import { fetchClientDashboardKPIs, fetchRecentOrders } from "@/lib/actions/client-actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Clock, Package, PackageSearch, Truck } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = {
    title: "Client Dashboard | OBBO iManage",
};

export default async function ClientDashboardPage() {
    const kpis = await fetchClientDashboardKPIs();
    const recentOrders = await fetchRecentOrders();

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Welcome back</h2>
                    <p className="text-sm text-gray-500">Here's an overview of your account.</p>
                </div>
                <div className="flex gap-2">
                    <Link href="/client/catalog">
                        <Button className="bg-[var(--color-industrial-blue)] text-white shadow-sm hover:bg-[var(--color-industrial-blue)]/90">
                            <PackageSearch className="w-4 h-4 mr-2" />
                            New Order
                        </Button>
                    </Link>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card className="bg-white border-blue-100 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">Pending Orders</CardTitle>
                        <Clock className="w-4 h-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-gray-900">{kpis.pendingOrders}</div>
                        <p className="text-xs text-gray-500 mt-1">Awaiting approval or payment</p>
                    </CardContent>
                </Card>

                <Card className="bg-white border-blue-100 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">Active Shipments</CardTitle>
                        <Truck className="w-4 h-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-gray-900">{kpis.activeShipments}</div>
                        <p className="text-xs text-gray-500 mt-1">Dispatched or In Transit</p>
                    </CardContent>
                </Card>

                <Card className="bg-[var(--color-industrial-blue)] text-white shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-blue-100">Remaining Balance</CardTitle>
                        <Package className="w-4 h-4 text-blue-200" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">
                            {kpis.remainingBags.toLocaleString()} <span className="text-sm font-normal text-blue-200">indiv. bags</span>
                        </div>
                        <p className="text-xs text-blue-200 mt-1">Available for re-delivery</p>
                    </CardContent>
                </Card>
            </div>

            {/* Notification Banner */}
            {kpis.pendingOrders > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                        <h4 className="text-sm font-semibold text-amber-900">You have orders awaiting action</h4>
                        <p className="text-sm text-amber-700 mt-1">
                            Please check your pending orders. If an order has been approved, you may need to submit payment details before it can be dispatched.
                        </p>
                        <Link href="/client/orders">
                            <Button variant="link" className="px-0 text-amber-800 hover:text-amber-900 h-auto py-1 font-semibold mt-1">
                                View Pending Orders &rarr;
                            </Button>
                        </Link>
                    </div>
                </div>
            )}

            <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle>Recent Orders</CardTitle>
                        <CardDescription>Your latest transactions and their status</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {recentOrders.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                                <PackageSearch className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                <p>You haven't placed any orders yet.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {recentOrders.map((order: any) => {
                                    const totalBags = order.items.reduce((acc: number, item: any) => acc + item.requested_qty, 0);
                                    
                                    // Map status to badge
                                    let statusVariant: "default" | "secondary" | "destructive" | "outline" = "outline";
                                    let statusLabel = order.status;
                                    
                                    if (order.status === "pending") {
                                        statusVariant = "secondary";
                                        statusLabel = "Awaiting Approval";
                                    } else if (order.status === "approved" || order.status === "partially_approved") {
                                        statusVariant = "default";
                                        statusLabel = "Approved - Awaiting Payment";
                                    } else if (order.status === "awaiting_check") {
                                        statusVariant = "secondary";
                                        statusLabel = "Check Verifying";
                                    } else if (order.status === "dispatched") {
                                        statusVariant = "default";
                                        statusLabel = order.tracking_status === "in_transit" ? "In Transit" : "Dispatched";
                                    } else if (order.status === "completed") {
                                        statusLabel = "Completed";
                                    } else if (order.status === "rejected") {
                                        statusVariant = "destructive";
                                        statusLabel = "Rejected";
                                    }

                                    return (
                                        <div key={order.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border bg-gray-50/50 hover:bg-gray-50 transition-colors">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-semibold text-gray-900">PO: {order.po_number}</span>
                                                    <Badge variant={statusVariant} className="text-[10px] uppercase tracking-wider">{statusLabel}</Badge>
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    {new Date(order.created_at).toLocaleDateString()} • {totalBags} bags • {order.service_type === 'pickup' ? 'Pick-up' : 'Delivery'}
                                                </div>
                                            </div>
                                            <div className="mt-3 sm:mt-0 text-left sm:text-right">
                                                <div className="font-medium text-gray-900">₱{order.total_amount.toLocaleString()}</div>
                                                <div className="text-xs text-gray-500 capitalize">{order.payment_method}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div className="pt-2">
                                    <Link href="/client/orders">
                                        <Button variant="outline" className="w-full">View All Orders</Button>
                                    </Link>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="shadow-sm bg-gradient-to-br from-slate-50 to-white">
                    <CardHeader>
                        <CardTitle>Quick Order</CardTitle>
                        <CardDescription>Need more cement?</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-gray-600">Head over to the Product Catalog to browse our Portland Cement offerings in Jumbo Bags (JB) and Sling Bags (SB).</p>
                        <Link href="/client/catalog" className="block">
                            <Button className="w-full bg-[var(--color-industrial-blue)]">Browse Catalog</Button>
                        </Link>
                        
                        <div className="mt-6 pt-6 border-t">
                            <h4 className="text-sm font-semibold mb-2">Have a balance?</h4>
                            <p className="text-xs text-gray-500 mb-3">If you have remaining bags from a previous order, you can request a re-delivery without placing a new PO.</p>
                            <Link href="/client/ledger" className="block">
                                <Button variant="secondary" className="w-full">View Ledger</Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
