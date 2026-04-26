"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/auth/auth-shell";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        try {
            const supabase = createClient();
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) {
                toast.error(error.message);
            } else {
                toast.success("Signed in successfully!");
                // Middleware will evaluate role + kyc_status and redirect correctly
                router.refresh();
                router.replace("/client/dashboard");
            }
        } catch {
            toast.error("An unexpected error occurred");
        } finally {
            setLoading(false);
        }
    }

    return (
        <AuthShell
            backHref="/"
            backLabel="Back to Home"
            eyebrow="Client access portal"
            title="Welcome back"
            description="Sign in to manage orders, inventory, and account updates in one place."
            highlights={[
                {
                    label: "Active orders",
                    value: "Real-time",
                    description: "Track requests and approvals without losing context.",
                },
                {
                    label: "Secure access",
                    value: "Verified",
                    description: "Keep client sessions consistent across the portal.",
                },
            ]}
        >
            <div className="space-y-8">
                <div className="space-y-3">
                    <div className="inline-flex items-center rounded-full border border-[var(--color-industrial-blue)]/15 bg-[var(--color-industrial-blue)]/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--color-industrial-blue)]">
                        Sign in
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-3xl font-semibold tracking-tight text-balance text-foreground">
                            Access your dashboard
                        </h2>
                        <p className="text-sm leading-6 text-muted-foreground">
                            Use your registered email and password to continue.
                        </p>
                    </div>
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-11" />
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                            <Label htmlFor="password">Password</Label>
                        </div>
                        <div className="relative">
                            <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-11 pr-10" />
                            <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground" onClick={() => setShowPassword(!showPassword)}>
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                    <Button type="submit" className="h-12 w-full bg-[var(--color-industrial-blue)] text-white hover:bg-[var(--color-industrial-blue)]/90 font-semibold" disabled={loading}>
                        {loading ? "Signing in..." : "Sign In"}
                    </Button>
                </form>

                <p className="text-center text-sm text-muted-foreground">
                    Don&apos;t have an account?{" "}
                    <Link href="/register" className="font-semibold text-[var(--color-industrial-blue)] hover:underline">
                        Create one
                    </Link>
                </p>
            </div>
        </AuthShell>
    );
}
