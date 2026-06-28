"use client";

import { useEffect } from "react";
import { Upload, X, FileCheck, Split, Camera } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface StepPoPaymentProps {
    form: {
        po_number: string;
        supplier_name: string;
        payment_method: "cash" | "check";
        wants_split: boolean;
        deliver_now_jb: number;
        deliver_now_sb: number;
    };
    files: {
        po_file: File | null;
        check_file: File | null;
    };
    onFieldChange: (field: string, value: string | boolean | number) => void;
    onFileChange: (field: "po_file" | "check_file", file: File | null) => void;
    errors: Record<string, string>;
    totalJB: number;
    totalSB: number;
    totalIndividualBags: number;
}

function FileDropZone({
    label,
    file,
    onFileChange,
    error,
    inputId,
    required = true,
}: {
    label: string;
    file: File | null;
    onFileChange: (f: File | null) => void;
    error?: string;
    inputId: string;
    required?: boolean;
}) {
    return (
        <div className="space-y-2">
            <Label className="text-sm font-medium">
                {label} {required && <span className="text-destructive">*</span>}
            </Label>
            {file ? (
                <div className="flex items-center gap-3 p-3 border border-emerald-200 bg-emerald-50 rounded-lg">
                    <FileCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm text-emerald-800 truncate">{file.name}</p>
                        <p className="text-xs text-emerald-600">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                    </div>
                    <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 flex-shrink-0"
                        onClick={() => onFileChange(null)}
                    >
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            ) : (
                <div
                    className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                    onClick={() => document.getElementById(inputId)?.click()}
                >
                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Click to upload</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">JPG, PNG, PDF &middot; max 10MB</p>
                    <input
                        id={inputId}
                        type="file"
                        className="hidden"
                        accept="image/*,.pdf"
                        onChange={(e) => onFileChange(e.target.files?.[0] || null)}
                    />
                </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
    );
}

export function StepPoPayment({
    form,
    files,
    onFieldChange,
    onFileChange,
    errors,
    totalJB,
    totalSB,
    totalIndividualBags,
}: StepPoPaymentProps) {
    const totalDeliverNow = form.deliver_now_jb + form.deliver_now_sb;
    
    // 🌟 MATHEMATICAL ALGORITHM CORRECTION: Hinati sa sako-sa-sako na deduction para maiwasan ang maling incremental factor errors
    const remainingBalance = (totalJB + totalSB) - totalDeliverNow;

    // 🌟 STATE LIFE CYCLE SYNCHRONIZER: Pinipilit nitong ibalik sa max totals o i-clamp sa valid bounds ang inputs kapag may nabago sa main settings status
    useEffect(() => {
        if (!form.wants_split) {
            onFieldChange("deliver_now_jb", totalJB);
            onFieldChange("deliver_now_sb", totalSB);
        } else {
            if (form.deliver_now_jb > totalJB) onFieldChange("deliver_now_jb", totalJB);
            if (form.deliver_now_sb > totalSB) onFieldChange("deliver_now_sb", totalSB);
        }
    }, [form.wants_split, totalJB, totalSB, onFieldChange, form.deliver_now_jb, form.deliver_now_sb]);

    return (
        <div className="space-y-6">
            <div className="space-y-1">
                <h2 className="text-xl font-semibold tracking-tight text-foreground">
                    PO & Payment
                </h2>
                <p className="text-sm text-muted-foreground">
                    Enter purchase order details, payment method, and optional split delivery.
                </p>
            </div>

            {/* PO Number & Supplier */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                    <Label htmlFor="po_number" className="text-sm font-medium">
                        PO Number <span className="text-destructive">*</span>
                    </Label>
                    <Input
                        id="po_number"
                        value={form.po_number}
                        onChange={(e) => onFieldChange("po_number", e.target.value)}
                        placeholder="PO-2026-001"
                        className="h-11 mt-1.5"
                    />
                    {errors.po_number && (
                        <p className="text-sm text-destructive mt-1">{errors.po_number}</p>
                    )}
                </div>
                <div>
                    <Label htmlFor="supplier_name" className="text-sm font-medium">
                        Supplier name
                    </Label>
                    <Input
                        id="supplier_name"
                        value={form.supplier_name}
                        onChange={(e) => onFieldChange("supplier_name", e.target.value)}
                        className="h-11 mt-1.5"
                    />
                </div>
            </div>

            {/* PO Image */}
            <FileDropZone
                label="PO Picture"
                file={files.po_file}
                onFileChange={(f) => onFileChange("po_file", f)}
                error={errors.po_file}
                inputId="po-upload"
            />

            {/* Payment Method */}
            <div className="space-y-2">
                <Label className="text-sm font-medium">
                    Payment method <span className="text-destructive">*</span>
                </Label>
                <Select
                    value={form.payment_method}
                    onValueChange={(v) => { if (v) onFieldChange("payment_method", v); }}
                >
                    <SelectTrigger className="h-11">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="check">Check</SelectItem>
                    </SelectContent>
                </Select>
                {errors.payment_method && (
                    <p className="text-sm text-destructive">{errors.payment_method}</p>
                )}
            </div>

            {/* Check image (conditional) */}
            {form.payment_method === "check" && (
                <div className="p-4 border border-blue-500/20 bg-blue-500/5 rounded-lg space-y-3">
                    <div className="flex items-center gap-2 text-sm font-bold text-blue-600 uppercase tracking-tight">
                        <Camera className="w-4 h-4" />
                        Check details
                    </div>
                    <FileDropZone
                        label="Check image"
                        file={files.check_file}
                        onFileChange={(f) => onFileChange("check_file", f)}
                        error={errors.check_file}
                        inputId="check-upload"
                    />
                </div>
            )}

            {/* Split Delivery Options panel row layout mapping */}
            <div className="p-4 border border-blue-500/20 bg-blue-500/5 rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Split className="w-4 h-4 text-blue-500" />
                        <div>
                            <h4 className="text-sm font-bold text-blue-600 uppercase tracking-tight">
                                Split delivery option
                            </h4>
                            <p className="text-xs text-blue-500/80">
                                Receive part of your order now; the rest is saved for later.
                            </p>
                        </div>
                    </div>
                    <label className="flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={form.wants_split}
                            onChange={(e) => onFieldChange("wants_split", e.target.checked)}
                            className="w-5 h-5 text-blue-600 rounded border-blue-500/30 focus:ring-blue-500 bg-background"
                        />
                        <span className="sr-only">Enable split delivery</span>
                    </label>
                </div>

                {form.wants_split && (
                    <div className="pt-3 space-y-4 border-t border-blue-500/20">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {totalJB > 0 && (
                                <div>
                                    <Label className="text-xs text-blue-600 font-bold uppercase">
                                        JB to receive now (max {totalJB})
                                    </Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        max={totalJB}
                                        value={form.deliver_now_jb || ""}
                                        placeholder="0"
                                        onChange={(e) =>
                                            onFieldChange("deliver_now_jb", Math.min(totalJB, Math.max(0, parseInt(e.target.value) || 0)))
                                        }
                                        className="h-10 mt-1.5 font-semibold border-blue-500/20"
                                    />
                                </div>
                            )}
                            {totalSB > 0 && (
                                <div>
                                    <Label className="text-xs text-blue-600 font-bold uppercase">
                                        SB to receive now (max {totalSB})
                                    </Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        max={totalSB}
                                        value={form.deliver_now_sb || ""}
                                        placeholder="0"
                                        onChange={(e) =>
                                            onFieldChange("deliver_now_sb", Math.min(totalSB, Math.max(0, parseInt(e.target.value) || 0)))
                                        }
                                        className="h-10 mt-1.5 font-semibold border-blue-500/20"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="p-3 bg-blue-500/10 rounded border border-blue-500/20 text-sm">
                            <div className="flex justify-between font-bold text-blue-600">
                                <span>Delivering now</span>
                                <span>{totalDeliverNow.toLocaleString()} bags</span>
                            </div>
                            <div className="flex justify-between text-blue-500/70 mt-1 font-medium">
                                <span>Remaining balance</span>
                                <span>{remainingBalance.toLocaleString()} bags</span>
                            </div>
                        </div>

                        {errors.deliver_now_jb && (
                            <p className="text-sm text-destructive">{errors.deliver_now_jb}</p>
                        )}
                        {errors.deliver_now_sb && (
                            <p className="text-sm text-destructive">{errors.deliver_now_sb}</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}