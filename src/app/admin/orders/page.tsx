"use client";

import { useState } from "react";
import {
    CheckCircle2, XCircle, Truck, Package, Clock, AlertTriangle,
    ChevronRight, Eye, Check, X,
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
    mockOrders, mockProducts, mockShipments,
} from "@/lib/mock-data";
import { Order, OrderStatus } from "@/lib/types/database";

// ─── Status badge helper ─────────────────────────────
function StatusBadge({ status }: { status: OrderStatus }) {
    const map: Record<OrderStatus, { label: string; class: string }> = {
        pending: { label: "Pending", class: "bg-amber-100 text-amber-800 border-amber-200" },
        approved: { label: "Approved", class: "bg-blue-100 text-blue-800 border-blue-200" },
        partially_approved: { label: "Partial Approval", class: "bg-indigo-100 text-indigo-800 border-indigo-200" },
        awaiting_check: { label: "Awaiting Check", class: "bg-purple-100 text-purple-800 border-purple-200" },
        dispatched: { label: "Dispatched", class: "bg-sky-100 text-sky-800 border-sky-200" },
        completed: { label: "Completed", class: "bg-emerald-100 text-emerald-800 border-emerald-200" },
        rejected: { label: "Rejected", class: "bg-red-100 text-red-800 border-red-200" },
    };
    const s = map[status];
    return <Badge variant="outline" className={`${s.class} font-medium text-xs`}>{s.label}</Badge>;
}

// ─── Order Row ─────────────────────────────────────
function OrderRow({ order, onSelect }: { order: Order; onSelect: (o: Order) => void }) {
    const prodName = order.items[0]?.product_id
        ? mockProducts.find(p => p.id === order.items[0]?.product_id)?.name ?? "—"
        : "—";
    const totalQty = order.items.reduce((s, i) => s + i.requested_qty, 0);
    return (
        <div
            className="flex flex-col sm:flex-row items-start sm:items-center gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer rounded-lg transition-colors group"
            onClick={() => onSelect(order)}
        >
            <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">#{order.id.split("-").pop()?.toUpperCase()}</span>
                    <StatusBadge status={order.status} />
                    <Badge variant="outline" className="text-xs">{order.payment_method === "cash" ? "💵 Cash" : "🏦 Check"}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                    {order.client?.full_name} · {prodName} · {totalQty.toLocaleString()} bags
                </p>
            </div>
            <div className="flex items-center gap-3 ml-auto">
                <span className="text-sm font-bold text-[var(--color-industrial-blue)]">
                    ₱{order.total_amount.toLocaleString()}
                </span>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
        </div>
    );
}

// ─── Approval Dialog ─────────────────────────────────────
function ApprovalDialog({ order, open, onClose }: { order: Order | null; open: boolean; onClose: () => void }) {
    const [approvedQtys, setApprovedQtys] = useState<Record<string, number>>({});
    const [adminNotes, setAdminNotes] = useState("");

    function handleApprove() {
        toast.success(`Order #${order?.id.split("-").pop()?.toUpperCase()} approved!`);
        onClose();
    }
    function handleReject() {
        toast.error(`Order #${order?.id.split("-").pop()?.toUpperCase()} rejected.`);
        onClose();
    }

    if (!order) return null;
    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Review Order #{order.id.split("-").pop()?.toUpperCase()}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="text-muted-foreground">Client</p>
                            <p className="font-semibold">{order.client?.full_name}</p>
                            <p className="text-xs text-muted-foreground">{order.client?.company_name}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Payment</p>
                            <p className="font-semibold capitalize">{order.payment_method}</p>
                        </div>
                    </div>
                    <div className="border rounded-lg divide-y">
                        {order.items.map((item) => {
                            const prod = mockProducts.find(p => p.id === item.product_id);
                            return (
                                <div key={item.id} className="p-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium">{prod?.name}</p>
                                            <p className="text-xs text-muted-foreground">{item.bag_type} · Requested: {item.requested_qty.toLocaleString()} bags</p>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Approve Quantity (max {item.requested_qty})</Label>
                                        <Input
                                            type="number"
                                            min={0}
                                            max={item.requested_qty}
                                            defaultValue={item.requested_qty}
                                            className="h-8 text-sm"
                                            onChange={(e) => setApprovedQtys({ ...approvedQtys, [item.id]: Number(e.target.value) })}
                                        />
                                        {(approvedQtys[item.id] ?? item.requested_qty) < item.requested_qty && (
                                            <p className="text-xs text-amber-600 flex items-center gap-1">
                                                <AlertTriangle className="w-3 h-3" />
                                                Partial approval — {item.requested_qty - (approvedQtys[item.id] ?? item.requested_qty)} bags go to customer balance
                                            </p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="space-y-1">
                        <Label>Admin Notes</Label>
                        <Textarea placeholder="Optional notes..." value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} className="text-sm resize-none" rows={2} />
                    </div>
                </div>
                <DialogFooter className="gap-2">
                    <Button variant="outline" className="text-destructive border-destructive hover:bg-destructive/10" onClick={handleReject}>
                        <X className="w-4 h-4 mr-1" /> Reject
                    </Button>
                    <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleApprove}>
                        <Check className="w-4 h-4 mr-1" /> Approve
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ─── Dispatch Dialog ─────────────────────────────────────
function DispatchDialog({ order, open, onClose }: { order: Order | null; open: boolean; onClose: () => void }) {
    if (!order) return null;
    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Dispatch Order #{order.id.split("-").pop()?.toUpperCase()}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">Select a shipment batch to deduct stock from.</p>
                    <div className="space-y-2">
                        {mockShipments.filter(s => s.bag_type === order.items[0]?.bag_type).map((ship) => (
                            <div key={ship.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary cursor-pointer transition-colors">
                                <div>
                                    <p className="text-sm font-semibold">{ship.batch_name}</p>
                                    <p className="text-xs text-muted-foreground">{ship.bag_type} · {ship.good_stock.toLocaleString()} available</p>
                                </div>
                                <Button size="sm" variant="outline" onClick={() => {
                                    toast.success(`Order dispatched from ${ship.batch_name}!`);
                                    onClose();
                                }}>Select</Button>
                            </div>
                        ))}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ─── Order Detail Panel ─────────────────────────────
function OrderDetailDialog({ order, open, onClose, mode }: {
    order: Order | null; open: boolean; onClose: () => void; mode: "approve" | "dispatch" | "view";
}) {
    if (!order) return null;
    if (mode === "approve") return <ApprovalDialog order={order} open={open} onClose={onClose} />;
    if (mode === "dispatch") return <DispatchDialog order={order} open={open} onClose={onClose} />;

    // View mode
    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Order #{order.id.split("-").pop()?.toUpperCase()}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 text-sm">
                    <div className="flex items-center gap-2">
                        <StatusBadge status={order.status} />
                        <span className="text-muted-foreground">·</span>
                        <span className="capitalize font-medium">{order.payment_method} payment</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 border rounded-lg p-3">
                        <div><p className="text-muted-foreground text-xs">Client</p><p className="font-semibold">{order.client?.full_name}</p></div>
                        <div><p className="text-muted-foreground text-xs">Company</p><p className="font-semibold">{order.client?.company_name || "—"}</p></div>
                        <div><p className="text-muted-foreground text-xs">Total</p><p className="font-bold text-[var(--color-industrial-blue)]">₱{order.total_amount.toLocaleString()}</p></div>
                        <div><p className="text-muted-foreground text-xs">Date</p><p className="font-semibold">{new Date(order.created_at).toLocaleDateString()}</p></div>
                    </div>
                    {order.items.map((item) => {
                        const prod = mockProducts.find(p => p.id === item.product_id);
                        return (
                            <div key={item.id} className="border rounded-lg p-3">
                                <p className="font-medium">{prod?.name}</p>
                                <div className="mt-1 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                                    <div><p>Requested</p><p className="font-bold text-foreground">{item.requested_qty.toLocaleString()}</p></div>
                                    <div><p>Approved</p><p className="font-bold text-emerald-600">{item.approved_qty.toLocaleString()}</p></div>
                                    <div><p>Dispatched</p><p className="font-bold text-blue-600">{item.dispatched_qty.toLocaleString()}</p></div>
                                </div>
                            </div>
                        );
                    })}
                    {order.notes && <p className="text-muted-foreground italic">Note: {order.notes}</p>}
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ─── Empty State ─────────────────────────────────────
function EmptyOrders({ label }: { label: string }) {
    return (
        <div className="py-16 text-center text-muted-foreground">
            <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">{label}</p>
        </div>
    );
}

// ─── Tab: Product Catalog ─────────────────────────────
function CatalogTab() {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {mockProducts.map((prod) => (
                <Card key={prod.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="pt-6 space-y-3">
                        <div className="flex items-start justify-between">
                            <div className="w-12 h-12 rounded-xl bg-[var(--color-industrial-blue)]/10 flex items-center justify-center">
                                <Package className="w-6 h-6 text-[var(--color-industrial-blue)]" />
                            </div>
                            <Badge variant="outline" className="text-xs font-bold">{prod.bag_type}</Badge>
                        </div>
                        <div>
                            <h3 className="font-bold text-sm">{prod.name}</h3>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{prod.description}</p>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t">
                            <span className="text-lg font-bold text-[var(--color-industrial-blue)]">₱{prod.price_per_bag.toLocaleString()}</span>
                            <span className="text-xs text-muted-foreground">per bag</span>
                        </div>
                        <Badge className={prod.is_active ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" : "bg-red-100 text-red-800 hover:bg-red-100"}>
                            {prod.is_active ? "Active" : "Inactive"}
                        </Badge>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

// ─── Orders Page ─────────────────────────────────────
export default function AdminOrdersPage() {
    const [orders, setOrders] = useState(mockOrders);
    const [selected, setSelected] = useState<Order | null>(null);
    const [dialogMode, setDialogMode] = useState<"approve" | "dispatch" | "view">("view");
    const [dialogOpen, setDialogOpen] = useState(false);

    function openDialog(order: Order, mode: "approve" | "dispatch" | "view") {
        setSelected(order);
        setDialogMode(mode);
        setDialogOpen(true);
    }

    const pending = orders.filter(o => o.status === "pending");
    const fulfillment = orders.filter(o => ["approved", "partially_approved", "awaiting_check"].includes(o.status));
    const dispatched = orders.filter(o => o.status === "dispatched");
    const history = orders.filter(o => ["completed", "rejected"].includes(o.status));

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Order Pipeline</h2>
                <p className="text-muted-foreground mt-1">Manage orders from request to delivery.</p>
            </div>

            <Tabs defaultValue="requests" className="space-y-4">
                <TabsList className="bg-muted w-full sm:w-auto flex-wrap h-auto gap-1 p-1">
                    <TabsTrigger value="catalog" className="text-xs sm:text-sm">Catalog</TabsTrigger>
                    <TabsTrigger value="requests" className="text-xs sm:text-sm flex items-center gap-1.5">
                        New Requests {pending.length > 0 && <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">{pending.length}</span>}
                    </TabsTrigger>
                    <TabsTrigger value="fulfillment" className="text-xs sm:text-sm">Fulfillment</TabsTrigger>
                    <TabsTrigger value="tracking" className="text-xs sm:text-sm">Tracking</TabsTrigger>
                    <TabsTrigger value="history" className="text-xs sm:text-sm">History</TabsTrigger>
                </TabsList>

                {/* Catalog */}
                <TabsContent value="catalog">
                    <CatalogTab />
                </TabsContent>

                {/* New Requests */}
                <TabsContent value="requests">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Pending Approval ({pending.length})</CardTitle>
                        </CardHeader>
                        <CardContent className="p-2">
                            {pending.length === 0 ? <EmptyOrders label="No pending orders" /> : (
                                <div className="space-y-1">
                                    {pending.map((order) => (
                                        <div key={order.id} className="flex flex-col sm:flex-row items-start sm:items-center gap-2 px-4 py-3 hover:bg-muted/50 rounded-lg transition-colors">
                                            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openDialog(order, "view")}>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="text-sm font-semibold">#{order.id.split("-").pop()?.toUpperCase()}</span>
                                                    <Badge variant="outline" className="text-xs capitalize">{order.payment_method}</Badge>
                                                    <StatusBadge status={order.status} />
                                                </div>
                                                <p className="text-sm text-muted-foreground mt-0.5">
                                                    {order.client?.full_name} · ₱{order.total_amount.toLocaleString()} · {order.items.reduce((s, i) => s + i.requested_qty, 0).toLocaleString()} bags
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button size="sm" variant="outline" className="text-destructive border-destructive hover:bg-destructive/10 h-7 px-2.5 text-xs"
                                                    onClick={() => { toast.error(`Order rejected.`); }}>
                                                    <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                                                </Button>
                                                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-7 px-2.5 text-xs"
                                                    onClick={() => openDialog(order, "approve")}>
                                                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Fulfillment */}
                <TabsContent value="fulfillment">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Ready for Dispatch ({fulfillment.length})</CardTitle>
                        </CardHeader>
                        <CardContent className="p-2">
                            {fulfillment.length === 0 ? <EmptyOrders label="No orders in fulfillment" /> : (
                                <div className="space-y-1">
                                    {fulfillment.map((order) => (
                                        <div key={order.id} className="flex flex-col sm:flex-row items-start sm:items-center gap-2 px-4 py-3 hover:bg-muted/50 rounded-lg transition-colors">
                                            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openDialog(order, "view")}>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="text-sm font-semibold">#{order.id.split("-").pop()?.toUpperCase()}</span>
                                                    <StatusBadge status={order.status} />
                                                </div>
                                                <p className="text-sm text-muted-foreground mt-0.5">
                                                    {order.client?.full_name} · ₱{order.total_amount.toLocaleString()}
                                                </p>
                                            </div>
                                            <Button size="sm" className="bg-[var(--color-industrial-blue)] hover:bg-[var(--color-industrial-blue)]/90 h-7 px-2.5 text-xs"
                                                onClick={() => openDialog(order, "dispatch")}>
                                                <Truck className="w-3.5 h-3.5 mr-1" /> Dispatch
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tracking */}
                <TabsContent value="tracking">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">In Transit ({dispatched.length})</CardTitle>
                        </CardHeader>
                        <CardContent className="p-2">
                            {dispatched.length === 0 ? <EmptyOrders label="No orders in transit" /> : (
                                <div className="space-y-1">
                                    {dispatched.map((order) => (
                                        <OrderRow key={order.id} order={order} onSelect={(o) => openDialog(o, "view")} />
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* History */}
                <TabsContent value="history">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Order History ({history.length})</CardTitle>
                        </CardHeader>
                        <CardContent className="p-2">
                            {history.length === 0 ? <EmptyOrders label="No completed orders" /> : (
                                <div className="space-y-1">
                                    {history.map((order) => (
                                        <OrderRow key={order.id} order={order} onSelect={(o) => openDialog(o, "view")} />
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <OrderDetailDialog order={selected} open={dialogOpen} onClose={() => setDialogOpen(false)} mode={dialogMode} />
        </div>
    );
}
