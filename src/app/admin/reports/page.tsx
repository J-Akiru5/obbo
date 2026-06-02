"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchCustomerBalances, fetchOrders, fetchWarehouseReport, fetchDashboardKPIs, autoSubmitEndOfDayReports, fetchSalesProfitReport } from "@/lib/actions/admin-actions";
import { createClient } from "@/lib/supabase/client";
import type { WarehouseReport } from "@/lib/types/database";

export default function AdminReportsPage() {
    const [reportDate, setReportDate] = useState(new Date().toISOString().split("T")[0]);
    const [report, setReport] = useState<WarehouseReport | null>(null);
    const [currentInventory, setCurrentInventory] = useState({ jb: 0, sb: 0 });
    const [todayDispatches, setTodayDispatches] = useState<Array<{ client: string; dr: string | null; service: string; jb: number; sb: number }>>([]);
    const [balances, setBalances] = useState<Array<{ id: string; remaining_qty: number; bag_type: string; client?: { full_name: string; company_name: string | null }; product?: { name: string } }>>([]);
    const [loading, setLoading] = useState(true);
    const [notAvailable, setNotAvailable] = useState(false);

    // Sales & Profit Report state
    const today = new Date().toISOString().split("T")[0];
    const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
    const [profitDateFrom, setProfitDateFrom] = useState(firstOfMonth);
    const [profitDateTo, setProfitDateTo] = useState(today);
    const [profitReport, setProfitReport] = useState<{ totalSales: number; totalGrossProfit: number; totalNetProfit: number; entries: Array<Record<string, unknown>> }>({ totalSales: 0, totalGrossProfit: 0, totalNetProfit: 0, entries: [] });
    const [loadingProfit, setLoadingProfit] = useState(false);

    const loadReportData = useCallback(async () => {
        setLoading(true);
        setNotAvailable(false);
        try {
            const today = new Date().toISOString().split("T")[0];
            const [reportRow, dispatchedOrders, completedOrders, balanceRows, dashboardKpis] = await Promise.all([
                fetchWarehouseReport(reportDate),
                fetchOrders("dispatched"),
                fetchOrders("completed"),
                fetchCustomerBalances(),
                fetchDashboardKPIs(),
            ]);

            const fetchedReport = (reportRow ?? null) as WarehouseReport | null;
            setReport(fetchedReport);

            // If today's date and no report returned, it may be unsubmitted
            if (!fetchedReport && reportDate === today) {
                setNotAvailable(true);
            }

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

    const loadProfitReport = useCallback(async () => {
        if (!profitDateFrom || !profitDateTo) return;
        setLoadingProfit(true);
        try {
            const data = await fetchSalesProfitReport(profitDateFrom, profitDateTo);
            setProfitReport(data);
        } catch (error) {
            console.error("Failed to load profit report:", error);
        } finally {
            setLoadingProfit(false);
        }
    }, [profitDateFrom, profitDateTo]);

    useEffect(() => {
        // Trigger auto-submit for past unsubmitted reports on page load
        autoSubmitEndOfDayReports().catch(() => {});

        loadReportData();
        loadProfitReport();
        
        const supabase = createClient();
        const channel = supabase
            .channel('reports-sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_balances' }, () => {
                loadReportData();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
                loadReportData();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
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
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
            <header className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-primary">
                        Reports
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-foreground">Warehouse report review</h2>
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
                <Card className="border-border shadow-sm">
                    <CardContent className="py-12 text-center text-sm text-muted-foreground">Loading report data...</CardContent>
                </Card>
            ) : (
                <div className="flex flex-col gap-6">
                    <section>
                        <Card className="border-border shadow-sm">
                            <CardHeader className="border-b border-border/60 pb-4">
                                <CardTitle className="text-base font-semibold">Physical warehouse inventory</CardTitle>
                                <CardDescription>Simplified daily snapshot of warehouse stock.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                {notAvailable ? (
                                    <div className="flex flex-col items-center gap-3 py-12 text-center">
                                        <div className="rounded-full border border-border/60 bg-muted/30 p-3">
                                            <Calendar className="h-6 w-6 text-muted-foreground/60" />
                                        </div>
                                        <p className="text-sm font-medium text-foreground">Today's report is not yet available</p>
                                        <p className="max-w-md text-xs text-muted-foreground">
                                            The warehouse report for today will be visible here once the warehouse manager submits it, or it will be automatically uploaded at the end of the day.
                                        </p>
                                    </div>
                                ) : (
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
                                )}
                            </CardContent>
                        </Card>
                    </section>

                    <section className="grid gap-6 lg:grid-cols-2">
                        <Card className="border-border shadow-sm">
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

                        <Card className="border-border shadow-sm">
                            <CardHeader className="border-b border-border/60 pb-4">
                                <CardTitle className="text-base font-semibold">Customer obligation report</CardTitle>
                                <CardDescription>Pending balances owed by clients, grouped for oversight.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader className="bg-muted/30">
                                        <TableRow>
                                            <TableHead>PO #</TableHead>
                                            <TableHead>Client</TableHead>
                                            <TableHead>Bag Type</TableHead>
                                            <TableHead className="text-right">Total Purchase</TableHead>
                                            <TableHead className="text-right text-amber-600 font-semibold">Balance</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {balances.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                                                    No pending obligations.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            balances.map((balance) => (
                                                <TableRow key={balance.id}>
                                                    <TableCell className="font-mono text-xs font-bold">{(balance as any).order?.po_number || "—"}</TableCell>
                                                    <TableCell className="font-medium">{balance.client?.company_name || balance.client?.full_name || "Unknown"}</TableCell>
                                                    <TableCell>{balance.bag_type}</TableCell>
                                                    <TableCell className="text-right">{(balance as any).total_purchase || 0}</TableCell>
                                                    <TableCell className="text-right font-bold text-amber-600">
                                                        {balance.remaining_qty}
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

            {/* Sales & Profit Report */}
            <div className="space-y-6 pt-6 border-t border-border">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h3 className="text-lg font-bold text-foreground">Sales & Profit Report</h3>
                        <p className="text-sm text-muted-foreground">Financial performance for the selected period.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <Input
                                type="date"
                                value={profitDateFrom}
                                onChange={(e) => setProfitDateFrom(e.target.value)}
                                className="h-9 w-40"
                            />
                        </div>
                        <span className="text-muted-foreground text-sm">to</span>
                        <Input
                            type="date"
                            value={profitDateTo}
                            onChange={(e) => setProfitDateTo(e.target.value)}
                            className="h-9 w-40"
                        />
                        <Button size="sm" onClick={loadProfitReport} disabled={loadingProfit} className="bg-primary h-9">
                            {loadingProfit ? "Loading..." : "Generate"}
                        </Button>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Card className="border-border shadow-sm">
                        <CardContent className="p-5 text-center">
                            <p className="text-xs uppercase font-bold text-muted-foreground tracking-wider mb-2">Total Sales</p>
                            <p className="text-3xl font-bold text-foreground">₱{profitReport.totalSales.toLocaleString()}</p>
                        </CardContent>
                    </Card>
                    <Card className="border-border shadow-sm">
                        <CardContent className="p-5 text-center">
                            <p className="text-xs uppercase font-bold text-muted-foreground tracking-wider mb-2">Gross Profit</p>
                            <p className="text-3xl font-bold text-emerald-600">₱{profitReport.totalGrossProfit.toLocaleString()}</p>
                        </CardContent>
                    </Card>
                    <Card className="border-border shadow-sm">
                        <CardContent className="p-5 text-center">
                            <p className="text-xs uppercase font-bold text-muted-foreground tracking-wider mb-2">Net Profit</p>
                            <p className={`text-3xl font-bold ${profitReport.totalNetProfit >= 0 ? "text-blue-600" : "text-red-500"}`}>
                                ₱{profitReport.totalNetProfit.toLocaleString()}
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Daily Breakdown Table */}
                {profitReport.entries.length > 0 && (
                    <Card className="border-border shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Dispatch Breakdown</CardTitle>
                            <CardDescription>Individual dispatch entries in the selected period.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>DR #</TableHead>
                                        <TableHead>Client</TableHead>
                                        <TableHead className="text-right">Bags</TableHead>
                                        <TableHead className="text-right">Sales</TableHead>
                                        <TableHead className="text-right">Gross Profit</TableHead>
                                        <TableHead className="text-right">Net Profit</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {profitReport.entries.map((entry, idx) => (
                                        <TableRow key={idx}>
                                            <TableCell className="text-xs">{String(entry.date)}</TableCell>
                                            <TableCell className="font-mono text-xs font-bold">{String(entry.dr_number || "—")}</TableCell>
                                            <TableCell className="text-sm max-w-[150px] truncate">{String(entry.client_name || "—")}</TableCell>
                                            <TableCell className="text-right text-sm">{((Number(entry.jb) || 0) * 25 + (Number(entry.sb) || 0) * 50).toLocaleString()}</TableCell>
                                            <TableCell className="text-right text-sm font-medium">₱{(Number(entry.total_sales) || 0).toLocaleString()}</TableCell>
                                            <TableCell className="text-right text-sm text-emerald-600">₱{(Number(entry.gross_profit) || 0).toLocaleString()}</TableCell>
                                            <TableCell className={`text-right text-sm font-bold ${(Number(entry.net_profit) || 0) >= 0 ? "text-blue-600" : "text-red-500"}`}>
                                                ₱{(Number(entry.net_profit) || 0).toLocaleString()}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}

                {profitReport.entries.length === 0 && !loadingProfit && (
                    <div className="text-center py-8 text-muted-foreground">
                        No dispatch entries found for the selected period.
                    </div>
                )}
            </div>
        </div>
    );
}

