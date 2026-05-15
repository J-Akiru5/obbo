"use client";

import { useEffect, useState, useCallback } from "react";
import {
    ShoppingCart, Truck, Users, ArrowUpRight,
    Clock, CheckCircle2, AlertCircle, UserPlus, PackagePlus,
    Package, AlertTriangle, ShieldAlert,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { fetchDashboardKPIs, fetchActivityFeed, fetchShipments, fetchOrders } from "@/lib/actions/admin-actions";
import type { ActivityLog, Order } from "@/lib/types/database";
import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface DashboardClientProps {
    initialKpis: any;
    initialActivityFeed: ActivityLog[];
    initialShipments: any[];
    initialRecentOrders: Order[];
    initialUserRole: string | null;
}

// ── Activity helpers ───────────────────────────────────────────
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

export default function DashboardClient({
    initialKpis,
    initialActivityFeed,
    initialShipments,
    initialRecentOrders,
    initialUserRole
}: DashboardClientProps) {
    const [kpis, setKpis] = useState(initialKpis);
    const [activityFeed, setActivityFeed] = useState<ActivityLog[]>(initialActivityFeed);
    const [recentOrders, setRecentOrders] = useState<Order[]>(initialRecentOrders);
    const [shipments, setShipments] = useState(initialShipments);
    const [userRole, setUserRole] = useState(initialUserRole);

    const loadData = useCallback(async () => {
        try {
            const [kpiData, feed, ships, pOrders] = await Promise.all([
                fetchDashboardKPIs(),
                fetchActivityFeed(20),
                fetchShipments(),
                fetchOrders("pending")
            ]);
            setKpis(kpiData);
            setActivityFeed(feed as ActivityLog[]);
            setShipments(ships as any[]);
            setRecentOrders((pOrders as Order[]).slice(0, 5));
        } catch (e) {
            console.error("Dashboard reload error:", e);
        }
    }, []);

    useEffect(() => {
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
                                    <p className="text-[13px] font-medium text-muted-foreground">JB: {kpis.jbGood.toLocaleString()} - SB: {kpis.sbGood.toLocaleString()}</p>
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
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border) / 0.5)" />
                            <XAxis 
                                dataKey="name" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fill: 'hsl(var(--foreground))', fontSize: 12, fontWeight: 500 }} 
                                dy={10} 
                            />
                            <YAxis 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fill: 'hsl(var(--foreground))', fontSize: 12, fontWeight: 500 }} 
                                tickFormatter={(value) => value.toLocaleString()}
                            />
                            <Tooltip 
                                cursor={{ fill: 'hsl(var(--muted)/0.15)' }} 
                                contentStyle={{ 
                                    borderRadius: '12px', 
                                    backgroundColor: 'hsl(var(--card))', 
                                    border: '1px solid hsl(var(--border))', 
                                    color: 'hsl(var(--foreground))',
                                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                    padding: '12px'
                                }} 
                            />
                            <Legend 
                                wrapperStyle={{ paddingTop: '30px' }} 
                                formatter={(value) => <span className="text-foreground/80 font-medium text-xs">{value}</span>}
                            />
                            <Bar dataKey="good" name="Good Stock" fill="#1dd1a1" radius={[6, 6, 0, 0]} maxBarSize={50} />
                            <Bar dataKey="obligated" name="Obligated (Balances)" fill="#feca57" radius={[6, 6, 0, 0]} maxBarSize={50} />
                            <Bar dataKey="net" name="Net Available" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={50} />
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

            <div className={`grid grid-cols-1 ${userRole !== 'admin' ? 'lg:grid-cols-2' : ''} gap-6 mt-8`}>
                {/* Pending Tasks */}
                {userRole !== 'admin' && (
                <Card className="border-border shadow-sm bg-card rounded-xl overflow-hidden">
                    <CardHeader className="pb-4 border-b border-border">
                        <CardTitle className="text-base font-semibold text-foreground tracking-wide">Pending Tasks</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-border">
                            <Link href="/admin/clients" className="flex items-center justify-between p-5 hover:bg-muted/50 transition-colors group">
                                <div className="flex items-center gap-3">
                                    <ShieldAlert className="w-5 h-5 text-[#ff6b6b]" />
                                    <span className="text-[14px] font-medium text-foreground">New Users Awaiting Verification</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="bg-[#ff6b6b] text-white text-[11px] font-bold px-2 py-0.5 rounded-full min-w-[24px] text-center">{kpis.pendingKyc}</span>
                                    <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                                </div>
                            </Link>
                            <Link href="/admin/orders#new" className="flex items-center justify-between p-5 hover:bg-muted/50 transition-colors group">
                                <div className="flex items-center gap-3">
                                    <ShoppingCart className="w-5 h-5 text-[#ff9f43]" />
                                    <span className="text-[14px] font-medium text-foreground">Pending Orders / Requests</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="bg-[#ff9f43] text-white text-[11px] font-bold px-2 py-0.5 rounded-full min-w-[24px] text-center">{kpis.pendingOrders}</span>
                                    <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                                </div>
                            </Link>
                            <Link href="/admin/orders#fulfillment" className="flex items-center justify-between p-5 hover:bg-muted/50 transition-colors group">
                                <div className="flex items-center gap-3">
                                    <Truck className="w-5 h-5 text-[#3b82f6]" />
                                    <span className="text-[14px] font-medium text-foreground">Pending Fulfillment</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="bg-[#3b82f6] text-white text-[11px] font-bold px-2 py-0.5 rounded-full min-w-[24px] text-center">{kpis.pendingFulfillment}</span>
                                    <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                                </div>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
                )}

                {/* System Activity Feed */}
                <Card className="border-border shadow-sm bg-card rounded-xl overflow-hidden">
                    <CardHeader className="pb-4 border-b border-border">
                        <CardTitle className="text-base font-semibold text-foreground tracking-wide">System Activity Feed</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="space-y-4 p-5">
                            {activityEvents.length === 0 && (
                                <p className="text-sm text-muted-foreground italic">No recent system activity.</p>
                            )}
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

            {/* Recent Pending Orders */}
            {userRole !== 'admin' && (
            <Card className="border-border shadow-sm bg-card rounded-xl overflow-hidden mt-8">
                <CardHeader className="pb-4 border-b border-border">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-semibold text-foreground tracking-wide">Recent Pending Orders</CardTitle>
                        <Link href="/admin/orders" className="text-[13px] font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors">
                            View All <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full text-sm text-left whitespace-nowrap">
                            <thead className="bg-muted/50 text-muted-foreground font-medium text-[12px] uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">PO #</th>
                                    <th className="px-6 py-4">Client</th>
                                    <th className="px-6 py-4 text-right">Total Bags</th>
                                    <th className="px-6 py-4">Payment</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {recentOrders.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium">No pending orders</td>
                                    </tr>
                                ) : (
                                    recentOrders.map((order) => {
                                        const total = order.items?.reduce((sum: number, i: any) => sum + i.requested_qty, 0) ?? 0;
                                        return (
                                            <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                                                <td className="px-6 py-4 font-mono font-medium text-foreground">{order.po_number || `#${order.id.slice(0, 8).toUpperCase()}`}</td>
                                                <td className="px-6 py-4 font-semibold text-primary">{(order as any).client?.full_name ?? "Unknown"}</td>
                                                <td className="px-6 py-4 text-right font-bold text-foreground">{total}</td>
                                                <td className="px-6 py-4">
                                                    <Badge className={order.payment_method === 'cash' ? "bg-emerald-500/10 text-emerald-500 border-0" : "bg-blue-500/10 text-blue-500 border-0"}>
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
                    </div>
                </CardContent>
            </Card>
            )}
        </div>
    );
}
