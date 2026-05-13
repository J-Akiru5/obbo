"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchCustomerBalances, fetchOrders, fetchWarehouseReport, fetchDashboardKPIs } from "@/lib/actions/admin-actions";
import type { WarehouseReport } from "@/lib/types/database";

export default function AdminReportsPage() {
    const [reportDate, setReportDate] = useState(new Date().toISOString().split("T")[0]);
    const [report, setReport] = useState<WarehouseReport | null>(null);
    const [currentInventory, setCurrentInventory] = useState({ jb: 0, sb: 0 });
    const [todayDispatches, setTodayDispatches] = useState<Array<{ client: string; dr: string | null; service: string; jb: number; sb: number }>>([]);
    const [balances, setBalances] = useState<Array<{ id: string; remaining_qty: number; bag_type: string; client?: { full_name: string; company_name: string | null }; product?: { name: string } }>>([]);
    const [loading, setLoading] = useState(true);

    const loadReportData = useCallback(async () => {
        setLoading(true);
        try {
            const [reportRow, dispatchedOrders, completedOrders, balanceRows, dashboardKpis] = await Promise.all([
                fetchWarehouseReport(reportDate),
                fetchOrders("dispatched"),
                fetchOrders("completed"),
                fetchCustomerBalances(),
                fetchDashboardKPIs(),
            ]);

            setReport((reportRow ?? null) as WarehouseReport | null);
            setCurrentInventory({ jb: dashboardKpis.jbGood, sb: dashboardKpis.sbGood });

            const dayOrders = [...(dispatchedOrders as any[]), ...(completedOrders as any[])].filter((order) =>
                typeof order.updated_at === "string" && order.updated_at.startsWith(reportDate) &&
                (order.status === "dispatched" || order.status === "completed")
            );

            setTodayDispatches(dayOrders.map((order) => ({
                client: order.client?.company_name || order.client?.full_name || "Unknown",
                dr: order.dr_number,
                service: order.service_type,
                jb: order.items.filter((item: { bag_type: string }) => item.bag_type === "JB").reduce((sum: number, item: { dispatched_qty: number }) => sum + item.dispatched_qty, 0),
                sb: order.items.filter((item: { bag_type: string }) => item.bag_type === "SB").reduce((sum: number, item: { dispatched_qty: number }) => sum + item.dispatched_qty, 0),
            })));

            setBalances(balanceRows as typeof balances);
        } catch (error) {
            console.error("Failed to load report data:", error);
        } finally {
            setLoading(false);
        }
    }, [reportDate]);

    useEffect(() => {
        loadReportData();
    }, [loadReportData]);

    const clientObligations = useMemo(() => {
        const obligations: Record<string, { clientName: string; jb: number; sb: number }> = {};
        for (const balance of balances) {
            const clientName = balance.client?.company_name || balance.client?.full_name || "Unknown Client";
            if (!obligations[clientName]) {
                obligations[clientName] = { clientName, jb: 0, sb: 0 };
            }
            if (balance.bag_type === "JB") obligations[clientName].jb += balance.remaining_qty;
            if (balance.bag_type === "SB") obligations[clientName].sb += balance.remaining_qty;
        }
        return Object.values(obligations);
    }, [balances]);

    return (
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-4 md:px-6 lg:px-8">
            <header className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card p-5 shadow-sm lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-primary">
                        Reports
                    </div>
                    <div>
                        <h2 className="text-3xl font-semibold tracking-tight text-foreground">Warehouse report review</h2>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                            View-only reporting for daily inventory reconciliation, movement tracking, and client obligation summaries.
                        </p>
                    </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <Input type="date" value={reportDate} onChange={(event) => setReportDate(event.target.value)} className="w-full sm:w-44" />
                    </div>
                </div>
            </header>

            {loading ? (
                <Card className="border-border/70 shadow-sm">
                    <CardContent className="py-12 text-center text-sm text-muted-foreground">Loading report data...</CardContent>
                </Card>
            ) : (
                <div className="flex flex-col gap-6">
                    <section>
                        <Card className="border-border/70 shadow-sm">
                            <CardHeader className="border-b border-border/60 pb-4">
                                <CardTitle className="text-base font-semibold">Physical warehouse inventory</CardTitle>
                                <CardDescription>Simplified daily snapshot of warehouse stock.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader className="bg-muted/30">
                                        <TableRow>
                                            <TableHead className="w-[220px]">Metric</TableHead>
                                            <TableHead>JB Bags</TableHead>
                                            <TableHead>SB Bags</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <TableRow>
                                            <TableCell className="font-medium">Yesterday's closing</TableCell>
                                            <TableCell>{report?.yesterday_jb ?? 0}</TableCell>
                                            <TableCell>{report?.yesterday_sb ?? 0}</TableCell>
                                        </TableRow>
                                        <TableRow className="bg-primary/5">
                                            <TableCell className="font-semibold text-primary">Today's closing (Current)</TableCell>
                                            <TableCell className="font-semibold">{currentInventory.jb}</TableCell>
                                            <TableCell className="font-semibold">{currentInventory.sb}</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </section>

                    <section className="grid gap-6 lg:grid-cols-2">
                        <Card className="border-border/70 shadow-sm">
                            <CardHeader className="border-b border-border/60 pb-4">
                                <CardTitle className="text-base font-semibold">Customer movement today</CardTitle>
                                <CardDescription>Auto-generated from dispatched and completed orders for the selected date.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader className="bg-muted/30">
                                        <TableRow>
                                            <TableHead>Client</TableHead>
                                            <TableHead>DR</TableHead>
                                            <TableHead>Service</TableHead>
                                            <TableHead className="text-right">JB</TableHead>
                                            <TableHead className="text-right">SB</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {todayDispatches.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                                                    No dispatches recorded for this date.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            todayDispatches.map((row, index) => (
                                                <TableRow key={`${row.client}-${index}`}>
                                                    <TableCell className="font-medium">{row.client}</TableCell>
                                                    <TableCell>{row.dr ?? "—"}</TableCell>
                                                    <TableCell className="capitalize">{row.service.replace(/_/g, " ")}</TableCell>
                                                    <TableCell className="text-right font-medium">{row.jb}</TableCell>
                                                    <TableCell className="text-right font-medium">{row.sb}</TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        <Card className="border-border/70 shadow-sm">
                            <CardHeader className="border-b border-border/60 pb-4">
                                <CardTitle className="text-base font-semibold">Customer obligation report</CardTitle>
                                <CardDescription>Pending balances owed by clients, grouped for oversight.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader className="bg-muted/30">
                                        <TableRow>
                                            <TableHead>Client</TableHead>
                                            <TableHead className="text-right">Remaining JB</TableHead>
                                            <TableHead className="text-right">Remaining SB</TableHead>
                                            <TableHead className="text-right">Total Bags</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {clientObligations.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                                                    No pending obligations.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            clientObligations.map((obl, idx) => (
                                                <TableRow key={idx}>
                                                    <TableCell className="font-medium">{obl.clientName}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Badge className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-0">
                                                            {obl.jb} JB
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Badge className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-0">
                                                            {obl.sb} SB
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right font-semibold">
                                                        {obl.jb + obl.sb}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </section>
                </div>
            )}
        </div>
    );
}

