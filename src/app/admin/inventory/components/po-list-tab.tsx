import { useState } from "react";
import { PurchaseOrder } from "@/lib/types/database";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit2, Trash2, MapPin, Truck, UploadCloud, CheckCircle2, X, FileImage, AlertTriangle } from "lucide-react";
import { createPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder } from "@/lib/actions/admin-actions";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";

export function PoListTab({ purchaseOrders, loading, onReload }: { purchaseOrders: PurchaseOrder[], loading: boolean, onReload: () => void }) {
    const [searchQuery, setSearchQuery] = useState("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingPo, setEditingPo] = useState<PurchaseOrder | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<PurchaseOrder | null>(null);

    // Form state
    const [poNumber, setPoNumber] = useState("");
    const [clientName, setClientName] = useState("");
    const [jb, setJb] = useState(0);
    const [sb, setSb] = useState(0);
    const [source, setSource] = useState("warehouse");
    const [serviceType, setServiceType] = useState("pickup");
    const [checkNumber, setCheckNumber] = useState("");
    const [checkAmount, setCheckAmount] = useState(0);
    const [cashAmount, setCashAmount] = useState(0);
    const [photoFile, setPhotoFile] = useState<File | null>(null);

    const openCreate = () => {
        setEditingPo(null);
        setPoNumber(""); setClientName(""); setJb(0); setSb(0);
        setSource("warehouse"); setServiceType("pickup");
        setCheckNumber(""); setCheckAmount(0); setCashAmount(0);
        setPhotoFile(null);
        setIsDialogOpen(true);
    };

    const openEdit = (po: PurchaseOrder) => {
        setEditingPo(po);
        setPoNumber(po.po_number);
        setClientName(po.client_name || "");
        setJb(po.jb);
        setSb(po.sb);
        setSource(po.source || "warehouse");
        setServiceType(po.service_type || "pickup");
        setCheckNumber(po.check_number || "");
        setCheckAmount(po.check_amount || 0);
        setCashAmount(po.cash_amount || 0);
        setPhotoFile(null);
        setIsDialogOpen(true);
    };

    const handleSubmit = async () => {
        if (!poNumber) return toast.error("PO Number is required");
        setIsSubmitting(true);
        try {
            // Upload photo if provided
            let photoUrl: string | undefined;
            if (photoFile) {
                const supabase = createClient();
                const ext = photoFile.name.split(".").pop();
                const fileName = `po_${poNumber.replace(/\//g, "-")}_${Date.now()}.${ext}`;
                const { error: uploadError } = await supabase.storage
                    .from("po-documents")
                    .upload(fileName, photoFile, { upsert: true });
                if (!uploadError) {
                    const { data: { publicUrl } } = supabase.storage
                        .from("po-documents")
                        .getPublicUrl(fileName);
                    photoUrl = publicUrl;
                }
            }

            if (editingPo) {
                await updatePurchaseOrder(editingPo.id, {
                    po_number: poNumber, client_name: clientName, jb, sb,
                    source, service_type: serviceType,
                    check_number: checkNumber || null,
                    check_amount: checkAmount || null,
                    cash_amount: cashAmount || null,
                    ...(photoUrl ? { photo_url: photoUrl } : {}),
                });
                toast.success("PO updated");
            } else {
                await createPurchaseOrder({
                    po_number: poNumber, client_name: clientName, jb, sb,
                    source, service_type: serviceType,
                    ...(photoUrl ? { photo_url: photoUrl } as any : {}),
                });
                toast.success("PO created");
            }
            setIsDialogOpen(false);
            setPhotoFile(null);
            onReload();
        } catch (e: any) {
            toast.error(e.message || "Failed to save PO");
        } finally {
            setIsSubmitting(false);
        }
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        try {
            await deletePurchaseOrder(deleteTarget.id);
            toast.success("PO deleted");
            onReload();
        } catch (e: any) {
            toast.error("Failed to delete");
        } finally {
            setDeleteTarget(null);
        }
    };

    const filtered = purchaseOrders.filter(po =>
        po.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (po.client_name || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) return <div className="py-8 text-center text-muted-foreground animate-pulse">Loading PO list...</div>;

    return (
        <Card>
            <CardContent className="p-4 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input type="search" placeholder="Search PO or Client..." className="pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>
                    <Button onClick={openCreate} className="bg-[var(--color-industrial-blue)] shrink-0"><Plus className="w-4 h-4 mr-2" /> Add Manual PO</Button>
                </div>

                <div className="border rounded-lg overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>PO #</TableHead>
                                <TableHead>Client Name</TableHead>
                                <TableHead>Service</TableHead>
                                <TableHead className="text-right">JB Qty</TableHead>
                                <TableHead className="text-right">SB Qty</TableHead>
                                <TableHead>Check No.</TableHead>
                                <TableHead>Cash</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.length === 0 ? (
                                <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">No purchase orders found.</TableCell></TableRow>
                            ) : filtered.map(po => (
                                <TableRow key={po.id} className={po.order_id ? "bg-blue-50/30 dark:bg-blue-950/10" : ""}>
                                    <TableCell className="text-sm whitespace-nowrap">{new Date(po.date).toLocaleDateString()}</TableCell>
                                    <TableCell>
                                        <span className="font-semibold text-sm">{po.po_number}</span>
                                        {po.order_id && (
                                            <Badge variant="outline" className="ml-2 text-[9px] border-blue-200 text-blue-600 bg-blue-50">AUTO</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-sm">{po.client_name || "—"}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase font-bold whitespace-nowrap">
                                            {po.service_type === 'deliver' ? <Truck className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
                                            {po.service_type === 'deliver' ? 'Delivery' : 'Pick-up'}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right font-medium text-sm">{po.jb}</TableCell>
                                    <TableCell className="text-right font-medium text-sm">{po.sb}</TableCell>
                                    <TableCell className="text-sm">
                                        {po.check_number ? (
                                            <div>
                                                <span className="font-medium">{po.check_number}</span>
                                                {po.check_amount ? (
                                                    <p className="text-[10px] text-muted-foreground">₱{Number(po.check_amount).toLocaleString()}</p>
                                                ) : null}
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        {po.cash_amount ? (
                                            <span className="font-medium">₱{Number(po.cash_amount).toLocaleString()}</span>
                                        ) : (
                                            <span className="text-muted-foreground">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right whitespace-nowrap">
                                        <Button variant="ghost" size="icon" onClick={() => openEdit(po)} className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"><Edit2 className="w-4 h-4" /></Button>
                                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(po)} className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"><Trash2 className="w-4 h-4" /></Button>
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
                        <DialogTitle>{editingPo ? "Edit Purchase Order" : "Add Manual Purchase Order"}</DialogTitle>
                        <DialogDescription>
                            {editingPo ? "Update the details of this purchase order." : "Create a manual PO entry for walk-in or offline transactions."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>PO Number <span className="text-red-500">*</span></Label>
                            <Input value={poNumber} onChange={e => setPoNumber(e.target.value)} placeholder="e.g. PO-2026-001" />
                        </div>
                        <div className="space-y-2">
                            <Label>Client Name</Label>
                            <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Client or company name" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Service</Label>
                                <Select value={serviceType} onValueChange={(v) => setServiceType(v || "")}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pickup">Pick-up</SelectItem>
                                        <SelectItem value="deliver">Delivery</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Source</Label>
                                <Select value={source} onValueChange={(v) => setSource(v || "")}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="warehouse">Warehouse</SelectItem>
                                        <SelectItem value="port">Port</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>JB Qty</Label>
                                <Input type="number" min="0" value={jb || ""} placeholder="0" onChange={e => setJb(parseInt(e.target.value) || 0)} />
                            </div>
                            <div className="space-y-2">
                                <Label>SB Qty</Label>
                                <Input type="number" min="0" value={sb || ""} placeholder="0" onChange={e => setSb(parseInt(e.target.value) || 0)} />
                            </div>
                        </div>

                        <div className="border-t pt-4 space-y-3">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payment Details</p>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Check No.</Label>
                                    <Input value={checkNumber} onChange={e => setCheckNumber(e.target.value)} placeholder="Check number" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Check Amount (₱)</Label>
                                    <Input type="number" min="0" value={checkAmount || ""} placeholder="0" onChange={e => {
                                        const val = parseFloat(e.target.value) || 0;
                                        setCheckAmount(val);
                                        if (val > 0) setCashAmount(0);
                                    }} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Cash Amount (₱)</Label>
                                <Input type="number" min="0" value={cashAmount || ""} placeholder="0" onChange={e => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setCashAmount(val);
                                    if (val > 0) {
                                        setCheckAmount(0);
                                        setCheckNumber("");
                                    }
                                }} />
                            </div>
                        </div>

                        {/* Photo Upload */}
                        <div className="space-y-2">
                            <Label>PO Photo <span className="text-muted-foreground text-xs">(optional)</span></Label>
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
                                    onClick={() => document.getElementById("po-photo-upload")?.click()}
                                >
                                    <UploadCloud className="w-6 h-6 mx-auto mb-1 text-muted-foreground" />
                                    <p className="text-xs text-muted-foreground">Click to attach PO photo</p>
                                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">JPG, PNG, PDF</p>
                                    <input
                                        id="po-photo-upload"
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
                            {isSubmitting ? "Saving..." : "Save PO"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="w-5 h-5" /> Delete Purchase Order
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete <strong>{deleteTarget?.po_number}</strong>?
                        </DialogDescription>
                    </DialogHeader>
                    {deleteTarget?.order_id && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                            <p className="font-semibold flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> System-generated record</p>
                            <p className="mt-1 text-xs text-amber-800">This PO was automatically created from a dispatched order. Deleting it will affect the Shipment Ledger and may cause data inconsistency.</p>
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
