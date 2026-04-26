import { useState, useEffect } from "react";
import { Shipment, ShipmentLedgerEntry } from "@/lib/types/database";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { ChevronDown, ChevronRight, PackagePlus, Plus, Save, Trash2 } from "lucide-react";
import { createShipment, fetchShipmentLedger, addLedgerEntry, deleteLedgerEntry } from "@/lib/actions/admin-actions";
import { toast } from "sonner";

export function ShipmentsTab({ shipments, loading, onReload }: { shipments: Shipment[], loading: boolean, onReload: () => void }) {
    const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
    const [ledgerData, setLedgerData] = useState<Record<string, ShipmentLedgerEntry[]>>({});
    const [isCreating, setIsCreating] = useState(false);
    
    // New batch form
    const [newBatchName, setNewBatchName] = useState("");
    const [newJb, setNewJb] = useState(0);
    const [newSb, setNewSb] = useState(0);

    // Manual entry form
    const [manualEntry, setManualEntry] = useState({
        dr_number: "", po_number: "", client_name: "", jb: 0, sb: 0, bags_returned: 0, notes: ""
    });

    const toggleExpand = async (shipmentId: string) => {
        if (expandedBatch === shipmentId) {
            setExpandedBatch(null);
        } else {
            setExpandedBatch(shipmentId);
            if (!ledgerData[shipmentId]) {
                const ledger = await fetchShipmentLedger(shipmentId);
                setLedgerData(prev => ({ ...prev, [shipmentId]: ledger as ShipmentLedgerEntry[] }));
            }
        }
    };

    const handleCreateBatch = async () => {
        if (!newBatchName) return toast.error("Batch name is required.");
        setIsCreating(true);
        try {
            await createShipment(newBatchName, newJb, newSb);
            toast.success("Shipment batch created.");
            setNewBatchName(""); setNewJb(0); setNewSb(0);
            onReload();
        } catch (e: any) {
            toast.error(e.message || "Failed to create batch.");
        } finally {
            setIsCreating(false);
        }
    };

    const handleAddManualEntry = async (shipmentId: string) => {
        try {
            await addLedgerEntry(shipmentId, manualEntry);
            toast.success("Manual entry added.");
            setManualEntry({ dr_number: "", po_number: "", client_name: "", jb: 0, sb: 0, bags_returned: 0, notes: "" });
            const ledger = await fetchShipmentLedger(shipmentId);
            setLedgerData(prev => ({ ...prev, [shipmentId]: ledger as ShipmentLedgerEntry[] }));
            onReload(); // Refresh remaining counts
        } catch (e: any) {
            toast.error(e.message || "Failed to add entry.");
        }
    };

    const handleDeleteEntry = async (entryId: string, shipmentId: string) => {
        if (!confirm("Are you sure you want to delete this ledger entry? Stock will NOT be automatically reverted in the UI for safety; you may need to adjust the shipment manually.")) return;
        try {
            await deleteLedgerEntry(entryId);
            toast.success("Entry deleted.");
            const ledger = await fetchShipmentLedger(shipmentId);
            setLedgerData(prev => ({ ...prev, [shipmentId]: ledger as ShipmentLedgerEntry[] }));
            onReload();
        } catch (e: any) {
            toast.error(e.message || "Failed to delete entry.");
        }
    };

    if (loading) return <div className="py-8 text-center text-muted-foreground animate-pulse">Loading shipment batches...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-card p-4 rounded-xl border border-border shadow-sm">
                <div>
                    <h3 className="font-semibold text-lg">Shipment Batches</h3>
                    <p className="text-sm text-muted-foreground">Batches act as folders holding JB and SB inventory.</p>
                </div>
                <Dialog>
                    <DialogTrigger asChild>
                        <Button className="bg-[var(--color-industrial-blue)]"><PackagePlus className="w-4 h-4 mr-2" /> New Batch</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create New Shipment Batch</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Batch Name / Vessel <span className="text-red-500">*</span></Label>
                                <Input value={newBatchName} onChange={e => setNewBatchName(e.target.value)} placeholder="e.g. Vessel Alpha - Nov 2023" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Total JB</Label>
                                    <Input type="number" min="0" value={newJb} onChange={e => setNewJb(parseInt(e.target.value) || 0)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Total SB</Label>
                                    <Input type="number" min="0" value={newSb} onChange={e => setNewSb(parseInt(e.target.value) || 0)} />
                                </div>
                            </div>
                            <div className="bg-muted p-3 rounded-lg text-sm">
                                <p className="text-muted-foreground">Grand Total: <span className="font-bold text-foreground">{newJb + newSb} bags</span></p>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleCreateBatch} disabled={isCreating || !newBatchName} className="bg-[var(--color-industrial-blue)]">
                                {isCreating ? "Creating..." : "Create Batch"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="space-y-4">
                {shipments.map(shipment => (
                    <Card key={shipment.id} className="overflow-hidden border border-border/50 shadow-sm transition-shadow hover:shadow-md">
                        <div 
                            className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors"
                            onClick={() => toggleExpand(shipment.id)}
                        >
                            <div className="flex items-center gap-4">
                                {expandedBatch === shipment.id ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
                                <div>
                                    <h4 className="font-bold text-lg">{shipment.batch_name}</h4>
                                    <p className="text-xs text-muted-foreground mt-0.5">Arrived: {new Date(shipment.arrival_date).toLocaleDateString()}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-8">
                                <div className="text-center">
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Initial</p>
                                    <p className="text-sm font-semibold">{shipment.total_jb} JB · {shipment.total_sb} SB</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-[10px] uppercase font-bold text-[var(--color-industrial-blue)] tracking-wider mb-1">Remaining</p>
                                    <p className="text-base font-bold text-[var(--color-industrial-blue)]">{shipment.remaining_jb} JB · {shipment.remaining_sb} SB</p>
                                </div>
                            </div>
                        </div>

                        {expandedBatch === shipment.id && (
                            <div className="border-t border-border bg-muted/10 p-4 space-y-4">
                                {/* Manual Entry Row */}
                                <div className="bg-card p-3 rounded-lg border border-border shadow-sm flex items-end gap-3">
                                    <div className="space-y-1.5 flex-1 max-w-[120px]">
                                        <Label className="text-[10px] uppercase text-muted-foreground">Date</Label>
                                        <Input type="date" className="h-8 text-xs" defaultValue={new Date().toISOString().split('T')[0]} />
                                    </div>
                                    <div className="space-y-1.5 flex-1 max-w-[120px]">
                                        <Label className="text-[10px] uppercase text-muted-foreground">DR #</Label>
                                        <Input className="h-8 text-xs" value={manualEntry.dr_number} onChange={e => setManualEntry({...manualEntry, dr_number: e.target.value})} placeholder="DR-XXXX" />
                                    </div>
                                    <div className="space-y-1.5 flex-1 max-w-[120px]">
                                        <Label className="text-[10px] uppercase text-muted-foreground">PO #</Label>
                                        <Input className="h-8 text-xs" value={manualEntry.po_number} onChange={e => setManualEntry({...manualEntry, po_number: e.target.value})} placeholder="PO-XXXX" />
                                    </div>
                                    <div className="space-y-1.5 flex-[2]">
                                        <Label className="text-[10px] uppercase text-muted-foreground">Client Name</Label>
                                        <Input className="h-8 text-xs" value={manualEntry.client_name} onChange={e => setManualEntry({...manualEntry, client_name: e.target.value})} placeholder="Client name" />
                                    </div>
                                    <div className="space-y-1.5 flex-1 max-w-[80px]">
                                        <Label className="text-[10px] uppercase text-muted-foreground">Out JB</Label>
                                        <Input type="number" className="h-8 text-xs" value={manualEntry.jb} onChange={e => setManualEntry({...manualEntry, jb: parseInt(e.target.value) || 0})} />
                                    </div>
                                    <div className="space-y-1.5 flex-1 max-w-[80px]">
                                        <Label className="text-[10px] uppercase text-muted-foreground">Out SB</Label>
                                        <Input type="number" className="h-8 text-xs" value={manualEntry.sb} onChange={e => setManualEntry({...manualEntry, sb: parseInt(e.target.value) || 0})} />
                                    </div>
                                    <Button size="sm" onClick={() => handleAddManualEntry(shipment.id)} className="h-8 px-3 bg-[var(--color-industrial-blue)]">
                                        <Plus className="w-3.5 h-3.5 mr-1" /> Add
                                    </Button>
                                </div>

                                {/* Ledger Table */}
                                <div className="bg-card rounded-lg border border-border overflow-hidden">
                                    <Table>
                                        <TableHeader className="bg-muted/50">
                                            <TableRow>
                                                <TableHead className="text-xs w-[100px]">Date</TableHead>
                                                <TableHead className="text-xs">DR #</TableHead>
                                                <TableHead className="text-xs">PO #</TableHead>
                                                <TableHead className="text-xs">Client Name</TableHead>
                                                <TableHead className="text-xs text-right text-red-600">Out JB</TableHead>
                                                <TableHead className="text-xs text-right text-red-600">Out SB</TableHead>
                                                <TableHead className="text-xs text-right w-[60px]"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {!ledgerData[shipment.id] ? (
                                                <TableRow><TableCell colSpan={7} className="text-center py-4 text-xs text-muted-foreground">Loading ledger...</TableCell></TableRow>
                                            ) : ledgerData[shipment.id].length === 0 ? (
                                                <TableRow><TableCell colSpan={7} className="text-center py-4 text-xs text-muted-foreground">No ledger entries.</TableCell></TableRow>
                                            ) : ledgerData[shipment.id].map(entry => (
                                                <TableRow key={entry.id}>
                                                    <TableCell className="text-xs">{new Date(entry.date).toLocaleDateString()}</TableCell>
                                                    <TableCell className="text-xs font-medium">{entry.dr_number || "—"}</TableCell>
                                                    <TableCell className="text-xs font-medium">{entry.po_number || "—"}</TableCell>
                                                    <TableCell className="text-xs">{entry.client_name || "—"}</TableCell>
                                                    <TableCell className="text-xs text-right text-red-600 font-medium">-{entry.jb}</TableCell>
                                                    <TableCell className="text-xs text-right text-red-600 font-medium">-{entry.sb}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteEntry(entry.id, shipment.id)}>
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}
                    </Card>
                ))}
            </div>
        </div>
    );
}
