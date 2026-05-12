import { fetchClientDashboardKPIs, fetchRecentOrders, fetchClientNotifications, fetchActiveProducts } from "@/lib/actions/client-actions";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Bell, Clock, Package, PackageSearch, Truck, Info, ShieldAlert, Lock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = {
    title: "Client Dashboard | OBBO iManage",
};

export default async function ClientDashboardPage() {
    const [kpis, recentOrders, notifications, products] = await Promise.all([
        fetchClientDashboardKPIs(),
        fetchRecentOrders(),
        fetchClientNotifications(),
        fetchActiveProducts(),
    ]);

    // Fetch kyc_status server-side for conditional rendering
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = user
        ? await supabase.from("profiles").select("kyc_status").eq("id", user.id).single()
        : { data: null };
    const isVerified = profile?.kyc_status === "verified";

    const unreadNotifications = notifications.filter((n: any) => !n.is_read);
    const popularProducts = products.slice(0, 2);

    return (
        <div className="space-y-6">
            {/* KYC Pending Banner — shown for unverified users */}
            {!isVerified && (
                <div className="flex items-start gap-3 rounded-xl border border-status-pending-border bg-status-pending-bg p-4">
                    <ShieldAlert className="w-5 h-5 text-status-pending-text shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-foreground">
                            Account pending KYC verification
                        </h4>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            You can browse the catalog, but placing orders and accessing your ledger require a verified account.
                            Our team will review your documents shortly.
                        </p>
                    </div>
                    <Link href="/client/contact-admin" className="shrink-0">
                        <Button size="sm" variant="outline" className="border-status-pending-border text-foreground hover:bg-muted h-8 text-xs">
                            Contact Admin
                        </Button>
                    </Link>
                </div>
            )}

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-foreground tracking-tight">Welcome back, {kpis.clientName}</h2>
                    <p className="text-sm text-muted-foreground">Here&apos;s an overview of your account.</p>
                </div>
                <div className="flex gap-2">
                    {isVerified ? (
                        <Link href="/client/catalog">
                            <Button className="bg-[var(--color-industrial-blue)] text-white shadow-sm hover:bg-[var(--color-industrial-blue)]/90">
                                <PackageSearch className="w-4 h-4 mr-2" />
                                New Order
                            </Button>
                        </Link>
                    ) : (
                        <Button
                            disabled
                            className="bg-[var(--color-industrial-blue)]/40 text-white cursor-not-allowed gap-2"
                            title="Complete KYC verification to place orders"
                        >
                            <Lock className="w-4 h-4" />
                            New Order
                        </Button>
                    )}
                </div>
            </div>

            {/* KPI Cards — now clickable */}
            <div className="grid gap-4 md:grid-cols-3">
                <Link href="/client/orders">
                    <Card className="bg-card border-border shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Orders</CardTitle>
                            <Clock className="w-4 h-4 text-status-pending-text" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-foreground">{kpis.pendingOrders}</div>
                            <p className="text-xs text-muted-foreground mt-1">Awaiting approval or payment</p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/client/orders">
                    <Card className="bg-card border-border shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Active Shipments</CardTitle>
                            <Truck className="w-4 h-4 text-status-success-text" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-foreground">{kpis.activeShipments}</div>
                            <p className="text-xs text-muted-foreground mt-1">Dispatched or In Transit</p>
                        </CardContent>
                    </Card>
                </Link>

                {isVerified ? (
                    <Link href="/client/ledger">
                        <Card className="bg-[var(--color-industrial-blue)] text-white shadow-md hover:shadow-lg transition-shadow cursor-pointer">
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
                    </Link>
                ) : (
                    <div className="cursor-not-allowed" title="Requires verified account">
                        <Card className="bg-muted text-muted-foreground shadow-sm opacity-60 select-none">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Remaining Balance</CardTitle>
                                <Lock className="w-4 h-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-muted-foreground">—</div>
                                <p className="text-xs text-muted-foreground mt-1">Available after KYC approval</p>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>

            {/* Notification Alerts */}
            {unreadNotifications.length > 0 && (
                <div className="space-y-2">
                    {unreadNotifications.slice(0, 3).map((notif: any) => (
                        <Link key={notif.id} href={notif.href || "/client/orders"}>
                                <div className={`rounded-xl p-4 flex items-start gap-3 cursor-pointer transition-colors ${
                                    notif.severity === "warning"
                                        ? "bg-status-pending-bg/20 border border-status-pending-border/30 hover:bg-status-pending-bg/30"
                                        : notif.severity === "success"
                                            ? "bg-status-success-bg/20 border border-status-success-border/30 hover:bg-status-success-bg/30"
                                            : "bg-status-info-bg/20 border border-status-info-border/30 hover:bg-status-info-bg/30"
                                }`}>
                                    {notif.severity === "warning" ? (
                                        <AlertCircle className="w-5 h-5 text-status-pending-text mt-0.5 shrink-0" />
                                    ) : notif.severity === "success" ? (
                                        <Bell className="w-5 h-5 text-status-success-text mt-0.5 shrink-0" />
                                    ) : (
                                        <Info className="w-5 h-5 text-status-info-text mt-0.5 shrink-0" />
                                    )}
                                    <div>
                                        <h4 className="text-sm font-semibold text-foreground">{notif.title}</h4>
                                        <p className="text-sm text-muted-foreground mt-0.5">{notif.message}</p>
                                        <p className="text-[10px] text-muted-foreground/60 mt-1">{new Date(notif.created_at).toLocaleString()}</p>
                                    </div>
                                </div>
                        </Link>
                    ))}
                </div>
            )}

            {/* Pending orders banner (fallback when no notifications) */}
            {unreadNotifications.length === 0 && kpis.pendingOrders > 0 && (
                <div className="bg-status-pending-bg/20 border border-status-pending-border/30 rounded-xl p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-status-pending-text mt-0.5 shrink-0" />
                    <div>
                        <h4 className="text-sm font-semibold text-foreground">You have orders awaiting action</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                            Please check your pending orders. If an order has been approved, you may need to submit payment details before it can be dispatched.
                        </p>
                        <Link href="/client/orders">
                            <Button variant="link" className="px-0 text-[var(--color-industrial-blue)] hover:underline h-auto py-1 font-semibold mt-1">
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
                                <p>You haven&apos;t placed any orders yet.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {recentOrders.map((order: any) => {
                                    const totalBags = order.items.reduce((acc: number, item: any) => acc + item.requested_qty, 0);
                                    
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
                                        <Link key={order.id} href="/client/orders">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-semibold text-foreground">PO: {order.po_number}</span>
                                                        <Badge variant={statusVariant} className="text-[10px] uppercase tracking-wider">{statusLabel}</Badge>
                                                        {order.order_type === "redelivery" && (
                                                            <Badge variant="outline" className="text-[10px] border-status-info-border text-status-info-text">Re-delivery</Badge>
                                                        )}
                                                    </div>
                                                    <div className="text-sm text-muted-foreground">
                                                        {new Date(order.created_at).toLocaleDateString()} • {totalBags} bags • {order.service_type === 'pickup' ? 'Pick-up' : 'Delivery'}
                                                    </div>
                                                </div>
                                                <div className="mt-3 sm:mt-0 text-left sm:text-right">
                                                    <div className="font-medium text-foreground">₱{order.total_amount.toLocaleString()}</div>
                                                    <div className="text-xs text-muted-foreground capitalize">{order.payment_method}</div>
                                                </div>
                                            </div>
                                        </Link>
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

                <Card className="shadow-sm border-border">
                    <CardHeader>
                        <CardTitle className="text-foreground">Quick Order</CardTitle>
                        <CardDescription className="text-muted-foreground">Need more cement?</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {popularProducts.length > 0 ? (
                            <div className="space-y-3">
                                {popularProducts.map((p: any) => (
                                    <div key={p.id} className="p-3 bg-muted/20 border border-border rounded-lg flex justify-between items-center">
                                        <div>
                                            <p className="text-sm font-medium text-foreground">{p.name}</p>
                                            <p className="text-xs text-muted-foreground">{p.bag_type === "JB" ? "Jumbo" : "Sling"} • From ₱{(p.price_warehouse || p.price_per_bag).toLocaleString()}/bag</p>
                                        </div>
                                        <Badge className="bg-[var(--color-industrial-blue)] text-white text-[10px]">{p.bag_type}</Badge>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-600">Head over to the Product Catalog to browse our Portland Cement offerings in Jumbo Bags (JB) and Sling Bags (SB).</p>
                        )}
                        <Link href="/client/catalog" className="block">
                            <Button className="w-full bg-[var(--color-industrial-blue)]">Browse Catalog</Button>
                        </Link>
                        
                        <div className="mt-6 pt-6 border-t border-border">
                            <h4 className="text-sm font-semibold mb-2 text-foreground">Have a balance?</h4>
                            <p className="text-xs text-muted-foreground mb-3">If you have remaining bags from a previous order, you can request a re-delivery without placing a new PO.</p>
                            {isVerified ? (
                                <Link href="/client/ledger" className="block">
                                    <Button variant="secondary" className="w-full">View Ledger</Button>
                                </Link>
                            ) : (
                                <Button variant="secondary" disabled className="w-full gap-2 opacity-60 cursor-not-allowed">
                                    <Lock className="w-3.5 h-3.5" />
                                    View Ledger
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
