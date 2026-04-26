"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Package, Eye, EyeOff, ArrowLeft, Sparkles, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

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
                router.push("/admin/dashboard");
            }
        } catch {
            toast.error("An unexpected error occurred");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen w-full flex flex-col lg:flex-row">
            {/* Left Panel - Dark Theme */}
            <div className="hidden lg:flex flex-col justify-between w-1/2 bg-[#0f1b29] text-white p-12 lg:p-16 relative overflow-hidden">
                {/* Background vertical lines for industrial feel */}
                <div className="absolute inset-0 opacity-10 flex justify-evenly pointer-events-none">
                    <div className="w-px h-full bg-white"></div>
                    <div className="w-px h-full bg-white"></div>
                    <div className="w-px h-full bg-white"></div>
                    <div className="w-px h-full bg-white"></div>
                </div>

                <div className="relative z-10 flex flex-col">
                    <div className="flex items-center gap-4 mb-16">
                        <div className="w-12 h-12 rounded-xl bg-[var(--color-industrial-yellow)] flex items-center justify-center">
                            <Package className="w-7 h-7 text-[#0f1b29]" />
                        </div>
                        <div>
                            <h2 className="font-bold tracking-[0.15em] text-sm text-white/90 uppercase">OBBO iManage</h2>
                            <p className="text-xs text-white/60 mt-0.5">Cement distribution portal</p>
                        </div>
                    </div>

                    <div className="mt-4 max-w-lg">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 mb-8">
                            <Sparkles className="w-3.5 h-3.5 text-[var(--color-industrial-yellow)]" />
                            <span className="text-[11px] font-bold tracking-[0.15em] text-white/80 uppercase">Client Access Portal</span>
                        </div>
                        
                        <h1 className="text-5xl lg:text-6xl font-serif font-bold text-white mb-6 tracking-tight">Welcome back</h1>
                        <p className="text-lg text-white/70 leading-relaxed max-w-md">
                            Sign in to manage orders, inventory, and account updates in one place.
                        </p>
                    </div>
                </div>

                <div className="relative z-10 mt-auto">
                    <div className="grid grid-cols-2 gap-6 mb-12">
                        <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                            <p className="text-[11px] font-bold tracking-[0.15em] text-white/50 uppercase mb-3">Active Orders</p>
                            <h3 className="text-2xl font-bold text-white mb-3">Real-time</h3>
                            <p className="text-sm text-white/60 leading-relaxed">Track requests and approvals without losing context.</p>
                        </div>
                        <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                            <p className="text-[11px] font-bold tracking-[0.15em] text-white/50 uppercase mb-3">Secure Access</p>
                            <h3 className="text-2xl font-bold text-white mb-3">Verified</h3>
                            <p className="text-sm text-white/60 leading-relaxed">Keep client sessions consistent across the portal.</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 w-max">
                        <Shield className="w-5 h-5 text-[var(--color-industrial-yellow)]" />
                        <span className="text-sm text-white/80">Secure access with a consistent industrial workflow</span>
                    </div>
                </div>
            </div>

            {/* Right Panel - Light Theme Form */}
            <div className="w-full lg:w-1/2 flex flex-col bg-white relative">
                <div className="absolute top-8 left-8">
                    <Link href="/">
                        <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-foreground rounded-full px-4">
                            <ArrowLeft className="w-4 h-4" /> Back to Home
                        </Button>
                    </Link>
                </div>

                <div className="flex-1 flex items-center justify-center p-8 sm:p-12 lg:p-20">
                    <div className="w-full max-w-[420px]">
                        <div className="mb-12">
                            <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-slate-100 text-[var(--color-industrial-blue)] font-bold text-[11px] tracking-[0.15em] mb-6">
                                SIGN IN
                            </div>
                            <h2 className="text-4xl font-serif font-bold text-gray-900 mb-4 tracking-tight">Access your dashboard</h2>
                            <p className="text-[15px] text-muted-foreground">
                                Use your registered email and password to continue.
                            </p>
                        </div>

                        <form onSubmit={handleLogin} className="space-y-6">
                            <div className="space-y-2.5">
                                <Label htmlFor="email" className="text-sm font-semibold text-gray-700">Email</Label>
                                <Input 
                                    id="email" 
                                    type="email" 
                                    placeholder="you@company.com" 
                                    value={email} 
                                    onChange={(e) => setEmail(e.target.value)} 
                                    required 
                                    className="h-12 border-gray-200 rounded-xl focus-visible:ring-1 focus-visible:ring-[var(--color-industrial-blue)] focus-visible:border-[var(--color-industrial-blue)] px-4"
                                />
                            </div>
                            <div className="space-y-2.5">
                                <Label htmlFor="password" className="text-sm font-semibold text-gray-700">Password</Label>
                                <div className="relative">
                                    <Input 
                                        id="password" 
                                        type={showPassword ? "text" : "password"} 
                                        placeholder="••••••••" 
                                        value={password} 
                                        onChange={(e) => setPassword(e.target.value)} 
                                        required 
                                        className="h-12 border-gray-200 rounded-xl pr-12 focus-visible:ring-1 focus-visible:ring-[var(--color-industrial-blue)] focus-visible:border-[var(--color-industrial-blue)] px-4"
                                    />
                                    <button 
                                        type="button" 
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none" 
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>
                            
                            <Button 
                                type="submit" 
                                className="w-full h-12 bg-[var(--color-industrial-blue)] hover:bg-[var(--color-industrial-blue)]/90 text-white font-semibold rounded-xl mt-8 transition-colors" 
                                disabled={loading}
                            >
                                {loading ? "Signing in..." : "Sign In"}
                            </Button>
                        </form>
                        
                        <div className="mt-10 text-center">
                            <p className="text-sm text-muted-foreground">
                                Don&apos;t have an account?{" "}
                                <Link href="/register" className="text-[var(--color-industrial-blue)] font-bold hover:underline">
                                    Create one
                                </Link>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
