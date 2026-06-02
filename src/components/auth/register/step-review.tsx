"use client";

import { Building2, User, FileText, FileCheck, Pencil, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface StepReviewProps {
    form: {
        account_type: "individual" | "company";
        email: string;
        first_name: string;
        surname: string;
        contact_number: string;
        company_name: string;
        contact_person_first_name: string;
        contact_person_surname: string;
        contact_person_number: string;
        business_permit_no: string;
        tin_no: string;
        street: string;
        city: string;
        province: string;
        postal_code: string;
    };
    files: {
        valid_id_file: File | null;
        business_permit_file: File | null;
    };
    onEditStep: (step: number) => void;
    onSubmit: () => void;
    loading: boolean;
}

function ReviewSection({
    title,
    icon: Icon,
    stepIndex,
    onEdit,
    children,
}: {
    title: string;
    icon: typeof User;
    stepIndex: number;
    onEdit: (step: number) => void;
    children: React.ReactNode;
}) {
    return (
        <div className="rounded-lg border bg-card">
            <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
                <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold">{title}</h3>
                </div>
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
            <span className="text-xs text-muted-foreground w-32 flex-shrink-0">{label}</span>
            <span className="text-sm font-medium text-foreground break-words">{value || "—"}</span>
        </div>
    );
}

export function StepReview({
    form,
    files,
    onEditStep,
    onSubmit,
    loading,
}: StepReviewProps) {
    const isCompany = form.account_type === "company";

    return (
        <div className="space-y-5">
            <div className="space-y-1">
                <h2 className="text-xl font-semibold tracking-tight text-foreground">
                    Review & submit
                </h2>
                <p className="text-sm text-muted-foreground">
                    Please review your information before submitting. Click &ldquo;Edit&rdquo; on any section to make changes.
                </p>
            </div>

            <div className="space-y-3">
                {/* Account Type */}
                <ReviewSection title="Account type" icon={isCompany ? Building2 : User} stepIndex={0} onEdit={onEditStep}>
                    <p className="text-sm font-medium capitalize">{form.account_type}</p>
                </ReviewSection>

                {/* Credentials */}
                <ReviewSection title="Account credentials" icon={FileText} stepIndex={1} onEdit={onEditStep}>
                    <ReviewField label="Email" value={form.email} />
                </ReviewSection>

                {/* Profile */}
                <ReviewSection title="Profile details" icon={User} stepIndex={2} onEdit={onEditStep}>
                    {isCompany ? (
                        <>
                            <ReviewField label="Company name" value={form.company_name} />
                            <ReviewField label="Contact person" value={`${form.contact_person_first_name} ${form.contact_person_surname}`} />
                            <ReviewField label="Contact number" value={form.contact_person_number} />
                            <ReviewField label="Business permit no." value={form.business_permit_no} />
                            <ReviewField label="TIN no." value={form.tin_no} />
                        </>
                    ) : (
                        <>
                            <ReviewField label="Name" value={`${form.first_name} ${form.surname}`} />
                            <ReviewField label="Contact number" value={form.contact_number} />
                        </>
                    )}
                    <Separator className="my-2" />
                    <ReviewField label="Street" value={form.street} />
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-0">
                        <ReviewField label="Municipality" value={form.city} />
                        <ReviewField label="Province" value={form.province} />
                        <ReviewField label="Postal code" value={form.postal_code} />
                    </div>
                </ReviewSection>

                {/* Documents */}
                <ReviewSection title="Documents" icon={FileCheck} stepIndex={3} onEdit={onEditStep}>
                    <ReviewField
                        label={isCompany ? "Contact person ID" : "Valid ID"}
                        value={files.valid_id_file?.name ?? "No file selected"}
                    />
                    {isCompany && (
                        <ReviewField
                            label="Business permit"
                            value={files.business_permit_file?.name ?? "No file selected"}
                        />
                    )}
                </ReviewSection>
            </div>

            {/* Info box */}
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                <p className="font-semibold">What happens next?</p>
                <p className="mt-1 leading-relaxed">
                    After submission, your account will be created with pending verification status.
                    An administrator will review your details and documents before granting full portal access.
                </p>
            </div>

            {/* Submit */}
            <div className="flex justify-end">
                <Button
                    type="button"
                    className="h-12 px-8 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                    onClick={onSubmit}
                    disabled={loading}
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Creating account...
                        </>
                    ) : (
                        <>
                            <CheckCircle2 className="w-4 h-4" />
                            Submit registration
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}
