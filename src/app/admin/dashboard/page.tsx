"use client";

import { useEffect, useState, useRef } from "react";
import {
    Package,
    ShoppingCart,
    Truck,
    Users,
    ArrowUpRight,
    Clock,
    CheckCircle2,
    AlertCircle,
    UserPlus,
    PackagePlus,
    Wifi,
    WifiOff,
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
import { ActivityLog } from "@/lib/types/database";
import { createClient } from "@/lib/supabase/client";

// ── KPI helpers (computed from mock data as baseline) ──────────────
const stock = computeStockByType();
const baselineKpis = {
    sbNet: stock.sb.net,
    sbGood: stock.sb.good,
    sbBalance: stock.sb.balance,
    jbNet: stock.jb.net,
    jbGood: stock.jb.good,
    jbBalance: stock.jb.balance,
    pendingOrders: mockOrders.filter((o) => o.status === "pending").length,
    dispatched: mockOrders.filter((o) => o.status === "dispatched").length,
    activeClients: mockProfiles.filter((p) => p.role === "client" && p.kyc_status === "verified").length,
    pendingKyc: mockProfiles.filter((p) => p.kyc_status === "pending_verification").length,
};

// ── Activity helpers ───────────────────────────────────────────────
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
    const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    const d = Math.floor(s / 86400);
    if (d > 30) return `${Math.floor(d / 30)}mo ago`;
    if (d > 0) return `${d}d ago`;
    const h = Math.floor(s / 3600);
    if (h > 0) return `${h}h ago`;
    const m = Math.floor(s / 60);
    if (m > 0) return `${m}m ago`;
    return "Just now";
}

export default function AdminDashboard() {
    const [activityFeed, setActivityFeed] = useState<ActivityLog[]>(mockActivityLog);
    const [pendingCount, setPendingCount] = useState(baselineKpis.pendingOrders);
    const [realtimeConnected, setRealtimeConnected] = useState(false);
    const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

    useEffect(() => {
        const supabase = createClient();

        // ── Subscribe to orders table changes ──────────────────────────
        const ordersChannel = supabase
            .channel("admin-dashboard")
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "orders" },
                (payload) => {
                    // New order placed — increment pending count and add to feed
                    setPendingCount((prev) => prev + 1);
                    const newActivity: ActivityLog = {
                        id: crypto.randomUUID(),
                        actor_id: payload.new.client_id ?? "unknown",
                        action: "order_placed",
                        entity_type: "order",
                        entity_id: payload.new.id,
                        metadata: { total: payload.new.total_amount },
                        created_at: payload.new.created_at ?? new Date().toISOString(),
                    };
                    setActivityFeed((prev) => [newActivity, ...prev].slice(0, 20));
                }
            )
            .on(
                "postgres_changes",
                { event: "UPDATE", schema: "public", table: "orders" },
                (payload) => {
                    const action =
                        payload.new.status === "dispatched" ? "order_dispatched" :
                            payload.new.status === "approved" ? "order_approved" :
                                payload.new.status === "rejected" ? "order_rejected" : null;
                    if (!action) return;
                    if (payload.old.status === "pending" && payload.new.status !== "pending") {
                        setPendingCount((prev) => Math.max(0, prev - 1));
                    }
                    const newActivity: ActivityLog = {
                        id: crypto.randomUUID(),
                        actor_id: "admin",
                        action,
                        entity_type: "order",
                        entity_id: payload.new.id,
                        metadata: {},
                        created_at: new Date().toISOString(),
                    };
                    setActivityFeed((prev) => [newActivity, ...prev].slice(0, 20));
                }
            )
            // ── Subscribe to activity_log table inserts ──────────────────
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "activity_log" },
                (payload) => {
                    const entry = payload.new as ActivityLog;
                    setActivityFeed((prev) => [entry, ...prev].slice(0, 20));
                }
            )
            // ── Subscribe to profiles changes (KYC updates) ──────────────
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "profiles" },
                (payload) => {
                    const newActivity: ActivityLog = {
                        id: crypto.randomUUID(),
                        actor_id: payload.new.id,
                        action: "kyc_submitted",
                        entity_type: "profile",
                        entity_id: payload.new.id,
                        metadata: {},
                        created_at: payload.new.created_at ?? new Date().toISOString(),
                    };
                    setActivityFeed((prev) => [newActivity, ...prev].slice(0, 20));
                }
            )
            .subscribe((status) => {
                setRealtimeConnected(status === "SUBSCRIBED");
            });

        channelRef.current = ordersChannel;

        return () => {
            supabase.removeChannel(ordersChannel);
        };
    }, []);

    const kpis = [
        {
            title: "Net Available (SB)",
            value: baselineKpis.sbNet.toLocaleString(),
            subtitle: `${baselineKpis.sbGood.toLocaleString()} good · ${baselineKpis.sbBalance.toLocaleString()} obligated`,
            icon: Package,
            trend: "+12%",
            trendUp: true,
            color: "text-blue-600 bg-blue-500/10",
        },
        {
            title: "Net Available (JB)",
            value: baselineKpis.jbNet.toLocaleString(),
            subtitle: `${baselineKpis.jbGood.toLocaleString()} good · ${baselineKpis.jbBalance.toLocaleString()} obligated`,
            icon: Package,
            trend: "+5%",
            trendUp: true,
            color: "text-emerald-600 bg-emerald-500/10",
        },
        {
            title: "Pending Orders",
            value: pendingCount.toString(),
            subtitle: `${baselineKpis.dispatched} dispatched today`,
            icon: ShoppingCart,
            trend: `${pendingCount} open`,
            trendUp: pendingCount === 0,
            color: "text-amber-600 bg-amber-500/10",
        },
        {
            title: "Active Clients",
            value: baselineKpis.activeClients.toString(),
            subtitle: `${baselineKpis.pendingKyc} pending verification`,
            icon: Users,
            trend: `+${baselineKpis.pendingKyc} pending`,
            trendUp: true,
            color: "text-purple-600 bg-purple-500/10",
        },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
                    <p className="text-muted-foreground mt-1">Overview of your cement distribution operations.</p>
                </div>
                {/* Realtime indicator */}
                <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${realtimeConnected
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : "bg-muted border-border text-muted-foreground"
                    }`}>
                    {realtimeConnected
                        ? <><Wifi className="w-3 h-3" /> Live</>
                        : <><WifiOff className="w-3 h-3" /> Offline</>
                    }
                </div>
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
                                {kpi.trendUp
                                    ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
                                    : <AlertCircle className="w-3.5 h-3.5 text-amber-500" />}
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
                            <div className="flex items-center gap-2">
                                {realtimeConnected && (
                                    <span className="flex items-center gap-1 text-xs text-emerald-600">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        Live updates
                                    </span>
                                )}
                                <Badge variant="secondary" className="text-xs">{activityFeed.length} events</Badge>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-1">
                            {activityFeed.map((activity) => (
                                <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                                        {getActivityIcon(activity.action)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium">{getActivityLabel(activity.action)}</p>
                                        <p className="text-xs text-muted-foreground truncate">
                                            {activity.actor?.full_name
                                                ? `by ${activity.actor.full_name} · `
                                                : ""}
                                            {activity.entity_type} #{String(activity.entity_id).split("-").pop()}
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

                {/* Side panels */}
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
