import { useState, useMemo } from "react";
import { Order, OrderItem } from "@/lib/types/database";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Check, X, FileText, Truck, MapPin, ExternalLink, Car, Search, Filter, Clock, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function NewRequestsTab({ orders, onApprove, onReject, onConfirmCheck, loading }: { 
    orders: Order[]; 
    onApprove: (id: string, items: {itemId: string, qty: number}[], shippingFee?: number) => Promise<void>; 
    onReject: (id: string, reason: string) => Promise<void>;
    onConfirmCheck?: (id: string) => Promise<void>;
    loading: boolean;
}) {
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [actionType, setActionType] = useState<"approve" | "reject" | "check" | null>(null);
    const [approvedQtys, setApprovedQtys] = useState<Record<string, number>>({});
    const [shippingFee, setShippingFee] = useState<number>(0);
    const [rejectionReason, setRejectionReason] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Search and Filter State
    const [searchQuery, setSearchQuery] = useState("");
    const [serviceFilter, setServiceFilter] = useState("all");
    const [paymentFilter, setPaymentFilter] = useState("all");

    const filteredOrders = useMemo(() => {
        return orders.filter(order => {
            const q = searchQuery.toLowerCase();
            const matchesSearch = 
                (order.po_number || "").toLowerCase().includes(q) || 
                (order.client?.company_name || order.client?.full_name || "").toLowerCase().includes(q) ||
                order.id.toLowerCase().includes(q);
            const matchesService = serviceFilter === "all" || order.service_type === serviceFilter;
            const matchesPayment = paymentFilter === "all" || order.payment_method === paymentFilter;
            return matchesSearch && matchesService && matchesPayment;
        });
    }, [orders, searchQuery, serviceFilter, paymentFilter]);

    const openAction = (order: Order, type: "approve" | "reject" | "check") => {
        setSelectedOrder(order);
        setActionType(type);
        if (type === "approve") {
            const initialQtys: Record<string, number> = {};
            if (order.is_split_delivery) {
                // Default approved quantities to the 'deliver now' request
                order.items.forEach(item => {
                    if (item.bag_type === "JB") initialQtys[item.id] = order.deliver_now_jb || 0;
                    else if (item.bag_type === "SB") initialQtys[item.id] = order.deliver_now_sb || 0;
                    else initialQtys[item.id] = item.requested_qty;
                });
            } else {
                order.items.forEach(item => { initialQtys[item.id] = item.requested_qty; });
            }
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
            } else if (actionType === "reject") {
                if (!rejectionReason.trim()) {
                    toast.error("Please provide a rejection reason.");
                    setIsSubmitting(false);
                    return;
                }
                await onReject(selectedOrder.id, rejectionReason);
            } else if (actionType === "check") {
                if (onConfirmCheck) {
                    await onConfirmCheck(selectedOrder.id);
                }
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
            <div className="flex flex-col md:flex-row gap-4 mb-6 bg-card p-4 rounded-xl border border-border shadow-sm">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input 
                        placeholder="Search by Client Name, PO Number, or ID..." 
                        className="pl-9 bg-background"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex gap-4">
                    <div className="w-40">
                        <Select value={serviceFilter} onValueChange={(val) => setServiceFilter(val || "all")}>
                            <SelectTrigger className="bg-background">
                                <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                                <SelectValue placeholder="Service" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Services</SelectItem>
                                <SelectItem value="deliver">Delivery</SelectItem>
                                <SelectItem value="pickup">Pick-up</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="w-40">
                        <Select value={paymentFilter} onValueChange={(val) => setPaymentFilter(val || "all")}>
                            <SelectTrigger className="bg-background">
                                <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                                <SelectValue placeholder="Payment" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Payments</SelectItem>
                                <SelectItem value="cash">Cash</SelectItem>
                                <SelectItem value="check">Check</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {filteredOrders.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground border-2 border-dashed rounded-xl">
                    No requests match your filters.
                </div>
            ) : (
                filteredOrders.map(order => {
                    const jbItem = order.items.find(i => i.bag_type === "JB");
                    const sbItem = order.items.find(i => i.bag_type === "SB");
                    const totalBags = order.items.reduce((sum, item) => sum + item.requested_qty, 0);

                    return (
                        <Card key={order.id} className="overflow-hidden border-l-4 border-l-accent hover:shadow-md transition-shadow">
                            <CardContent className="p-0">
                                <div className="flex flex-col md:flex-row">
                                    <div className="p-5 flex-1 space-y-4">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    {order.status === "pending_final_confirmation" ? (
                                                        <Badge className="bg-blue-100 text-blue-700 border-blue-200">Check Uploaded - Needs Review</Badge>
                                                    ) : order.status === "awaiting_check" ? (
                                                        <Badge className="bg-amber-100 text-amber-700 border-amber-200">Awaiting Client Check Upload</Badge>
                                                    ) : (
                                                        <Badge className="bg-accent text-accent-foreground hover:bg-accent/90">New Request</Badge>
                                                    )}
                                                    {order.is_split_delivery && (
                                                        <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50 font-bold">SPLIT</Badge>
                                                    )}
                                                    <span className="text-xs text-muted-foreground">ID: {order.id.slice(0,8)}</span>
                                                    <span className="text-xs text-muted-foreground">• {new Date(order.created_at).toLocaleDateString()}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="w-8 h-8 border border-border/50">
                                                        {order.client?.avatar_url ? (
                                                            <AvatarImage src={order.client.avatar_url} alt="Client" className="object-cover" />
                                                        ) : (
                                                            <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-bold">
                                                                {(order.client?.full_name || "CL").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                                                            </AvatarFallback>
                                                        )}
                                                    </Avatar>
                                                    <h3 className="text-lg font-bold">
                                                        {order.client?.company_name || order.client?.full_name}
                                                    </h3>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Payment Method</p>
                                                <Badge variant="outline" className={`mt-1 font-mono uppercase ${order.payment_method === 'check' ? 'border-accent text-accent' : 'border-primary text-primary'}`}>
                                                    {order.payment_method}
                                                </Badge>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-3 border-y border-border/50 bg-muted/20">
                                            <div>
                                                <p className="text-xs text-muted-foreground mb-1">PO Details</p>
                                                {order.po_number ? (
                                                    <div className="flex items-center gap-1.5 text-sm font-medium">
                                                        <FileText className="w-4 h-4 text-primary" />
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
                                            <div className="col-span-2">
                                                <p className="text-xs text-muted-foreground mb-1">Ordered Quantity</p>
                                                <div className="flex flex-wrap gap-3">
                                                    {jbItem && (jbItem.requested_qty > 0 || order.deliver_now_jb > 0) && (
                                                        <div className="bg-primary/5 border border-primary/10 rounded px-2 py-1">
                                                            <p className="text-lg font-bold text-foreground leading-none">
                                                                {order.is_split_delivery ? (
                                                                    <span>{order.deliver_now_jb} <span className="text-[10px] text-muted-foreground font-normal">/ {jbItem.requested_qty}</span></span>
                                                                ) : (
                                                                    jbItem.requested_qty
                                                                )}
                                                                <span className="ml-1 text-xs font-medium text-muted-foreground uppercase">JB</span>
                                                            </p>
                                                        </div>
                                                    )}
                                                    {sbItem && (sbItem.requested_qty > 0 || order.deliver_now_sb > 0) && (
                                                        <div className="bg-primary/5 border border-primary/10 rounded px-2 py-1">
                                                            <p className="text-lg font-bold text-foreground leading-none">
                                                                {order.is_split_delivery ? (
                                                                    <span>{order.deliver_now_sb} <span className="text-[10px] text-muted-foreground font-normal">/ {sbItem.requested_qty}</span></span>
                                                                ) : (
                                                                    sbItem.requested_qty
                                                                )}
                                                                <span className="ml-1 text-xs font-medium text-muted-foreground uppercase">SB</span>
                                                            </p>
                                                        </div>
                                                    )}
                                                    {totalBags > 0 && !jbItem && !sbItem && (
                                                        <p className="text-lg font-bold text-foreground">{totalBags} bags</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="flex justify-between items-center pt-1">
                                            <div className="text-sm">
                                                <span className="text-muted-foreground">Total Value: </span>
                                                <span className="font-bold text-primary">₱{order.total_amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                            </div>
                                            {order.check_image_url && (
                                                <div className="flex gap-2">
                                                    <a href={order.check_image_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded">
                                                        <ExternalLink className="w-3 h-3" />
                                                        View Check
                                                    </a>
                                                    {order.po_image_url && (
                                                        <a href={order.po_image_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 bg-primary/5 border border-primary/10 px-2 py-1 rounded">
                                                            <ExternalLink className="w-3 h-3" />
                                                            View PO
                                                        </a>
                                                    )}
                                                </div>
                                            )}
                                            {!order.check_image_url && order.po_image_url && (
                                                <a href={order.po_image_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 bg-primary/5 border border-primary/10 px-2 py-1 rounded">
                                                    <ExternalLink className="w-3 h-3" />
                                                    View PO Document
                                                </a>
                                            )}
                                        </div>
                                        {order.status === "pending_final_confirmation" && (
                                            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                                                <p className="font-semibold mb-1 flex items-center gap-1.5">
                                                    <CreditCard className="w-4 h-4" /> Payment Details
                                                </p>
                                                <p className="text-xs">
                                                    {order.payment_method === "check" ? (
                                                        <>Check Number: <span className="font-mono font-bold">{order.check_number}</span></>
                                                    ) : (
                                                        <>Payment Method: <span className="font-bold uppercase">Cash</span></>
                                                    )}
                                                </p>
                                            </div>
                                        )}
                                        {order.service_type === "pickup" && (
                                            <div className="rounded-md border border-accent/20 bg-accent/5 px-4 py-3 text-sm text-accent">
                                                <p className="font-semibold text-accent mb-2 flex items-center gap-1.5">
                                                    <Car className="w-4 h-4" />
                                                    Pick-up Details
                                                </p>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <p className="text-xs text-accent/60 font-medium uppercase tracking-wider">Driver</p>
                                                        <p className="font-semibold text-accent">{order.driver_name || <span className="text-destructive font-normal italic">Not provided</span>}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-accent/60 font-medium uppercase tracking-wider">Plate No.</p>
                                                        <p className="font-semibold text-accent font-mono">{order.plate_number || <span className="text-destructive font-normal italic">Not provided</span>}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {order.notes && (
                                            <div className="rounded-md border border-muted bg-muted/20 px-4 py-3 text-sm">
                                                <p className="font-semibold text-muted-foreground mb-1 flex items-center gap-1.5">
                                                    <FileText className="w-4 h-4" /> Notes
                                                </p>
                                                <p className="text-muted-foreground whitespace-pre-wrap">{order.notes}</p>
                                            </div>
                                        )}
                                    </div>
<<<<<<< HEAD
                                    <div className="bg-muted/40 p-5 md:w-48 flex flex-col justify-center gap-3 border-l border-border/50">
                                        {order.status === "pending_final_confirmation" ? (
                                            <Button onClick={() => openAction(order, "check")} className="w-full bg-blue-600 hover:bg-blue-700">
                                                <Check className="w-4 h-4 mr-2" /> Review & Confirm
                                            </Button>
                                        ) : order.status === "awaiting_check" ? (
                                            <Button disabled className="w-full bg-gray-200 text-gray-500 border-gray-300">
                                                <Clock className="w-4 h-4 mr-2" /> Waiting...
                                            </Button>
                                        ) : (
                                            <Button onClick={() => openAction(order, "approve")} className="w-full bg-primary hover:bg-primary/90">
                                                <Check className="w-4 h-4 mr-2" /> Approve
                                            </Button>
                                        )}
                                        <Button 
                                            onClick={() => openAction(order, "reject")} 
                                            variant="outline" 
                                            className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
                                            disabled={order.status === "awaiting_check"}
                                        >
                                            <X className="w-4 h-4 mr-2" /> Reject
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })
            )}

            <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{actionType === "approve" ? "Approve Order" : actionType === "check" ? "Final Payment Confirmation" : "Reject Order"}</DialogTitle>
                        <DialogDescription>
                            {actionType === "approve" 
                                ? "Review requested quantities and set shipping details. You can partially approve items if stock is low."
                                : actionType === "check"
                                ? `Are you sure you want to confirm this ${selectedOrder?.payment_method} payment? This will move the order to the Fulfillment queue.`
                                : "Please provide a reason for rejecting this order."}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedOrder && actionType === "approve" && (
                        <div className="space-y-5 py-4">
                            <div className="bg-accent/10 text-accent p-3 rounded-lg text-sm border border-accent/20">
                                <p className="font-semibold mb-1">Approval Workflow</p>
                                <ul className="list-disc pl-5 space-y-0.5 text-xs">
                                    {selectedOrder.payment_method === 'check' 
                                        ? <li>This is a <b>Check</b> payment. Approval will move it to "Awaiting Check" status.</li>
                                        : <li>This is a <b>Cash</b> payment. Approval will move it directly to Fulfillment.</li>}
                                    {selectedOrder.is_split_delivery && (
                                        <li className="text-amber-700 font-bold">
                                            CLIENT REQUESTED SPLIT: Deliver <b>{selectedOrder.deliver_now_jb}</b> JB and <b>{selectedOrder.deliver_now_sb}</b> SB now.
                                        </li>
                                    )}
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
                                                value={approvedQtys[item.id] || ""}
                                                placeholder="0"
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
                                        value={shippingFee || ""}
                                        placeholder="0"
                                        onChange={(e) => setShippingFee(parseFloat(e.target.value) || 0)}
                                    />
                                    <p className="text-xs text-muted-foreground">Required for delivery orders.</p>
                                </div>
                            )}
                            {selectedOrder.po_image_url && (
                                <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg border text-sm mt-3">
                                    <span className="text-muted-foreground">PO Document</span>
                                    <a href={selectedOrder.po_image_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline font-medium">
                                        <ExternalLink className="w-3.5 h-3.5" />
                                        View
                                    </a>
                                </div>
                            )}
                            {selectedOrder.service_type === "pickup" && (
                                <div className="p-3 bg-accent/5 border border-accent/20 rounded-lg text-sm mt-3">
                                    <p className="font-semibold text-accent mb-1.5 flex items-center gap-1.5"><Car className="w-4 h-4" />Pick-up Details</p>
                                    <div className="grid grid-cols-2 gap-2 text-amber-900">
                                        <div><p className="text-xs text-amber-600 font-medium">Driver</p><p className="font-semibold">{selectedOrder.driver_name || <span className="text-red-500 italic font-normal">Missing</span>}</p></div>
                                        <div><p className="text-xs text-amber-600 font-medium">Plate</p><p className="font-semibold font-mono">{selectedOrder.plate_number || <span className="text-red-500 italic font-normal">Missing</span>}</p></div>
                                    </div>
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
                            className={actionType === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : actionType === "check" ? "bg-amber-600 hover:bg-amber-700" : "bg-destructive hover:bg-destructive/90"}
                        >
                            {isSubmitting ? "Processing..." : actionType === "approve" ? "Confirm Approval" : actionType === "check" ? "Confirm Final Payment" : "Confirm Rejection"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
