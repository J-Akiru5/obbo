"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/auth/auth-shell";
import { createRoleNotificationAdmin } from "@/lib/actions/notification-actions";
import { usePersistedForm } from "@/lib/hooks/use-persisted-form";
import { StepIndicator } from "@/components/ui/step-indicator";
import { StepAccountType } from "@/components/auth/register/step-account-type";
import { StepCredentials } from "@/components/auth/register/step-credentials";
import { StepProfileDetails } from "@/components/auth/register/step-profile-details";
import { StepDocuments } from "@/components/auth/register/step-documents";
import { StepReview } from "@/components/auth/register/step-review";
import {
    accountTypeSchema,
    credentialsSchema,
    getProfileSchema,
    getDocumentSchema,
} from "@/components/auth/register/register-schema";

const STEPS = ["Account Type", "Credentials", "Profile", "Documents", "Review"];

const INITIAL_FORM = {
    account_type: "individual" as "individual" | "company",
    email: "",
    password: "",
    confirm_password: "",
    otp_verified: false,
    first_name: "",
    surname: "",
    contact_number: "",
    company_name: "",
    contact_person_first_name: "",
    contact_person_surname: "",
    contact_person_number: "",
    business_permit_no: "",
    tin_no: "",
    street: "",
    city: "",
    province: "",
    postal_code: "",
};

export default function RegisterPage() {
    const router = useRouter();
    const [form, updateForm, clearForm] = usePersistedForm("obbo-register-form", INITIAL_FORM);
    const [currentStep, setCurrentStep] = useState(0);
    const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);

    // Files are NOT persisted (File objects can't serialize)
    const [validIdFile, setValidIdFile] = useState<File | null>(null);
    const [businessPermitFile, setBusinessPermitFile] = useState<File | null>(null);

    const updateField = useCallback(
        (field: string, value: string | boolean) => {
            updateForm({ [field]: value } as Partial<typeof INITIAL_FORM>);
            // Clear field error on change
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
            const result = accountTypeSchema.safeParse({ account_type: form.account_type });
            if (!result.success) {
                for (const issue of result.error.issues) {
                    newErrors[issue.path[0] as string] = issue.message;
                }
            }
        }

        if (step === 1) {
            const result = credentialsSchema.safeParse({
                email: form.email,
                password: form.password,
                confirm_password: form.confirm_password,
                otp_verified: form.otp_verified,
            });
            if (!result.success) {
                for (const issue of result.error.issues) {
                    const key = issue.path[0] as string;
                    if (!newErrors[key]) newErrors[key] = issue.message;
                }
            }
        }

        if (step === 2) {
            const schema = getProfileSchema(form.account_type);
            const result = schema.safeParse(form);
            if (!result.success) {
                for (const issue of result.error.issues) {
                    const key = issue.path[0] as string;
                    if (!newErrors[key]) newErrors[key] = issue.message;
                }
            }
        }

        if (step === 3) {
            const schema = getDocumentSchema(form.account_type);
            const result = schema.safeParse({
                valid_id_file: validIdFile,
                business_permit_file: businessPermitFile,
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
        setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1));
        setErrors({});
    }

    function goBack() {
        setCurrentStep((s) => Math.max(s - 1, 0));
        setErrors({});
    }

    function goToStep(step: number) {
        // Only allow going back to completed steps
        if (step < currentStep || completedSteps.has(step)) {
            setCurrentStep(step);
            setErrors({});
        }
    }

    async function handleSubmit() {
        setLoading(true);
        try {
            const supabase = createClient();

            const metaData: Record<string, string> = {
                account_type: form.account_type,
                address_street: form.street,
                address_city: form.city,
                address_province: form.province,
                address_postal_code: form.postal_code,
                role: "client",
                kyc_status: "pending_verification",
            };

            if (form.account_type === "individual") {
                metaData.first_name = form.first_name;
                metaData.surname = form.surname;
                metaData.phone = form.contact_number;
                metaData.full_name = `${form.first_name} ${form.surname}`.trim();
            } else {
                metaData.company_name = form.company_name;
                metaData.contact_person_first_name = form.contact_person_first_name;
                metaData.contact_person_surname = form.contact_person_surname;
                metaData.phone = form.contact_person_number;
                metaData.business_permit_no = form.business_permit_no;
                metaData.tin_no = form.tin_no;
                metaData.full_name = `${form.contact_person_first_name} ${form.contact_person_surname}`.trim();
            }

            // 1. Sign up
            const { data: authData, error: signUpError } = await supabase.auth.signUp({
                email: form.email,
                password: form.password,
                options: { data: metaData },
            });

            if (signUpError) {
                toast.error(signUpError.message);
                return;
            }
            const userId = authData.user?.id;
            if (!userId) {
                toast.error("Registration failed. Please try again.");
                return;
            }

            // 2. Upload KYC documents
            const kycPaths: string[] = [];

            if (validIdFile) {
                const idExt = validIdFile.name.split(".").pop();
                const idPath = `${userId}/valid-id.${idExt}`;
                const { error: idUploadErr } = await supabase.storage
                    .from("kyc-documents")
                    .upload(idPath, validIdFile, { upsert: true });

                if (!idUploadErr) kycPaths.push(idPath);
            }

            if (form.account_type === "company" && businessPermitFile) {
                const bpExt = businessPermitFile.name.split(".").pop();
                const bpPath = `${userId}/business-permit.${bpExt}`;
                const { error: bpUploadErr } = await supabase.storage
                    .from("kyc-documents")
                    .upload(bpPath, businessPermitFile, { upsert: true });

                if (!bpUploadErr) kycPaths.push(bpPath);
            }

            // 3. Update profile with document paths
            if (kycPaths.length > 0) {
                await supabase.from("profiles").update({ kyc_documents: kycPaths }).eq("id", userId);
            }

            // Trigger Admin Notification (uses service-role client to bypass RLS)
            await createRoleNotificationAdmin({
                targetRole: "admin",
                title: "New Client Registration",
                message: `${metaData.full_name} has registered and is pending KYC verification.`,
                href: "/admin/clients?tab=kyc",
                severity: "info",
            });

            // 5. Sign out and redirect to login
            await supabase.auth.signOut();
            clearForm();
            router.push("/login?registered=true");
        } catch {
            toast.error("An unexpected error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <AuthShell
            backHref="/"
            backLabel="Back to Home"
            eyebrow="Verified onboarding"
            title="Create your account"
            description="Register once, complete verification, and get approved for portal access."
            highlights={[
                {
                    label: "Verification",
                    value: "Email + KYC",
                    description: "Keep the onboarding path clear and secure for every new client.",
                },
                {
                    label: "Approval flow",
                    value: "Admin review",
                    description: "New accounts wait in a consistent pending state before activation.",
                },
            ]}
        >
            <div className="space-y-8">
                <div className="space-y-3">
                    <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-primary">
                        Sign up
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-3xl font-semibold tracking-tight text-balance text-foreground">
                            Start your client profile
                        </h1>
                        <p className="text-sm leading-6 text-muted-foreground">
                            Complete the steps below to request access to the portal.
                        </p>
                    </div>
                </div>

                {/* Step Indicator */}
                <StepIndicator
                    steps={STEPS}
                    currentStep={currentStep}
                    completedSteps={completedSteps}
                    onStepClick={goToStep}
                />

                {/* Step Content with slide animation */}
                <div className="relative overflow-hidden">
                    <div
                        key={currentStep}
                        className="animate-slide-in-right"
                    >
                        {currentStep === 0 && (
                            <StepAccountType
                                value={form.account_type}
                                onChange={(v) => updateField("account_type", v)}
                                error={errors.account_type}
                            />
                        )}
                        {currentStep === 1 && (
                            <StepCredentials
                                form={form}
                                updateField={updateField}
                                errors={errors}
                            />
                        )}
                        {currentStep === 2 && (
                            <StepProfileDetails
                                form={form}
                                updateField={updateField}
                                errors={errors}
                                accountType={form.account_type}
                            />
                        )}
                        {currentStep === 3 && (
                            <StepDocuments
                                files={{ valid_id_file: validIdFile, business_permit_file: businessPermitFile }}
                                onFilesChange={(f) => {
                                    if (f.valid_id_file !== undefined) setValidIdFile(f.valid_id_file);
                                    if (f.business_permit_file !== undefined) setBusinessPermitFile(f.business_permit_file);
                                }}
                                errors={errors}
                                accountType={form.account_type}
                            />
                        )}
                        {currentStep === 4 && (
                            <StepReview
                                form={form}
                                files={{ valid_id_file: validIdFile, business_permit_file: businessPermitFile }}
                                onEditStep={goToStep}
                                onSubmit={handleSubmit}
                                loading={loading}
                            />
                        )}
                    </div>
                </div>

                {/* Navigation Buttons — hidden on review step (it has its own submit) */}
                {currentStep < 4 && (
                    <div className="flex justify-between pt-2">
                        {currentStep > 0 ? (
                            <Button
                                type="button"
                                variant="outline"
                                className="h-11 gap-1"
                                onClick={goBack}
                            >
                                <ChevronLeft className="w-4 h-4" />
                                Back
                            </Button>
                        ) : (
                            <div />
                        )}
                        <Button
                            type="button"
                            className="h-11 gap-2 bg-primary text-primary-foreground font-semibold hover:bg-primary/90"
                            onClick={goNext}
                        >
                            Continue
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                )}

                <p className="text-center text-sm text-muted-foreground">
                    Already have an account?{" "}
                    <a href="/login" className="font-semibold text-primary hover:underline">
                        Sign in
                    </a>
                </p>
            </div>
        </AuthShell>
    );
}
