import { useState } from "react";
import { Order, OrderItem } from "@/lib/types/database";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Check, X, FileText, User, Truck, MapPin } from "lucide-react";
import { toast } from "sonner";

export function NewRequestsTab({ orders, onApprove, onReject, loading }: { 
    orders: Order[]; 
    onApprove: (id: string, items: {itemId: string, qty: number}[], shippingFee?: number) => Promise<void>; 
    onReject: (id: string, reason: string) => Promise<void>;
    loading: boolean;
}) {
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
    const [approvedQtys, setApprovedQtys] = useState<Record<string, number>>({});
    const [shippingFee, setShippingFee] = useState<number>(0);
    const [rejectionReason, setRejectionReason] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const openAction = (order: Order, type: "approve" | "reject") => {
        setSelectedOrder(order);
        setActionType(type);
        if (type === "approve") {
            const initialQtys: Record<string, number> = {};
            order.items.forEach(item => { initialQtys[item.id] = item.requested_qty; });
            setApprovedQtys(initialQtys);
            setShippingFee(order.service_type === 'deliver' ? (order.shipping_fee || 0) : 0);
        } else {
            setRejectionReason("");
        }
    };

    const handleSubmit = async () => {
        if (!selectedOrder || !actionType) return;
        setIsSubmitting(true);
        try {
            if (actionType === "approve") {
                const itemsToApprove = selectedOrder.items.map(item => ({
                    itemId: item.id,
                    qty: approvedQtys[item.id] ?? item.requested_qty
                }));
                await onApprove(selectedOrder.id, itemsToApprove, selectedOrder.service_type === 'deliver' ? shippingFee : undefined);
            } else {
                if (!rejectionReason.trim()) {
                    toast.error("Please provide a rejection reason.");
                    setIsSubmitting(false);
                    return;
                }
                await onReject(selectedOrder.id, rejectionReason);
            }
            setSelectedOrder(null);
            setActionType(null);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return <div className="py-8 text-center text-muted-foreground animate-pulse">Loading requests...</div>;
    if (orders.length === 0) return <div className="py-12 text-center text-muted-foreground border-2 border-dashed rounded-xl">No pending requests.</div>;

    return (
        <div className="space-y-4">
            {orders.map(order => {
                const jbItem = order.items.find(i => i.bag_type === "JB");
                const sbItem = order.items.find(i => i.bag_type === "SB");
                const totalBags = order.items.reduce((sum, item) => sum + item.requested_qty, 0);

                return (
                    <Card key={order.id} className="overflow-hidden border-l-4 border-l-[var(--color-industrial-yellow)] hover:shadow-md transition-shadow">
                        <CardContent className="p-0">
                            <div className="flex flex-col md:flex-row">
                                <div className="p-5 flex-1 space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <Badge className="bg-[var(--color-industrial-yellow)] text-white hover:bg-[var(--color-industrial-yellow-light)]">New Request</Badge>
                                                <span className="text-xs text-muted-foreground">ID: {order.id.slice(0,8)}</span>
                                                <span className="text-xs text-muted-foreground">• {new Date(order.created_at).toLocaleDateString()}</span>
                                            </div>
                                            <h3 className="text-lg font-bold flex items-center gap-2">
                                                <User className="w-4 h-4 text-muted-foreground" />
                                                {order.client?.company_name || order.client?.full_name}
                                            </h3>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Payment Method</p>
                                            <Badge variant="outline" className={`mt-1 font-mono uppercase ${order.payment_method === 'check' ? 'border-amber-500 text-amber-700' : 'border-emerald-500 text-emerald-700'}`}>
                                                {order.payment_method}
                                            </Badge>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-3 border-y border-border/50 bg-muted/20">
                                        <div>
                                            <p className="text-xs text-muted-foreground mb-1">PO Details</p>
                                            {order.po_number ? (
                                                <div className="flex items-center gap-1.5 text-sm font-medium">
                                                    <FileText className="w-4 h-4 text-[var(--color-industrial-blue)]" />
                                                    {order.po_number}
                                                </div>
                                            ) : <span className="text-sm text-muted-foreground italic">None</span>}
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground mb-1">Source & Service</p>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="secondary" className="text-[10px] uppercase">{order.source}</Badge>
                                                <Badge variant="secondary" className="text-[10px] uppercase flex items-center gap-1">
                                                    {order.service_type === 'deliver' ? <Truck className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
                                                    {order.service_type}
                                                </Badge>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground mb-1">Requested JB</p>
                                            <p className="text-lg font-bold text-[var(--color-industrial-slate)]">{jbItem?.requested_qty || 0}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground mb-1">Requested SB</p>
                                            <p className="text-lg font-bold text-[var(--color-industrial-slate)]">{sbItem?.requested_qty || 0}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex justify-between items-center pt-1">
                                        <div className="text-sm">
                                            <span className="text-muted-foreground">Total Value: </span>
                                            <span className="font-bold text-[var(--color-industrial-blue)]">₱{order.total_amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                        </div>
                                        {order.po_image_url && (
                                            <a href={order.po_image_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                                                View PO Document
                                            </a>
                                        )}
                                    </div>
                                </div>
                                <div className="bg-muted/40 p-5 md:w-48 flex flex-col justify-center gap-3 border-l border-border/50">
                                    <Button onClick={() => openAction(order, "approve")} className="w-full bg-[var(--color-industrial-blue)] hover:bg-[var(--color-industrial-blue-light)]">
                                        <Check className="w-4 h-4 mr-2" /> Approve
                                    </Button>
                                    <Button onClick={() => openAction(order, "reject")} variant="outline" className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20">
                                        <X className="w-4 h-4 mr-2" /> Reject
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                );
            })}

            <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{actionType === "approve" ? "Approve Order" : "Reject Order"}</DialogTitle>
                        <DialogDescription>
                            {actionType === "approve" 
                                ? "Review requested quantities and set shipping details. You can partially approve items if stock is low."
                                : "Please provide a reason for rejecting this order."}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedOrder && actionType === "approve" && (
                        <div className="space-y-5 py-4">
                            <div className="bg-amber-50 text-amber-800 p-3 rounded-lg text-sm border border-amber-200">
                                <p className="font-semibold mb-1">Approval Workflow</p>
                                <ul className="list-disc pl-5 space-y-0.5 text-xs">
                                    {selectedOrder.payment_method === 'check' 
                                        ? <li>This is a <b>Check</b> payment. Approval will move it to "Awaiting Check" status.</li>
                                        : <li>This is a <b>Cash</b> payment. Approval will move it directly to Fulfillment.</li>}
                                    <li>If you approve less than requested, the remaining bags will automatically become a Customer Balance.</li>
                                </ul>
                            </div>

                            <div className="space-y-4">
                                <h4 className="font-semibold text-sm border-b pb-2">Requested Quantities</h4>
                                {selectedOrder.items.map(item => (
                                    <div key={item.id} className="flex items-center gap-4">
                                        <div className="w-16">
                                            <Badge variant="outline" className="font-mono">{item.bag_type}</Badge>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-xs text-muted-foreground">Requested: {item.requested_qty}</p>
                                        </div>
                                        <div className="w-32">
                                            <Label className="text-xs mb-1 block">Approve Qty</Label>
                                            <Input 
                                                type="number" 
                                                min="0" 
                                                max={item.requested_qty}
                                                value={approvedQtys[item.id] || 0}
                                                onChange={(e) => setApprovedQtys(prev => ({...prev, [item.id]: parseInt(e.target.value) || 0}))}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {selectedOrder.service_type === 'deliver' && (
                                <div className="space-y-2 pt-2 border-t">
                                    <Label>Shipping Fee (₱)</Label>
                                    <Input 
                                        type="number" 
                                        value={shippingFee}
                                        onChange={(e) => setShippingFee(parseFloat(e.target.value) || 0)}
                                    />
                                    <p className="text-xs text-muted-foreground">Required for delivery orders.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {selectedOrder && actionType === "reject" && (
                        <div className="space-y-2 py-4">
                            <Label>Reason for Rejection <span className="text-red-500">*</span></Label>
                            <Textarea 
                                placeholder="e.g. Insufficient stock, Invalid PO, etc."
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                rows={4}
                            />
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSelectedOrder(null)} disabled={isSubmitting}>Cancel</Button>
                        <Button 
                            onClick={handleSubmit} 
                            disabled={isSubmitting}
                            className={actionType === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-destructive hover:bg-destructive/90"}
                        >
                            {isSubmitting ? "Processing..." : actionType === "approve" ? "Confirm Approval" : "Confirm Rejection"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
