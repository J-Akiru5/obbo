"use client";

import { useState } from "react";
import {
    PackagePlus, FileText, Boxes, TrendingDown, ArrowUpDown,
    Plus, Calendar, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
    mockShipments, mockProducts, mockOrders, mockCustomerBalances, mockDeliveryReceipts,
} from "@/lib/mock-data";
import { Shipment } from "@/lib/types/database";

// ─── Add Shipment Dialog ─────────────────────────────
function AddShipmentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
    const [form, setForm] = useState({ batch_name: "", product_id: "", bag_type: "", initial_quantity: "", notes: "" });
    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        toast.success(`Shipment batch "${form.batch_name}" created!`);
        onClose();
    }
    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Add New Shipment Batch</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                        <Label>Batch Name *</Label>
                        <Input placeholder="e.g. BATCH-2025-005" value={form.batch_name} onChange={e => setForm({ ...form, batch_name: e.target.value })} required />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Product *</Label>
                        <Select onValueChange={v => setForm({ ...form, product_id: v })}>
                            <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                            <SelectContent>
                                {mockProducts.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label>Bag Type *</Label>
                            <Select onValueChange={v => setForm({ ...form, bag_type: v })}>
                                <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="SB">Sling Bags (SB)</SelectItem>
                                    <SelectItem value="JB">Jumbo Bags (JB)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Initial Quantity *</Label>
                            <Input type="number" min={1} placeholder="0" value={form.initial_quantity} onChange={e => setForm({ ...form, initial_quantity: e.target.value })} required />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Notes</Label>
                        <Textarea placeholder="Optional notes..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="resize-none text-sm" />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        <Button type="submit" className="bg-[var(--color-industrial-blue)] hover:bg-[var(--color-industrial-blue)]/90">Create Batch</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ─── Add DR Dialog ─────────────────────────────
function AddDRDialog({ open, onClose, shipment }: { open: boolean; onClose: () => void; shipment: Shipment | null }) {
    const [form, setForm] = useState({ dr_number: "", quantity: "", notes: "" });
    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        toast.success(`DR ${form.dr_number} attached to ${shipment?.batch_name}!`);
        onClose();
    }
    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader><DialogTitle>Add Delivery Receipt</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <p className="text-sm text-muted-foreground">Batch: <strong>{shipment?.batch_name}</strong></p>
                    <div className="space-y-1.5">
                        <Label>DR Number *</Label>
                        <Input placeholder="DR-2025-0003" value={form.dr_number} onChange={e => setForm({ ...form, dr_number: e.target.value })} required />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Quantity *</Label>
                        <Input type="number" min={1} placeholder="0" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} required />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Notes</Label>
                        <Textarea placeholder="Optional..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="resize-none text-sm" />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        <Button type="submit" className="bg-[var(--color-industrial-blue)] hover:bg-[var(--color-industrial-blue)]/90">Add DR</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ─── Stock Level Bar ─────────────────────────────
function StockBar({ good, initial }: { good: number; initial: number }) {
    const pct = Math.max(0, Math.min(100, (good / initial) * 100));
    const color = pct > 50 ? "bg-emerald-500" : pct > 20 ? "bg-amber-500" : "bg-red-500";
    return (
        <div className="w-full bg-muted rounded-full h-1.5">
            <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
        </div>
    );
}

export default function AdminInventoryPage() {
    const [addShipmentOpen, setAddShipmentOpen] = useState(false);
    const [addDROpen, setAddDROpen] = useState(false);
    const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);

    const todayDispatched = mockOrders.filter(o => o.status === "dispatched");
    const totalObligations = mockCustomerBalances.filter(b => b.status === "pending").reduce((s, b) => s + b.remaining_qty, 0);

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Inventory Module</h2>
                    <p className="text-muted-foreground mt-1">Manage shipment batches and delivery receipts.</p>
                </div>
                <Button className="bg-[var(--color-industrial-blue)] hover:bg-[var(--color-industrial-blue)]/90 gap-2 self-start sm:self-auto"
                    onClick={() => setAddShipmentOpen(true)}>
                    <Plus className="w-4 h-4" /> New Batch
                </Button>
            </div>

            <Tabs defaultValue="batches">
                <TabsList className="w-full sm:w-auto">
                    <TabsTrigger value="batches">Shipment Batches</TabsTrigger>
                    <TabsTrigger value="reports">Reports</TabsTrigger>
                </TabsList>

                {/* Shipment Batches */}
                <TabsContent value="batches" className="space-y-3">
                    <div className="hidden sm:grid sm:grid-cols-7 gap-2 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        <div className="col-span-2">Batch</div>
                        <div>Product</div>
                        <div>Type</div>
                        <div>Good Stock</div>
                        <div>Damaged</div>
                        <div></div>
                    </div>
                    <Card>
                        <CardContent className="p-2 divide-y">
                            {mockShipments.map((ship) => {
                                const prod = mockProducts.find(p => p.id === ship.product_id);
                                return (
                                    <div key={ship.id} className="py-3 px-3 hover:bg-muted/50 rounded-lg transition-colors">
                                        <div className="flex flex-col sm:grid sm:grid-cols-7 sm:gap-2 sm:items-center gap-2">
                                            <div className="sm:col-span-2">
                                                <p className="text-sm font-bold">{ship.batch_name}</p>
                                                <p className="text-xs text-muted-foreground">{new Date(ship.arrival_date).toLocaleDateString()}</p>
                                            </div>
                                            <p className="text-sm hidden sm:block truncate">{prod?.name}</p>
                                            <div>
                                                <Badge variant="outline" className="text-xs font-bold">{ship.bag_type}</Badge>
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-emerald-700">{ship.good_stock.toLocaleString()}</p>
                                                <StockBar good={ship.good_stock} initial={ship.initial_quantity} />
                                            </div>
                                            <p className="text-sm text-red-600 hidden sm:block">{ship.damaged_stock.toLocaleString()}</p>
                                            <div className="flex gap-2 justify-end">
                                                <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                                                    onClick={() => { setSelectedShipment(ship); setAddDROpen(true); }}>
                                                    <FileText className="w-3 h-3" /> DR
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>

                    {/* DRs */}
                    <div>
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Delivery Receipts</h3>
                        <Card>
                            <CardContent className="p-2 divide-y">
                                {mockDeliveryReceipts.map(dr => {
                                    const ship = mockShipments.find(s => s.id === dr.shipment_id);
                                    return (
                                        <div key={dr.id} className="flex flex-col sm:flex-row sm:items-center justify-between py-3 px-3 gap-1">
                                            <div>
                                                <p className="text-sm font-bold">{dr.dr_number}</p>
                                                <p className="text-xs text-muted-foreground">{ship?.batch_name} · {new Date(dr.received_date).toLocaleDateString()}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-bold">{dr.quantity.toLocaleString()} bags</p>
                                                <Badge variant="outline" className="text-xs">{dr.bag_type}</Badge>
                                            </div>
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Reports */}
                <TabsContent value="reports" className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <TrendingDown className="w-4 h-4 text-sky-500" /> Movement Today
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {todayDispatched.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No dispatches today.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {todayDispatched.map(o => (
                                            <div key={o.id} className="flex justify-between items-center text-sm">
                                                <span className="text-muted-foreground">Order #{o.id.split("-").pop()?.toUpperCase()}</span>
                                                <span className="font-bold">{o.items.reduce((s, i) => s + i.dispatched_qty, 0).toLocaleString()} bags</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Boxes className="w-4 h-4 text-amber-500" /> Customer Obligations
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Total outstanding bags</span>
                                        <span className="font-bold text-amber-700">{totalObligations.toLocaleString()}</span>
                                    </div>
                                    {mockCustomerBalances.filter(b => b.status === "pending").map(b => {
                                        const prod = mockProducts.find(p => p.id === b.product_id);
                                        return (
                                            <div key={b.id} className="text-sm p-2 bg-amber-50 rounded-lg border border-amber-200">
                                                <p className="font-medium text-amber-900">{prod?.name}</p>
                                                <p className="text-xs text-amber-700">{b.remaining_qty} {b.bag_type} owed · Order #{b.order_id.split("-").pop()?.toUpperCase()}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Stock Summary Table */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                                <ArrowUpDown className="w-4 h-4" /> Full Stock Summary
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b">
                                        <th className="text-left py-2 pr-4">Product</th>
                                        <th className="text-right py-2 pr-4">Initial</th>
                                        <th className="text-right py-2 pr-4">Good</th>
                                        <th className="text-right py-2">Damaged</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {mockShipments.map(ship => {
                                        const prod = mockProducts.find(p => p.id === ship.product_id);
                                        return (
                                            <tr key={ship.id} className="hover:bg-muted/30">
                                                <td className="py-2.5 pr-4">
                                                    <p className="font-medium">{ship.batch_name}</p>
                                                    <p className="text-xs text-muted-foreground">{prod?.name}</p>
                                                </td>
                                                <td className="text-right py-2.5 pr-4 text-muted-foreground">{ship.initial_quantity.toLocaleString()}</td>
                                                <td className="text-right py-2.5 pr-4 text-emerald-700 font-bold">{ship.good_stock.toLocaleString()}</td>
                                                <td className="text-right py-2.5 text-red-600">{ship.damaged_stock.toLocaleString()}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <AddShipmentDialog open={addShipmentOpen} onClose={() => setAddShipmentOpen(false)} />
            <AddDRDialog open={addDROpen} onClose={() => setAddDROpen(false)} shipment={selectedShipment} />
        </div>
    );
}
