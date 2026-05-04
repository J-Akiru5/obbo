"use client";

import { useState, useEffect } from "react";
import {
    fetchWarehouseReport,
    saveWarehouseReport,
    fetchCustomerBalances,
    fetchOrders,
    generateDailyReportData,
    submitWarehouseReport,
    checkReportSubmission,
} from "@/lib/actions/admin-actions";
import { generateReportXLSX } from "@/lib/report-generators/report-xlsx";
import { generateReportPDF } from "@/lib/report-generators/report-pdf";
import type { ReportExportData } from "@/lib/report-generators/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
    Save, Calendar, ArrowRight, ArrowDownRight, ArrowUpRight,
    Sparkles, FileSpreadsheet, FileText, Loader2, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

export function ReportsTab() {
    const [reportDate, setReportDate] = useState(new Date().toISOString().split("T")[0]);
    const [loading, setLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isAutoFilled, setIsAutoFilled] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Module 1: Physical Warehouse
    const [physical, setPhysical] = useState({
        yesterday_jb: 0, yesterday_sb: 0,
        received_jb: 0, received_sb: 0,
        dispatched_jb: 0, dispatched_sb: 0,
        returned_jb: 0, returned_sb: 0,
        waste_jb: 0, waste_sb: 0,
    });

    // Module 2 & 3 Data
    const [todayDispatches, setTodayDispatches] = useState<any[]>([]);
    const [balances, setBalances] = useState<any[]>([]);

    useEffect(() => {
        setIsAutoFilled(false);
        loadReportData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reportDate]);

    const loadReportData = async () => {
        setLoading(true);
        try {
            const report = await fetchWarehouseReport(reportDate);
            if (report) {
                setPhysical({
                    yesterday_jb: report.yesterday_jb, yesterday_sb: report.yesterday_sb,
                    received_jb: report.received_jb, received_sb: report.received_sb,
                    dispatched_jb: report.dispatched_jb, dispatched_sb: report.dispatched_sb,
                    returned_jb: report.returned_jb, returned_sb: report.returned_sb,
                    waste_jb: report.waste_jb, waste_sb: report.waste_sb,
                });
            } else {
                setPhysical({
                    yesterday_jb: 0, yesterday_sb: 0, received_jb: 0, received_sb: 0,
                    dispatched_jb: 0, dispatched_sb: 0, returned_jb: 0, returned_sb: 0,
                    waste_jb: 0, waste_sb: 0,
                });
            }

            // Load today's dispatches for Module 2
            const orders = await fetchOrders("dispatched");
            const completed = await fetchOrders("completed");
            const todayOrders = [...(orders as any[]), ...(completed as any[])].filter(o =>
                o.updated_at.startsWith(reportDate) && (o.status === "dispatched" || o.status === "completed")
            );
            const dispatches = todayOrders.map(o => {
                const jb = o.items.filter((i: any) => i.bag_type === "JB").reduce((s: number, i: any) => s + i.dispatched_qty, 0);
                const sb = o.items.filter((i: any) => i.bag_type === "SB").reduce((s: number, i: any) => s + i.dispatched_qty, 0);
                return {
                    client: o.client?.company_name || o.client?.full_name,
                    dr: o.dr_number,
                    service: o.service_type,
                    jb, sb,
                };
            });
            setTodayDispatches(dispatches);

            // Auto-fill dispatched from orders if not set
            if (!report && dispatches.length > 0) {
                const totalDispJb = dispatches.reduce((s, d) => s + d.jb, 0);
                const totalDispSb = dispatches.reduce((s, d) => s + d.sb, 0);
                setPhysical(p => ({ ...p, dispatched_jb: totalDispJb, dispatched_sb: totalDispSb }));
            }

            // Check if already submitted
            const submitted = await checkReportSubmission(reportDate);
            setIsSubmitted(submitted);

            // Load balances for Module 3
            const bals = await fetchCustomerBalances();
            setBalances(bals as any[]);
        } catch (e) {
            console.error(e);
            toast.error("Failed to load report data");
        } finally {
            setLoading(false);
        }
    };

    // ── Send to Admin ─────────────────────────────────────────────
    const handleSendToAdmin = async () => {
        setIsSubmitting(true);
        try {
            // First save to be sure
            await handleSavePhysical();
            
            await submitWarehouseReport(reportDate);
            setIsSubmitted(true);
            toast.success("Report officially submitted to Admin!", { icon: "🚀" });
        } catch (e: any) {
            toast.error("Submission failed: " + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // ── Auto-Generate ─────────────────────────────────────────────
    const handleAutoGenerate = async () => {
        setIsGenerating(true);
        try {
            const generated = await generateDailyReportData(reportDate);
            setPhysical({
                yesterday_jb: generated.yesterday_jb,
                yesterday_sb: generated.yesterday_sb,
                received_jb: generated.received_jb,
                received_sb: generated.received_sb,
                dispatched_jb: generated.dispatched_jb,
                dispatched_sb: generated.dispatched_sb,
                returned_jb: generated.returned_jb,
                returned_sb: generated.returned_sb,
                waste_jb: generated.waste_jb,
                waste_sb: generated.waste_sb,
            });
            if (generated.dispatches.length > 0) {
                setTodayDispatches(generated.dispatches);
            }
            if (generated.balances.length > 0) {
                setBalances(generated.balances.map((b: any) => ({
                    id: Math.random().toString(),
                    client: { company_name: b.client, full_name: b.client },
                    product: { name: b.product },
                    remaining_qty: b.qty,
                    bag_type: b.bag_type,
                })));
            }
            setIsAutoFilled(true);
            toast.success("Report auto-generated from today's transactions!", { icon: "✨" });
        } catch (e: any) {
            toast.error("Auto-generation failed: " + e.message);
        } finally {
            setIsGenerating(false);
        }
    };

    // ── Save ──────────────────────────────────────────────────────
    const handleSavePhysical = async () => {
        setIsSaving(true);
        try {
            const closing_jb = physical.yesterday_jb + physical.received_jb - physical.dispatched_jb + physical.returned_jb - physical.waste_jb;
            const closing_sb = physical.yesterday_sb + physical.received_sb - physical.dispatched_sb + physical.returned_sb - physical.waste_sb;
            await saveWarehouseReport({
                report_date: reportDate,
                ...physical,
                closing_jb, closing_sb,
            });
            toast.success("Physical warehouse report saved");
        } catch (e: any) {
            toast.error("Failed to save report: " + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    // ── Export helpers ────────────────────────────────────────────
    const buildExportData = (): ReportExportData => ({
        date: reportDate,
        physical: {
            ...physical,
            closing_jb: closingJb,
            closing_sb: closingSb,
        },
        dispatches: todayDispatches.map(d => ({
            client: d.client ?? "Unknown",
            dr: d.dr ?? null,
            service: d.service ?? "—",
            jb: d.jb,
            sb: d.sb,
        })),
        balances: balances.map(b => ({
            client: b.client?.company_name || b.client?.full_name || "Unknown",
            product: b.product?.name || "—",
            qty: b.remaining_qty,
            bag_type: b.bag_type,
        })),
    });

    const handleExportXLSX = () => {
        try {
            generateReportXLSX(buildExportData());
            toast.success("Excel report downloaded!");
        } catch (e: any) {
            toast.error("XLSX export failed: " + e.message);
        }
    };

    const handleExportPDF = () => {
        try {
            generateReportPDF(buildExportData());
            toast.success("PDF report downloaded!");
        } catch (e: any) {
            toast.error("PDF export failed: " + e.message);
        }
    };

    // Computed closing
    const closingJb = physical.yesterday_jb + physical.received_jb - physical.dispatched_jb + physical.returned_jb - physical.waste_jb;
    const closingSb = physical.yesterday_sb + physical.received_sb - physical.dispatched_sb + physical.returned_sb - physical.waste_sb;

    return (
        <div className="space-y-6">
            {/* Header Bar */}
            <div className="bg-card p-4 rounded-xl border border-border shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h3 className="font-semibold text-lg">Daily Warehouse Reports</h3>
                        <p className="text-sm text-muted-foreground">End-of-day reconciliation and movement tracking.</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <Label className="font-medium flex items-center gap-2 text-sm">
                            <Calendar className="w-4 h-4 text-muted-foreground" /> Date
                        </Label>
                        <Input
                            type="date"
                            value={reportDate}
                            onChange={e => { setReportDate(e.target.value); setIsAutoFilled(false); }}
                            className="w-40"
                        />
                    </div>
                </div>

                {/* Action Buttons Row */}
                <div className="flex flex-wrap gap-2 pt-1 border-t border-border/50">
                    <Button
                        onClick={handleAutoGenerate}
                        disabled={isGenerating}
                        className="bg-[var(--color-industrial-blue)] hover:bg-[var(--color-industrial-blue)]/90 gap-2"
                    >
                        {isGenerating ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Sparkles className="w-4 h-4" />
                        )}
                        {isGenerating ? "Generating..." : "Auto-Generate Report"}
                    </Button>

                    {isAutoFilled && (
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 gap-1.5 px-3 py-1.5 text-xs">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Auto-filled from today&apos;s transactions — review &amp; edit before saving
                        </Badge>
                    )}

                    <div className="ml-auto flex gap-2">
                        <Button
                            variant="outline"
                            onClick={handleExportXLSX}
                            className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                        >
                            <FileSpreadsheet className="w-4 h-4" />
                            Export XLSX
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handleExportPDF}
                            className="gap-2 border-red-200 text-red-700 hover:bg-red-50"
                        >
                            <FileText className="w-4 h-4" />
                            Export PDF
                        </Button>
                        <Button
                            onClick={handleSendToAdmin}
                            disabled={isSubmitting || isSubmitted}
                            className={`${isSubmitted ? 'bg-emerald-600' : 'bg-indigo-600'} hover:opacity-90 gap-2 min-w-[140px]`}
                        >
                            {isSubmitting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : isSubmitted ? (
                                <CheckCircle2 className="w-4 h-4" />
                            ) : (
                                <ArrowRight className="w-4 h-4" />
                            )}
                            {isSubmitting ? "Sending..." : isSubmitted ? "Submitted to Admin" : "Send to Admin"}
                        </Button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="py-12 text-center text-muted-foreground animate-pulse">Loading report data...</div>
            ) : (
                <div className="space-y-8">
                    {/* MODULE 1: PHYSICAL WAREHOUSE */}
                    <Card>
                        <CardHeader className="border-b border-border/50 pb-4">
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle className="text-lg text-[var(--color-industrial-blue)]">1. Physical Warehouse Inventory</CardTitle>
                                    <CardDescription>Daily opening and closing physical stock count.</CardDescription>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" onClick={handleSavePhysical} disabled={isSaving} className="border-[var(--color-industrial-blue)] text-[var(--color-industrial-blue)]">
                                        <Save className="w-4 h-4 mr-2" /> {isSaving ? "Saving..." : "Save Draft"}
                                    </Button>
                                    <Button onClick={handleSendToAdmin} disabled={isSubmitting || isSubmitted} className="bg-indigo-600">
                                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                                        {isSubmitted ? "Submitted" : "Send to Admin"}
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow>
                                        <TableHead className="w-[200px]">Metric</TableHead>
                                        <TableHead>JB Bags</TableHead>
                                        <TableHead>SB Bags</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow className="bg-slate-50">
                                        <TableCell className="font-semibold">Yesterday&apos;s Closing</TableCell>
                                        <TableCell><Input type="number" value={physical.yesterday_jb} onChange={e => setPhysical({ ...physical, yesterday_jb: parseInt(e.target.value) || 0 })} className="w-32 h-8 bg-white" /></TableCell>
                                        <TableCell><Input type="number" value={physical.yesterday_sb} onChange={e => setPhysical({ ...physical, yesterday_sb: parseInt(e.target.value) || 0 })} className="w-32 h-8 bg-white" /></TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell className="font-medium text-emerald-600 flex items-center gap-2"><ArrowDownRight className="w-4 h-4" /> Stock Received (+)</TableCell>
                                        <TableCell><Input type="number" value={physical.received_jb} onChange={e => setPhysical({ ...physical, received_jb: parseInt(e.target.value) || 0 })} className="w-32 h-8" /></TableCell>
                                        <TableCell><Input type="number" value={physical.received_sb} onChange={e => setPhysical({ ...physical, received_sb: parseInt(e.target.value) || 0 })} className="w-32 h-8" /></TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell className="font-medium text-blue-600 flex items-center gap-2"><ArrowUpRight className="w-4 h-4" /> Total Dispatched (-)</TableCell>
                                        <TableCell><Input type="number" value={physical.dispatched_jb} onChange={e => setPhysical({ ...physical, dispatched_jb: parseInt(e.target.value) || 0 })} className="w-32 h-8" /></TableCell>
                                        <TableCell><Input type="number" value={physical.dispatched_sb} onChange={e => setPhysical({ ...physical, dispatched_sb: parseInt(e.target.value) || 0 })} className="w-32 h-8" /></TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell className="font-medium text-purple-600 flex items-center gap-2"><ArrowDownRight className="w-4 h-4" /> Customer Returns (+)</TableCell>
                                        <TableCell><Input type="number" value={physical.returned_jb} onChange={e => setPhysical({ ...physical, returned_jb: parseInt(e.target.value) || 0 })} className="w-32 h-8" /></TableCell>
                                        <TableCell><Input type="number" value={physical.returned_sb} onChange={e => setPhysical({ ...physical, returned_sb: parseInt(e.target.value) || 0 })} className="w-32 h-8" /></TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell className="font-medium text-red-600 flex items-center gap-2"><ArrowUpRight className="w-4 h-4" /> Waste/Damaged (-)</TableCell>
                                        <TableCell><Input type="number" value={physical.waste_jb} onChange={e => setPhysical({ ...physical, waste_jb: parseInt(e.target.value) || 0 })} className="w-32 h-8" /></TableCell>
                                        <TableCell><Input type="number" value={physical.waste_sb} onChange={e => setPhysical({ ...physical, waste_sb: parseInt(e.target.value) || 0 })} className="w-32 h-8" /></TableCell>
                                    </TableRow>
                                    <TableRow className="bg-[var(--color-industrial-blue)]/5 hover:bg-[var(--color-industrial-blue)]/10">
                                        <TableCell className="font-bold text-[var(--color-industrial-blue)] text-base">Today&apos;s Closing</TableCell>
                                        <TableCell className="font-bold text-lg">{closingJb}</TableCell>
                                        <TableCell className="font-bold text-lg">{closingSb}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    {/* MODULE 2: CUSTOMER MOVEMENT */}
                    <Card>
                        <CardHeader className="border-b border-border/50 pb-4">
                            <CardTitle className="text-lg text-[var(--color-industrial-blue)]">2. Customer Movement Today</CardTitle>
                            <CardDescription>Deliveries and pick-ups dispatched today (auto-generated from tracking).</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow>
                                        <TableHead>Client</TableHead>
                                        <TableHead>DR Number</TableHead>
                                        <TableHead>Service</TableHead>
                                        <TableHead className="text-right">JB</TableHead>
                                        <TableHead className="text-right">SB</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {todayDispatches.length === 0 ? (
                                        <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">No dispatches recorded today.</TableCell></TableRow>
                                    ) : todayDispatches.map((d, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="font-medium">{d.client}</TableCell>
                                            <TableCell>{d.dr || "—"}</TableCell>
                                            <TableCell><Badge variant="outline" className="uppercase text-[10px]">{d.service}</Badge></TableCell>
                                            <TableCell className="text-right font-semibold">{d.jb}</TableCell>
                                            <TableCell className="text-right font-semibold">{d.sb}</TableCell>
                                        </TableRow>
                                    ))}
                                    {todayDispatches.length > 0 && (
                                        <TableRow className="bg-muted/20">
                                            <TableCell colSpan={3} className="text-right font-bold">Total Dispatched:</TableCell>
                                            <TableCell className="text-right font-bold text-blue-600">{todayDispatches.reduce((s, d) => s + d.jb, 0)}</TableCell>
                                            <TableCell className="text-right font-bold text-blue-600">{todayDispatches.reduce((s, d) => s + d.sb, 0)}</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    {/* MODULE 3: OBLIGATION REPORT */}
                    <Card>
                        <CardHeader className="border-b border-border/50 pb-4">
                            <CardTitle className="text-lg text-amber-600">3. Customer Obligation Report</CardTitle>
                            <CardDescription>Current pending balances owed to clients (auto-generated).</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow>
                                        <TableHead>Client Name</TableHead>
                                        <TableHead>Product</TableHead>
                                        <TableHead className="text-right text-amber-700">Remaining Balance</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {balances.length === 0 ? (
                                        <TableRow><TableCell colSpan={3} className="text-center py-4 text-muted-foreground">No pending obligations.</TableCell></TableRow>
                                    ) : balances.map((b) => (
                                        <TableRow key={b.id}>
                                            <TableCell className="font-medium">{b.client?.company_name || b.client?.full_name}</TableCell>
                                            <TableCell className="text-muted-foreground">{b.product?.name}</TableCell>
                                            <TableCell className="text-right">
                                                <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">{b.remaining_qty} {b.bag_type}</Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
