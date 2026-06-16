"use client";

import { useState } from "react";
import { DeliveryReceipt, Shipment } from "@/lib/types/database";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit2, UploadCloud, CheckCircle2, X, FileImage, AlertTriangle, Truck, Layers, Coins } from "lucide-react";
import { createDeliveryReceipt, updateDeliveryReceipt } from "@/lib/actions/admin-actions";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, Eye, LayoutGrid, List, Package } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PurchaseOrder } from "@/lib/types/database";

export function DrListTab({ 
    deliveryReceipts, 
    shipments, 
    purchaseOrders, 
    loading, 
    onReload 
}: { 
    deliveryReceipts: DeliveryReceipt[], 
    shipments: Shipment[], 
    purchaseOrders: PurchaseOrder[], 
    loading: boolean, 
    onReload: () => void 
}) {
    const [viewMode, setViewMode] = useState<"list" | "grid">("list");
    const [isViewOpen, setIsViewOpen] = useState(false);
    const [drDateFrom, setDrDateFrom] = useState("");
    const [drDateTo, setDrDateTo] = useState("");
    const [viewingDr, setViewingDr] = useState<DeliveryReceipt | null>(null);
    const [poSearch, setPoSearch] = useState("");
    const [isPoOpen, setIsPoOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingDr, setEditingDr] = useState<DeliveryReceipt | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state
    const [drNumber, setDrNumber] = useState("");
    const [shipmentId, setShipmentId] = useState("");
    const [clientName, setClientName] = useState("");
    const [poNumber, setPoNumber] = useState("");
    const [jbQty, setJbQty] = useState(0);
    const [sbQty, setSbQty] = useState(0);
    const [driver, setDriver] = useState("");
    const [plateNumber, setPlateNumber] = useState("");
    const [destination, setDestination] = useState("");
    const [shippingFee, setShippingFee] = useState(0);
    const [photoFile, setPhotoFile] = useState<File | null>(null);

    const openCreate = () => {
        setEditingDr(null);
        setDrNumber(""); setShipmentId(""); setClientName(""); setPoNumber("");
        setJbQty(0); setSbQty(0); setDriver(""); setPlateNumber(""); setDestination("");
        setShippingFee(0); setPhotoFile(null);
        setIsDialogOpen(true);
    };

    const openEdit = (dr: DeliveryReceipt) => {
        setEditingDr(dr);
        setDrNumber(dr.dr_number); setShipmentId(dr.shipment_id); setClientName(dr.client_name || ""); setPoNumber(dr.po_number || "");
        setJbQty(dr.jb || 0);
        setSbQty(dr.sb || 0);
        setDriver(dr.driver || ""); setPlateNumber(dr.plate_number || "");
        setDestination(dr.destination || ""); setShippingFee(dr.shipping_fee || 0);
        setPhotoFile(null);
        setIsDialogOpen(true);
    };

    const handleSubmit = async () => {
        if (!drNumber || !shipmentId || !poNumber) return toast.error("DR Number, PO# Link, and Shipment Batch are required");
        setIsSubmitting(true);
        try {
            let drImageUrl: string | undefined = editingDr?.dr_image_url ?? undefined;
            if (photoFile) {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error("Not authenticated");
                const ext = photoFile.name.split(".").pop();
                const fileName = `${user.id}/dr_${drNumber.replace(/\//g, "-")}_${Date.now()}.${ext}`;
                const { error: uploadError } = await supabase.storage
                    .from("order-attachments")
                    .upload(fileName, photoFile, { upsert: true, contentType: photoFile.type });
                if (uploadError) throw new Error(`Failed to upload DR image: ${uploadError.message}`);
                const { data: { publicUrl } } = supabase.storage
                    .from("order-attachments")
                    .getPublicUrl(fileName);
                drImageUrl = publicUrl;
            }

            if (editingDr) {
                await updateDeliveryReceipt(editingDr.id, {
                    dr_number: drNumber, shipment_id: shipmentId, client_name: clientName,
                    po_number: poNumber, jb: jbQty, sb: sbQty, driver, plate_number: plateNumber,
                    shipping_fee: shippingFee, destination: destination || null,
                    ...(drImageUrl ? { dr_image_url: drImageUrl } : {}),
                });
                toast.success("DR updated");
            } else {
                await createDeliveryReceipt({
                    dr_number: drNumber, shipment_id: shipmentId, client_name: clientName,
                    po_number: poNumber, jb: jbQty, sb: sbQty, driver, plate_number: plateNumber,
                    shipping_fee: shippingFee, destination: destination || undefined,
                    ...(drImageUrl ? { dr_image_url: drImageUrl } : {}),
                });
                toast.success("DR created and ledger updated");
            }
            setIsDialogOpen(false);
            setPhotoFile(null);
            onReload();
        } catch (e: any) {
            toast.error(e.message || "Failed to save DR");
        } finally {
            setIsSubmitting(false);
        }
    };

    const filtered = deliveryReceipts.filter(dr => {
        const matchSearch = dr.dr_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (dr.client_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (dr.po_number || "").toLowerCase().includes(searchQuery.toLowerCase());
        const matchDateFrom = !drDateFrom || dr.received_date >= drDateFrom;
        const matchDateTo = !drDateTo || dr.received_date <= drDateTo;
        return matchSearch && matchDateFrom && matchDateTo;
    });

    // ── REAL-TIME DR LOGISTICS ACCUMULATOR SUMMARY ──
    const drMetrics = filtered.reduce(
        (acc, dr) => {
            acc.totalDeliveredBags += (dr.jb || 0) + (dr.sb || 0);
            acc.totalLogisticsOutflow += Number(dr.shipping_fee) || 0;
            return acc;
        },
        { totalDeliveredBags: 0, totalLogisticsOutflow: 0 }
    );

    if (loading) return <div className="py-8 text-center text-muted-foreground animate-pulse">Loading DR list...</div>;

    return (
        <div className="space-y-6">
            {/* ── DR LOGISTICS ANALYTICS SUMMARY CARDS ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border border-border shadow-sm bg-card rounded-2xl overflow-hidden relative">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
                    <CardContent className="p-5 flex items-center justify-between">
                        <div className="space-y-1.5">
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Total Delivered Cement</span>
                            <div className="text-2xl font-extrabold text-foreground tracking-tight">
                                {drMetrics.totalDeliveredBags.toLocaleString()} <span className="text-sm font-medium text-muted-foreground">bags</span>
                            </div>
                            <span className="text-[11px] text-muted-foreground block font-medium">Cement volume cleared and received by clients</span>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shadow-sm">
                            <Truck className="w-6 h-6 text-emerald-500" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border border-border shadow-sm bg-card rounded-2xl overflow-hidden relative">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500" />
                    <CardContent className="p-5 flex items-center justify-between">
                        <div className="space-y-1.5">
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Total Receipts Logged</span>
                            <div className="text-2xl font-extrabold text-blue-500 tracking-tight">
                                {filtered.length} <span className="text-sm font-medium text-muted-foreground">receipts</span>
                            </div>
                            <span className="text-[11px] text-muted-foreground block font-medium">Official delivery parameters recorded</span>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center shadow-sm">
                            <Layers className="w-6 h-6 text-blue-500" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border border-border shadow-sm bg-card rounded-2xl overflow-hidden relative">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-orange-500" />
                    <CardContent className="p-5 flex items-center justify-between">
                        <div className="space-y-1.5">
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Total Shipping Fees</span>
                            <div className="text-2xl font-extrabold text-foreground tracking-tight">
                                ₱{drMetrics.totalLogisticsOutflow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <span className="text-[11px] text-muted-foreground block font-medium">Accumulated vehicle transport clearing costs</span>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center shadow-sm">
                            <Coins className="w-6 h-6 text-orange-500" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardContent className="p-4 space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div className="relative w-full max-w-sm">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input type="search" placeholder="Search DR, PO, or Client..." className="pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <div className="flex items-center border rounded-md p-1 bg-muted/30">
                                <Button 
                                    variant={viewMode === "list" ? "secondary" : "ghost"} 
                                    size="sm" 
                                    className="h-7 w-7 p-0"
                                    onClick={() => setViewMode("list")}
                                    title="List View"
                                >
                                    <List className="h-4 w-4" />
                                </Button>
                                <Button 
                                    variant={viewMode === "grid" ? "secondary" : "ghost"} 
                                    size="sm" 
                                    className="h-7 w-7 p-0"
                                    onClick={() => setViewMode("grid")}
                                    title="Grid View"
                                >
                                    <LayoutGrid className="h-4 w-4" />
                                </Button>
                            </div>
                            <Button onClick={openCreate} className="bg-primary shrink-0 h-9">
                                <Plus className="w-4 h-4 mr-2" /> Add Manual DR
                            </Button>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Input type="date" value={drDateFrom} onChange={e => setDrDateFrom(e.target.value)} className="h-8 w-[130px] text-xs" placeholder="From" />
                        <span className="text-xs text-muted-foreground">—</span>
                        <Input type="date" value={drDateTo} onChange={e => setDrDateTo(e.target.value)} className="h-8 w-[130px] text-xs" placeholder="To" />
                        {(drDateFrom || drDateTo) && (
                            <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={() => { setDrDateFrom(""); setDrDateTo(""); }}>
                                <X className="w-3 h-3 mr-1" /> Clear
                            </Button>
                        )}
                    </div>

                    {viewMode === "list" ? (
                        <div className="border rounded-lg overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead className="text-xs">Image</TableHead>
                                        <TableHead className="text-xs">Date</TableHead>
                                        <TableHead className="text-xs">DR #</TableHead>
                                        <TableHead className="text-xs">Client Name</TableHead>
                                        <TableHead className="text-xs">PO# Link</TableHead>
                                        <TableHead className="text-xs">Order</TableHead>
                                        <TableHead className="text-xs">Driver Name</TableHead>
                                        <TableHead className="text-xs">Plate #</TableHead>
                                        <TableHead className="text-xs text-right">Total Bags</TableHead>
                                        <TableHead className="text-right text-xs w-[100px]">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.length === 0 ? (
                                        <TableRow><TableCell colSpan={10} className="text-center py-6 text-xs text-muted-foreground">No delivery receipts found.</TableCell></TableRow>
                                    ) : filtered.map(dr => (
                                        <TableRow key={dr.id} className={dr.order_id ? "bg-primary/5" : ""}>
                                            <TableCell>
                                                <div className="w-10 h-10 rounded bg-muted flex items-center justify-center overflow-hidden border border-border">
                                                    {dr.dr_image_url ? (
                                                        <OptimizedImage 
                                                            src={dr.dr_image_url} 
                                                            alt="DR" 
                                                            fill 
                                                            className="object-cover" 
                                                            unoptimized 
                                                            containerClassName="w-full h-full"
                                                        />
                                                    ) : (
                                                        <FileImage className="w-5 h-5 text-muted-foreground/40" />
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-xs whitespace-nowrap">{new Date(dr.received_date).toLocaleDateString()}</TableCell>
                                            <TableCell>
                                                <span className="font-semibold text-xs">{dr.dr_number}</span>
                                                {dr.order_id && (
                                                    <Badge variant="outline" className="ml-2 text-[9px] border-primary/20 text-primary bg-primary/5">AUTO</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-xs font-medium">{dr.client_name || "—"}</TableCell>
                                            <TableCell>
                                                {dr.po_number ? (
                                                    <Badge variant="outline" className="text-[11px] font-mono cursor-default">{dr.po_number}</Badge>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-xs">
                                                {dr.order ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <Badge variant="outline" className="text-[9px] capitalize bg-primary/5 border-primary/20">{dr.order.status}</Badge>
                                                        <span className="text-[9px] text-muted-foreground font-mono">{dr.order.id.slice(0, 8)}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-xs">{dr.driver || "—"}</TableCell>
                                            <TableCell className="text-xs font-mono">{dr.plate_number || "—"}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <span className="text-xs font-bold text-foreground">{(dr.jb || 0) + (dr.sb || 0)}</span>
                                                    <Badge variant="outline" className="text-[9px] font-mono px-1 h-4">{dr.jb > 0 ? "JB" : "SB"}</Badge>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right whitespace-nowrap">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    onClick={() => { setViewingDr(dr); setIsViewOpen(true); }}
                                                    className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 mr-1"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => openEdit(dr)} className="h-7 w-7 text-primary hover:text-primary/90 hover:bg-primary/10"><Edit2 className="w-3.5 h-3.5" /></Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filtered.length === 0 ? (
                                <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed rounded-xl text-xs">
                                    No delivery receipts found matching your search.
                                </div>
                            ) : (
                                filtered.map(dr => (
                                    <Card key={dr.id} className={`overflow-hidden group hover:shadow-md transition-shadow border-border ${dr.order_id ? "border-primary/10 bg-primary/5" : ""}`}>
                                        <div className="aspect-video bg-muted relative overflow-hidden border-b">
                                            {dr.dr_image_url ? (
                                                <OptimizedImage 
                                                    src={dr.dr_image_url} 
                                                    alt="DR" 
                                                    fill 
                                                    className="object-cover group-hover:scale-105 transition-transform duration-500" 
                                                    unoptimized 
                                                    containerClassName="h-full w-full"
                                                />
                                            ) : (
                                                <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/30">
                                                    <FileImage className="w-12 h-12 mb-2" />
                                                    <span className="text-[10px] uppercase font-bold tracking-widest">No Document Preview</span>
                                                </div>
                                            )}
                                            <div className="absolute top-2 right-2 flex gap-1">
                                                {dr.order_id && <Badge className="bg-primary text-primary-foreground border-none text-[9px]">AUTO</Badge>}
                                                <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm text-foreground text-[10px] font-mono border-none font-semibold">{new Date(dr.received_date).toLocaleDateString()}</Badge>
                                            </div>
                                        </div>
                                        <CardContent className="p-3 space-y-3">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h4 className="font-bold text-sm text-foreground">{dr.dr_number}</h4>
                                                    <p className="text-xs text-muted-foreground truncate max-w-[150px] font-medium">{dr.client_name || "Unknown Client"}</p>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[9px] uppercase font-bold text-muted-foreground mb-0.5">PO Link</div>
                                                    <Badge variant="outline" className="text-[10px] font-mono h-5">{dr.po_number || "NONE"}</Badge>
                                                </div>
                                            </div>

                                            {dr.order && (
                                                <div className="flex items-center justify-between text-[10px] py-0.5 border-t border-dashed">
                                                    <span className="text-muted-foreground uppercase font-bold">Order</span>
                                                    <div className="flex items-center gap-1">
                                                        <Badge variant="outline" className="text-[9px] capitalize bg-primary/5 border-primary/20">{dr.order.status}</Badge>
                                                        <span className="text-muted-foreground font-mono">{dr.order.id.slice(0, 8)}</span>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="grid grid-cols-2 gap-2 py-2 border-y border-border">
                                                <div>
                                                    <div className="text-[9px] uppercase font-bold text-muted-foreground mb-1">Driver / Plate</div>
                                                    <p className="text-[11px] font-medium truncate text-foreground">{dr.driver || "—"} • {dr.plate_number || "—"}</p>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[9px] uppercase font-bold text-muted-foreground mb-1">Quantity</div>
                                                    <p className="text-[11px] font-bold text-foreground">{(dr.jb || 0) + (dr.sb || 0)} {dr.jb > 0 ? "JB" : "SB"}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between pt-1">
                                                <Button 
                                                    variant="secondary" 
                                                    size="sm" 
                                                    className="h-8 text-[11px] font-bold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                                                    onClick={() => { setViewingDr(dr); setIsViewOpen(true); }}
                                                >
                                                    <Eye className="w-3.5 h-3.5" /> View Details
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => openEdit(dr)} className="h-8 w-8 text-primary hover:text-primary/90 hover:bg-primary/10"><Edit2 className="w-3.5 h-3.5" /></Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* View Details Dialog */}
            <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
                <DialogContent showCloseButton={false} className="sm:max-w-2xl p-0 overflow-hidden rounded-xl border-none max-h-[90vh] overflow-y-auto shadow-xl">
                    <div className="bg-primary p-6 text-primary-foreground">
                        <div className="flex justify-between items-start">
                            <div>
                                <Badge className="bg-white/20 hover:bg-white/30 text-white border-none mb-2 text-[10px]">Delivery Receipt Details</Badge>
                                <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                                    {viewingDr?.dr_number}
                                    {viewingDr?.order_id && <Badge className="bg-amber-400 text-amber-950 border-none text-[9px] font-black uppercase">Automated</Badge>}
                                </h2>
                                <p className="text-primary-foreground/70 text-sm mt-1">Received on {viewingDr && new Date(viewingDr.received_date).toLocaleDateString(undefined, { dateStyle: 'full' })}</p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setIsViewOpen(false)} className="text-white hover:bg-white/10 rounded-full h-8 w-8">
                                <X className="w-5 h-5" />
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase font-black text-muted-foreground/60 tracking-wider">Client Name</p>
                                    <p className="font-bold text-foreground text-sm">{viewingDr?.client_name || "N/A"}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase font-black text-muted-foreground/60 tracking-wider">PO Number Link</p>
                                    <p className="font-mono text-primary font-bold text-sm">{viewingDr?.po_number || "NONE"}</p>
                                </div>
                            </div>

                            <div className="p-4 bg-muted/30 rounded-lg border border-border space-y-3">
                                <p className="text-[10px] uppercase font-black text-muted-foreground/60 tracking-wider">Shipment Volume Metrics</p>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="flex items-center gap-2 font-medium text-muted-foreground"><Package className="w-4 h-4" /> Quantity</span>
                                    <span className="font-black text-foreground">{((viewingDr?.jb || 0) + (viewingDr?.sb || 0)).toLocaleString()} units</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="flex items-center gap-2 font-medium text-muted-foreground"><Package className="w-4 h-4" /> Configuration</span>
                                    <span className="font-black text-foreground">{(viewingDr?.jb ?? 0) > 0 ? "Jumbo Bag (JB)" : "Sling Bag (SB)"}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase font-black text-muted-foreground/60 tracking-wider">Driver / Plate</p>
                                    <p className="text-sm font-bold text-foreground">{viewingDr?.driver || "—"} / {viewingDr?.plate_number || "—"}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase font-black text-muted-foreground/60 tracking-wider">Shipping Fee</p>
                                    <p className="text-sm font-bold text-emerald-600">₱{viewingDr?.shipping_fee?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || "0.00"}</p>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <p className="text-[10px] uppercase font-black text-muted-foreground/60 tracking-wider">Destination Address</p>
                                <p className="text-sm font-medium text-foreground leading-relaxed italic border-l-2 border-accent pl-3 bg-muted/20 py-2 rounded-r-md">
                                    {viewingDr?.destination || "No destination specified."}
                                </p>
                            </div>
                        </div>

                        <div className="bg-muted flex items-center justify-center relative min-h-[300px] md:border-l border-t md:border-t-0">
                            {viewingDr?.dr_image_url ? (
                                <>
                                    <OptimizedImage 
                                        src={viewingDr.dr_image_url} 
                                        alt="DR Document" 
                                        fill 
                                        className="object-contain p-2"
                                        unoptimized
                                        containerClassName="h-full w-full"
                                    />
                                    <a 
                                        href={viewingDr.dr_image_url} 
                                        target="_blank" 
                                        rel="noreferrer" 
                                        className="absolute bottom-4 right-4 bg-background/90 hover:bg-background backdrop-blur-sm text-foreground px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-lg transition-colors flex items-center gap-1.5"
                                    >
                                        <FileImage className="w-3.5 h-3.5" /> Full Resolution
                                    </a>
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center text-muted-foreground/40 text-center p-8">
                                    <FileImage className="w-16 h-16 mb-4" />
                                    <p className="text-xs font-bold uppercase tracking-widest">No Document Uploaded</p>
                                    <p className="text-[10px] mt-2 text-muted-foreground/80">Manual entries without attachments do not show preview images.</p>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="p-4 bg-muted/20 border-t flex justify-end">
                        <Button variant="outline" onClick={() => setIsViewOpen(false)} className="rounded-lg font-bold text-xs uppercase tracking-widest">Close Record</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Create / Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setPhotoFile(null); }}>
                <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingDr ? "Edit Delivery Receipt" : "Add Manual Delivery Receipt"}</DialogTitle>
                        <DialogDescription>
                            {editingDr ? "Update the details of this delivery receipt." : "Create a manual DR entry for walk-in or offline transactions."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="dr-number">DR Number <span className="text-red-500">*</span></Label>
                            <Input id="dr-number" value={drNumber} onChange={e => setDrNumber(e.target.value)} placeholder="e.g. DR-2026-001" />
                        </div>
                        <div className="space-y-2">
                            <Label>Source Shipment Batch <span className="text-red-500">*</span></Label>
                            <Select value={shipmentId} onValueChange={(v) => setShipmentId(v || "")} disabled={!!editingDr}>
                                <SelectTrigger><SelectValue placeholder="Select batch" /></SelectTrigger>
                                <SelectContent>
                                    {shipments.map(s => (
                                        <SelectItem key={s.id} value={s.id}>{s.batch_name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {!editingDr && <p className="text-xs text-muted-foreground">Adding a DR will automatically append an outflow row entry to this specific batch ledger.</p>}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="dr-client">Client Name</Label>
                                <Input id="dr-client" value={clientName} onChange={e => setClientName(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>PO# Link <span className="text-red-500">*</span></Label>
                                <Popover open={isPoOpen} onOpenChange={setIsPoOpen}>
                                    <PopoverTrigger render={
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={isPoOpen}
                                            className="w-full justify-between font-normal"
                                        >
                                            {poNumber || "Select PO Number..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    } />
                                    <PopoverContent className="w-[200px] p-0" align="start">
                                        <div className="flex flex-col">
                                            <div className="p-2 border-b">
                                                <Input 
                                                    placeholder="Search PO..." 
                                                    className="h-8"
                                                    value={poSearch}
                                                    onChange={(e) => setPoSearch(e.target.value)}
                                                />
                                            </div>
                                            <div className="max-h-[200px] overflow-y-auto p-1">
                                                {purchaseOrders
                                                    .filter(po => po.po_number.toLowerCase().includes(poSearch.toLowerCase()))
                                                    .map(po => (
                                                        <div
                                                            key={po.id}
                                                            className="flex items-center justify-between px-2 py-1.5 text-sm rounded-sm hover:bg-accent cursor-pointer"
                                                            onClick={() => {
                                                                setPoNumber(po.po_number);
                                                                setClientName(po.client_name || "");
                                                                setIsPoOpen(false);
                                                                setPoSearch("");
                                                            }}
                                                        >
                                                            <div className="flex flex-col">
                                                                <span>{po.po_number}</span>
                                                                <span className="text-[10px] text-muted-foreground">{po.client_name}</span>
                                                            </div>
                                                            {poNumber === po.po_number && <Check className="h-4 w-4" />}
                                                        </div>
                                                    ))}
                                                {purchaseOrders.filter(po => po.po_number.toLowerCase().includes(poSearch.toLowerCase())).length === 0 && (
                                                    <div className="p-2 text-xs text-center text-muted-foreground">No PO found</div>
                                                )}
                                                
                                                {poSearch && !purchaseOrders.some(po => po.po_number === poSearch) && (
                                                    <div
                                                        className="mt-1 p-2 text-xs border-t cursor-pointer hover:bg-accent text-blue-600 font-medium"
                                                        onClick={() => {
                                                            setPoNumber(poSearch);
                                                            setIsPoOpen(false);
                                                            setPoSearch("");
                                                        }}
                                                    >
                                                        Use manual: "{poSearch}"
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                                {!editingDr && <p className="text-[10px] text-emerald-600 leading-tight">Linking a verified PO automates shipping cross-referencing values.</p>}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="dr-jb-quantity">Quantity JB (Jumbo Bag)</Label>
                                <Input 
                                    id="dr-jb-quantity"
                                    type="number" 
                                    min="0" 
                                    value={jbQty || ""} 
                                    placeholder="0" 
                                    onChange={e => setJbQty(parseInt(e.target.value) || 0)} 
                                    className="font-bold"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="dr-sb-quantity">Quantity SB (Sling Bag)</Label>
                                <Input 
                                    id="dr-sb-quantity"
                                    type="number" 
                                    min="0" 
                                    value={sbQty || ""} 
                                    placeholder="0" 
                                    onChange={e => setSbQty(parseInt(e.target.value) || 0)} 
                                    className="font-bold"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="dr-driver">Driver Name</Label>
                                <Input id="dr-driver" value={driver} onChange={e => setDriver(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="dr-plate">Plate Number</Label>
                                <Input id="dr-plate" value={plateNumber} onChange={e => setPlateNumber(e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="dr-destination">Destination</Label>
                            <Input id="dr-destination" value={destination} onChange={e => setDestination(e.target.value)} placeholder="Delivery address or location" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="dr-shipping-fee">Shipping Fee (₱)</Label>
                            <Input id="dr-shipping-fee" type="number" min="0" value={shippingFee || ""} placeholder="0" onChange={e => setShippingFee(parseFloat(e.target.value) || 0)} />
                        </div>

                        {/* Photo Upload */}
                        <div className="space-y-2">
                            <Label>
                                DR Photo <span className="text-muted-foreground text-xs">(optional)</span>
                            </Label>
                            {editingDr?.dr_image_url && !photoFile && (
                                <div className="flex items-center gap-2 text-xs text-primary">
                                    <FileImage className="w-3.5 h-3.5" />
                                    <a href={editingDr.dr_image_url} target="_blank" rel="noreferrer" className="hover:underline">
                                        View current photo
                                    </a>
                                    <span className="text-muted-foreground">— upload a new one to replace</span>
                                </div>
                            )}
                            {photoFile ? (
                                <div className="flex items-center gap-3 p-3 border border-emerald-200 bg-emerald-50 rounded-lg">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                    <span className="text-sm text-emerald-800 flex-1 truncate">{photoFile.name}</span>
                                    <button type="button" onClick={() => setPhotoFile(null)} className="text-emerald-700 hover:text-red-600">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <div
                                    className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                                    onClick={() => document.getElementById("dr-photo-upload")?.click()}
                                >
                                    <UploadCloud className="w-6 h-6 mx-auto mb-1 text-muted-foreground" />
                                    <p className="text-xs text-muted-foreground">Click to attach DR photo</p>
                                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">JPG, PNG, PDF</p>
                                    <input
                                        id="dr-photo-upload"
                                        type="file"
                                        className="hidden"
                                        accept="image/*,.pdf"
                                        onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
                        <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-primary">
                            {isSubmitting ? "Saving..." : "Save DR"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}