"use client";

import { Pencil, CheckCircle2, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { Product } from "@/lib/types/database";
import { getPrice, getSubtotal, getTotalIndividualBags } from "./order-schema";

interface StepOrderReviewProps {
    form: {
        jb_qty: number;
        sb_qty: number;
        source: string;
        service_type: string;
        driver_name: string;
        plate_number: string;
        preferred_pickup_date: string;
        po_number: string;
        supplier_name: string;
        payment_method: string;
        wants_split: boolean;
        deliver_now_jb: number;
        deliver_now_sb: number;
    };
    files: {
        po_file: File | null;
        check_file: File | null;
    };
    products: Product[];
    onEditStep: (step: number) => void;
    onSubmit: () => void;
    onSaveDraft: () => void;
    loading: boolean;
    draftLoading: boolean;
}

function ReviewSection({
    title,
    stepIndex,
    onEdit,
    children,
}: {
    title: string;
    stepIndex: number;
    onEdit: (step: number) => void;
    children: React.ReactNode;
}) {
    return (
        <div className="rounded-lg border bg-card">
            <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
                <h3 className="text-sm font-semibold">{title}</h3>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={() => onEdit(stepIndex)}
                >
                    <Pencil className="w-3 h-3" /> Edit
                </Button>
            </div>
            <div className="px-4 py-3">{children}</div>
        </div>
    );
}

function ReviewField({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-3 py-1.5">
            <span className="text-xs text-muted-foreground w-36 flex-shrink-0">{label}</span>
            <span className="text-sm font-medium text-foreground break-words">{value || "\u2014"}</span>
        </div>
    );
}

export function StepOrderReview({
    form,
    files,
    products,
    onEditStep,
    onSubmit,
    onSaveDraft,
    loading,
    draftLoading,
}: StepOrderReviewProps) {
    const jbProduct = products.find((p) => p.bag_type === "JB");
    const sbProduct = products.find((p) => p.bag_type === "SB");
    const jbPrice = getPrice(jbProduct, form.source);
    const sbPrice = getPrice(sbProduct, form.source);
    const subtotal = getSubtotal(form.jb_qty, form.sb_qty, jbPrice, sbPrice);
    const totalIndividual = getTotalIndividualBags(form.jb_qty, form.sb_qty);
    const totalDeliverNow = form.deliver_now_jb + form.deliver_now_sb;

    return (
        <div className="space-y-5">
            <div className="space-y-1">
                <h2 className="text-xl font-semibold tracking-tight text-foreground">
                    Review & submit
                </h2>
                <p className="text-sm text-muted-foreground">
                    Review your order details before submitting.
                </p>
            </div>

            <div className="space-y-3">
                {/* Products */}
                <ReviewSection title="Products" stepIndex={0} onEdit={onEditStep}>
                    {form.jb_qty > 0 && (
                        <ReviewField
                            label="Jumbo Bags (JB)"
                            value={`${form.jb_qty} bags = ${(form.jb_qty * 25).toLocaleString()} individual`}
                        />
                    )}
                    {form.sb_qty > 0 && (
                        <ReviewField
                            label="Sling Bags (SB)"
                            value={`${form.sb_qty} bags = ${(form.sb_qty * 50).toLocaleString()} individual`}
                        />
                    )}
                    <Separator className="my-2" />
                    <ReviewField
                        label="Total individual bags"
                        value={totalIndividual.toLocaleString()}
                    />
                </ReviewSection>

                {/* Source */}
                <ReviewSection title="Source" stepIndex={1} onEdit={onEditStep}>
                    <ReviewField
                        label="Source"
                        value={form.source === "port" ? "Port" : "Warehouse"}
                    />
                    {form.jb_qty > 0 && (
                        <ReviewField
                            label="JB price"
                            value={`₱${jbPrice.toLocaleString()}/bag × ${form.jb_qty} = ₱${(jbPrice * form.jb_qty).toLocaleString()}`}
                        />
                    )}
                    {form.sb_qty > 0 && (
                        <ReviewField
                            label="SB price"
                            value={`₱${sbPrice.toLocaleString()}/bag × ${form.sb_qty} = ₱${(sbPrice * form.sb_qty).toLocaleString()}`}
                        />
                    )}
                </ReviewSection>

                {/* Service Type */}
                <ReviewSection title="Service type" stepIndex={2} onEdit={onEditStep}>
                    <ReviewField
                        label="Service type"
                        value={form.service_type === "pickup" ? "Pick up" : "Deliver"}
                    />
                    {form.service_type === "pickup" && (
                        <>
                            <ReviewField label="Driver name" value={form.driver_name} />
                            <ReviewField label="Plate number" value={form.plate_number} />
                            {form.preferred_pickup_date && (
                                <ReviewField label="Preferred date" value={form.preferred_pickup_date} />
                            )}
                        </>
                    )}
                </ReviewSection>

                {/* PO & Payment */}
                <ReviewSection title="PO & Payment" stepIndex={3} onEdit={onEditStep}>
                    <ReviewField label="PO Number" value={form.po_number} />
                    <ReviewField label="Supplier" value={form.supplier_name} />
                    <ReviewField label="PO image" value={files.po_file?.name ?? "No file"} />
                    <ReviewField
                        label="Payment method"
                        value={form.payment_method === "cash" ? "Cash" : "Check"}
                    />
                    {form.payment_method === "check" && (
                        <ReviewField label="Check image" value={files.check_file?.name ?? "No file"} />
                    )}
                    {form.wants_split && (
                        <>
                            <Separator className="my-2" />
                            <ReviewField
                                label="Split delivery"
                                value={`Deliver ${totalDeliverNow.toLocaleString()} now, ${(totalIndividual - totalDeliverNow).toLocaleString()} remaining`}
                            />
                            {form.deliver_now_jb > 0 && (
                                <ReviewField label="JB deliver now" value={form.deliver_now_jb.toLocaleString()} />
                            )}
                            {form.deliver_now_sb > 0 && (
                                <ReviewField label="SB deliver now" value={form.deliver_now_sb.toLocaleString()} />
                            )}
                        </>
                    )}
                </ReviewSection>
            </div>

            {/* Subtotal */}
            <div className="p-4 bg-primary text-primary-foreground rounded-lg shadow-inner space-y-2">
                <div className="flex justify-between items-center">
                    <div>
                        <p className="text-sm text-white/80">Order subtotal</p>
                        {form.service_type === "deliver" && (
                            <p className="text-xs text-white/60 mt-0.5">
                                + Shipping fee (added by warehouse manager after approval)
                            </p>
                        )}
                    </div>
                    <p className="text-2xl font-bold">₱{subtotal.toLocaleString()}</p>
                </div>
                <div className="space-y-1 text-xs text-white/70">
                    {form.jb_qty > 0 && (
                        <div className="flex justify-between">
                            <span>JB: {form.jb_qty} × ₱{jbPrice.toLocaleString()}</span>
                            <span>₱{(form.jb_qty * jbPrice).toLocaleString()}</span>
                        </div>
                    )}
                    {form.sb_qty > 0 && (
                        <div className="flex justify-between">
                            <span>SB: {form.sb_qty} × ₱{sbPrice.toLocaleString()}</span>
                            <span>₱{(form.sb_qty * sbPrice).toLocaleString()}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row justify-between gap-3">
                <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={onSaveDraft}
                    disabled={loading || draftLoading}
                >
                    {draftLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Save className="w-4 h-4" />
                    )}
                    Save as Draft
                </Button>
                <Button
                    type="button"
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold min-w-44"
                    onClick={onSubmit}
                    disabled={loading || draftLoading}
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Submitting...
                        </>
                    ) : (
                        <>
                            <CheckCircle2 className="w-4 h-4" />
                            Submit for Approval
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}
