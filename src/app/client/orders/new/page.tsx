"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, ChevronLeft, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useClientKyc } from "@/lib/context/client-kyc-context";
import { usePersistedForm } from "@/lib/hooks/use-persisted-form";
import { StepIndicator } from "@/components/ui/step-indicator";
import { StepProducts } from "@/components/orders/wizard/step-products";
import { StepSource } from "@/components/orders/wizard/step-source";
import { StepServiceType } from "@/components/orders/wizard/step-service-type";
import { productsSchema, sourceSchema, serviceTypeSchema } from "@/components/orders/wizard/order-schema";
import type { Product } from "@/lib/types/database";

const ORDERING_STEPS = ["Products", "Source", "Service"];

const INITIAL_FORM = {
    jb_qty: 0,
    sb_qty: 0,
    source: "warehouse" as "port" | "warehouse",
    service_type: "pickup" as "pickup" | "deliver",
    driver_name: "",
    plate_number: "",
    preferred_pickup_date: "",
    po_number: "",
    supplier_name: "OBBO",
    payment_method: "cash" as "cash" | "check",
    wants_split: false,
    deliver_now_jb: 0,
    deliver_now_sb: 0,
};

export default function NewOrderPage() {
    const router = useRouter();
    const { kycStatus } = useClientKyc();
    const isVerified = kycStatus === "verified";

    const [form, updateForm] = usePersistedForm("obbo-order-form", INITIAL_FORM);
    const [currentStep, setCurrentStep] = useState(() => {
        if (typeof window === "undefined") return 0;
        try {
            const stored = sessionStorage.getItem("obbo-order-form");
            if (stored) {
                const parsed = JSON.parse(stored);
                return parsed._orderingStep ?? 0;
            }
        } catch { /* ignore */ }
        return 0;
    });
    const [completedSteps, setCompletedSteps] = useState<Set<number>>(() => {
        if (typeof window === "undefined") return new Set();
        try {
            const stored = sessionStorage.getItem("obbo-order-form");
            if (stored) {
                const parsed = JSON.parse(stored);
                return new Set(parsed._orderingCompleted ?? []);
            }
        } catch { /* ignore */ }
        return new Set();
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [products, setProducts] = useState<Product[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(true);

    useEffect(() => {
        createClient()
            .from("products")
            .select("*")
            .eq("is_active", true)
            .order("name")
            .then(({ data }) => {
                setProducts(data ?? []);
                setLoadingProducts(false);
            });
    }, []);

    // Persist wizard navigation state back to sessionStorage
    useEffect(() => {
        updateForm({ _orderingStep: currentStep, _orderingCompleted: Array.from(completedSteps) } as Partial<typeof INITIAL_FORM>);
    }, [currentStep, completedSteps]); // eslint-disable-line react-hooks/exhaustive-deps

    const updateField = useCallback(
        (field: string, value: string | boolean | number) => {
            updateForm({ [field]: value } as Partial<typeof INITIAL_FORM>);
            setErrors((prev) => {
                if (prev[field]) {
                    const next = { ...prev };
                    delete next[field];
                    return next;
                }
                return prev;
            });
        },
        [updateForm],
    );

    function validateStep(step: number): boolean {
        const newErrors: Record<string, string> = {};

        if (step === 0) {
            const result = productsSchema.safeParse({ jb_qty: form.jb_qty, sb_qty: form.sb_qty });
            if (!result.success) {
                for (const issue of result.error.issues) {
                    newErrors[issue.path[0] as string] = issue.message;
                }
            }
        }

        if (step === 1) {
            const result = sourceSchema.safeParse({ source: form.source });
            if (!result.success) {
                for (const issue of result.error.issues) {
                    newErrors[issue.path[0] as string] = issue.message;
                }
            }
        }

        if (step === 2) {
            const result = serviceTypeSchema.safeParse({
                service_type: form.service_type,
                driver_name: form.driver_name,
                plate_number: form.plate_number,
                preferred_pickup_date: form.preferred_pickup_date,
            });
            if (!result.success) {
                for (const issue of result.error.issues) {
                    const key = issue.path[0] as string;
                    if (!newErrors[key]) newErrors[key] = issue.message;
                }
            }
        }

        setErrors(newErrors);
        if (Object.keys(newErrors).length > 0) {
            toast.error("Please fix the errors before continuing.");
            return false;
        }
        return true;
    }

    function goNext() {
        if (!validateStep(currentStep)) return;
        setCompletedSteps((prev) => new Set(prev).add(currentStep));

        if (currentStep === ORDERING_STEPS.length - 1) {
            // Last step: proceed to submit page
            router.push("/client/orders/new/submit");
            return;
        }

        setCurrentStep((s: number) => Math.min(s + 1, ORDERING_STEPS.length - 1));
        setErrors({});
    }

    function goBack() {
        if (currentStep === 0) {
            router.push("/client/orders");
            return;
        }
        setCurrentStep((s: number) => Math.max(s - 1, 0));
        setErrors({});
    }

    function goToStep(step: number) {
        if (step < currentStep || completedSteps.has(step)) {
            setCurrentStep(step);
            setErrors({});
        }
    }

    if (!isVerified) {
        return (
            <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
                <ShieldAlert className="w-12 h-12 mx-auto text-amber-500" />
                <h2 className="text-xl font-bold text-foreground">Verification Required</h2>
                <p className="text-muted-foreground">
                    You need to be KYC verified before you can place orders.
                </p>
                <Link href="/client/pending-kyc">
                    <Button variant="outline">Learn more</Button>
                </Link>
            </div>
        );
    }

    if (loadingProducts) {
        return (
            <div className="max-w-3xl mx-auto px-4 py-16 text-center">
                <p className="text-muted-foreground">Loading products...</p>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Place New Order</h2>
                <p className="text-muted-foreground mt-1">
                    Select your products, source, and service type to proceed.
                </p>
            </div>

            <StepIndicator
                steps={ORDERING_STEPS}
                currentStep={currentStep}
                completedSteps={completedSteps}
                onStepClick={goToStep}
            />

            <div className="relative overflow-hidden">
                <div key={currentStep} className="animate-slide-in-right">
                    {currentStep === 0 && (
                        <StepProducts
                            products={products}
                            jbQty={form.jb_qty}
                            sbQty={form.sb_qty}
                            onQtyChange={(field, value) => updateField(field, value)}
                            error={errors.jb_qty || errors.sb_qty}
                        />
                    )}
                    {currentStep === 1 && (
                        <StepSource
                            value={form.source}
                            onChange={(v) => updateField("source", v)}
                            products={products}
                            jbQty={form.jb_qty}
                            sbQty={form.sb_qty}
                            error={errors.source}
                        />
                    )}
                    {currentStep === 2 && (
                        <StepServiceType
                            value={form.service_type}
                            onChange={(v) => updateField("service_type", v)}
                            driverName={form.driver_name}
                            plateNumber={form.plate_number}
                            pickupDate={form.preferred_pickup_date}
                            onFieldChange={updateField}
                            errors={errors}
                        />
                    )}
                </div>
            </div>

            <div className="flex justify-between pt-2">
                <Button
                    type="button"
                    variant="outline"
                    className="h-11 gap-1"
                    onClick={goBack}
                >
                    <ChevronLeft className="w-4 h-4" />
                    {currentStep === 0 ? "Back to Orders" : "Back"}
                </Button>
                <Button
                    type="button"
                    className="h-11 gap-2 bg-primary text-primary-foreground font-semibold hover:bg-primary/90"
                    onClick={goNext}
                >
                    {currentStep === ORDERING_STEPS.length - 1 ? "Proceed to Submit POs" : "Continue"}
                    <ChevronRight className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
}
