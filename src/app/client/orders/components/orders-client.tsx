"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { submitPaymentDetails, submitOrderReturn } from "@/lib/actions/client-actions";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    CornerDownLeft, PackageSearch, CreditCard, UploadCloud, Truck, CheckCircle2, History,
    AlertCircle, Info, Search, CalendarDays, ChevronDown, ChevronUp,
    Clock, CircleDot, Package, ArrowRight
} from "lucide-react";

import { Order, OrderItem } from "@/lib/types/database";

// ─── Tracking progress steps ─────────────────────────────────
const TRACKING_STEPS = [
    { key: "approved", label: "Approved", icon: CheckCircle2 },
    { key: "payment_submitted", label: "Payment Submitted", icon: CreditCard },
    { key: "dispatched", label: "Dispatched", icon: Package },
    { key: "in_transit", label: "In Transit", icon: Truck },
    { key: "delivered", label: "Delivered", icon: CircleDot },
];

function getActiveStep(order: Order): number {
    if (order.status === "completed" || order.tracking_status === "delivered") return 4;
    if (order.tracking_status === "in_transit") return 3;
    if (order.status === "dispatched") return 2;
    if (order.status === "pending_final_confirmation" || order.status === "awaiting_check" || (order.status === "approved" && (order.check_number || order.payment_method === "cash"))) return 1;
    if (order.status === "approved") return 0;
    return -1;
}

function TrackingProgressBar({ order }: { order: Order }) {
    const activeStep = getActiveStep(order);
    if (activeStep < 0) return null;

    return (
        <div className="px-2 py-3">
            <div className="flex items-center justify-between">
                {TRACKING_STEPS.map((step, idx) => {
                    const StepIcon = step.icon;
                    const isCompleted = idx <= activeStep;
                    const isCurrent = idx === activeStep;
                    return (
                        <div key={step.key} className="flex items-center flex-1 last:flex-initial">
                            <div className="flex flex-col items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                                    isCompleted
                                        ? "bg-emerald-500 border-emerald-500 text-white"
                                        : isCurrent
                                        ? "border-primary text-primary bg-primary/10"
                                        : "bg-background border-border text-muted-foreground"
                                }`}>
                                    <StepIcon className="w-4 h-4" />
                                </div>
                                <span className={`text-[9px] mt-1.5 text-center leading-tight max-w-[60px] ${
                                    isCompleted 
                                        ? "text-emerald-500 font-semibold" 
                                        : "text-muted-foreground"
                                }`}>
                                    {step.label}
                                </span>
                            </div>
                            {idx < TRACKING_STEPS.length - 1 && (
                                <div className={`flex-1 h-0.5 mx-1.5 mt-[-14px] ${idx < activeStep ? "bg-emerald-500" : "bg-muted"}`} />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default function OrdersClient({ orders }: { orders: Order[] }) {
    const router = useRouter();
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [isPaymentOpen, setIsPaymentOpen] = useState(false);
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
    
    // Payment Form
    const [checkNumber, setCheckNumber] = useState("");
    const [checkFile, setCheckFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Return Report
    const [isReturnOpen, setIsReturnOpen] = useState(false);
    const [returnJb, setReturnJb] = useState(0);
    const [returnSb, setReturnSb] = useState(0);
    const [returnReason, setReturnReason] = useState("");

    // History filters
    const [searchQuery, setSearchQuery] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    const pendingOrders = orders.filter(o => o.status === "pending" || o.status === "partially_approved");
    const activeOrders = orders.filter(o => o.status === "approved" || o.status === "awaiting_check" || o.status === "pending_final_confirmation" || o.status === "dispatched");
    const historyOrders = useMemo(() => {
        let filtered = orders.filter(o => o.status === "completed" || o.status === "rejected");
        
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(o =>
                (o.po_number?.toLowerCase().includes(q)) ||
                (o.dr_number?.toLowerCase().includes(q))
            );
        }
        if (dateFrom) {
            filtered = filtered.filter(o => new Date(o.created_at) >= new Date(dateFrom));
        }
        if (dateTo) {
            const end = new Date(dateTo);
            end.setHours(23, 59, 59);
            filtered = filtered.filter(o => new Date(o.created_at) <= end);
        }
        return filtered;
    }, [orders, searchQuery, dateFrom, dateTo]);

    const handleOpenPayment = (order: Order) => {
        setSelectedOrder(order);
        setCheckNumber("");
        setCheckFile(null);
        setIsPaymentOpen(true);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setCheckFile(e.target.files[0]);
        }
    };

    const handleConfirmCash = async () => {
        if (!selectedOrder) return;
        setIsSubmitting(true);
        try {
            await submitPaymentDetails(selectedOrder.id, "cash");
            toast.success("Cash payment submitted! Awaiting admin confirmation.");
            setIsPaymentOpen(false);
            router.refresh();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Failed to confirm payment.";
            toast.error(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmitCheck = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedOrder || !checkFile || !checkNumber) return;

        setIsSubmitting(true);
        try {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            const fileExt = checkFile.name.split('.').pop();
            const timestamp = Date.now();
            const random = Math.random().toString(36).substring(7);
            const fileName = `${user.id}/check_${timestamp}_${random}.${fileExt}`;
            const { error: uploadError } = await supabase.storage
                .from('order-attachments')
                .upload(fileName, checkFile);

            if (uploadError) throw new Error("Failed to upload check image.");
            const { data: { publicUrl } } = supabase.storage.from('order-attachments').getPublicUrl(fileName);

            await submitPaymentDetails(selectedOrder.id, "check", checkNumber, publicUrl);
            
            toast.success("Check payment submitted! Awaiting admin verification.");
            setIsPaymentOpen(false);
            router.refresh();
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : "An error occurred while submitting check.";
            toast.error(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleExpanded = (orderId: string) => {
        setExpandedOrderId(expandedOrderId === orderId ? null : orderId);
    };

    const handleOpenReturn = (order: Order) => {
        setSelectedOrder(order);
        setReturnJb(0);
        setReturnSb(0);
        setReturnReason("");
        setIsReturnOpen(true);
    };

    const handleSubmitReturn = async () => {
        if (!selectedOrder) return;
        if (returnJb <= 0 && returnSb <= 0) {
            toast.error("Please enter at least one bag quantity to return.");
            return;
        }
        if (!returnReason.trim()) {
            toast.error("Please provide a reason for the return.");
            return;
        }
        setIsSubmitting(true);
        try {
            await submitOrderReturn(selectedOrder.id, returnJb, returnSb, returnReason);
            toast.success("Return request submitted. The warehouse team will review it shortly.");
            setIsReturnOpen(false);
            router.refresh();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Failed to submit return request.";
            toast.error(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderOrderCard = (order: Order, type: "pending" | "active" | "history") => {
        const totalBags = order.items.reduce((acc: number, item: OrderItem) => acc + (item.requested_qty || 0), 0);
        const grandTotal = order.total_amount + (order.shipping_fee || 0);
        const isExpanded = expandedOrderId === order.id;
        const isRedelivery = order.order_type === "redelivery";

        return (
            <Card key={order.id} className="mb-4 shadow-sm overflow-hidden bg-card border-border">
                <CardHeader className="bg-muted/30 border-b pb-3 pt-4 cursor-pointer" onClick={() => toggleExpanded(order.id)}>
                    <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <CardTitle className="text-base text-foreground truncate">PO: {order.po_number}</CardTitle>
                                {isRedelivery && (
                                    <Badge variant="outline" className="text-[10px] border-status-info-text/30 text-status-info-text bg-status-info-bg/50">
                                        Re-delivery
                                    </Badge>
                                )}
                            </div>
                            <CardDescription className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                {new Date(order.created_at).toLocaleDateString()}
                                <span>•</span>
                                <span className="capitalize">{order.service_type === 'pickup' ? 'Pick-up' : 'Deliver'}</span>
                                {isRedelivery && order.linked_po_number && (
                                    <>
                                        <span>•</span>
                                        <span className="text-primary">Linked to {order.linked_po_number}</span>
                                    </>
                                )}
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-right">
                                <div className="font-bold text-foreground">₱{grandTotal.toLocaleString()}</div>
                                <div className="text-xs text-muted-foreground capitalize">{order.payment_method}</div>
                            </div>
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                            <p className="text-muted-foreground text-xs">Items</p>
                            <p className="font-medium text-foreground">{totalBags} <span className="text-muted-foreground font-normal">indiv. bags</span></p>
                        </div>
                        <div>
                            <p className="text-muted-foreground text-xs">Shipping Fee</p>
                            <p className="font-medium text-foreground">₱{(order.shipping_fee || 0).toLocaleString()}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground text-xs">Source</p>
                            <p className="font-medium text-foreground uppercase">{order.source}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground text-xs">Status</p>
                            {order.status === "pending" && <Badge variant="secondary" className="whitespace-normal text-center">Awaiting Approval</Badge>}
                            {order.status === "partially_approved" && <Badge className="bg-status-info-bg text-status-info-text border-status-info-text/20 whitespace-normal text-center">Partially Approved</Badge>}
                            {order.status === "approved" && (
                                 <Badge className={order.payment_method === 'cash' ? "bg-status-success-bg text-status-success-text border-status-success-border/20 whitespace-normal text-center" : "bg-status-pending-bg text-status-pending-text border-status-pending-border whitespace-normal text-center"}>
                                     {order.payment_method === 'cash' ? "Ready for Dispatch" : "Payment Required"}
                                 </Badge>
                             )}
                            {order.status === "awaiting_check" && <Badge className="bg-status-pending-bg text-status-pending-text border-status-pending-border whitespace-normal text-center">Upload Check</Badge>}
                            {order.status === "pending_final_confirmation" && <Badge className="bg-status-success-bg text-status-success-text border-status-success-border whitespace-normal text-center">✅ Payment Submitted</Badge>}
                            {order.status === "dispatched" && (
                                <Badge className="bg-status-success-bg text-status-success-text border-status-success-border/20 whitespace-normal text-center">
                                    {order.tracking_status === "in_transit" ? "In Transit" : "Dispatched"}
                                </Badge>
                            )}
                            {order.status === "completed" && <Badge variant="outline" className="border-status-success-border text-status-success-text whitespace-normal text-center">Completed</Badge>}
                            {order.status === "rejected" && <Badge variant="destructive" className="whitespace-normal text-center">Rejected</Badge>}
                        </div>
                    </div>

                    {/* Report Return — for dispatched and completed orders */}
                    {(order.status === "dispatched" || order.status === "completed") && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full gap-2 border-border text-foreground hover:bg-muted"
                            onClick={() => handleOpenReturn(order)}
                        >
                            <CornerDownLeft className="w-4 h-4" />
                            Report Return
                        </Button>
                    )}

                    {/* Split delivery badge */}
                    {order.is_split_delivery && (
                        <div className="flex items-center gap-2 text-xs text-status-info-text bg-status-info-bg border border-status-info-text/20 rounded-lg px-3 py-2">
                            <ArrowRight className="w-3 h-3" />
                            <span>Split delivery: {order.deliver_now_qty} bags now, rest saved to balance</span>
                        </div>
                    )}

                    {/* Check Payment Upload (Only for Check method + Awaiting status) */}
                    {type === "active" && order.status === "awaiting_check" && order.payment_method === "check" && (
                        <div className="p-3 bg-status-pending-bg border border-status-pending-border rounded-lg space-y-3">
                            <div className="flex items-start gap-2">
                                <AlertCircle className="w-5 h-5 text-status-pending-text shrink-0 mt-0.5" />
                                <div>
                                    <span className="text-sm text-foreground font-medium">Order Approved – Awaiting Payment.</span>
                                    {order.shipping_fee > 0 && (
                                        <span className="text-sm text-foreground"> Shipping Fee: <strong>₱{order.shipping_fee.toLocaleString()}</strong>.</span>
                                    )}
                                    <p className="text-xs text-muted-foreground mt-1">Please upload a picture of your check to proceed.</p>
                                </div>
                            </div>
                            <Button size="sm" className="bg-status-pending-text hover:bg-status-pending-text/80 text-background w-full sm:w-auto" onClick={() => handleOpenPayment(order)}>
                                <UploadCloud className="w-4 h-4 mr-2" />
                                Upload Check Details
                            </Button>
                        </div>
                    )}

                    {/* Approved / Ready for Dispatch Banner (For Cash COD or Verified Check) */}
                    {type === "active" && order.status === "approved" && (
                        <div className="p-3 bg-status-success-bg border border-status-success-border rounded-lg space-y-2">
                            <div className="flex items-start gap-2">
                                <CheckCircle2 className="w-5 h-5 text-status-success-text shrink-0 mt-0.5" />
                                <div>
                                    <span className="text-sm text-status-success-text font-bold">Your order has been approved.</span>
                                    {order.shipping_fee > 0 && (
                                        <span className="text-sm text-status-success-text"> Shipping Fee: <strong>₱{order.shipping_fee.toLocaleString()}</strong>.</span>
                                    )}
                                    <p className="text-xs text-status-success-text mt-1">
                                        Your order is queued for dispatch. {order.payment_method === 'cash' 
                                            ? "Please prepare the cash payment for collection upon delivery." 
                                            : "Your check payment has been verified."}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Awaiting admin verification (Both cash & check) */}
                    {type === "active" && order.status === "pending_final_confirmation" && (
                        <div className="p-3 bg-status-success-bg border border-status-success-border rounded-lg text-sm text-status-success-text flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-status-success-text" />
                            <span>Payment Submitted – Awaiting Admin Confirmation.</span>
                        </div>
                    )}
                    
                    {/* Tracking progress bar + details */}
                    {type === "active" && (order.status === "dispatched" || order.status === "approved" || order.status === "awaiting_check" || order.status === "pending_final_confirmation") && (
                        <TrackingProgressBar order={order} />
                    )}

                    {type === "active" && order.status === "dispatched" && (
                        <div className="p-3 bg-status-success-bg border border-status-success-border/20 rounded-lg text-sm text-status-success-text flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                            <div className="flex items-center gap-2">
                                <Truck className="w-4 h-4" />
                                <span className="font-semibold">Tracking:</span> {order.tracking_status === "in_transit" ? "Currently in transit" : "Prepared for dispatch"}
                            </div>
                            {order.dr_number && <div>DR: <span className="font-mono">{order.dr_number}</span></div>}
                        </div>
                    )}

                    {/* Rejection reason */}
                    {order.status === "rejected" && order.rejection_reason && (
                        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-destructive" />
                            <div>
                                <span className="font-medium">Rejection Reason:</span> {order.rejection_reason}
                            </div>
                        </div>
                    )}

                    {/* Expanded details */}
                    {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-border space-y-3">
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Order Items</h4>
                            <div className="space-y-2">
                                {order.items.map((item: any) => (
                                    <div key={item.id} className="flex justify-between items-center gap-3 p-2 bg-muted/30 rounded text-sm">
                                        <div className="min-w-0">
                                            <span className="font-medium truncate block">{item.product?.name || "Product"}</span>
                                            <span className="text-muted-foreground">({item.bag_type})</span>
                                        </div>
                                        <div className="text-right text-xs text-muted-foreground shrink-0">
                                            <div>Requested: {item.requested_qty}</div>
                                            {item.approved_qty > 0 && <div className="text-emerald-500 font-medium">Approved: {item.approved_qty}</div>}
                                            {item.dispatched_qty > 0 && <div className="text-blue-500 font-medium">Dispatched: {item.dispatched_qty}</div>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {order.supplier_name && (
                                <div className="text-xs text-muted-foreground">Supplier: <span className="text-foreground">{order.supplier_name}</span></div>
                            )}
                            {order.driver_name && (
                                <div className="text-xs text-muted-foreground">Driver: <span className="text-foreground">{order.driver_name}</span> | Plate: <span className="text-foreground">{order.plate_number}</span></div>
                            )}
                            {order.dr_number && (
                                <div className="text-xs text-muted-foreground">DR Number: <span className="font-mono text-foreground">{order.dr_number}</span></div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-foreground tracking-tight">My Orders</h2>
                <p className="text-sm text-muted-foreground">Track and manage all your cement orders and re-delivery requests.</p>
            </div>

            <Tabs defaultValue="active" className="w-full">
                <TabsList className="w-full justify-start overflow-x-auto no-scrollbar border-b rounded-none h-auto p-0 bg-transparent mb-6">
                    <TabsTrigger value="active" className="shrink-0 whitespace-nowrap data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-0 py-3 mr-6 shadow-none">
                        Active & Tracking ({activeOrders.length})
                    </TabsTrigger>
                    <TabsTrigger value="pending" className="shrink-0 whitespace-nowrap data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-0 py-3 mr-6 shadow-none">
                        Pending Approval ({pendingOrders.length})
                    </TabsTrigger>
                    <TabsTrigger value="history" className="shrink-0 whitespace-nowrap data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-0 py-3 shadow-none">
                        Order History
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="active" className="mt-0">
                    {activeOrders.length === 0 ? (
                        <div className="p-12 text-center text-muted-foreground border border-border rounded-xl bg-card border-dashed">
                            <Truck className="w-8 h-8 mx-auto mb-3 text-muted-foreground/30" />
                            <p>No active shipments at the moment.</p>
                        </div>
                    ) : (
                        activeOrders.map(o => renderOrderCard(o, "active"))
                    )}
                </TabsContent>

                <TabsContent value="pending" className="mt-0">
                    {pendingOrders.length === 0 ? (
                        <div className="p-12 text-center text-muted-foreground border border-border rounded-xl bg-card border-dashed">
                            <PackageSearch className="w-8 h-8 mx-auto mb-3 text-muted-foreground/30" />
                            <p>No pending orders.</p>
                        </div>
                    ) : (
                        pendingOrders.map(o => renderOrderCard(o, "pending"))
                    )}
                </TabsContent>

                <TabsContent value="history" className="mt-0 space-y-4">
                    {/* History Filters */}
                    <div className="flex flex-col sm:flex-row gap-3 p-4 bg-card border border-border rounded-lg">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by PO # or DR #..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
                            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[140px] min-w-0" />
                            <span className="text-xs text-muted-foreground">to</span>
                            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[140px] min-w-0" />
                        </div>
                    </div>

                    {historyOrders.length === 0 ? (
                        <div className="p-12 text-center text-muted-foreground border border-border rounded-xl bg-card border-dashed">
                            <History className="w-8 h-8 mx-auto mb-3 text-muted-foreground/30" />
                            <p>{searchQuery || dateFrom || dateTo ? "No orders match your filters." : "No completed or rejected orders yet."}</p>
                        </div>
                    ) : (
                        historyOrders.map(o => renderOrderCard(o, "history"))
                    )}
                </TabsContent>
            </Tabs>

            {/* Payment Dialog */}
            <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Submit Payment Details</DialogTitle>
                        <DialogDescription>
                            Please submit the {selectedOrder?.payment_method} payment of ₱{((selectedOrder?.total_amount || 0) + (selectedOrder?.shipping_fee || 0)).toLocaleString()} to process your order.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedOrder?.payment_method === "cash" ? (
                        <div className="space-y-6 py-4">
                            <div className="p-4 bg-status-info-bg border border-status-info-text/20 rounded-lg flex items-start gap-3">
                                <Info className="w-5 h-5 text-status-info-text shrink-0" />
                                <p className="text-sm text-status-info-text">You have selected <strong>Cash</strong>. By confirming, you agree to pay the total amount upon pick-up or delivery. Your order will be queued for dispatch immediately.</p>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsPaymentOpen(false)} disabled={isSubmitting}>Cancel</Button>
                                <Button className="bg-primary hover:bg-primary/90" onClick={handleConfirmCash} disabled={isSubmitting}>
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    Confirm Cash Payment
                                </Button>
                            </DialogFooter>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmitCheck} className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="check-number">Check Number <span className="text-red-500">*</span></Label>
                                <Input id="check-number" required value={checkNumber} onChange={e => setCheckNumber(e.target.value)} placeholder="Enter exact check number" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="check-upload">Upload Picture of Check <span className="text-red-500">*</span></Label>
                                <Input id="check-upload" type="file" accept="image/*,.pdf" onChange={handleFileChange} required />
                                <p className="text-[10px] text-muted-foreground">Please ensure all details are clearly visible.</p>
                            </div>
                            <DialogFooter className="pt-4">
                                <Button type="button" variant="outline" onClick={() => setIsPaymentOpen(false)} disabled={isSubmitting}>Cancel</Button>
                                <Button type="submit" className="bg-primary" disabled={isSubmitting}>
                                    <UploadCloud className="w-4 h-4 mr-2" />
                                    {isSubmitting ? "Uploading..." : "Submit Check"}
                                </Button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            {/* Return Report Dialog */}
            <Dialog open={isReturnOpen} onOpenChange={setIsReturnOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Report Bag Return</DialogTitle>
                        <DialogDescription>
                            Report returned bags for PO {selectedOrder?.po_number}. The warehouse team will review your request and process the return.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>JB Bags Returned</Label>
                                <Input type="number" min={0} value={returnJb || ""} onChange={e => setReturnJb(parseInt(e.target.value) || 0)} placeholder="0" />
                            </div>
                            <div className="space-y-2">
                                <Label>SB Bags Returned</Label>
                                <Input type="number" min={0} value={returnSb || ""} onChange={e => setReturnSb(parseInt(e.target.value) || 0)} placeholder="0" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Reason for Return <span className="text-red-500">*</span></Label>
                            <textarea
                                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                value={returnReason}
                                onChange={e => setReturnReason(e.target.value)}
                                placeholder="Explain why the bags are being returned (e.g., damaged on arrival, wrong product, excess quantity)..."
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsReturnOpen(false)} disabled={isSubmitting}>Cancel</Button>
                        <Button onClick={handleSubmitReturn} disabled={isSubmitting} className="bg-primary gap-2">
                            <CornerDownLeft className="w-4 h-4" />
                            {isSubmitting ? "Submitting..." : "Submit Return Request"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}