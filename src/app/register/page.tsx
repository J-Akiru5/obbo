"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, CheckCircle2, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/auth/auth-shell";

export default function RegisterPage() {
    const router = useRouter();
    const [accountType, setAccountType] = useState<"individual" | "company">("individual");

    // Email OTP state
    const [otpSent, setOtpSent] = useState(false);
    const [otpVerified, setOtpVerified] = useState(false);
    const [otpCode, setOtpCode] = useState("");
    const [sendingOtp, setSendingOtp] = useState(false);
    const [verifyingOtp, setVerifyingOtp] = useState(false);

    const [form, setForm] = useState({
        email: "",
        password: "",
        street: "",
        city: "",
        province: "",
        postal_code: "",
        // Individual
        first_name: "",
        surname: "",
        contact_number: "",
        // Company
        company_name: "",
        contact_person_first_name: "",
        contact_person_surname: "",
        contact_person_number: "",
        business_permit_no: "",
        tin_no: "",
    });

    const [validIdFile, setValidIdFile] = useState<File | null>(null);
    const [businessPermitFile, setBusinessPermitFile] = useState<File | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    function updateField(field: string, value: string) {
        setForm((prev) => ({ ...prev, [field]: value }));
        // If email changes, reset OTP state
        if (field === "email") {
            setOtpSent(false);
            setOtpVerified(false);
            setOtpCode("");
        }
    }

    async function handleSendOtp() {
        if (!form.email) { toast.error("Please enter your email first."); return; }
        setSendingOtp(true);
        try {
            const res = await fetch("/api/auth/send-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: form.email }),
            });
            const data = await res.json();
            if (!res.ok || data.error) {
                toast.error(data.error || "Failed to send code.");
            } else {
                setOtpSent(true);
                toast.success(`Verification code sent to ${form.email}`);
            }
        } catch {
            toast.error("Failed to send code. Please try again.");
        } finally {
            setSendingOtp(false);
        }
    }

    async function handleVerifyOtp() {
        if (!otpCode || otpCode.length !== 6) { toast.error("Please enter the 6-digit code."); return; }
        setVerifyingOtp(true);
        try {
            const res = await fetch("/api/auth/verify-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: form.email, code: otpCode }),
            });
            const data = await res.json();
            if (data.valid) {
                setOtpVerified(true);
                toast.success("Email verified!");
            } else {
                toast.error(data.error || "Invalid code. Please try again.");
            }
        } catch {
            toast.error("Verification failed. Please try again.");
        } finally {
            setVerifyingOtp(false);
        }
    }

    async function handleRegister(e: React.FormEvent) {
        e.preventDefault();
        if (!otpVerified) { toast.error("Please verify your email first."); return; }
        if (form.password.length < 6) { toast.error("Password must be at least 6 characters."); return; }
        if (!validIdFile) { toast.error("Please upload a valid ID."); return; }
        if (accountType === "company" && !businessPermitFile) {
            toast.error("Please upload your business permit."); return;
        }

        setLoading(true);
        try {
            const supabase = createClient();

            const metaData: Record<string, string> = {
                account_type: accountType,
                address_street: form.street,
                address_city: form.city,
                address_province: form.province,
                address_postal_code: form.postal_code,
                role: "client",
                kyc_status: "pending_verification",
            };

            if (accountType === "individual") {
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

            if (signUpError) { toast.error(signUpError.message); return; }
            const userId = authData.user?.id;
            if (!userId) { toast.error("Registration failed. Please try again."); return; }

            // 2. Upload KYC documents to Storage
            const kycPaths: string[] = [];

            const idExt = validIdFile.name.split(".").pop();
            const idPath = `${userId}/valid-id.${idExt}`;
            const { error: idUploadErr } = await supabase.storage
                .from("kyc-documents")
                .upload(idPath, validIdFile, { upsert: true });

            if (idUploadErr) {
                console.error("ID upload error:", idUploadErr);
            } else {
                kycPaths.push(idPath);
            }

            if (accountType === "company" && businessPermitFile) {
                const bpExt = businessPermitFile.name.split(".").pop();
                const bpPath = `${userId}/business-permit.${bpExt}`;
                const { error: bpUploadErr } = await supabase.storage
                    .from("kyc-documents")
                    .upload(bpPath, businessPermitFile, { upsert: true });

                if (!bpUploadErr) kycPaths.push(bpPath);
            }

            // 3. Update profile with document paths
            if (kycPaths.length > 0) {
                await supabase
                    .from("profiles")
                    .update({ kyc_documents: kycPaths })
                    .eq("id", userId);
            }

            // 4. Sign out immediately — user must wait for admin approval
            await supabase.auth.signOut();

            toast.success("Account created! Awaiting admin verification.");
            router.push("/pending");
        } catch {
            toast.error("An unexpected error occurred. Please try again.");
        } finally {
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
                        <div className="inline-flex items-center rounded-full border border-[var(--color-industrial-yellow)]/25 bg-[var(--color-industrial-yellow)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--color-industrial-blue)]">
                            Sign up
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-3xl font-semibold tracking-tight text-balance text-foreground">
                                Start your client profile
                            </h2>
                            <p className="text-sm leading-6 text-muted-foreground">
                                Complete the details below to request access to the portal.
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleRegister} className="flex flex-col">
                        <div className="grid grid-cols-1 gap-8 md:gap-10 lg:grid-cols-2">
                    </div>
                            {/* LEFT COLUMN */}
                            <div className="space-y-8">
                                <div>
                                    <h3 className="font-semibold text-lg mb-4 text-foreground">Account credentials</h3>
                                    <div className="space-y-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-sm font-medium">Account type</Label>
                                            <Select value={accountType} onValueChange={(val) => {
                                                if (val === "individual" || val === "company") setAccountType(val);
                                            }}>
                                                <SelectTrigger className="h-11 w-full">
                                                    <SelectValue placeholder="Select account type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="individual">Individual</SelectItem>
                                                    <SelectItem value="company">Company</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label className="text-sm font-medium">Email</Label>
                                            <div className="flex flex-col gap-2 sm:flex-row">
                                                <Input
                                                    type="email"
                                                    placeholder="you@company.com"
                                                    value={form.email}
                                                    onChange={(e) => updateField("email", e.target.value)}
                                                    required
                                                    disabled={otpVerified}
                                                    className="h-11 flex-1"
                                                />
                                                {!otpVerified && (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        className="h-11 border-[var(--color-industrial-yellow)]/50 bg-[var(--color-industrial-yellow)] text-[var(--color-industrial-blue)] font-semibold hover:bg-[var(--color-industrial-yellow)]/90 whitespace-nowrap"
                                                        onClick={handleSendOtp}
                                                        disabled={sendingOtp || !form.email}
                                                    >
                                                        {sendingOtp ? <Loader2 className="w-4 h-4 animate-spin" /> : otpSent ? "Resend code" : "Send code"}
                                                    </Button>
                                                )}
                                                {otpVerified && (
                                                    <div className="h-11 flex items-center justify-center px-3 rounded-lg border border-emerald-200 bg-emerald-50 text-sm font-semibold text-emerald-700">
                                                        <CheckCircle2 className="mr-1.5 w-4 h-4" /> Verified
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                                            <CheckCircle2 className="w-4 h-4" /> Verified
                                        {otpSent && !otpVerified && (
                                            <div className="space-y-1.5">
                                                <Label className="text-sm font-medium">Verification code</Label>
                                                <div className="flex flex-col gap-2 sm:flex-row">
                                                    <Input
                                                        type="text"
                                                        placeholder="6-digit code"
                                                        value={otpCode}
                                                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                                        maxLength={6}
                                                        className="h-11 tracking-[0.35em] text-center font-mono text-base"
                                                    />
                                                    <Button
                                                        type="button"
                                                        className="h-11 bg-[var(--color-industrial-blue)] font-semibold hover:bg-[var(--color-industrial-blue)]/90"
                                                        onClick={handleVerifyOtp}
                                                        disabled={verifyingOtp || otpCode.length !== 6}
                                                    >
                                                        {verifyingOtp ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify"}
                                                    </Button>
                                                </div>
                                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <Mail className="w-3 h-3" /> Check your inbox and spam folder.
                                                </p>
                                            </div>
                                        )}
                                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <div className="space-y-1.5">
                                            <Label className="text-sm font-medium">Password</Label>
                                            <div className="relative">
                                                <Input
                                                    type={showPassword ? "text" : "password"}
                                                    placeholder="••••••••"
                                                    value={form.password}
                                                    onChange={(e) => updateField("password", e.target.value)}
                                                    required
                                                    className="h-11 pr-10"
                                                />
                                                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                                                    onClick={() => setShowPassword(!showPassword)}>
                                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                                    </button>
                                <div>
                                    <h3 className="font-semibold text-lg mb-4 text-foreground">Address</h3>
                                    <div className="grid grid-cols-1 gap-3">
                                        <div><Label className="mb-1.5 block text-sm font-medium">Street</Label><Input value={form.street} onChange={(e) => updateField("street", e.target.value)} className="h-11" required /></div>
                                        <div><Label className="mb-1.5 block text-sm font-medium">City</Label><Input value={form.city} onChange={(e) => updateField("city", e.target.value)} className="h-11" required /></div>
                                        <div><Label className="mb-1.5 block text-sm font-medium">Province</Label><Input value={form.province} onChange={(e) => updateField("province", e.target.value)} className="h-11" required /></div>
                                        <div><Label className="mb-1.5 block text-sm font-medium">Postal code</Label><Input value={form.postal_code} onChange={(e) => updateField("postal_code", e.target.value)} className="h-11" required /></div>
                                    </div>
                                </div>
                            </div>
                                            <div><Label className="text-sm font-semibold mb-1.5 block">Province:</Label><Input value={form.province} onChange={(e) => updateField("province", e.target.value)} className="h-11 border-gray-300" required /></div>
                        {/* RIGHT COLUMN */}
                        <div className="space-y-6 lg:border-l lg:border-border lg:pl-10">
                            {accountType === "individual" ? (
                                <div>
                                    <h3 className="font-semibold text-lg mb-4 text-foreground">Personal information</h3>
                                    <div className="space-y-4">
                                        <div><Label className="mb-1.5 block text-sm font-medium">First name</Label><Input value={form.first_name} onChange={(e) => updateField("first_name", e.target.value)} className="h-11" required /></div>
                                        <div><Label className="mb-1.5 block text-sm font-medium">Surname</Label><Input value={form.surname} onChange={(e) => updateField("surname", e.target.value)} className="h-11" required /></div>
                                        <div><Label className="mb-1.5 block text-sm font-medium">Contact number</Label><Input value={form.contact_number} onChange={(e) => updateField("contact_number", e.target.value)} className="h-11" required /></div>
                                        <div className="space-y-1.5">
                                            <Label className="text-sm font-medium">Valid ID (photo)</Label>
                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                                <Button type="button" variant="outline" className="border-[var(--color-industrial-yellow)]/50 bg-[var(--color-industrial-yellow)] text-[var(--color-industrial-blue)] font-semibold hover:bg-[var(--color-industrial-yellow)]/90"
                                                    onClick={() => document.getElementById("valid-id-upload")?.click()}>
                                                    Choose file
                                                </Button>
                                                <span className="text-sm text-muted-foreground truncate">{validIdFile ? validIdFile.name : "No file chosen"}</span>
                                                <input id="valid-id-upload" type="file" className="hidden" accept="image/*,.pdf"
                                                    onChange={(e) => setValidIdFile(e.target.files?.[0] || null)} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <h3 className="font-semibold text-lg mb-4 text-foreground">Company information</h3>
                                    <div className="space-y-4">
                                        <div><Label className="mb-1.5 block text-sm font-medium">Company name</Label><Input value={form.company_name} onChange={(e) => updateField("company_name", e.target.value)} className="h-11" required /></div>
                                        <div><Label className="mb-1.5 block text-sm font-medium">Contact person first name</Label><Input value={form.contact_person_first_name} onChange={(e) => updateField("contact_person_first_name", e.target.value)} className="h-11" required /></div>
                                        <div><Label className="mb-1.5 block text-sm font-medium">Contact person surname</Label><Input value={form.contact_person_surname} onChange={(e) => updateField("contact_person_surname", e.target.value)} className="h-11" required /></div>
                                        <div><Label className="mb-1.5 block text-sm font-medium">Contact person number</Label><Input value={form.contact_person_number} onChange={(e) => updateField("contact_person_number", e.target.value)} className="h-11" required /></div>

                                        <div className="space-y-1.5 pt-2">
                                            <Label className="text-sm font-medium">Contact person valid ID</Label>
                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                                <Button type="button" variant="outline" className="border-[var(--color-industrial-yellow)]/50 bg-[var(--color-industrial-yellow)] text-[var(--color-industrial-blue)] font-semibold hover:bg-[var(--color-industrial-yellow)]/90"
                                                    onClick={() => document.getElementById("contact-valid-id-upload")?.click()}>
                                                    Choose file
                                                </Button>
                                                <span className="text-sm text-muted-foreground truncate">{validIdFile ? validIdFile.name : "No file chosen"}</span>
                                                <input id="contact-valid-id-upload" type="file" className="hidden" accept="image/*,.pdf"
                                                    onChange={(e) => setValidIdFile(e.target.files?.[0] || null)} />
                                            </div>
                                        </div>

                                        <div><Label className="mb-1.5 block text-sm font-medium">Business permit no.</Label><Input value={form.business_permit_no} onChange={(e) => updateField("business_permit_no", e.target.value)} className="h-11" required /></div>

                                        <div className="space-y-1.5 pt-2">
                                            <Label className="text-sm font-medium">Business permit (photo)</Label>
                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                                <Button type="button" variant="outline" className="border-[var(--color-industrial-yellow)]/50 bg-[var(--color-industrial-yellow)] text-[var(--color-industrial-blue)] font-semibold hover:bg-[var(--color-industrial-yellow)]/90"
                                                    onClick={() => document.getElementById("business-permit-upload")?.click()}>
                                                    Choose file
                                                </Button>
                                                <span className="text-sm text-muted-foreground truncate">{businessPermitFile ? businessPermitFile.name : "No file chosen"}</span>
                                                <input id="business-permit-upload" type="file" className="hidden" accept="image/*,.pdf"
                                                    onChange={(e) => setBusinessPermitFile(e.target.files?.[0] || null)} />
                                            </div>
                                        </div>

                                        <div><Label className="mb-1.5 block text-sm font-medium">TIN no.</Label><Input value={form.tin_no} onChange={(e) => updateField("tin_no", e.target.value)} className="h-11" required /></div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-10 space-y-3">
                        <Button type="submit" disabled={loading} className="h-12 w-full rounded-xl bg-[var(--color-industrial-yellow)] font-semibold text-[var(--color-industrial-blue)] shadow-sm shadow-[var(--color-industrial-yellow)]/20 hover:bg-[var(--color-industrial-yellow)]/90">
                            {loading ? "Signing up..." : "Sign Up"}
                        </Button>
                        <p className="text-center text-sm text-muted-foreground">
                            Already have an account?{" "}
                            <Link href="/login" className="font-semibold text-[var(--color-industrial-blue)] hover:underline">
                                Sign in
                            </Link>
                        </p>
                    </div>
                </div>
            </AuthShell>
                                    {loading ? (
                                        <span className="flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Creating account...</span>
                                    ) : "Sign Up"}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
