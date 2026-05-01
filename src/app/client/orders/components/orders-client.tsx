"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { submitPaymentDetails } from "@/lib/actions/client-actions";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PackageSearch, CreditCard, UploadCloud, Truck, CheckCircle2, History, AlertCircle, Info } from "lucide-react";

export default function OrdersClient({ orders }: { orders: any[] }) {
    const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
    const [isPaymentOpen, setIsPaymentOpen] = useState(false);
    
    // Payment Form
    const [checkNumber, setCheckNumber] = useState("");
    const [checkFile, setCheckFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const pendingOrders = orders.filter(o => o.status === "pending" || o.status === "partially_approved");
    const activeOrders = orders.filter(o => o.status === "approved" || o.status === "awaiting_check" || o.status === "dispatched");
    const historyOrders = orders.filter(o => o.status === "completed" || o.status === "rejected");

    const handleOpenPayment = (order: any) => {
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
            toast.success("Cash payment confirmed! Order is now queued for dispatch.");
            setIsPaymentOpen(false);
        } catch (e: any) {
            toast.error(e.message || "Failed to confirm payment.");
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
            const fileExt = checkFile.name.split('.').pop();
            const fileName = `check_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const { error: uploadError } = await supabase.storage
                .from('order-attachments')
                .upload(fileName, checkFile);

            if (uploadError) throw new Error("Failed to upload check image.");
            const { data: { publicUrl } } = supabase.storage.from('order-attachments').getPublicUrl(fileName);

            await submitPaymentDetails(selectedOrder.id, "check", checkNumber, publicUrl);
            
            toast.success("Check payment submitted! Awaiting admin verification.");
            setIsPaymentOpen(false);
        } catch (error: any) {
            toast.error(error.message || "An error occurred while submitting check.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderOrderCard = (order: any, type: "pending" | "active" | "history") => {
        const totalBags = order.items.reduce((acc: number, item: any) => acc + item.requested_qty, 0);
        const grandTotal = order.total_amount + (order.shipping_fee || 0);

        return (
            <Card key={order.id} className="mb-4 shadow-sm overflow-hidden">
                <CardHeader className="bg-slate-50 border-b pb-3 pt-4">
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-base">PO: {order.po_number}</CardTitle>
                            <CardDescription className="mt-1 flex items-center gap-2 text-xs">
                                {new Date(order.created_at).toLocaleDateString()}
                                <span>•</span>
                                <span className="capitalize">{order.service_type === 'pickup' ? 'Pick-up' : 'Deliver'}</span>
                            </CardDescription>
                        </div>
                        <div className="text-right">
                            <div className="font-bold text-slate-900">₱{grandTotal.toLocaleString()}</div>
                            <div className="text-xs text-slate-500 capitalize">{order.payment_method}</div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                            <p className="text-gray-500 text-xs">Items</p>
                            <p className="font-medium text-gray-900">{totalBags} <span className="text-gray-500 font-normal">indiv. bags</span></p>
                        </div>
                        <div>
                            <p className="text-gray-500 text-xs">Shipping Fee</p>
                            <p className="font-medium text-gray-900">₱{(order.shipping_fee || 0).toLocaleString()}</p>
                        </div>
                        <div className="col-span-2">
                            <p className="text-gray-500 text-xs">Status</p>
                            {order.status === "pending" && <Badge variant="secondary">Awaiting Approval</Badge>}
                            {order.status === "partially_approved" && <Badge variant="default" className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200">Partially Approved</Badge>}
                            {order.status === "approved" && <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">Payment Required</Badge>}
                            {order.status === "awaiting_check" && <Badge variant="secondary">Check Verifying</Badge>}
                            {order.status === "dispatched" && (
                                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">
                                    {order.tracking_status === "in_transit" ? "In Transit" : "Dispatched"}
                                </Badge>
                            )}
                            {order.status === "completed" && <Badge variant="outline" className="border-emerald-200 text-emerald-700">Completed</Badge>}
                            {order.status === "rejected" && <Badge variant="destructive">Rejected</Badge>}
                        </div>
                    </div>

                    {/* Payment CTA for active orders */}
                    {type === "active" && order.status === "approved" && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <AlertCircle className="w-5 h-5 text-amber-600" />
                                <span className="text-sm text-amber-900 font-medium">Your order has been approved. Please complete your payment.</span>
                            </div>
                            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 w-full sm:w-auto" onClick={() => handleOpenPayment(order)}>
                                <CreditCard className="w-4 h-4 mr-2" />
                                Submit Payment
                            </Button>
                        </div>
                    )}
                    
                    {/* Tracking details */}
                    {type === "active" && order.status === "dispatched" && (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-900 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                            <div className="flex items-center gap-2">
                                <Truck className="w-4 h-4" />
                                <span className="font-semibold">Tracking:</span> {order.tracking_status === "in_transit" ? "Currently in transit" : "Prepared for dispatch"}
                            </div>
                            {order.dr_number && <div>DR: <span className="font-mono">{order.dr_number}</span></div>}
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">My Orders</h2>
                <p className="text-sm text-gray-500">Track and manage all your cement orders and re-delivery requests.</p>
            </div>

            <Tabs defaultValue="active" className="w-full">
                <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent mb-6 space-x-6">
                    <TabsTrigger value="active" className="data-[state=active]:border-b-2 data-[state=active]:border-[var(--color-industrial-blue)] data-[state=active]:text-[var(--color-industrial-blue)] rounded-none px-0 py-3 shadow-none">
                        Active & Tracking ({activeOrders.length})
                    </TabsTrigger>
                    <TabsTrigger value="pending" className="data-[state=active]:border-b-2 data-[state=active]:border-[var(--color-industrial-blue)] data-[state=active]:text-[var(--color-industrial-blue)] rounded-none px-0 py-3 shadow-none">
                        Pending Approval ({pendingOrders.length})
                    </TabsTrigger>
                    <TabsTrigger value="history" className="data-[state=active]:border-b-2 data-[state=active]:border-[var(--color-industrial-blue)] data-[state=active]:text-[var(--color-industrial-blue)] rounded-none px-0 py-3 shadow-none">
                        Order History
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="active" className="mt-0">
                    {activeOrders.length === 0 ? (
                        <div className="p-12 text-center text-gray-500 border rounded-xl bg-white border-dashed">
                            <Truck className="w-8 h-8 mx-auto mb-3 text-gray-300" />
                            <p>No active shipments at the moment.</p>
                        </div>
                    ) : (
                        activeOrders.map(o => renderOrderCard(o, "active"))
                    )}
                </TabsContent>

                <TabsContent value="pending" className="mt-0">
                    {pendingOrders.length === 0 ? (
                        <div className="p-12 text-center text-gray-500 border rounded-xl bg-white border-dashed">
                            <PackageSearch className="w-8 h-8 mx-auto mb-3 text-gray-300" />
                            <p>No pending orders.</p>
                        </div>
                    ) : (
                        pendingOrders.map(o => renderOrderCard(o, "pending"))
                    )}
                </TabsContent>

                <TabsContent value="history" className="mt-0">
                    {historyOrders.length === 0 ? (
                        <div className="p-12 text-center text-gray-500 border rounded-xl bg-white border-dashed">
                            <History className="w-8 h-8 mx-auto mb-3 text-gray-300" />
                            <p>No completed or rejected orders yet.</p>
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
                            Your order requires a {selectedOrder?.payment_method} payment of ₱{(selectedOrder?.total_amount + (selectedOrder?.shipping_fee || 0)).toLocaleString()}.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedOrder?.payment_method === "cash" ? (
                        <div className="space-y-6 py-4">
                            <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-3">
                                <Info className="w-5 h-5 text-blue-600 shrink-0" />
                                <p className="text-sm text-blue-800">You have selected <strong>Cash</strong>. By confirming, you agree to pay the total amount upon pick-up or delivery. Your order will be queued for dispatch immediately.</p>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsPaymentOpen(false)} disabled={isSubmitting}>Cancel</Button>
                                <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleConfirmCash} disabled={isSubmitting}>
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    Confirm Cash Payment
                                </Button>
                            </DialogFooter>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmitCheck} className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Check Number <span className="text-red-500">*</span></Label>
                                <Input required value={checkNumber} onChange={e => setCheckNumber(e.target.value)} placeholder="Enter exact check number" />
                            </div>
                            <div className="space-y-2">
                                <Label>Upload Picture of Check <span className="text-red-500">*</span></Label>
                                <Input type="file" accept="image/*,.pdf" onChange={handleFileChange} required />
                                <p className="text-[10px] text-muted-foreground">Please ensure all details are clearly visible.</p>
                            </div>
                            <DialogFooter className="pt-4">
                                <Button type="button" variant="outline" onClick={() => setIsPaymentOpen(false)} disabled={isSubmitting}>Cancel</Button>
                                <Button type="submit" className="bg-[var(--color-industrial-blue)]" disabled={isSubmitting}>
                                    <UploadCloud className="w-4 h-4 mr-2" />
                                    {isSubmitting ? "Uploading..." : "Submit Check"}
                                </Button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
