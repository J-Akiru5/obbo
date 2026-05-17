"use client";
import { useState, useEffect } from "react";
import { ShipmentLedgerEntry } from "@/lib/types/database";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface LedgerEntryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    entry: ShipmentLedgerEntry | null; // null = create mode
    onSubmit: (data: Record<string, unknown>) => Promise<void>;
}

const EMPTY = {
    date: new Date().toISOString().split("T")[0],
    po_number: "", dr_number: "", client_name: "",
    driver_name: "", plate_number: "", destination: "",
    service_type: "pickup",
    jb: 0, sb: 0,
    payment_method: "cash", check_number: "", amount: 0,
    bags_returned: 0, bag_returned_type: "", return_reason: "return", client_reason: "", notes: "",
};

export function LedgerEntryDialog({ open, onOpenChange, entry, onSubmit }: LedgerEntryDialogProps) {
    const [form, setForm] = useState(EMPTY);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (entry) {
            setForm({
                date: entry.date?.split("T")[0] ?? EMPTY.date,
                po_number: entry.po_number ?? "",
                dr_number: entry.dr_number ?? "",
                client_name: entry.client_name ?? "",
                driver_name: entry.driver_name ?? "",
                plate_number: entry.plate_number ?? "",
                destination: entry.destination ?? "",
                service_type: entry.service_type ?? "pickup",
                jb: entry.jb ?? 0,
                sb: entry.sb ?? 0,
                payment_method: entry.payment_method ?? "cash",
                check_number: entry.check_number ?? "",
                amount: entry.amount ? Number(entry.amount) : 0,
                bags_returned: entry.bags_returned ?? 0,
                bag_returned_type: entry.bag_returned_type ?? "",
                return_reason: entry.return_reason ?? "return",
                client_reason: entry.client_reason ?? "",
                notes: entry.notes ?? "",
            });
        } else {
            setForm(EMPTY);
        }
    }, [entry, open]);

    const set = (k: string, v: unknown) => setForm(prev => ({ ...prev, [k]: v }));

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSubmit({
                ...form,
                jb: Number(form.jb) || 0,
                sb: Number(form.sb) || 0,
                amount: Number(form.amount) || 0,
                bags_returned: Number(form.bags_returned) || 0,
                check_number: form.payment_method === "check" ? form.check_number : null,
                bag_returned_type: Number(form.bags_returned) > 0 ? (form.bag_returned_type || "SB") : null,
                return_reason: Number(form.bags_returned) > 0 ? (form.return_reason || "return") : null,
            });
            onOpenChange(false);
        } catch { /* toast handled upstream */ } finally { setSaving(false); }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{entry ? "Edit Ledger Entry" : "Add Ledger Entry"}</DialogTitle>
                    <DialogDescription>
                        {entry ? "Update the details of this ledger row." : "Add a manual ledger entry to this shipment batch."}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-3">
                    {/* Row 1: Date, PO#, DR# */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Date</Label>
                            <Input type="date" value={form.date} onChange={e => set("date", e.target.value)} className="h-9" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">PO #</Label>
                            <Input value={form.po_number} onChange={e => set("po_number", e.target.value)} placeholder="PO-XXXX" className="h-9" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">DR #</Label>
                            <Input value={form.dr_number} onChange={e => set("dr_number", e.target.value)} placeholder="DR-XXXX" className="h-9" />
                        </div>
                    </div>

                    {/* Row 2: Client, Driver, Plate */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Client Name</Label>
                            <Input value={form.client_name} onChange={e => set("client_name", e.target.value)} className="h-9" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Driver Name</Label>
                            <Input value={form.driver_name} onChange={e => set("driver_name", e.target.value)} className="h-9" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Plate #</Label>
                            <Input value={form.plate_number} onChange={e => set("plate_number", e.target.value)} className="h-9" />
                        </div>
                    </div>

                    {/* Row 3: Destination, Service */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1.5 col-span-2">
                            <Label className="text-xs">Destination</Label>
                            <Input value={form.destination} onChange={e => set("destination", e.target.value)} placeholder="Client address" className="h-9" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Service Type</Label>
                            <Select value={form.service_type} onValueChange={v => set("service_type", v)}>
                                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pickup">Pick-up</SelectItem>
                                    <SelectItem value="deliver">Delivery</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Row 4: JB, SB, Total (auto) */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Total JB (out)</Label>
                            <Input type="number" min={0} value={form.jb || ""} placeholder="0" onChange={e => set("jb", parseInt(e.target.value) || 0)} className="h-9" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Total SB (out)</Label>
                            <Input type="number" min={0} value={form.sb || ""} placeholder="0" onChange={e => set("sb", parseInt(e.target.value) || 0)} className="h-9" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Total Bags (auto)</Label>
                            <div className="h-9 rounded-md border bg-muted/50 flex items-center px-3 text-sm font-bold">
                                {(Number(form.jb) || 0) + (Number(form.sb) || 0)}
                            </div>
                        </div>
                    </div>

                    {/* Row 5: Payment */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Payment</Label>
                            <Select value={form.payment_method} onValueChange={v => set("payment_method", v)}>
                                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="cash">Cash</SelectItem>
                                    <SelectItem value="check">Check</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {form.payment_method === "check" && (
                            <div className="space-y-1.5">
                                <Label className="text-xs">Check No.</Label>
                                <Input value={form.check_number} onChange={e => set("check_number", e.target.value)} className="h-9" />
                            </div>
                        )}
                        <div className="space-y-1.5">
                            <Label className="text-xs">Amount (₱)</Label>
                            <Input type="number" min={0} value={form.amount || ""} placeholder="0" onChange={e => set("amount", parseFloat(e.target.value) || 0)} className="h-9" />
                        </div>
                    </div>

                    {/* Row 6: Returns */}
                    <div className="border-t pt-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Returns</p>
                        <div className="grid grid-cols-4 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Bags Returned</Label>
                                <Input type="number" min={0} value={form.bags_returned || ""} placeholder="0" onChange={e => set("bags_returned", parseInt(e.target.value) || 0)} className="h-9" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Returned Type</Label>
                                <Select value={form.bag_returned_type || ""} onValueChange={v => set("bag_returned_type", v)} disabled={!Number(form.bags_returned)}>
                                    <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="JB">JB</SelectItem>
                                        <SelectItem value="SB">SB</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Return Reason</Label>
                                <Select value={form.return_reason || "return"} onValueChange={v => set("return_reason", v)} disabled={!Number(form.bags_returned)}>
                                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="return">Return</SelectItem>
                                        <SelectItem value="waste">Waste</SelectItem>
                                        <SelectItem value="damage">Damage</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        {Number(form.bags_returned) > 0 && (
                            <p className={`text-xs mt-2 ${form.return_reason === "return" ? "text-emerald-600" : "text-red-600"}`}>
                                {form.return_reason === "return"
                                    ? `✓ ${form.bags_returned} ${form.bag_returned_type || "bags"} will be added back to the batch remaining stock.`
                                    : `⚠ ${form.bags_returned} ${form.bag_returned_type || "bags"} marked as ${form.return_reason} — will be written off and NOT added to physical stock.`}
                            </p>
                        )}
                    </div>

                    {/* Client Reason (for returns) */}
                    {Number(form.bags_returned) > 0 && (
                        <div className="space-y-1.5">
                            <Label className="text-xs">Client Reason / Notes</Label>
                            <Input value={form.client_reason || ""} onChange={e => set("client_reason", e.target.value)} placeholder="Optional: reason from client or additional notes" className="h-9" />
                        </div>
                    )}

                    {/* Notes */}
                    <div className="space-y-1.5">
                        <Label className="text-xs">Notes</Label>
                        <Input value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Optional notes" className="h-9" />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving} className="bg-primary">
                        {saving ? "Saving..." : entry ? "Update Entry" : "Add Entry"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
