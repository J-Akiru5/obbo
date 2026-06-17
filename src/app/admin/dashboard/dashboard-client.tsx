"use client";

import { useEffect, useState, useCallback } from "react";
import {
    ShoppingCart, Truck, Users, ArrowUpRight,
    Package, AlertTriangle, ShieldAlert, TrendingUp, 
    DollarSign, Settings2, ArrowLeft
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { fetchDashboardKPIs, fetchActivityFeed, fetchShipments, fetchOrders } from "@/lib/actions/admin-actions";
import type { ActivityLog, Order } from "@/lib/types/database";
import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { toast } from "sonner"; // 🌟 TOAST CODES NORMALIZATION PIPELINE

interface DashboardClientProps {
    initialKpis: any;
    initialActivityFeed: ActivityLog[];
    initialShipments: any[];
    initialRecentOrders: Order[];
    initialUserRole: string | null;
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

    const [showCostConfig, setShowCostConfig] = useState<boolean>(false);
    const [landedCost, setLandedCost] = useState<number>(147.64); 
    const [localExpenses, setLocalExpenses] = useState<number>(20.00); 
    const [saving, setSaving] = useState<boolean>(false);

    const sampleQty = 1200; 
    const sampleSellingPrice = 185.00;
    
    const currentGrossPerBag = sampleSellingPrice - landedCost;
    const currentNetPerBag = sampleSellingPrice - (landedCost + localExpenses);
    const currentTotalCostPerBag = landedCost + localExpenses;

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

    useEffect(() => {
        const fetchCostsFromDB = async () => {
            try {
                const supabase = createClient();
                const { data, error } = await supabase
                    .from("cost_configurations")
                    .select("landed_cost, local_expenses")
                    .order("updated_at", { ascending: false })
                    .limit(1)
                    .single();

                if (data && !error) {
                    setLandedCost(Number(data.landed_cost));
                    setLocalExpenses(Number(data.local_expenses));
                }
            } catch (err) {
                console.error("Operational cost database sync issue:", err);
            }
        };

        fetchCostsFromDB();
    }, []);

    const saveConfiguration = async () => {
        setSaving(true);
        try {
            const supabase = createClient();
            const { error } = await supabase
                .from("cost_configurations")
                .insert([
                    {
                        landed_cost: Number(landedCost),
                        local_expenses: Number(localExpenses)
                    }
                ]);

            if (!error) {
                toast.success("Cost parameters successfully compiled in live database system!");
            } else {
                toast.error(`ERROR: ${error.message}`);
            }
        } catch (err) {
            toast.error("ERROR: Live storage infrastructure failure");
        } finally {
            setSaving(false);
        }
    };

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
        <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 lg:p-8 min-h-screen">
            {/* Upper Action Context Controller Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 border-b border-border/60 pb-5">
                <div>
                    <h2 className="text-[28px] font-bold tracking-tight text-foreground">
                        {showCostConfig ? "Cost Configuration" : "Dashboard"}
                    </h2>
                    <p className="text-sm text-muted-foreground font-medium mt-1">
                        {showCostConfig 
                          ? "Establish ledger variables, landing fees, and operational criteria parameters" 
                          : "Real-time operational overview of warehouse performance"}
                    </p>
                </div>
                <div>
                    <button
                        onClick={() => {
                            setShowCostConfig(!showCostConfig);
                        }}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm border ${
                            showCostConfig 
                              ? "bg-muted text-muted-foreground hover:bg-muted/80 border-border" 
                              : "bg-orange-500 hover:bg-orange-600 text-white border-orange-600"
                        }`}
                    >
                        {showCostConfig ? (
                            <>
                                <ArrowLeft className="w-4 h-4" /> Back to Dashboard
                            </>
                        ) : (
                            <>
                                <Settings2 className="w-4 h-4" /> Open Cost Configuration
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* ── CONDITIONAL RENDER WRAPPER ─────────────────────────── */}
            {showCostConfig ? (
                <div className="animate-in fade-in duration-200">
                    <Card className="border-border shadow-md bg-card rounded-2xl overflow-hidden max-w-4xl mx-auto">
                        <div className="h-1.5 bg-orange-500 w-full" />
                        <CardContent className="p-6 md:p-8 space-y-6">

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="block text-sm font-bold text-foreground tracking-wide">
                                        Landed Cost (₱ / individual 40kg bag)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={landedCost}
                                        onChange={(e) => setLandedCost(parseFloat(e.target.value) || 0)}
                                        className="w-full bg-background border border-border text-foreground px-4 py-3 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium transition-all"
                                    />
                                    <span className="text-xs text-muted-foreground/80 block leading-normal pt-1">
                                        Base 85.80 + Freight 27.84 + Duties 22.00 + Port Handling 12.00 = 147.64 PHP.
                                    </span>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-sm font-bold text-foreground tracking-wide">
                                        Local Expenses (₱ / individual 40kg bag)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={localExpenses}
                                        onChange={(e) => setLocalExpenses(parseFloat(e.target.value) || 0)}
                                        className="w-full bg-background border border-border text-foreground px-4 py-3 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium transition-all"
                                    />
                                    <span className="text-xs text-muted-foreground/80 block leading-normal pt-1">
                                        Aggregated warehouse rental, domestic logistics, labor charges, and business taxes = 20.00 PHP.
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
                                <div className="bg-muted/40 border border-border/70 rounded-2xl p-5 shadow-sm">
                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Gross Profit / Bag</span>
                                    <div className="text-2xl font-extrabold text-foreground mt-2 tracking-tight">
                                        ₱{currentGrossPerBag.toFixed(2)}
                                    </div>
                                    <span className="text-[11px] font-medium text-muted-foreground block mt-1">Based on ₱{sampleSellingPrice} standard price</span>
                                </div>

                                <div className="bg-orange-500/5 border border-orange-500/10 rounded-2xl p-5 shadow-sm">
                                    <span className="text-xs font-semibold text-orange-500 uppercase tracking-wider">Net Profit / Bag</span>
                                    <div className="text-2xl font-extrabold text-orange-500 mt-2 tracking-tight">
                                        ₱{currentNetPerBag.toFixed(2)}
                                    </div>
                                    <span className="text-[11px] font-medium text-orange-500/70 block mt-1">Direct owner net yield earnings</span>
                                </div>

                                <div className="bg-muted/40 border border-border/70 rounded-2xl p-5 shadow-sm">
                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Cost / Bag</span>
                                    <div className="text-2xl font-extrabold text-foreground mt-2 tracking-tight">
                                        ₱{currentTotalCostPerBag.toFixed(2)}
                                    </div>
                                    <span className="text-[11px] font-medium text-muted-foreground block mt-1">Combined expenses threshold</span>
                                </div>
                            </div>

                            <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-5 text-sm text-orange-600 space-y-2">
                                <strong className="font-bold text-[14px] flex items-center gap-1.5 mb-1">
                                    <AlertTriangle className="w-4 h-4" /> Dynamic Systems Formulas Reference Architecture:
                                </strong>
                                <div className="font-medium text-xs md:text-sm pl-1 space-y-1">
                                    <p>• <span className="font-bold">Total Sales Matrix</span> = Quantity (Bags) × Wholesale Price per Catalog Item</p>
                                    <p>• <span className="font-bold">Gross Profit (Revenue)</span> = Total Sales − (Quantity × Landed Cost Target Point)</p>
                                    <p>• <span className="font-bold">Net Profit Margin</span> = Total Sales − (Quantity × (Landed Cost + Local Expenses Aggregates))</p>
                                </div>
                            </div>

                            <div className="pt-2">
                                <button
                                    onClick={saveConfiguration}
                                    disabled={saving}
                                    className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm tracking-wide px-6 py-3.5 rounded-xl transition-all disabled:opacity-50 shadow-sm flex items-center gap-2"
                                >
                                    {saving ? "Synchronizing Database Engine..." : "✓ Save Cost Configuration"}
                                </button>
                            </div>

                        </CardContent>
                    </Card>
                </div>
            ) : (
                <div className="animate-in fade-in duration-200 space-y-6">
                    {/* KPI Cards Row 1 */}
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

                    {/* KPI Cards Row 2 (Financial KPIs) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mt-6">
                        {/* Today's Revenue */}
                        <Card className="border-border shadow-sm bg-card rounded-xl overflow-hidden relative">
                            <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
                            <CardContent className="p-6">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-4 w-full">
                                        <p className="text-[13px] font-medium text-muted-foreground uppercase tracking-wide">Today&apos;s Revenue</p>
                                        <div className="flex items-baseline justify-between w-full">
                                            <p className="text-3xl sm:text-[38px] font-bold tracking-tight text-foreground leading-none">
                                                ₱{kpis.todayRevenue?.toLocaleString() ?? "0"}
                                            </p>
                                            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                                <DollarSign className="w-5 h-5 text-emerald-500" />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[13px] font-medium text-muted-foreground">Total sales today</p>
                                            <p className="text-[12px] font-semibold text-emerald-500">
                                                Gross: ₱{kpis.todayGrossProfit?.toLocaleString() ?? "0"}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Today's Net Profit */}
                        <Card className="border-border shadow-sm bg-card rounded-xl overflow-hidden relative">
                            <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500" />
                            <CardContent className="p-6">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-4 w-full">
                                        <p className="text-[13px] font-medium text-muted-foreground uppercase tracking-wide">Today&apos;s Net Profit</p>
                                        <div className="flex items-baseline justify-between w-full">
                                            <p className="text-3xl sm:text-[38px] font-bold tracking-tight text-foreground leading-none">
                                                ₱{kpis.todayNetProfit?.toLocaleString() ?? "0"}
                                            </p>
                                            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                                <TrendingUp className="w-5 h-5 text-blue-500" />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[13px] font-medium text-muted-foreground">Owner&apos;s income today</p>
                                            <p className="text-[12px] font-semibold text-transparent select-none">&nbsp;</p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Visual Analytics Bar Chart Card */}
                    <Card className="border-border shadow-sm bg-card rounded-xl overflow-hidden p-6 mt-6">
                        <CardHeader className="p-0 pb-4 mb-4 border-b border-border">
                            <CardTitle className="text-base font-semibold text-foreground tracking-wide">Warehouse Stock Overview</CardTitle>
                        </CardHeader>
                        {/* 🌟 FIX: Idinagdag ang min-w-0 para maiwasan ang chart responsive width calculation warning loops */}
                        <div className="h-[300px] w-full min-w-0 mt-4">
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

                    {/* Low Stock Alerts Card */}
                    <Card className="border-border shadow-sm bg-card rounded-xl overflow-hidden mt-6">
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

                    {/* Pending Tasks & Activities Split View Grid Layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                        {/* Pending Tasks Section */}
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

                        {/* System Activity Feed Section */}
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

                    {/* Recent Pending Orders Table Section */}
                    {userRole !== 'admin' && (
                    <Card className="border-border shadow-sm bg-card rounded-xl overflow-hidden mt-6">
                        <CardHeader className="pb-4 border-b border-border">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base font-semibold text-foreground tracking-wide">Recent Pending Orders</CardTitle>
                                <Link href="/admin/orders" className="text-[13px] font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                                    View All <ArrowUpRight className="w-3.5 h-3.5" />
                                </Link>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="hidden sm:block overflow-x-auto">
                                <Table className="w-full text-left whitespace-nowrap">
                                    <TableHeader className="bg-muted/50 text-muted-foreground font-medium text-[12px] uppercase tracking-wider">
                                        <TableRow>
                                            <TableHead className="px-6 py-4">PO #</TableHead>
                                            <TableHead className="px-6 py-4">Client</TableHead>
                                            <TableHead className="px-6 py-4 text-right">Total Bags</TableHead>
                                            <TableHead className="px-6 py-4">Payment</TableHead>
                                            <TableHead className="px-6 py-4 text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody className="divide-y divide-border">
                                        {recentOrders.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="px-6 py-12 text-center text-muted-foreground font-medium">No pending orders</TableCell>
                                            </TableRow>
                                        ) : (
                                            recentOrders.map((order) => {
                                                const total = order.items?.reduce((sum: number, i: any) => sum + i.requested_qty, 0) ?? 0;
                                                return (
                                                    <TableRow key={order.id} className="hover:bg-muted/30 transition-colors">
                                                        <TableCell className="px-6 py-4 font-mono font-medium text-foreground">{order.po_number || `#${order.id.slice(0, 8).toUpperCase()}`}</TableCell>
                                                        <TableCell className="px-6 py-4 font-semibold text-primary">{(order as any).client?.full_name ?? "Unknown"}</TableCell>
                                                        <TableCell className="px-6 py-4 text-right font-bold text-foreground">{total}</TableCell>
                                                        <TableCell className="px-6 py-4">
                                                            <Badge className={order.payment_method === 'cash' ? "bg-emerald-500/10 text-emerald-500 border-0" : "bg-blue-500/10 text-blue-500 border-0"}>
                                                                {order.payment_method.toUpperCase()}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="px-6 py-4 text-right">
                                                            <Link href={`/admin/orders#${order.id}`} className="text-primary hover:underline text-xs font-medium">Review</Link>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                            <div className="sm:hidden divide-y divide-border">
                                {recentOrders.length === 0 ? (
                                    <div className="px-4 py-12 text-center text-sm text-muted-foreground">No pending orders</div>
                                ) : (
                                    recentOrders.map((order) => {
                                        const total = order.items?.reduce((sum: number, i: any) => sum + i.requested_qty, 0) ?? 0;
                                        return (
                                            <Link key={order.id} href={`/admin/orders#${order.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                                                <div className="min-w-0">
                                                    <p className="font-mono text-sm font-medium">{order.po_number || `#${order.id.slice(0, 8).toUpperCase()}`}</p>
                                                    <p className="text-xs text-muted-foreground">{(order as any).client?.full_name ?? "Unknown"}</p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <Badge className={order.payment_method === 'cash' ? "bg-emerald-500/10 text-emerald-500 border-0 text-xs" : "bg-blue-500/10 text-blue-500 border-0 text-xs"}>
                                                        {order.payment_method.toUpperCase()}
                                                    </Badge>
                                                    <span className="text-sm font-bold">{total}</span>
                                                </div>
                                            </Link>
                                        );
                                    })
                                )}
                             </div>
                        </CardContent>
                    </Card>
                    )}
                </div>
            )}
        </div>
    );
}