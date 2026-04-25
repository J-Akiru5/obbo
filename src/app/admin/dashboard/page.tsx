"use client";

import {
    Package,
    TrendingUp,
    ShoppingCart,
    Truck,
    Users,
    ArrowUpRight,
    ArrowDownRight,
    Clock,
    CheckCircle2,
    AlertCircle,
    UserPlus,
    PackagePlus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    mockOrders,
    mockShipments,
    mockCustomerBalances,
    mockProfiles,
    mockActivityLog,
    computeStockByType,
} from "@/lib/mock-data";

const stock = computeStockByType();
const pendingOrders = mockOrders.filter((o) => o.status === "pending").length;
const dispatchedToday = mockOrders.filter((o) => o.status === "dispatched").length;
const activeClients = mockProfiles.filter((p) => p.role === "client" && p.kyc_status === "verified").length;
const pendingKyc = mockProfiles.filter((p) => p.kyc_status === "pending_verification").length;

const kpis = [
    {
        title: "Net Available (SB)",
        value: stock.sb.net.toLocaleString(),
        subtitle: `${stock.sb.good.toLocaleString()} good · ${stock.sb.balance.toLocaleString()} obligated`,
        icon: Package,
        trend: "+12%",
        trendUp: true,
        color: "text-blue-600 bg-blue-500/10",
    },
    {
        title: "Net Available (JB)",
        value: stock.jb.net.toLocaleString(),
        subtitle: `${stock.jb.good.toLocaleString()} good · ${stock.jb.balance.toLocaleString()} obligated`,
        icon: Package,
        trend: "+5%",
        trendUp: true,
        color: "text-emerald-600 bg-emerald-500/10",
    },
    {
        title: "Pending Orders",
        value: pendingOrders.toString(),
        subtitle: `${dispatchedToday} dispatched today`,
        icon: ShoppingCart,
        trend: "2 new",
        trendUp: false,
        color: "text-amber-600 bg-amber-500/10",
    },
    {
        title: "Active Clients",
        value: activeClients.toString(),
        subtitle: `${pendingKyc} pending verification`,
        icon: Users,
        trend: `+${pendingKyc}`,
        trendUp: true,
        color: "text-purple-600 bg-purple-500/10",
    },
];

function getActivityIcon(action: string) {
    switch (action) {
        case "order_placed": return <ShoppingCart className="w-4 h-4 text-blue-500" />;
        case "order_approved": return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
        case "order_dispatched": return <Truck className="w-4 h-4 text-indigo-500" />;
        case "kyc_submitted": return <UserPlus className="w-4 h-4 text-amber-500" />;
        case "shipment_added": return <PackagePlus className="w-4 h-4 text-purple-500" />;
        default: return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
}

function getActivityLabel(action: string) {
    switch (action) {
        case "order_placed": return "New Order Placed";
        case "order_approved": return "Order Approved";
        case "order_dispatched": return "Order Dispatched";
        case "kyc_submitted": return "KYC Documents Submitted";
        case "shipment_added": return "Shipment Batch Added";
        default: return action;
    }
}

function formatTimeAgo(dateStr: string) {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    const days = Math.floor(seconds / 86400);
    if (days > 30) return `${Math.floor(days / 30)}mo ago`;
    if (days > 0) return `${days}d ago`;
    const hours = Math.floor(seconds / 3600);
    if (hours > 0) return `${hours}h ago`;
    return "Just now";
}

export default function AdminDashboard() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
                <p className="text-muted-foreground mt-1">Overview of your cement distribution operations.</p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {kpis.map((kpi) => (
                    <Card key={kpi.title} className="hover:shadow-md transition-shadow">
                        <CardContent className="pt-6">
                            <div className="flex items-start justify-between">
                                <div className="space-y-2">
                                    <p className="text-sm font-medium text-muted-foreground">{kpi.title}</p>
                                    <p className="text-3xl font-bold tracking-tight">{kpi.value}</p>
                                    <p className="text-xs text-muted-foreground">{kpi.subtitle}</p>
                                </div>
                                <div className={`w-11 h-11 rounded-xl ${kpi.color} flex items-center justify-center`}>
                                    <kpi.icon className="w-5 h-5" />
                                </div>
                            </div>
                            <div className="mt-3 flex items-center gap-1.5">
                                {kpi.trendUp ? (
                                    <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
                                ) : (
                                    <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                                )}
                                <span className={`text-xs font-medium ${kpi.trendUp ? "text-emerald-600" : "text-amber-600"}`}>
                                    {kpi.trend}
                                </span>
                                <span className="text-xs text-muted-foreground">this month</span>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Activity Feed */}
                <Card className="lg:col-span-2">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">Recent Activity</CardTitle>
                            <Badge variant="secondary" className="text-xs">{mockActivityLog.length} events</Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-1">
                            {mockActivityLog.map((activity) => (
                                <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                                        {getActivityIcon(activity.action)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium">{getActivityLabel(activity.action)}</p>
                                        <p className="text-xs text-muted-foreground truncate">
                                            by {activity.actor?.full_name || "System"} · {activity.entity_type} #{activity.entity_id.split("-").pop()}
                                        </p>
                                    </div>
                                    <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                                        {formatTimeAgo(activity.created_at)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Quick Stats / Obligations */}
                <div className="space-y-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg">Customer Obligations</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {mockCustomerBalances.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No outstanding balances.</p>
                            ) : (
                                <div className="space-y-3">
                                    {mockCustomerBalances.map((bal) => {
                                        const client = mockProfiles.find((p) => p.id === bal.client_id);
                                        return (
                                            <div key={bal.id} className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-200">
                                                <div>
                                                    <p className="text-sm font-medium text-amber-900">{client?.full_name}</p>
                                                    <p className="text-xs text-amber-700">{bal.remaining_qty} {bal.bag_type} remaining</p>
                                                </div>
                                                <Badge className="bg-amber-200 text-amber-800 hover:bg-amber-200">{bal.status}</Badge>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg">Shipment Summary</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {mockShipments.slice(0, 3).map((s) => (
                                    <div key={s.id} className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium">{s.batch_name}</p>
                                            <p className="text-xs text-muted-foreground">{s.bag_type} · {s.good_stock.toLocaleString()} good</p>
                                        </div>
                                        <span className="text-sm font-semibold text-[var(--color-industrial-blue)]">{s.good_stock.toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
