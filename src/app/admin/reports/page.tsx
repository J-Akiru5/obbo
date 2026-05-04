"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Calendar, CircleCheckBig, FileText, Package, Truck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchCustomerBalances, fetchOrders, fetchWarehouseReport, fetchWarehouseReports } from "@/lib/actions/admin-actions";
import type { WarehouseReport } from "@/lib/types/database";

function reportStatusFor(report: WarehouseReport | null, reportDate: string) {
    if (!report) {
        return { label: "Draft", tone: "bg-slate-100 text-slate-700 border-slate-200" };
    }

    if (reportDate === new Date().toISOString().split("T")[0]) {
        return { label: "Submitted", tone: "bg-amber-100 text-amber-800 border-amber-200" };
    }

    return { label: "Reviewed", tone: "bg-emerald-100 text-emerald-800 border-emerald-200" };
}

function MetricCard({ title, value, icon: Icon, description }: { title: string; value: string; icon: React.ComponentType<{ className?: string }>; description: string; }) {
    return (
        <Card className="border-border/70 shadow-sm">
            <CardContent className="flex items-start justify-between gap-4 p-5">
                <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{title}</p>
                    <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
                    <p className="text-xs text-muted-foreground">{description}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/70">
                    <Icon className="h-5 w-5 text-[var(--color-industrial-blue)]" />
                </div>
            </CardContent>
        </Card>
    );
}

export default function AdminReportsPage() {
    const [reportDate, setReportDate] = useState(new Date().toISOString().split("T")[0]);
    const [report, setReport] = useState<WarehouseReport | null>(null);
    const [recentReports, setRecentReports] = useState<WarehouseReport[]>([]);
    const [todayDispatches, setTodayDispatches] = useState<Array<{ client: string; dr: string | null; service: string; jb: number; sb: number }>>([]);
    const [balances, setBalances] = useState<Array<{ id: string; remaining_qty: number; bag_type: string; client?: { full_name: string; company_name: string | null }; product?: { name: string } }>>([]);
    const [loading, setLoading] = useState(true);

    const loadReportData = useCallback(async () => {
        setLoading(true);
        try {
            const [reportRow, reportRows, dispatchedOrders, completedOrders, balanceRows] = await Promise.all([
                fetchWarehouseReport(reportDate),
                fetchWarehouseReports(6),
                fetchOrders("dispatched"),
                fetchOrders("completed"),
                fetchCustomerBalances(),
            ]);

            setReport((reportRow ?? null) as WarehouseReport | null);
            setRecentReports(reportRows as WarehouseReport[]);

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

    const closingJb = useMemo(() => {
        if (!report) return 0;
        return report.closing_jb;
    }, [report]);

    const closingSb = useMemo(() => {
        if (!report) return 0;
        return report.closing_sb;
    }, [report]);

    const selectedStatus = reportStatusFor(report, reportDate);

    return (
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-4 md:px-6 lg:px-8">
            <header className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card p-5 shadow-sm lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-industrial-blue)]/15 bg-[var(--color-industrial-blue)]/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--color-industrial-blue)]">
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
                    <Badge className={selectedStatus.tone}>{selectedStatus.label}</Badge>
                </div>
            </header>

            {loading ? (
                <Card className="border-border/70 shadow-sm">
                    <CardContent className="py-12 text-center text-sm text-muted-foreground">Loading report data...</CardContent>
                </Card>
            ) : (
                <>
                    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <MetricCard title="Opening stock" value={`${(report?.yesterday_jb ?? 0) + (report?.yesterday_sb ?? 0)}`} icon={Package} description="Previous closing stock carried into the day." />
                        <MetricCard title="Received today" value={`${(report?.received_jb ?? 0) + (report?.received_sb ?? 0)}`} icon={CircleCheckBig} description="Stock received into the warehouse." />
                        <MetricCard title="Dispatched today" value={`${(report?.dispatched_jb ?? 0) + (report?.dispatched_sb ?? 0)}`} icon={Truck} description="Confirmed movement out of stock." />
                        <MetricCard title="Closing stock" value={`${closingJb + closingSb}`} icon={Users} description="Final reconciled stock total for the selected day." />
                    </section>

                    <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                        <Card className="border-border/70 shadow-sm">
                            <CardHeader className="border-b border-border/60 pb-4">
                                <CardTitle className="text-base font-semibold">Physical warehouse inventory</CardTitle>
                                <CardDescription>Daily opening, movement, and closing totals for the selected date.</CardDescription>
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
                                        <TableRow>
                                            <TableCell className="font-medium">Stock received</TableCell>
                                            <TableCell>{report?.received_jb ?? 0}</TableCell>
                                            <TableCell>{report?.received_sb ?? 0}</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell className="font-medium">Total dispatched</TableCell>
                                            <TableCell>{report?.dispatched_jb ?? 0}</TableCell>
                                            <TableCell>{report?.dispatched_sb ?? 0}</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell className="font-medium">Customer returns</TableCell>
                                            <TableCell>{report?.returned_jb ?? 0}</TableCell>
                                            <TableCell>{report?.returned_sb ?? 0}</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell className="font-medium">Waste / damaged</TableCell>
                                            <TableCell>{report?.waste_jb ?? 0}</TableCell>
                                            <TableCell>{report?.waste_sb ?? 0}</TableCell>
                                        </TableRow>
                                        <TableRow className="bg-[var(--color-industrial-blue)]/5">
                                            <TableCell className="font-semibold text-[var(--color-industrial-blue)]">Today's closing</TableCell>
                                            <TableCell className="font-semibold">{closingJb}</TableCell>
                                            <TableCell className="font-semibold">{closingSb}</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        <Card className="border-border/70 shadow-sm">
                            <CardHeader className="border-b border-border/60 pb-4">
                                <CardTitle className="text-base font-semibold">Report status timeline</CardTitle>
                                <CardDescription>Draft, submitted, and reviewed states as a read-only reference.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 p-5">
                                {recentReports.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-border/70 px-4 py-10 text-center text-sm text-muted-foreground">
                                        No report history available.
                                    </div>
                                ) : (
                                    recentReports.map((entry) => {
                                        const entryStatus = reportStatusFor(entry, entry.report_date);
                                        return (
                                            <div key={entry.id} className="rounded-xl border border-border/70 p-4 shadow-sm">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div>
                                                        <p className="text-sm font-semibold text-foreground">{entry.report_date}</p>
                                                        <p className="mt-1 text-xs text-muted-foreground">
                                                            Closing JB {entry.closing_jb} · Closing SB {entry.closing_sb}
                                                        </p>
                                                    </div>
                                                    <Badge className={entryStatus.tone}>{entryStatus.label}</Badge>
                                                </div>
                                                {entry.notes ? (
                                                    <p className="mt-3 text-xs leading-5 text-muted-foreground">{entry.notes}</p>
                                                ) : (
                                                    <p className="mt-3 text-xs leading-5 text-muted-foreground">No additional notes recorded.</p>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
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
                                            <TableHead>Product</TableHead>
                                            <TableHead className="text-right">Remaining</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {balances.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                                                    No pending obligations.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            balances.map((balance) => (
                                                <TableRow key={balance.id}>
                                                    <TableCell className="font-medium">{balance.client?.company_name || balance.client?.full_name || "Client"}</TableCell>
                                                    <TableCell className="text-muted-foreground">{balance.product?.name ?? "Product"}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                                                            {balance.remaining_qty} {balance.bag_type}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </section>
                </>
            )}
        </div>
    );
}
