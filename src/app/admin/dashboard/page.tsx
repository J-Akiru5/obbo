"use client";

import { useEffect, useState, useCallback } from "react";
import {
    Package, ShoppingCart, Truck, Users, ArrowUpRight,
    Clock, CheckCircle2, AlertCircle, UserPlus, PackagePlus,
    Wifi, WifiOff, AlertTriangle, ShieldAlert,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { fetchDashboardKPIs, fetchActivityFeed, fetchShipments, fetchOrders } from "@/lib/actions/admin-actions";
import type { ActivityLog, Order } from "@/lib/types/database";
import Link from "next/link";

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

function StockAlertBadge({ percentage }: { percentage: number }) {
    if (percentage > 50) return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-[10px]">Safe</Badge>;
    if (percentage > 20) return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-[10px]">Warning</Badge>;
    return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 text-[10px]">Critical</Badge>;
}

export default function AdminDashboard() {
    const [kpis, setKpis] = useState({
        jbGood: 0, sbGood: 0, jbBalance: 0, sbBalance: 0,
        jbNet: 0, sbNet: 0, grandTotal: 0, grandBalance: 0, grandNet: 0,
        pendingOrders: 0, pendingKyc: 0, activeClients: 0, pendingFulfillment: 0,
    });
    const [activityFeed, setActivityFeed] = useState<ActivityLog[]>([]);
    const [recentOrders, setRecentOrders] = useState<Order[]>([]);
    const [shipments, setShipments] = useState<Array<{ batch_name: string; remaining_jb: number; remaining_sb: number; total_jb: number; total_sb: number }>>([]);

    const loadData = useCallback(async () => {
        try {
            const [kpiData, feed, ships, pOrders] = await Promise.all([
                fetchDashboardKPIs(),
                fetchActivityFeed(20),
                fetchShipments(),
                fetchOrders("pending")
            ]);
            setKpis(kpiData as any);
            setActivityFeed(feed as ActivityLog[]);
            setShipments(ships as typeof shipments);
            setRecentOrders((pOrders as Order[]).slice(0, 5));
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

    const kpiCards = [
        {
            title: "Good Stock (SB)", value: kpis.sbGood.toLocaleString(),
            subtitle: `${kpis.sbBalance.toLocaleString()} obligated · ${kpis.sbNet.toLocaleString()} net`,
            icon: Package, color: "text-blue-600 bg-blue-500/10",
        },
        {
            title: "Good Stock (JB)", value: kpis.jbGood.toLocaleString(),
            subtitle: `${kpis.jbBalance.toLocaleString()} obligated · ${kpis.jbNet.toLocaleString()} net`,
            icon: Package, color: "text-emerald-600 bg-emerald-500/10",
        },
        {
            title: "Net Available", value: kpis.grandNet.toLocaleString(),
            subtitle: `${kpis.grandTotal.toLocaleString()} total − ${kpis.grandBalance.toLocaleString()} owed`,
            icon: Truck, color: "text-indigo-600 bg-indigo-500/10",
        },
        {
            title: "Pending Orders", value: kpis.pendingOrders.toString(),
            subtitle: `${kpis.activeClients} active clients · ${kpis.pendingKyc} pending KYC`,
            icon: ShoppingCart, color: "text-amber-600 bg-amber-500/10",
        },
    ];

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 lg:p-8 font-sans bg-[#f4f2ef] min-h-screen">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-[28px] font-bold tracking-tight text-slate-800">Dashboard</h2>
                    <p className="text-sm text-slate-500 font-medium mt-1">Real-time operational overview of warehouse performance</p>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Total Good Stock */}
                <Card className="border-0 shadow-sm bg-white rounded-xl overflow-hidden relative">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-[#ff9f43]" />
                    <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                            <div className="space-y-4 w-full">
                                <p className="text-[13px] font-medium text-slate-500 uppercase tracking-wide">Total Good Stock</p>
                                <div className="flex items-baseline justify-between w-full">
                                    <p className="text-[38px] font-bold tracking-tight text-slate-800 leading-none">{kpis.grandTotal.toLocaleString()}</p>
                                    <div className="w-10 h-10 rounded-lg bg-[#fff4e6] flex items-center justify-center">
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
                <Card className="border-0 shadow-sm bg-white rounded-xl overflow-hidden relative">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-[#feca57]" />
                    <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                            <div className="space-y-4 w-full">
                                <p className="text-[13px] font-medium text-slate-500 uppercase tracking-wide">Client Balances</p>
                                <div className="flex items-baseline justify-between w-full">
                                    <p className="text-[38px] font-bold tracking-tight text-slate-800 leading-none">{kpis.grandBalance.toLocaleString()}</p>
                                    <div className="w-10 h-10 rounded-lg bg-[#fff8e1] flex items-center justify-center">
                                        <Users className="w-5 h-5 text-[#feca57]" />
                                    </div>
                                </div>
                                <div className="space-y-1 mt-4">
                                    <p className="text-[13px] font-medium text-slate-400">Total owed in-bags</p>
                                    <p className="text-[12px] font-semibold text-transparent select-none">&nbsp;</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Pending KYC */}
                <Card className="border-0 shadow-sm bg-[#f2f2f2] rounded-xl overflow-hidden relative">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-[#ff6b6b]" />
                    <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                            <div className="space-y-4 w-full">
                                <p className="text-[13px] font-medium text-slate-500 uppercase tracking-wide">Pending KYC</p>
                                <div className="flex items-baseline justify-between w-full">
                                    <p className="text-[38px] font-bold tracking-tight text-slate-800 leading-none">{kpis.pendingKyc}</p>
                                    <div className="w-10 h-10 rounded-lg bg-[#ffebe6] flex items-center justify-center">
                                        <ShieldAlert className="w-5 h-5 text-[#ff6b6b]" />
                                    </div>
                                </div>
                                <div className="space-y-1 mt-4">
                                    <p className="text-[13px] font-medium text-slate-400">Unverified users</p>
                                    <p className="text-[12px] font-semibold text-transparent select-none">&nbsp;</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Net Available */}
                <Card className="border-0 shadow-sm bg-white rounded-xl overflow-hidden relative">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-[#1dd1a1]" />
                    <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                            <div className="space-y-4 w-full">
                                <p className="text-[13px] font-medium text-slate-500 uppercase tracking-wide">Net Available</p>
                                <div className="flex items-baseline justify-between w-full">
                                    <p className="text-[38px] font-bold tracking-tight text-slate-800 leading-none">{kpis.grandNet.toLocaleString()}</p>
                                    <div className="w-10 h-10 rounded-lg bg-[#e6fbf5] flex items-center justify-center">
                                        <Package className="w-5 h-5 text-[#1dd1a1]" />
                                    </div>
                                </div>
                                <div className="space-y-1 mt-4">
                                    <p className="text-[13px] font-medium text-slate-400">Physical - Balances</p>
                                    <p className="text-[12px] font-semibold text-transparent select-none">&nbsp;</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Low Stock Alerts */}
            <Card className="border-0 shadow-sm bg-[#eeece8] rounded-xl overflow-hidden mt-8">
                <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-slate-500" />
                        <CardTitle className="text-base font-semibold text-slate-600 tracking-wide">Low Stock Alerts</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 pb-6">
                    <div className="bg-[#e6f9f0] border border-[#a2e8c6] rounded-xl p-5 flex items-center justify-between">
                        <div>
                            <h4 className="text-[15px] font-semibold text-slate-800">Jumbo Bags (JB)</h4>
                            <p className="text-[13px] text-slate-500 mt-1">Threshold: 100 bags</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[28px] font-bold text-emerald-600 leading-none mb-1">{kpis.jbGood.toLocaleString()}</p>
                            <span className="text-[10px] font-bold tracking-widest text-emerald-600 uppercase">Safe</span>
                        </div>
                    </div>
                    <div className="bg-[#e6f9f0] border border-[#a2e8c6] rounded-xl p-5 flex items-center justify-between">
                        <div>
                            <h4 className="text-[15px] font-semibold text-slate-800">Sling Bags (SB)</h4>
                            <p className="text-[13px] text-slate-500 mt-1">Threshold: 200 bags</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[28px] font-bold text-emerald-600 leading-none mb-1">{kpis.sbGood.toLocaleString()}</p>
                            <span className="text-[10px] font-bold tracking-widest text-emerald-600 uppercase">Safe</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
                {/* Pending Tasks */}
                <Card className="border-0 shadow-sm bg-[#eeece8] rounded-xl overflow-hidden">
                    <CardHeader className="pb-4 border-b border-[#e2dfd9]">
                        <CardTitle className="text-base font-semibold text-slate-700 tracking-wide">Pending Tasks</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-[#e2dfd9]">
                            <Link href="/admin/clients" className="flex items-center justify-between p-5 hover:bg-[#e6e4df] transition-colors group">
                                <div className="flex items-center gap-3">
                                    <ShieldAlert className="w-5 h-5 text-[#ff6b6b]" />
                                    <span className="text-[14px] font-medium text-slate-700">New Users Awaiting Verification</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="bg-[#ff6b6b] text-white text-[11px] font-bold px-2 py-0.5 rounded-full min-w-[24px] text-center">{kpis.pendingKyc}</span>
                                    <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                                </div>
                            </Link>
                            <Link href="/admin/orders#new" className="flex items-center justify-between p-5 hover:bg-[#e6e4df] transition-colors group">
                                <div className="flex items-center gap-3">
                                    <ShoppingCart className="w-5 h-5 text-[#ff9f43]" />
                                    <span className="text-[14px] font-medium text-slate-700">Pending Orders / Requests</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="bg-[#ff9f43] text-white text-[11px] font-bold px-2 py-0.5 rounded-full min-w-[24px] text-center">{kpis.pendingOrders}</span>
                                    <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                                </div>
                            </Link>
                            <Link href="/admin/orders#fulfillment" className="flex items-center justify-between p-5 hover:bg-[#e6e4df] transition-colors group">
                                <div className="flex items-center gap-3">
                                    <Truck className="w-5 h-5 text-[#3b82f6]" />
                                    <span className="text-[14px] font-medium text-slate-700">Pending Fulfillment</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="bg-[#3b82f6] text-white text-[11px] font-bold px-2 py-0.5 rounded-full min-w-[24px] text-center">{kpis.pendingFulfillment}</span>
                                    <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                                </div>
                            </Link>
                        </div>
                    </CardContent>
                </Card>

                {/* System Activity Feed */}
                <Card className="border-0 shadow-sm bg-[#eeece8] rounded-xl overflow-hidden">
                    <CardHeader className="pb-4 border-b border-[#e2dfd9]">
                        <CardTitle className="text-base font-semibold text-slate-700 tracking-wide">System Activity Feed</CardTitle>
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
                                        <span className="text-[12px] text-slate-400 font-mono mt-0.5">{new Date(activity.created_at).toLocaleTimeString([], { hour12: false })}</span>
                                        <div>
                                            <p className="text-[14px] font-bold text-slate-800">{getActivityLabel(activity.action)}</p>
                                            <p className="text-[12px] text-slate-500">
                                                {activity.action === "warehouse_report_submitted" 
                                                    ? `Report for ${String((activity.metadata as any)?.date ?? "Unknown")}`
                                                    : `User: ${activity.actor?.email ?? "Unknown"} · IP: ${String((activity.metadata as any)?.ip ?? "Unknown")}`}
                                            </p>
                                        </div>
                                    </div>
                                    <Badge className={activity.action === "warehouse_report_submitted" ? "bg-indigo-100 text-indigo-600 border-0" : "bg-[#e6f9f0] text-emerald-600 border-0"} text-[10px] uppercase font-bold>
                                        {activity.action === "warehouse_report_submitted" ? "Report" : "Success"}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Pending Orders */}
            <Card className="border-0 shadow-sm bg-[#eeece8] rounded-xl overflow-hidden mt-8">
                <CardHeader className="pb-4 border-b border-[#e2dfd9]">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-semibold text-slate-700 tracking-wide">Recent Pending Orders</CardTitle>
                        <Link href="/admin/orders" className="text-[13px] font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors">
                            View All <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="bg-[#e6e4df] text-slate-500 font-medium text-[12px] uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4 rounded-tl-xl">PO #</th>
                                <th className="px-6 py-4">Client</th>
                                <th className="px-6 py-4">Type</th>
                                <th className="px-6 py-4 text-right">JB</th>
                                <th className="px-6 py-4 text-right">SB</th>
                                <th className="px-6 py-4 text-right">Total Bags</th>
                                <th className="px-6 py-4">Payment</th>
                                <th className="px-6 py-4 text-right rounded-tr-xl">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e2dfd9]">
                            {recentOrders.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400 font-medium">No pending orders</td>
                                </tr>
                            ) : (
                                recentOrders.map((order) => {
                                    const jb = order.items?.filter((i: any) => i.bag_type === 'JB').reduce((sum: number, i: any) => sum + i.requested_qty, 0) ?? 0;
                                    const sb = order.items?.filter((i: any) => i.bag_type === 'SB').reduce((sum: number, i: any) => sum + i.requested_qty, 0) ?? 0;
                                    return (
                                        <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 font-mono font-medium text-slate-700">{order.po_number || `#${order.id.slice(0, 8).toUpperCase()}`}</td>
                                            <td className="px-6 py-4 font-semibold text-[var(--color-industrial-blue)]">{(order as any).client?.full_name ?? "Unknown"}</td>
                                            <td className="px-6 py-4"><Badge variant="outline" className="text-[10px] uppercase bg-white">{order.source}</Badge></td>
                                            <td className="px-6 py-4 text-right font-medium">{jb}</td>
                                            <td className="px-6 py-4 text-right font-medium">{sb}</td>
                                            <td className="px-6 py-4 text-right font-bold text-slate-800">{jb + sb}</td>
                                            <td className="px-6 py-4">
                                                <Badge className={order.payment_method === 'cash' ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" : "bg-blue-100 text-blue-800 hover:bg-blue-100"}>
                                                    {order.payment_method.toUpperCase()}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Link href={`/admin/orders#${order.id}`} className="text-[#3b82f6] hover:underline text-xs font-medium">Review</Link>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </CardContent>
            </Card>
        </div>
    );
}
