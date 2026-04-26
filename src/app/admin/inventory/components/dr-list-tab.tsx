import { useState } from "react";
import { DeliveryReceipt, Shipment } from "@/lib/types/database";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit2, Trash2 } from "lucide-react";
import { createDeliveryReceipt, updateDeliveryReceipt, deleteDeliveryReceipt } from "@/lib/actions/admin-actions";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function DrListTab({ deliveryReceipts, shipments, loading, onReload }: { deliveryReceipts: DeliveryReceipt[], shipments: Shipment[], loading: boolean, onReload: () => void }) {
    const [searchQuery, setSearchQuery] = useState("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingDr, setEditingDr] = useState<DeliveryReceipt | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state
    const [drNumber, setDrNumber] = useState("");
    const [shipmentId, setShipmentId] = useState("");
    const [clientName, setClientName] = useState("");
    const [poNumber, setPoNumber] = useState("");
    const [jb, setJb] = useState(0);
    const [sb, setSb] = useState(0);
    const [driver, setDriver] = useState("");
    const [plateNumber, setPlateNumber] = useState("");
    const [shippingFee, setShippingFee] = useState(0);

    const openCreate = () => {
        setEditingDr(null);
        setDrNumber(""); setShipmentId(""); setClientName(""); setPoNumber("");
        setJb(0); setSb(0); setDriver(""); setPlateNumber(""); setShippingFee(0);
        setIsDialogOpen(true);
    };

    const openEdit = (dr: DeliveryReceipt) => {
        setEditingDr(dr);
        setDrNumber(dr.dr_number); setShipmentId(dr.shipment_id); setClientName(dr.client_name || ""); setPoNumber(dr.po_number || "");
        setJb(dr.jb); setSb(dr.sb); setDriver(dr.driver || ""); setPlateNumber(dr.plate_number || ""); setShippingFee(dr.shipping_fee || 0);
        setIsDialogOpen(true);
    };

    const handleSubmit = async () => {
        if (!drNumber || !shipmentId) return toast.error("DR Number and Shipment Batch are required");
        setIsSubmitting(true);
        try {
            if (editingDr) {
                await updateDeliveryReceipt(editingDr.id, { 
                    dr_number: drNumber, shipment_id: shipmentId, client_name: clientName, 
                    po_number: poNumber, jb, sb, driver, plate_number: plateNumber, shipping_fee: shippingFee 
                });
                toast.success("DR updated");
            } else {
                await createDeliveryReceipt({ 
                    dr_number: drNumber, shipment_id: shipmentId, client_name: clientName, 
                    po_number: poNumber, jb, sb, driver, plate_number: plateNumber, shipping_fee: shippingFee 
                });
                toast.success("DR created and ledger updated");
            }
            setIsDialogOpen(false);
            onReload();
        } catch (e: any) {
            toast.error(e.message || "Failed to save DR");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this DR record?")) return;
        try {
            await deleteDeliveryReceipt(id);
            toast.success("DR deleted");
            onReload();
        } catch (e: any) {
            toast.error("Failed to delete");
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
                <div className="flex justify-between items-center">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input type="search" placeholder="Search DR, PO, or Client..." className="pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>
                    <Button onClick={openCreate} className="bg-[var(--color-industrial-blue)]"><Plus className="w-4 h-4 mr-2" /> Add DR</Button>
                </div>

                <div className="border rounded-lg overflow-hidden">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>DR #</TableHead>
                                <TableHead>Batch</TableHead>
                                <TableHead>Client / PO</TableHead>
                                <TableHead>Driver Info</TableHead>
                                <TableHead>Quantities</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.length === 0 ? (
                                <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No delivery receipts found.</TableCell></TableRow>
                            ) : filtered.map(dr => (
                                <TableRow key={dr.id}>
                                    <TableCell className="text-sm">{new Date(dr.received_date).toLocaleDateString()}</TableCell>
                                    <TableCell className="font-semibold text-sm">{dr.dr_number}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate" title={(dr as any).shipment?.batch_name}>
                                        {(dr as any).shipment?.batch_name || "—"}
                                    </TableCell>
                                    <TableCell>
                                        <p className="text-sm">{dr.client_name || "—"}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">{dr.po_number ? `PO: ${dr.po_number}` : ""}</p>
                                    </TableCell>
                                    <TableCell>
                                        <p className="text-sm">{dr.driver || "—"}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">{dr.plate_number || ""}</p>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex gap-2">
                                            <Badge variant="outline" className="text-xs">{dr.jb} JB</Badge>
                                            <Badge variant="outline" className="text-xs">{dr.sb} SB</Badge>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => openEdit(dr)} className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"><Edit2 className="w-4 h-4" /></Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(dr.id)} className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"><Trash2 className="w-4 h-4" /></Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editingDr ? "Edit Delivery Receipt" : "Add Delivery Receipt"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto px-1">
                        <div className="space-y-2">
                            <Label>DR Number <span className="text-red-500">*</span></Label>
                            <Input value={drNumber} onChange={e => setDrNumber(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Source Shipment Batch <span className="text-red-500">*</span></Label>
                            <Select value={shipmentId} onValueChange={setShipmentId} disabled={!!editingDr}>
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
                                <Label>PO Number</Label>
                                <Input value={poNumber} onChange={e => setPoNumber(e.target.value)} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>JB Bags</Label>
                                <Input type="number" min="0" value={jb} onChange={e => setJb(parseInt(e.target.value) || 0)} />
                            </div>
                            <div className="space-y-2">
                                <Label>SB Bags</Label>
                                <Input type="number" min="0" value={sb} onChange={e => setSb(parseInt(e.target.value) || 0)} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Driver</Label>
                                <Input value={driver} onChange={e => setDriver(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Plate Number</Label>
                                <Input value={plateNumber} onChange={e => setPlateNumber(e.target.value)} />
                            </div>
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
        </Card>
    );
}
