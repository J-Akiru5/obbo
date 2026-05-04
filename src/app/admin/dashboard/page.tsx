"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
    AlertCircle,
    AlertTriangle,
    ArrowUpRight,
    BadgeAlert,
    CheckCircle2,
    Clock,
    Package,
    Shield,
    ShieldAlert,
    ShoppingCart,
    UserPlus,
    Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { fetchActivityFeed, fetchDashboardKPIs, fetchShipments } from "@/lib/actions/admin-actions";
import type { ActivityLog } from "@/lib/types/database";

function formatTimeAgo(dateStr: string) {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    const days = Math.floor(seconds / 86400);
    if (days > 30) return `${Math.floor(days / 30)}mo ago`;
    if (days > 0) return `${days}d ago`;
    const hours = Math.floor(seconds / 3600);
    if (hours > 0) return `${hours}h ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) return `${minutes}m ago`;
    return "Just now";
}

function getActivityIcon(action: string) {
    if (action.includes("kyc")) return <UserPlus className="w-4 h-4 text-amber-500" />;
    if (action.includes("order")) return <ShoppingCart className="w-4 h-4 text-[var(--color-industrial-blue)]" />;
    if (action.includes("setting") || action.includes("role")) return <Shield className="w-4 h-4 text-rose-500" />;
    return <Clock className="w-4 h-4 text-muted-foreground" />;
}

function getActivityLabel(action: string) {
    const labels: Record<string, string> = {
        kyc_submitted: "KYC submitted",
        kyc_approved: "KYC approved",
        kyc_rejected: "KYC rejected",
        profile_role_updated: "Role updated",
        setting_updated: "Setting updated",
        manual_client_created: "Manual client created",
        order_approved: "Order approved",
        order_rejected: "Order rejected",
        order_dispatched: "Order dispatched",
        order_check_confirmed: "Check confirmed",
        tracking_updated: "Tracking updated",
        warehouse_report_saved: "Warehouse report saved",
    };
    return labels[action] ?? action.replace(/_/g, " ");
}

function getStockSeverity(current: number, total: number) {
    if (total <= 0) {
        return { label: "Green", tone: "bg-emerald-100 text-emerald-800 border-emerald-200" };
    }
    const pct = (current / total) * 100;
    if (pct <= 20) return { label: "Red", tone: "bg-red-100 text-red-800 border-red-200" };
    if (pct <= 45) return { label: "Yellow", tone: "bg-amber-100 text-amber-800 border-amber-200" };
    return { label: "Green", tone: "bg-emerald-100 text-emerald-800 border-emerald-200" };
}

function SummaryCard({
    title,
    value,
    subtitle,
    icon: Icon,
    accent,
}: {
    title: string;
    value: string;
    subtitle: string;
    icon: React.ComponentType<{ className?: string }>;
    accent: string;
}) {
    return (
        <Card className="overflow-hidden border-border/70 shadow-sm bg-card">
            <div className={`h-1 ${accent}`} />
            <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{title}</p>
                        <p className="text-3xl font-semibold tracking-tight text-foreground">{value}</p>
                        <p className="text-sm text-muted-foreground">{subtitle}</p>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted/70">
                        <Icon className="h-5 w-5 text-[var(--color-industrial-blue)]" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export default function AdminDashboard() {
    const [kpis, setKpis] = useState({
        jbGood: 0,
        sbGood: 0,
        jbBalance: 0,
        sbBalance: 0,
        jbNet: 0,
        sbNet: 0,
        grandTotal: 0,
        grandBalance: 0,
        grandNet: 0,
        pendingOrders: 0,
        pendingKyc: 0,
        activeClients: 0,
        pendingFulfillment: 0,
    });
    const [activityFeed, setActivityFeed] = useState<ActivityLog[]>([]);
    const [shipments, setShipments] = useState<Array<{ total_jb: number; total_sb: number; remaining_jb: number; remaining_sb: number }>>([]);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        try {
            const [kpiData, feed, shipmentRows] = await Promise.all([
                fetchDashboardKPIs(),
                fetchActivityFeed(20),
                fetchShipments(),
            ]);
            setKpis(kpiData as typeof kpis);
            setActivityFeed(feed as ActivityLog[]);
            setShipments(shipmentRows as typeof shipments);
        } catch (error) {
            console.error("Dashboard load error:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();

        const supabase = createClient();
        const channel = supabase
            .channel("admin-dashboard-live")
            .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, loadData)
            .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, loadData)
            .on("postgres_changes", { event: "*", schema: "public", table: "shipments" }, loadData)
            .on("postgres_changes", { event: "*", schema: "public", table: "activity_log" }, loadData)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [loadData]);

    const totalInitialJb = shipments.reduce((sum, shipment) => sum + (shipment.total_jb ?? 0), 0);
    const totalInitialSb = shipments.reduce((sum, shipment) => sum + (shipment.total_sb ?? 0), 0);
    const jbSeverity = getStockSeverity(kpis.jbGood, totalInitialJb);
    const sbSeverity = getStockSeverity(kpis.sbGood, totalInitialSb);

    const securityAlerts = activityFeed.filter((entry) =>
        entry.action.includes("login") ||
        entry.action.includes("kyc_rejected") ||
        entry.action.includes("role_updated") ||
        entry.action.includes("setting_updated")
    );

    return (
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-4 md:px-6 lg:px-8">
            <header className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-industrial-blue)]/15 bg-[var(--color-industrial-blue)]/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--color-industrial-blue)]">
                    Admin oversight
                </div>
                <div className="space-y-2">
                    <h2 className="text-3xl font-semibold tracking-tight text-balance text-foreground">Dashboard</h2>
                    <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                        Real-time, read-only monitoring for stock, client balances, KYC reviews, and security activity.
                    </p>
                </div>
            </header>

            {loading ? (
                <Card className="border-border/70 shadow-sm">
                    <CardContent className="py-12 text-center text-sm text-muted-foreground">Loading dashboard data...</CardContent>
                </Card>
            ) : (
                <>
                    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <SummaryCard
                            title="Total Good Stock"
                            value={kpis.grandTotal.toLocaleString()}
                            subtitle={`JB ${kpis.jbGood.toLocaleString()} + SB ${kpis.sbGood.toLocaleString()}`}
                            icon={Package}
                            accent="bg-[var(--color-industrial-yellow)]"
                        />
                        <SummaryCard
                            title="Total Client Balances"
                            value={Math.abs(kpis.grandBalance).toLocaleString()}
                            subtitle="Total owed in bags"
                            icon={Users}
                            accent="bg-amber-400"
                        />
                        <SummaryCard
                            title="Net Available Stock"
                            value={kpis.grandNet.toLocaleString()}
                            subtitle="Good stock minus client balances"
                            icon={Shield}
                            accent="bg-emerald-400"
                        />
                        <SummaryCard
                            title="Review Queue"
                            value={`${kpis.pendingKyc} / ${kpis.pendingOrders}`}
                            subtitle="Pending KYC / pending orders"
                            icon={BadgeAlert}
                            accent="bg-[var(--color-industrial-blue)]"
                        />
                    </section>

                    <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                        <Card className="border-border/70 shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-border/60 pb-4">
                                <div>
                                    <CardTitle className="text-base font-semibold">Low stock alerts</CardTitle>
                                    <p className="mt-1 text-sm text-muted-foreground">Warehouse health is shown as a simple Green / Yellow / Red status.</p>
                                </div>
                                <Badge className="border bg-muted text-foreground hover:bg-muted">Read only</Badge>
                            </CardHeader>
                            <CardContent className="grid gap-4 p-5 md:grid-cols-2">
                                <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <p className="text-sm font-semibold text-foreground">Jumbo Bags (JB)</p>
                                            <p className="mt-1 text-xs text-muted-foreground">{kpis.jbGood.toLocaleString()} of {totalInitialJb.toLocaleString()} recorded</p>
                                        </div>
                                        <Badge className={jbSeverity.tone}>{jbSeverity.label}</Badge>
                                    </div>
                                    <p className="mt-4 text-xs text-muted-foreground">
                                        {totalInitialJb > 0 ? `${Math.round((kpis.jbGood / totalInitialJb) * 100)}% of recorded JB stock remains.` : "No JB stock baseline available."}
                                    </p>
                                </div>
                                <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <p className="text-sm font-semibold text-foreground">Sling Bags (SB)</p>
                                            <p className="mt-1 text-xs text-muted-foreground">{kpis.sbGood.toLocaleString()} of {totalInitialSb.toLocaleString()} recorded</p>
                                        </div>
                                        <Badge className={sbSeverity.tone}>{sbSeverity.label}</Badge>
                                    </div>
                                    <p className="mt-4 text-xs text-muted-foreground">
                                        {totalInitialSb > 0 ? `${Math.round((kpis.sbGood / totalInitialSb) * 100)}% of recorded SB stock remains.` : "No SB stock baseline available."}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-border/70 shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-border/60 pb-4">
                                <div>
                                    <CardTitle className="text-base font-semibold">Recent security alerts</CardTitle>
                                    <p className="mt-1 text-sm text-muted-foreground">Audit events that need attention from the office team.</p>
                                </div>
                                <AlertTriangle className="h-5 w-5 text-[var(--color-industrial-yellow)]" />
                            </CardHeader>
                            <CardContent className="p-0">
                                {securityAlerts.length === 0 ? (
                                    <div className="px-5 py-12 text-center text-sm text-muted-foreground">No recent security alerts.</div>
                                ) : (
                                    <div className="divide-y divide-border/60">
                                        {securityAlerts.slice(0, 5).map((entry) => (
                                            <div key={entry.id} className="flex items-start justify-between gap-4 px-5 py-4">
                                                <div className="flex items-start gap-3">
                                                    <div className="mt-0.5 rounded-lg bg-muted p-2">{getActivityIcon(entry.action)}</div>
                                                    <div className="space-y-1">
                                                        <p className="text-sm font-medium text-foreground">{getActivityLabel(entry.action)}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {entry.actor?.full_name ?? "System"} · {formatTimeAgo(entry.created_at)}
                                                        </p>
                                                    </div>
                                                </div>
                                                <Badge variant="outline" className="text-[10px] uppercase tracking-wide">Security</Badge>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </section>

                    <section className="grid gap-6 lg:grid-cols-2">
                        <Card className="border-border/70 shadow-sm">
                            <CardHeader className="border-b border-border/60 pb-4">
                                <CardTitle className="text-base font-semibold">Pending review counts</CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
                                <Link href="/admin/clients" className="group rounded-xl border border-border/70 bg-card p-4 transition-colors hover:border-[var(--color-industrial-blue)]/35 hover:bg-[var(--color-industrial-blue)]/5">
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <p className="text-sm font-semibold text-foreground">Pending KYC</p>
                                            <p className="mt-1 text-xs text-muted-foreground">Verification hub queue</p>
                                        </div>
                                        <span className="rounded-full bg-[var(--color-industrial-yellow)] px-2.5 py-1 text-xs font-semibold text-white">{kpis.pendingKyc}</span>
                                    </div>
                                    <div className="mt-4 flex items-center gap-1 text-xs font-medium text-[var(--color-industrial-blue)]">
                                        View clients <ArrowUpRight className="h-3.5 w-3.5" />
                                    </div>
                                </Link>
                                <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <p className="text-sm font-semibold text-foreground">Pending Orders</p>
                                            <p className="mt-1 text-xs text-muted-foreground">Read-only count for office oversight</p>
                                        </div>
                                        <span className="rounded-full bg-[var(--color-industrial-blue)] px-2.5 py-1 text-xs font-semibold text-white">{kpis.pendingOrders}</span>
                                    </div>
                                    <p className="mt-4 text-xs text-muted-foreground">
                                        Admins no longer process the order pipeline. Warehouse staff handle approval, dispatch, and tracking.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-border/70 shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-border/60 pb-4">
                                <div>
                                    <CardTitle className="text-base font-semibold">Operational notes</CardTitle>
                                    <p className="mt-1 text-sm text-muted-foreground">The dashboard remains read only for oversight and escalation.</p>
                                </div>
                            </CardHeader>
                            <CardContent className="grid gap-3 p-5 sm:grid-cols-3">
                                <div className="rounded-xl border border-border/70 bg-card p-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Status</p>
                                    <p className="mt-2 text-sm font-medium text-foreground">{kpis.grandNet >= 0 ? "Stock in surplus" : "Stock deficit"}</p>
                                </div>
                                <div className="rounded-xl border border-border/70 bg-card p-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">KYC</p>
                                    <p className="mt-2 text-sm font-medium text-foreground">{kpis.pendingKyc} registrations waiting</p>
                                </div>
                                <div className="rounded-xl border border-border/70 bg-card p-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Security</p>
                                    <p className="mt-2 text-sm font-medium text-foreground">{securityAlerts.length} recent alerts</p>
                                </div>
                            </CardContent>
                        </Card>
                    </section>
                </>
            )}
        </div>
    );
}
