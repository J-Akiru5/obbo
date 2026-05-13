"use client";
import { useState } from "react";
import { Shipment, ShipmentLedgerEntry } from "@/lib/types/database";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { ChevronDown, ChevronRight, PackagePlus, Plus, Trash2, Edit2, MoreVertical, Save, AlertTriangle, Pencil } from "lucide-react";
import { createShipment, fetchShipmentLedger, addLedgerEntry, updateLedgerEntry, deleteLedgerEntry, updateShipment, deleteShipment } from "@/lib/actions/admin-actions";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LedgerEntryDialog } from "./ledger-entry-dialog";

export function ShipmentsTab({ shipments, loading, onReload }: { shipments: Shipment[], loading: boolean, onReload: () => void }) {
    const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
    const [ledgerData, setLedgerData] = useState<Record<string, ShipmentLedgerEntry[]>>({});
    const [isCreating, setIsCreating] = useState(false);

    // New batch form
    const [newBatchName, setNewBatchName] = useState("");
    const [newJbBags, setNewJbBags] = useState(0);
    const [newSbBags, setNewSbBags] = useState(0);
    const [newArrivalDate, setNewArrivalDate] = useState(new Date().toISOString().split("T")[0]);

    // Edit batch dialog
    const [editingShipment, setEditingShipment] = useState<Shipment | null>(null);
    const [editForm, setEditForm] = useState({ batch_name: "", total_jb: 0, total_sb: 0, arrival_date: "" });
    const [isUpdating, setIsUpdating] = useState(false);

    // Manual remaining override
    const [overrideShipment, setOverrideShipment] = useState<Shipment | null>(null);
    const [overrideRemJb, setOverrideRemJb] = useState(0);
    const [overrideRemSb, setOverrideRemSb] = useState(0);
    const [isSavingOverride, setIsSavingOverride] = useState(false);

    // Ledger entry dialog
    const [ledgerDialogOpen, setLedgerDialogOpen] = useState(false);
    const [editingEntry, setEditingEntry] = useState<ShipmentLedgerEntry | null>(null);
    const [activeShipmentId, setActiveShipmentId] = useState<string>("");

    // Delete confirmation
    const [deleteTarget, setDeleteTarget] = useState<{ entry: ShipmentLedgerEntry; shipmentId: string } | null>(null);

    const refreshLedger = async (shipmentId: string) => {
        const ledger = await fetchShipmentLedger(shipmentId);
        setLedgerData(prev => ({ ...prev, [shipmentId]: ledger as ShipmentLedgerEntry[] }));
    };

    const toggleExpand = async (shipmentId: string) => {
        if (expandedBatch === shipmentId) { setExpandedBatch(null); return; }
        setExpandedBatch(shipmentId);
        if (!ledgerData[shipmentId]) await refreshLedger(shipmentId);
    };

    const handleCreateBatch = async () => {
        if (!newBatchName) return toast.error("Batch name is required.");
        const totalBags = newJbBags + newSbBags;
        if (totalBags <= 0) return toast.error("Total bags must be greater than 0.");
        setIsCreating(true);
        try {
            await createShipment(newBatchName, newJbBags, newSbBags, newArrivalDate);
            toast.success("Shipment batch created.");
            setNewBatchName(""); setNewJbBags(0); setNewSbBags(0);
            setNewArrivalDate(new Date().toISOString().split("T")[0]);
            onReload();
        } catch (e: any) { toast.error(e.message || "Failed to create batch."); }
        finally { setIsCreating(false); }
    };

    const handleUpdateShipment = async () => {
        if (!editingShipment) return;
        setIsUpdating(true);
        try {
            await updateShipment(editingShipment.id, editForm);
            toast.success("Shipment batch updated.");
            setEditingShipment(null);
            onReload();
        } catch (e: any) { toast.error(e.message || "Failed to update batch."); }
        finally { setIsUpdating(false); }
    };

    const handleDeleteBatch = async (id: string) => {
        if (!confirm("Delete this shipment batch? This cannot be undone.")) return;
        try { await deleteShipment(id); toast.success("Batch deleted."); onReload(); }
        catch (e: any) { toast.error(e.message || "Failed to delete batch."); }
    };

    const openEditDialog = (s: Shipment) => {
        setEditingShipment(s);
        setEditForm({ 
            batch_name: s.batch_name, 
            total_jb: s.total_jb, 
            total_sb: s.total_sb, 
            arrival_date: s.arrival_date.split("T")[0] 
        });
    };

    const openOverrideDialog = (s: Shipment) => {
        setOverrideShipment(s);
        setOverrideRemJb(s.remaining_jb);
        setOverrideRemSb(s.remaining_sb);
    };

    const handleSaveOverride = async () => {
        if (!overrideShipment) return;
        setIsSavingOverride(true);
        try {
            await updateShipment(overrideShipment.id, {
                remaining_jb: overrideRemJb,
                remaining_sb: overrideRemSb,
            });
            toast.success("Remaining stock updated. Dashboard totals will reflect this change.");
            setOverrideShipment(null);
            onReload();
        } catch (e: any) { toast.error(e.message || "Failed to update."); }
        finally { setIsSavingOverride(false); }
    };

    // Ledger entry add
    const openAddEntry = (shipmentId: string) => {
        setActiveShipmentId(shipmentId);
        setEditingEntry(null);
        setLedgerDialogOpen(true);
    };

    // Ledger entry edit
    const openEditEntry = (entry: ShipmentLedgerEntry, shipmentId: string) => {
        setActiveShipmentId(shipmentId);
        setEditingEntry(entry);
        setLedgerDialogOpen(true);
    };

    const handleLedgerSubmit = async (data: Record<string, unknown>) => {
        if (editingEntry) {
            await updateLedgerEntry(
                editingEntry.id,
                activeShipmentId,
                { jb: editingEntry.jb, sb: editingEntry.sb, bags_returned: editingEntry.bags_returned, bag_returned_type: editingEntry.bag_returned_type },
                data as any
            );
            toast.success("Ledger entry updated.");
        } else {
            await addLedgerEntry(activeShipmentId, data as any);
            toast.success("Ledger entry added.");
        }
        await refreshLedger(activeShipmentId);
        onReload();
    };

    const confirmDeleteEntry = async () => {
        if (!deleteTarget) return;
        try {
            await deleteLedgerEntry(deleteTarget.entry.id);
            toast.success("Entry deleted.");
            await refreshLedger(deleteTarget.shipmentId);
            onReload();
        } catch (e: any) { toast.error(e.message || "Failed to delete."); }
        finally { setDeleteTarget(null); }
    };

    if (loading) return <div className="py-8 text-center text-muted-foreground animate-pulse">Loading shipment batches...</div>;

    return (
        <div className="space-y-6">
            {/* Header + Create */}
            <div className="flex justify-between items-center bg-card p-4 rounded-xl border border-border shadow-sm">
                <div>
                    <h3 className="font-semibold text-lg">Shipment Batches</h3>
                    <p className="text-sm text-muted-foreground">Each batch tracks a shipment of Portland Cement Type 1.</p>
                </div>
                <Dialog>
                    <DialogTrigger render={<Button className="bg-primary" />}>
                        <PackagePlus className="w-4 h-4 mr-2" /> New Batch
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create New Shipment Batch</DialogTitle>
                            <DialogDescription>Enter the batch name and total bags received.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Batch Name / Vessel <span className="text-red-500">*</span></Label>
                                <Input value={newBatchName} onChange={e => setNewBatchName(e.target.value)} placeholder="e.g. MV Alpha - May 2026" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>JB Bags <span className="text-red-500">*</span></Label>
                                    <Input type="number" min={0} value={newJbBags || ""} onChange={e => setNewJbBags(parseInt(e.target.value) || 0)} placeholder="Jumbo Bags" />
                                </div>
                                <div className="space-y-2">
                                    <Label>SB Bags <span className="text-red-500">*</span></Label>
                                    <Input type="number" min={0} value={newSbBags || ""} onChange={e => setNewSbBags(parseInt(e.target.value) || 0)} placeholder="Standard Bags" />
                                </div>
                            </div>
                            <div className="bg-muted p-3 rounded-lg border border-dashed border-border">
                                <div className="flex justify-between items-center text-sm font-medium">
                                    <span className="text-muted-foreground">Calculated Total:</span>
                                    <span className="text-foreground">{newJbBags + newSbBags} bags</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Arrival Date</Label>
                                <Input type="date" value={newArrivalDate} onChange={e => setNewArrivalDate(e.target.value)} />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleCreateBatch} disabled={isCreating || !newBatchName || (newJbBags + newSbBags) <= 0} className="bg-primary">
                                {isCreating ? "Creating..." : "Create Batch"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Batch List */}
            <div className="space-y-4">
                {shipments.map(shipment => {
                    const totalRemaining = shipment.remaining_jb + shipment.remaining_sb;
                    const totalInitial = shipment.total_jb + shipment.total_sb;
                    return (
                    <Card key={shipment.id} className="overflow-hidden border border-border/50 shadow-sm transition-shadow hover:shadow-md">
                        {/* Batch Header */}
                        <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => toggleExpand(shipment.id)}>
                            <div className="flex items-center gap-4">
                                {expandedBatch === shipment.id ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
                                <div>
                                    <h4 className="font-bold text-lg">{shipment.batch_name}</h4>
                                    <p className="text-xs text-muted-foreground mt-0.5">Arrived: {new Date(shipment.arrival_date).toLocaleDateString()}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-6">
                                <div className="text-right">
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-0.5">Initial Total</p>
                                    <p className="text-sm font-semibold">{totalInitial} bags</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] uppercase font-bold text-primary tracking-wider mb-0.5">Remaining</p>
                                    <p className="text-base font-bold text-primary">{totalRemaining} bags</p>
                                    <p className="text-[10px] text-muted-foreground">{shipment.remaining_jb} JB · {shipment.remaining_sb} SB</p>
                                </div>
                                <div onClick={e => e.stopPropagation()}>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" />}>
                                            <MoreVertical className="w-4 h-4" />
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => openEditDialog(shipment)}>
                                                <Edit2 className="w-4 h-4 mr-2" /> Rename / Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => openOverrideDialog(shipment)}>
                                                <Pencil className="w-4 h-4 mr-2" /> Adjust Remaining
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleDeleteBatch(shipment.id)} className="text-destructive focus:text-destructive">
                                                <Trash2 className="w-4 h-4 mr-2" /> Delete Batch
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                        </div>

                        {/* Expanded Ledger */}
                        {expandedBatch === shipment.id && (
                            <div className="border-t border-border bg-muted/10 p-4 space-y-4">
                                {/* Remaining Stock + Add Entry */}
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-card p-3 rounded-lg border">
                                    <div className="flex items-center gap-4">
                                        <div className="px-3 py-1.5 rounded-md bg-primary/10 border border-primary/20">
                                            <p className="text-[10px] uppercase font-bold text-primary tracking-wider">Remaining</p>
                                            <p className="text-lg font-bold text-primary">{totalRemaining}</p>
                                        </div>
                                        <div className="text-xs text-muted-foreground space-y-0.5">
                                            <p>JB: <span className="font-bold text-foreground">{shipment.remaining_jb}</span></p>
                                            <p>SB: <span className="font-bold text-foreground">{shipment.remaining_sb}</span></p>
                                        </div>
                                        <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => openOverrideDialog(shipment)}>
                                            <Pencil className="w-3 h-3 mr-1" /> Adjust
                                        </Button>
                                    </div>
                                    <Button size="sm" onClick={() => openAddEntry(shipment.id)} className="bg-primary">
                                        <Plus className="w-3.5 h-3.5 mr-1" /> Add Entry
                                    </Button>
                                </div>

                                {/* Ledger Table */}
                                <div className="bg-card rounded-lg border border-border overflow-x-auto">
                                    <Table>
                                        <TableHeader className="bg-muted/50">
                                            <TableRow>
                                                <TableHead className="text-[10px] w-[80px]">Date</TableHead>
                                                <TableHead className="text-[10px]">PO #</TableHead>
                                                <TableHead className="text-[10px]">DR #</TableHead>
                                                <TableHead className="text-[10px]">Client</TableHead>
                                                <TableHead className="text-[10px]">Driver</TableHead>
                                                <TableHead className="text-[10px]">Plate</TableHead>
                                                <TableHead className="text-[10px]">Destination</TableHead>
                                                <TableHead className="text-[10px]">Service</TableHead>
                                                <TableHead className="text-[10px] text-right">JB</TableHead>
                                                <TableHead className="text-[10px] text-right">SB</TableHead>
                                                <TableHead className="text-[10px] text-right">Total</TableHead>
                                                <TableHead className="text-[10px]">Payment</TableHead>
                                                <TableHead className="text-[10px]">Check No.</TableHead>
                                                <TableHead className="text-[10px] text-right">Amount</TableHead>
                                                <TableHead className="text-[10px] text-right text-emerald-600">Returns</TableHead>
                                                <TableHead className="text-[10px]">Ret. Type</TableHead>
                                                <TableHead className="text-right w-[70px]"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {!ledgerData[shipment.id] ? (
                                                <TableRow><TableCell colSpan={17} className="text-center py-4 text-xs text-muted-foreground">Loading...</TableCell></TableRow>
                                            ) : ledgerData[shipment.id].length === 0 ? (
                                                <TableRow><TableCell colSpan={17} className="text-center py-4 text-xs text-muted-foreground">No ledger entries yet.</TableCell></TableRow>
                                            ) : ledgerData[shipment.id].map(e => (
                                                <TableRow key={e.id}>
                                                    <TableCell className="text-[11px] whitespace-nowrap">{new Date(e.date).toLocaleDateString()}</TableCell>
                                                    <TableCell className="text-[11px] font-medium">{e.po_number || "—"}</TableCell>
                                                    <TableCell className="text-[11px] font-medium">{e.dr_number || "—"}</TableCell>
                                                    <TableCell className="text-[11px] max-w-[100px] truncate">{e.client_name || "—"}</TableCell>
                                                    <TableCell className="text-[11px]">{e.driver_name || "—"}</TableCell>
                                                    <TableCell className="text-[11px]">{e.plate_number || "—"}</TableCell>
                                                    <TableCell className="text-[11px] max-w-[100px] truncate" title={e.destination || ""}>{e.destination || "—"}</TableCell>
                                                    <TableCell className="text-[10px] uppercase">{e.service_type === "deliver" ? "Delivery" : e.service_type === "pickup" ? "Pick-up" : "—"}</TableCell>
                                                    <TableCell className="text-[11px] text-right text-red-500 font-medium">{e.jb > 0 ? `-${e.jb}` : "—"}</TableCell>
                                                    <TableCell className="text-[11px] text-right text-red-500 font-medium">{e.sb > 0 ? `-${e.sb}` : "—"}</TableCell>
                                                    <TableCell className="text-[11px] text-right font-bold">{e.jb + e.sb > 0 ? e.jb + e.sb : "—"}</TableCell>
                                                    <TableCell className="text-[10px] uppercase">{e.payment_method || "—"}</TableCell>
                                                    <TableCell className="text-[11px]">{e.check_number || "—"}</TableCell>
                                                    <TableCell className="text-[11px] text-right">{e.amount ? `₱${Number(e.amount).toLocaleString()}` : "—"}</TableCell>
                                                    <TableCell className="text-[11px] text-right font-bold text-emerald-600">{e.bags_returned > 0 ? `+${e.bags_returned}` : "—"}</TableCell>
                                                    <TableCell className="text-[10px]">{e.bag_returned_type || "—"}</TableCell>
                                                    <TableCell className="text-right whitespace-nowrap">
                                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-blue-600" onClick={() => openEditEntry(e, shipment.id)}><Edit2 className="w-3 h-3" /></Button>
                                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setDeleteTarget({ entry: e, shipmentId: shipment.id })}><Trash2 className="w-3 h-3" /></Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}
                    </Card>
                    );
                })}
            </div>

            {/* Edit Shipment Dialog */}
            <Dialog open={!!editingShipment} onOpenChange={open => !open && setEditingShipment(null)}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Edit Shipment Batch</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Batch Name <span className="text-red-500">*</span></Label>
                            <Input value={editForm.batch_name} onChange={e => setEditForm({ ...editForm, batch_name: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Arrival Date</Label>
                            <Input type="date" value={editForm.arrival_date} onChange={e => setEditForm({ ...editForm, arrival_date: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Initial JB</Label>
                                <Input type="number" min={0} value={editForm.total_jb || ""} placeholder="0" onChange={e => setEditForm({ ...editForm, total_jb: parseInt(e.target.value) || 0 })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Initial SB</Label>
                                <Input type="number" min={0} value={editForm.total_sb || ""} placeholder="0" onChange={e => setEditForm({ ...editForm, total_sb: parseInt(e.target.value) || 0 })} />
                            </div>
                        </div>
                        <div className="bg-muted p-3 rounded-lg border border-dashed border-border">
                            <div className="flex justify-between items-center text-sm font-medium">
                                <span className="text-muted-foreground">Total Initial Stock:</span>
                                <span className="text-foreground">{editForm.total_jb + editForm.total_sb} bags</span>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setEditingShipment(null)}>Cancel</Button>
                        <Button onClick={handleUpdateShipment} disabled={isUpdating} className="bg-primary">
                            {isUpdating ? "Saving..." : "Save"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Manual Remaining Override Dialog */}
            <Dialog open={!!overrideShipment} onOpenChange={open => !open && setOverrideShipment(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Adjust Remaining Stock</DialogTitle>
                        <DialogDescription>
                            Manually override the remaining bag counts for <strong>{overrideShipment?.batch_name}</strong>.
                            Use this for damage, spoilage, or inventory corrections.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="rounded-lg border border-accent/20 bg-accent/5 p-3 text-xs text-foreground">
                            <p className="font-semibold flex items-center gap-1.5 text-accent-foreground"><AlertTriangle className="w-4 h-4 text-accent" /> Manual Override</p>
                            <p className="mt-1 text-muted-foreground">Changes here instantly affect the Dashboard&apos;s &quot;Total Good Stock&quot; counter.</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Remaining JB</Label>
                                <Input type="number" min={0} value={overrideRemJb || ""} placeholder="0" onChange={e => setOverrideRemJb(parseInt(e.target.value) || 0)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Remaining SB</Label>
                                <Input type="number" min={0} value={overrideRemSb || ""} placeholder="0" onChange={e => setOverrideRemSb(parseInt(e.target.value) || 0)} />
                            </div>
                        </div>
                        <div className="bg-muted p-3 rounded-lg text-sm">
                            <p className="text-muted-foreground">New Total: <span className="font-bold text-foreground">{overrideRemJb + overrideRemSb} bags</span></p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOverrideShipment(null)}>Cancel</Button>
                        <Button onClick={handleSaveOverride} disabled={isSavingOverride} className="bg-primary">
                            <Save className="w-4 h-4 mr-2" /> {isSavingOverride ? "Saving..." : "Save Override"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Ledger Entry Add/Edit Dialog */}
            <LedgerEntryDialog
                open={ledgerDialogOpen}
                onOpenChange={setLedgerDialogOpen}
                entry={editingEntry}
                onSubmit={handleLedgerSubmit}
            />

            {/* Delete Entry Confirmation */}
            <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="w-5 h-5" /> Delete Ledger Entry
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure? Stock will NOT be automatically reverted. You may need to manually adjust the remaining count.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={confirmDeleteEntry}>
                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
