import { useState } from "react";
import { DeliveryReceipt, Shipment } from "@/lib/types/database";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit2, Trash2, UploadCloud, CheckCircle2, X, FileImage, AlertTriangle } from "lucide-react";
import { createDeliveryReceipt, updateDeliveryReceipt, deleteDeliveryReceipt } from "@/lib/actions/admin-actions";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
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
    const [poSearch, setPoSearch] = useState("");
    const [isPoOpen, setIsPoOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingDr, setEditingDr] = useState<DeliveryReceipt | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<DeliveryReceipt | null>(null);

    // Form state
    const [drNumber, setDrNumber] = useState("");
    const [shipmentId, setShipmentId] = useState("");
    const [clientName, setClientName] = useState("");
    const [poNumber, setPoNumber] = useState("");
    const [jb, setJb] = useState(0);
    const [sb, setSb] = useState(0);
    const [driver, setDriver] = useState("");
    const [plateNumber, setPlateNumber] = useState("");
    const [destination, setDestination] = useState("");
    const [shippingFee, setShippingFee] = useState(0);
    const [photoFile, setPhotoFile] = useState<File | null>(null);

    const openCreate = () => {
        setEditingDr(null);
        setDrNumber(""); setShipmentId(""); setClientName(""); setPoNumber("");
        setJb(0); setSb(0); setDriver(""); setPlateNumber(""); setDestination("");
        setShippingFee(0); setPhotoFile(null);
        setIsDialogOpen(true);
    };

    const openEdit = (dr: DeliveryReceipt) => {
        setEditingDr(dr);
        setDrNumber(dr.dr_number); setShipmentId(dr.shipment_id); setClientName(dr.client_name || ""); setPoNumber(dr.po_number || "");
        setJb(dr.jb); setSb(dr.sb); setDriver(dr.driver || ""); setPlateNumber(dr.plate_number || "");
        setDestination(dr.destination || ""); setShippingFee(dr.shipping_fee || 0);
        setPhotoFile(null);
        setIsDialogOpen(true);
    };

    const handleSubmit = async () => {
        if (!drNumber || !shipmentId || !poNumber) return toast.error("DR Number, PO# Link, and Shipment Batch are required");
        setIsSubmitting(true);
        try {
            // Upload DR photo if provided
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
                    po_number: poNumber, jb, sb, driver, plate_number: plateNumber,
                    shipping_fee: shippingFee, destination: destination || null,
                    ...(drImageUrl ? { dr_image_url: drImageUrl } : {}),
                });
                toast.success("DR updated");
            } else {
                await createDeliveryReceipt({
                    dr_number: drNumber, shipment_id: shipmentId, client_name: clientName,
                    po_number: poNumber, jb, sb, driver, plate_number: plateNumber,
                    shipping_fee: shippingFee,
                    ...(drImageUrl ? { dr_image_url: drImageUrl } as any : {}),
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

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        try {
            await deleteDeliveryReceipt(deleteTarget.id);
            toast.success("DR deleted");
            onReload();
        } catch (e: any) {
            toast.error("Failed to delete");
        } finally {
            setDeleteTarget(null);
        }
    };

    const filtered = deliveryReceipts.filter(dr =>
        dr.dr_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (dr.client_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (dr.po_number || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) return <div className="py-8 text-center text-muted-foreground animate-pulse">Loading DR list...</div>;

    return (
        <Card>
            <CardContent className="p-4 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input type="search" placeholder="Search DR, PO, or Client..." className="pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>
                    <Button onClick={openCreate} className="bg-[var(--color-industrial-blue)] shrink-0"><Plus className="w-4 h-4 mr-2" /> Add Manual DR</Button>
                </div>

                <div className="border rounded-lg overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>DR #</TableHead>
                                <TableHead>Client Name</TableHead>
                                <TableHead>PO# Link</TableHead>
                                <TableHead>Driver Name</TableHead>
                                <TableHead>Plate #</TableHead>
                                <TableHead>Destination</TableHead>
                                <TableHead className="text-right">Total Bags</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.length === 0 ? (
                                <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">No delivery receipts found.</TableCell></TableRow>
                            ) : filtered.map(dr => (
                                <TableRow key={dr.id} className={dr.order_id ? "bg-blue-50/30 dark:bg-blue-950/10" : ""}>
                                    <TableCell className="text-sm whitespace-nowrap">{new Date(dr.received_date).toLocaleDateString()}</TableCell>
                                    <TableCell>
                                        <span className="font-semibold text-sm">{dr.dr_number}</span>
                                        {dr.order_id && (
                                            <Badge variant="outline" className="ml-2 text-[9px] border-blue-200 text-blue-600 bg-blue-50">AUTO</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-sm">{dr.client_name || "—"}</TableCell>
                                    <TableCell>
                                        {dr.po_number ? (
                                            <Badge variant="outline" className="text-xs font-mono cursor-default">{dr.po_number}</Badge>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-sm">{dr.driver || "—"}</TableCell>
                                    <TableCell className="text-sm">{dr.plate_number || "—"}</TableCell>
                                    <TableCell className="text-sm max-w-[160px] truncate" title={dr.destination || ""}>
                                        {dr.destination || "—"}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <Badge variant="outline" className="text-xs">{dr.jb} JB</Badge>
                                            <Badge variant="outline" className="text-xs">{dr.sb} SB</Badge>
                                            <span className="text-xs font-bold text-foreground ml-1">= {dr.jb + dr.sb}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right whitespace-nowrap">
                                        {dr.dr_image_url && (
                                            <a href={dr.dr_image_url} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md">
                                                <FileImage className="w-4 h-4" />
                                            </a>
                                        )}
                                        <Button variant="ghost" size="icon" onClick={() => openEdit(dr)} className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"><Edit2 className="w-4 h-4" /></Button>
                                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(dr)} className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"><Trash2 className="w-4 h-4" /></Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>

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
                            <Label>DR Number <span className="text-red-500">*</span></Label>
                            <Input value={drNumber} onChange={e => setDrNumber(e.target.value)} placeholder="e.g. DR-2026-001" />
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
                            {!editingDr && <p className="text-xs text-muted-foreground">Adding a DR will automatically add a ledger entry to this batch.</p>}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Client Name</Label>
                                <Input value={clientName} onChange={e => setClientName(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>PO# Link <span className="text-red-500">*</span></Label>
                                <Popover open={isPoOpen} onOpenChange={setIsPoOpen}>
                                    <PopoverTrigger 
                                        render={
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={isPoOpen}
                                                className="w-full justify-between font-normal"
                                            >
                                                {poNumber || "Select PO Number..."}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        }
                                    />
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
                                                
                                                {/* Allow manual entry if not found */}
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
                                {!editingDr && <p className="text-[10px] text-emerald-600 leading-tight">Linking a PO automatically syncs its payment data into the Shipment Ledger.</p>}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>JB Bags</Label>
                                <Input type="number" min="0" value={jb || ""} placeholder="0" onChange={e => setJb(parseInt(e.target.value) || 0)} />
                            </div>
                            <div className="space-y-2">
                                <Label>SB Bags</Label>
                                <Input type="number" min="0" value={sb || ""} placeholder="0" onChange={e => setSb(parseInt(e.target.value) || 0)} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Driver Name</Label>
                                <Input value={driver} onChange={e => setDriver(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Plate Number</Label>
                                <Input value={plateNumber} onChange={e => setPlateNumber(e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Destination</Label>
                            <Input value={destination} onChange={e => setDestination(e.target.value)} placeholder="Delivery address or location" />
                        </div>
                        <div className="space-y-2">
                            <Label>Shipping Fee (₱)</Label>
                            <Input type="number" min="0" value={shippingFee || ""} placeholder="0" onChange={e => setShippingFee(parseFloat(e.target.value) || 0)} />
                        </div>

                        {/* Photo Upload */}
                        <div className="space-y-2">
                            <Label>
                                DR Photo <span className="text-muted-foreground text-xs">(optional)</span>
                            </Label>
                            {editingDr?.dr_image_url && !photoFile && (
                                <div className="flex items-center gap-2 text-xs text-blue-600">
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
                                    className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-[var(--color-industrial-blue)]/50 hover:bg-muted/30 transition-colors"
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
                        <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-[var(--color-industrial-blue)]">
                            {isSubmitting ? "Saving..." : "Save DR"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="w-5 h-5" /> Delete Delivery Receipt
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete <strong>{deleteTarget?.dr_number}</strong>?
                        </DialogDescription>
                    </DialogHeader>
                    {deleteTarget?.order_id && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                            <p className="font-semibold flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> System-generated record</p>
                            <p className="mt-1 text-xs text-amber-800">This DR was automatically created from a dispatched order. Deleting it will affect the Shipment Ledger and may cause data inconsistency.</p>
                        </div>
                    )}
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={confirmDelete}>
                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
