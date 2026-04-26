import { useState } from "react";
import { PurchaseOrder } from "@/lib/types/database";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit2, Trash2, MapPin, Truck } from "lucide-react";
import { createPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder } from "@/lib/actions/admin-actions";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function PoListTab({ purchaseOrders, loading, onReload }: { purchaseOrders: PurchaseOrder[], loading: boolean, onReload: () => void }) {
    const [searchQuery, setSearchQuery] = useState("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingPo, setEditingPo] = useState<PurchaseOrder | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state
    const [poNumber, setPoNumber] = useState("");
    const [clientName, setClientName] = useState("");
    const [jb, setJb] = useState(0);
    const [sb, setSb] = useState(0);
    const [source, setSource] = useState("warehouse");
    const [serviceType, setServiceType] = useState("pickup");

    const openCreate = () => {
        setEditingPo(null);
        setPoNumber(""); setClientName(""); setJb(0); setSb(0);
        setSource("warehouse"); setServiceType("pickup");
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
        setIsDialogOpen(true);
    };

    const handleSubmit = async () => {
        if (!poNumber) return toast.error("PO Number is required");
        setIsSubmitting(true);
        try {
            if (editingPo) {
                await updatePurchaseOrder(editingPo.id, { po_number: poNumber, client_name: clientName, jb, sb, source, service_type: serviceType });
                toast.success("PO updated");
            } else {
                await createPurchaseOrder({ po_number: poNumber, client_name: clientName, jb, sb, source, service_type: serviceType });
                toast.success("PO created");
            }
            setIsDialogOpen(false);
            onReload();
        } catch (e: any) {
            toast.error(e.message || "Failed to save PO");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this PO record?")) return;
        try {
            await deletePurchaseOrder(id);
            toast.success("PO deleted");
            onReload();
        } catch (e: any) {
            toast.error("Failed to delete");
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
                <div className="flex justify-between items-center">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input type="search" placeholder="Search PO or Client..." className="pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>
                    <Button onClick={openCreate} className="bg-[var(--color-industrial-blue)]"><Plus className="w-4 h-4 mr-2" /> Add PO</Button>
                </div>

                <div className="border rounded-lg overflow-hidden">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>PO #</TableHead>
                                <TableHead>Client Name</TableHead>
                                <TableHead>Service</TableHead>
                                <TableHead>Quantities</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.length === 0 ? (
                                <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No purchase orders found.</TableCell></TableRow>
                            ) : filtered.map(po => (
                                <TableRow key={po.id}>
                                    <TableCell className="text-sm">{new Date(po.date).toLocaleDateString()}</TableCell>
                                    <TableCell className="font-semibold text-sm">{po.po_number}</TableCell>
                                    <TableCell className="text-sm">{po.client_name || "—"}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase font-bold">
                                            {po.service_type === 'deliver' ? <Truck className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
                                            {po.service_type} · {po.source}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex gap-2">
                                            <Badge variant="outline" className="text-xs">{po.jb} JB</Badge>
                                            <Badge variant="outline" className="text-xs">{po.sb} SB</Badge>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className="capitalize">{po.status.replace('_', ' ')}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => openEdit(po)} className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"><Edit2 className="w-4 h-4" /></Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(po.id)} className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"><Trash2 className="w-4 h-4" /></Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingPo ? "Edit Purchase Order" : "Add Purchase Order"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>PO Number <span className="text-red-500">*</span></Label>
                            <Input value={poNumber} onChange={e => setPoNumber(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Client Name</Label>
                            <Input value={clientName} onChange={e => setClientName(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Source</Label>
                                <Select value={source} onValueChange={setSource}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="warehouse">Warehouse</SelectItem>
                                        <SelectItem value="port">Port</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Service Type</Label>
                                <Select value={serviceType} onValueChange={setServiceType}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pickup">Pick-up</SelectItem>
                                        <SelectItem value="deliver">Delivery</SelectItem>
                                    </SelectContent>
                                </Select>
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
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
                        <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-[var(--color-industrial-blue)]">
                            {isSubmitting ? "Saving..." : "Save PO"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
