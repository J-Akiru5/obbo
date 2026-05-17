"use client";

import { useState } from "react";
import { OrderReturn } from "@/lib/types/database";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CornerDownLeft, CheckCircle2, Loader2 } from "lucide-react";
import { processOrderReturn } from "@/lib/actions/admin-actions";
import { toast } from "sonner";

export function ReturnsTab({ returns, loading, onReload }: { returns: OrderReturn[], loading: boolean, onReload: () => void }) {
    const [processing, setProcessing] = useState<string | null>(null);

    const handleProcess = async (returnId: string) => {
        setProcessing(returnId);
        try {
            await processOrderReturn(returnId);
            toast.success("Return request marked as processed.");
            onReload();
        } catch (e: any) {
            toast.error(e.message || "Failed to process return.");
        } finally {
            setProcessing(null);
        }
    };

    if (loading) return <div className="py-8 text-center text-muted-foreground animate-pulse">Loading return requests...</div>;

    return (
        <div className="space-y-4">
            <div className="bg-card p-4 rounded-xl border border-border shadow-sm">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold text-lg">Customer Return Requests</h3>
                        <p className="text-sm text-muted-foreground">Review and process return requests submitted by clients.</p>
                    </div>
                    <Badge variant="outline" className="text-sm">{returns.length} pending</Badge>
                </div>
            </div>

            {returns.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        <CornerDownLeft className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm font-medium">No pending return requests.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {returns.map((ret) => {
                        const order = (ret as any).order;
                        return (
                            <Card key={ret.id} className="border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 shadow-sm">
                                <CardContent className="p-4">
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                                        <div className="min-w-0 flex-1 space-y-2">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-mono text-sm font-bold text-foreground">
                                                    PO: {order?.po_number || "—"}
                                                </span>
                                                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-[10px] border-0">Pending</Badge>
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                Client: {order?.client?.company_name || order?.client?.full_name || "Unknown"}
                                            </p>
                                            {order?.dr_number && (
                                                <p className="text-xs text-muted-foreground">DR: {order.dr_number}</p>
                                            )}
                                            <div className="flex gap-4 text-sm">
                                                {ret.jb_qty > 0 && (
                                                    <span className="font-semibold text-foreground">{ret.jb_qty} JB</span>
                                                )}
                                                {ret.sb_qty > 0 && (
                                                    <span className="font-semibold text-foreground">{ret.sb_qty} SB</span>
                                                )}
                                            </div>
                                            {ret.reason && (
                                                <div className="rounded-lg border border-border bg-background p-3">
                                                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Client Reason</p>
                                                    <p className="text-sm text-foreground">{ret.reason}</p>
                                                </div>
                                            )}
                                            <p className="text-xs text-muted-foreground">
                                                Submitted: {new Date(ret.created_at).toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="flex-shrink-0">
                                            <Button
                                                size="sm"
                                                onClick={() => handleProcess(ret.id)}
                                                disabled={processing === ret.id}
                                                className="bg-emerald-600 hover:bg-emerald-700 gap-2"
                                            >
                                                {processing === ret.id ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <CheckCircle2 className="w-4 h-4" />
                                                )}
                                                Mark Processed
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
