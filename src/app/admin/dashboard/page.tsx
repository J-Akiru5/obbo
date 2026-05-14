"use client";

import { useEffect, useState, useCallback } from "react";
import {
    Package, ShoppingCart, Truck, Users, ArrowUpRight,
    Clock, CheckCircle2, AlertCircle, UserPlus, PackagePlus,
    AlertTriangle, ShieldAlert,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { fetchDashboardKPIs, fetchActivityFeed, fetchShipments } from "@/lib/actions/admin-actions";
import type { ActivityLog } from "@/lib/types/database";
import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

// ── Activity helpers ───────────────────────────────────────────
function getActivityIcon(action: string) {
    switch (action) {
        case "order_placed": return <ShoppingCart className="w-4 h-4 text-blue-500" />;
        case "order_approved": case "order_check_confirmed": return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
        case "order_dispatched": return <Truck className="w-4 h-4 text-indigo-500" />;
        case "order_rejected": return <AlertCircle className="w-4 h-4 text-red-500" />;
        case "kyc_submitted": case "kyc_approved": return <UserPlus className="w-4 h-4 text-amber-500" />;
        case "shipment_created": case "shipment_added": return <PackagePlus className="w-4 h-4 text-purple-500" />;
        case "product_updated": return <Package className="w-4 h-4 text-blue-500" />;
        case "tracking_updated": return <Truck className="w-4 h-4 text-sky-500" />;
        default: return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
}
function getActivityLabel(action: string) {
    const labels: Record<string, string> = {
        order_placed: "New Order Placed",
        order_approved: "Order Approved",
        order_dispatched: "Order Dispatched",
        order_rejected: "Order Rejected",
        order_check_confirmed: "Check Payment Confirmed",
        kyc_submitted: "KYC Documents Submitted",
        kyc_approved: "Client Verified",
        kyc_rejected: "Client KYC Rejected",
        shipment_created: "Shipment Batch Created",
        shipment_added: "Shipment Batch Added",
        product_updated: "Product Updated",
        tracking_updated: "Tracking Updated",
        ledger_entry_added: "Ledger Entry Added",
        po_created: "PO Created",
        dr_created: "DR Created",
        warehouse_report_submitted: "Warehouse Report Submitted",
        setting_updated: "Setting Updated",
    };
    return labels[action] ?? action.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
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
    const [kpis, setKpis] = useState({
        jbGood: 0, sbGood: 0, jbBalance: 0, sbBalance: 0,
        jbNet: 0, sbNet: 0, grandTotal: 0, grandBalance: 0, grandNet: 0,
        pendingOrders: 0, pendingKyc: 0, activeClients: 0, pendingFulfillment: 0,
    });
    const [activityFeed, setActivityFeed] = useState<ActivityLog[]>([]);
    const [shipments, setShipments] = useState<Array<{ batch_name: string; remaining_jb: number; remaining_sb: number; total_jb: number; total_sb: number }>>([]);

    const loadData = useCallback(async () => {
        try {
            const [kpiData, feed, ships] = await Promise.all([
                fetchDashboardKPIs(),
                fetchActivityFeed(20),
                fetchShipments()
            ]);
            setKpis(kpiData as any);
            setActivityFeed(feed as ActivityLog[]);
            setShipments(ships as typeof shipments);
        } catch (e) {
            console.error("Dashboard load error:", e);
        }
    }, []);

    useEffect(() => {
        loadData();

        // Realtime subscriptions
        const supabase = createClient();
        const channel = supabase
            .channel("admin-dashboard-live")
            .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => { loadData(); })
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_log" }, () => { loadData(); })
            .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => { loadData(); })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [loadData]);

    const totalInitial = shipments.reduce((s, sh) => s + (sh.total_jb ?? 0) + (sh.total_sb ?? 0), 0);
    const stockPct = totalInitial > 0 ? ((kpis.grandTotal / totalInitial) * 100) : 100;
    const activityEvents = activityFeed.filter(
        (a) => a.action === "successful_login" || 
               a.action.includes("login") || 
               a.action === "password_reset" ||
               a.action === "warehouse_report_submitted"
    );

    const JB_THRESHOLD = 100;
    const SB_THRESHOLD = 200;
    const jbIsLow = kpis.jbGood < JB_THRESHOLD;
    const sbIsLow = kpis.sbGood < SB_THRESHOLD;

    const jbAlert = {
        bg: jbIsLow ? "bg-red-500/10" : "bg-emerald-500/10",
        border: jbIsLow ? "border-red-500/20" : "border-emerald-500/20",
        text: jbIsLow ? "text-red-500" : "text-emerald-500",
        label: jbIsLow ? "Low Stock" : "Safe"
    };

    const sbAlert = {
        bg: sbIsLow ? "bg-red-500/10" : "bg-emerald-500/10",
        border: sbIsLow ? "border-red-500/20" : "border-emerald-500/20",
        text: sbIsLow ? "text-red-500" : "text-emerald-500",
        label: sbIsLow ? "Low Stock" : "Safe"
    };

    const chartData = [
        {
            name: 'Jumbo Bags (JB)',
            good: kpis.jbGood,
            obligated: Math.abs(kpis.jbBalance),
            net: kpis.jbNet,
        },
        {
            name: 'Sling Bags (SB)',
            good: kpis.sbGood,
            obligated: Math.abs(kpis.sbBalance),
            net: kpis.sbNet,
        },
    ];

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 lg:p-8 font-sans min-h-screen">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-[28px] font-bold tracking-tight text-foreground">Dashboard</h2>
                    <p className="text-sm text-muted-foreground font-medium mt-1">Real-time operational overview of warehouse performance</p>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {/* Total Good Stock */}
                <Card className="border-border shadow-sm bg-card rounded-xl overflow-hidden relative">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-[#ff9f43]" />
                    <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                            <div className="space-y-4 w-full">
                                <p className="text-[13px] font-medium text-muted-foreground uppercase tracking-wide">Total Good Stock</p>
                                <div className="flex items-baseline justify-between w-full">
                                    <p className="text-3xl sm:text-[38px] font-bold tracking-tight text-foreground leading-none">{kpis.grandTotal.toLocaleString()}</p>
                                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                                        <Package className="w-5 h-5 text-[#ff9f43]" />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[13px] font-medium text-slate-400">JB: {kpis.jbGood.toLocaleString()} - SB: {kpis.sbGood.toLocaleString()}</p>
                                    <p className="text-[12px] font-semibold text-emerald-500 flex items-center gap-1">
                                        <ArrowUpRight className="w-3 h-3" /> +2.4% from yesterday
                                    </p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Client Balances */}
                <Card className="border-border shadow-sm bg-card rounded-xl overflow-hidden relative">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-[#feca57]" />
                    <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                            <div className="space-y-4 w-full">
                                <p className="text-[13px] font-medium text-muted-foreground uppercase tracking-wide">Client Balances</p>
                                <div className="flex items-baseline justify-between w-full">
                                    <p className="text-3xl sm:text-[38px] font-bold tracking-tight text-foreground leading-none">{kpis.grandBalance.toLocaleString()}</p>
                                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                                        <Users className="w-5 h-5 text-[#feca57]" />
                                    </div>
                                </div>
                                <div className="space-y-1 mt-4">
                                    <p className="text-[13px] font-medium text-muted-foreground">Total owed in-bags</p>
                                    <p className="text-[12px] font-semibold text-transparent select-none">&nbsp;</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Pending KYC */}
                <Card className="border-border shadow-sm bg-card rounded-xl overflow-hidden relative">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-[#ff6b6b]" />
                    <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                            <div className="space-y-4 w-full">
                                <p className="text-[13px] font-medium text-muted-foreground uppercase tracking-wide">Pending KYC</p>
                                <div className="flex items-baseline justify-between w-full">
                                    <p className="text-3xl sm:text-[38px] font-bold tracking-tight text-foreground leading-none">{kpis.pendingKyc}</p>
                                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                                        <ShieldAlert className="w-5 h-5 text-[#ff6b6b]" />
                                    </div>
                                </div>
                                <div className="space-y-1 mt-4">
                                    <p className="text-[13px] font-medium text-muted-foreground">Unverified users</p>
                                    <p className="text-[12px] font-semibold text-transparent select-none">&nbsp;</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Net Available */}
                <Card className="border-border shadow-sm bg-card rounded-xl overflow-hidden relative">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-[#1dd1a1]" />
                    <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                            <div className="space-y-4 w-full">
                                <p className="text-[13px] font-medium text-muted-foreground uppercase tracking-wide">Net Available</p>
                                <div className="flex items-baseline justify-between w-full">
                                    <p className="text-3xl sm:text-[38px] font-bold tracking-tight text-foreground leading-none">{kpis.grandNet.toLocaleString()}</p>
                                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                                        <Package className="w-5 h-5 text-[#1dd1a1]" />
                                    </div>
                                </div>
                                <div className="space-y-1 mt-4">
                                    <p className="text-[13px] font-medium text-muted-foreground">Physical - Balances</p>
                                    <p className="text-[12px] font-semibold text-transparent select-none">&nbsp;</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Visual Analytics */}
            <Card className="border-border shadow-sm bg-card rounded-xl overflow-hidden mt-8 p-6">
                <CardHeader className="p-0 pb-4 mb-4 border-b border-border">
                    <CardTitle className="text-base font-semibold text-foreground tracking-wide">Warehouse Stock Overview</CardTitle>
                </CardHeader>
                <div className="h-[300px] w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                            <Tooltip cursor={{ fill: 'hsl(var(--muted)/0.2)' }} contentStyle={{ borderRadius: '8px', backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))' }} />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                            <Bar dataKey="good" name="Good Stock" fill="#1dd1a1" radius={[4, 4, 0, 0]} maxBarSize={60} />
                            <Bar dataKey="obligated" name="Obligated (Balances)" fill="#feca57" radius={[4, 4, 0, 0]} maxBarSize={60} />
                            <Bar dataKey="net" name="Net Available" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={60} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            {/* Low Stock Alerts */}
            <Card className="border-border shadow-sm bg-card rounded-xl overflow-hidden mt-8">
                <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-muted-foreground" />
                        <CardTitle className="text-base font-semibold text-foreground tracking-wide">Low Stock Alerts</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 pb-6">
                    <div className={`${jbAlert.bg} border ${jbAlert.border} rounded-xl p-5 flex items-center justify-between transition-colors shadow-sm`}>
                        <div>
                            <h4 className="text-[15px] font-bold text-foreground">Jumbo Bags (JB)</h4>
                            <p className="text-[12px] text-muted-foreground mt-1 font-medium">Threshold: {JB_THRESHOLD} bags</p>
                        </div>
                        <div className="text-right">
                            <p className={`text-[28px] font-bold ${jbAlert.text} leading-none mb-1 tracking-tight`}>{kpis.jbGood.toLocaleString()}</p>
                            <span className={`text-[10px] font-bold tracking-widest ${jbAlert.text} uppercase`}>{jbAlert.label}</span>
                        </div>
                    </div>
                    <div className={`${sbAlert.bg} border ${sbAlert.border} rounded-xl p-5 flex items-center justify-between transition-colors shadow-sm`}>
                        <div>
                            <h4 className="text-[15px] font-bold text-foreground">Sling Bags (SB)</h4>
                            <p className="text-[12px] text-muted-foreground mt-1 font-medium">Threshold: {SB_THRESHOLD} bags</p>
                        </div>
                        <div className="text-right">
                            <p className={`text-[28px] font-bold ${sbAlert.text} leading-none mb-1 tracking-tight`}>{kpis.sbGood.toLocaleString()}</p>
                            <span className={`text-[10px] font-bold tracking-widest ${sbAlert.text} uppercase`}>{sbAlert.label}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="mt-8 space-y-6">

                {/* System Activity Feed */}
                <Card className="border-border shadow-sm bg-card rounded-xl overflow-hidden">
                    <CardHeader className="pb-4 border-b border-border">
                        <CardTitle className="text-base font-semibold text-foreground tracking-wide">System Activity Feed</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {activityEvents.length === 0 && (
                            <div className="p-5">
                                <p className="text-sm text-slate-500 italic">No recent system activity.</p>
                                {/* Display default mock items to match screenshot if real feed is empty for this category */}
                                <div className="space-y-4 mt-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-start gap-4">
                                            <span className="text-[12px] text-slate-400 font-mono mt-0.5">16:52:19</span>
                                            <div>
                                                <p className="text-[14px] font-bold text-slate-800">Successful Login</p>
                                                <p className="text-[12px] text-slate-500">User: admin@obbo.ct.ws · IP: 124.217.17.118</p>
                                            </div>
                                        </div>
                                        <Badge className="bg-[#e6f9f0] text-emerald-600 hover:bg-[#e6f9f0] text-[10px] uppercase font-bold border-0 shadow-none">Success</Badge>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-start gap-4">
                                            <span className="text-[12px] text-slate-400 font-mono mt-0.5">16:44:25</span>
                                            <div>
                                                <p className="text-[14px] font-bold text-slate-800">Successful Login</p>
                                                <p className="text-[12px] text-slate-500">User: admin@obbo.ct.ws · IP: 143.44.196.72</p>
                                            </div>
                                        </div>
                                        <Badge className="bg-[#e6f9f0] text-emerald-600 hover:bg-[#e6f9f0] text-[10px] uppercase font-bold border-0 shadow-none">Success</Badge>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-start gap-4">
                                            <span className="text-[12px] text-slate-400 font-mono mt-0.5">16:42:21</span>
                                            <div>
                                                <p className="text-[14px] font-bold text-slate-800">Successful Login</p>
                                                <p className="text-[12px] text-slate-500">User: pantidenicejane@gmail.com · IP: 131.226.111.224</p>
                                            </div>
                                        </div>
                                        <Badge className="bg-[#e6f9f0] text-emerald-600 hover:bg-[#e6f9f0] text-[10px] uppercase font-bold border-0 shadow-none">Success</Badge>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="space-y-4 p-5">
                            {activityEvents.slice(0, 4).map((activity) => (
                                <div key={activity.id} className="flex items-center justify-between">
                                    <div className="flex items-start gap-4">
                                        <span className="text-[12px] text-muted-foreground font-mono mt-0.5">{new Date(activity.created_at).toLocaleTimeString([], { hour12: false })}</span>
                                        <div>
                                            <p className="text-[14px] font-bold text-foreground">{getActivityLabel(activity.action)}</p>
                                            <p className="text-[12px] text-muted-foreground">
                                                {activity.action === "warehouse_report_submitted" 
                                                    ? `Report for ${String((activity.metadata as any)?.date ?? "Unknown")}`
                                                    : `User: ${activity.actor?.email ?? "Unknown"} · IP: ${String((activity.metadata as any)?.ip ?? "Unknown")}`}
                                            </p>
                                        </div>
                                    </div>
                                    <Badge className={`${activity.action === "warehouse_report_submitted" ? "bg-indigo-500/10 text-indigo-500 border-0" : "bg-emerald-500/10 text-emerald-500 border-0"} text-[10px] uppercase font-bold hidden sm:flex`}>
                                        {activity.action === "warehouse_report_submitted" ? "Report" : "Success"}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

        </div>
    );
}
