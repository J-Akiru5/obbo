"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Package, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
    const router = useRouter();
    const [form, setForm] = useState({
        full_name: "",
        email: "",
        password: "",
        confirm_password: "",
        company_name: "",
        phone: "",
    });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    function updateField(field: string, value: string) {
        setForm((prev) => ({ ...prev, [field]: value }));
    }

    async function handleRegister(e: React.FormEvent) {
        e.preventDefault();
        if (form.password !== form.confirm_password) {
            toast.error("Passwords do not match");
            return;
        }
        if (form.password.length < 6) {
            toast.error("Password must be at least 6 characters");
            return;
        }
        setLoading(true);
        try {
            const supabase = createClient();
            const { error } = await supabase.auth.signUp({
                email: form.email,
                password: form.password,
                options: {
                    data: {
                        full_name: form.full_name,
                        company_name: form.company_name,
                        phone: form.phone,
                        role: "client",
                        kyc_status: "pending_verification",
                    },
                },
            });
            if (error) {
                toast.error(error.message);
            } else {
                toast.success("Account created! Awaiting admin verification.");
                router.push("/pending");
            }
        } catch {
            toast.error("An unexpected error occurred");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-white px-4 py-12">
            <div className="absolute inset-0 -z-10 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, var(--color-industrial-blue) 1px, transparent 0)', backgroundSize: '32px 32px' }} />
            <Card className="w-full max-w-lg shadow-2xl shadow-[var(--color-industrial-blue)]/10 border-border">
                <CardHeader className="text-center pb-2">
                    <Link href="/" className="inline-flex items-center justify-center gap-2 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-[var(--color-industrial-blue)] flex items-center justify-center">
                            <Package className="w-5 h-5 text-white" />
                        </div>
                    </Link>
                    <CardTitle className="text-2xl font-bold">Create Your Account</CardTitle>
                    <CardDescription>Register for OBBO iManage to start ordering</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleRegister} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="full_name">Full Name *</Label>
                                <Input id="full_name" placeholder="Juan Dela Cruz" value={form.full_name} onChange={(e) => updateField("full_name", e.target.value)} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="company_name">Company Name</Label>
                                <Input id="company_name" placeholder="Your Company Inc." value={form.company_name} onChange={(e) => updateField("company_name", e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email *</Label>
                            <Input id="email" type="email" placeholder="you@company.com" value={form.email} onChange={(e) => updateField("email", e.target.value)} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">Phone Number</Label>
                            <Input id="phone" type="tel" placeholder="+63 9XX XXX XXXX" value={form.phone} onChange={(e) => updateField("phone", e.target.value)} />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="password">Password *</Label>
                                <div className="relative">
                                    <Input id="password" type={showPassword ? "text" : "password"} placeholder="Min 6 characters" value={form.password} onChange={(e) => updateField("password", e.target.value)} required />
                                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword(!showPassword)}>
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirm_password">Confirm Password *</Label>
                                <Input id="confirm_password" type={showPassword ? "text" : "password"} placeholder="Repeat password" value={form.confirm_password} onChange={(e) => updateField("confirm_password", e.target.value)} required />
                            </div>
                        </div>
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                            <strong>Note:</strong> After registration, your account will be in &quot;Pending Verification&quot; status. An admin will review and approve your account.
                        </div>
                        <Button type="submit" className="w-full bg-[var(--color-industrial-blue)] hover:bg-[var(--color-industrial-blue)]/90 font-semibold" disabled={loading}>
                            {loading ? "Creating account..." : "Create Account"}
                        </Button>
                    </form>
                    <p className="mt-6 text-center text-sm text-muted-foreground">
                        Already have an account?{" "}
                        <Link href="/login" className="text-[var(--color-industrial-blue)] font-semibold hover:underline">Sign In</Link>
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
