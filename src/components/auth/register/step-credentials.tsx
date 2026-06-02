"use client";

import { useState } from "react";
import { Eye, EyeOff, CheckCircle2, Loader2, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getPasswordStrength } from "./register-schema";

interface StepCredentialsProps {
    form: {
        email: string;
        password: string;
        confirm_password: string;
        otp_verified: boolean;
    };
    updateField: (field: string, value: string | boolean) => void;
    errors: Record<string, string>;
}

export function StepCredentials({ form, updateField, errors }: StepCredentialsProps) {
    const [otpSent, setOtpSent] = useState(false);
    const [otpCode, setOtpCode] = useState("");
    const [sendingOtp, setSendingOtp] = useState(false);
    const [verifyingOtp, setVerifyingOtp] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const strength = getPasswordStrength(form.password);

    async function handleSendOtp() {
        if (!form.email) {
            toast.error("Please enter your email first.");
            return;
        }
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
        if (!otpCode || otpCode.length !== 6) {
            toast.error("Please enter the 6-digit code.");
            return;
        }
        setVerifyingOtp(true);
        try {
            const res = await fetch("/api/auth/verify-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: form.email, code: otpCode }),
            });
            const data = await res.json();
            if (data.valid) {
                updateField("otp_verified", true);
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

    return (
        <div className="space-y-5">
            <div className="space-y-1">
                <h2 className="text-xl font-semibold tracking-tight text-foreground">
                    Account credentials
                </h2>
                <p className="text-sm text-muted-foreground">
                    Set up your login details and verify your email address.
                </p>
            </div>

            {/* Email + OTP */}
            <div className="space-y-1.5">
                <Label htmlFor="reg-email" className="text-sm font-medium">
                    Email address
                </Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                        id="reg-email"
                        type="email"
                        placeholder="you@example.com"
                        value={form.email}
                        onChange={(e) => {
                            updateField("email", e.target.value);
                            updateField("otp_verified", false);
                            setOtpSent(false);
                            setOtpCode("");
                        }}
                        disabled={form.otp_verified}
                        className="h-11 flex-1"
                    />
                    <Button
                        type="button"
                        variant="outline"
                        className="h-11 flex-shrink-0"
                        onClick={handleSendOtp}
                        disabled={sendingOtp || form.otp_verified || !form.email}
                    >
                        {sendingOtp ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : form.otp_verified ? (
                            <>
                                <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-500" /> Verified
                            </>
                        ) : otpSent ? (
                            "Resend"
                        ) : (
                            "Send code"
                        )}
                    </Button>
                </div>
                {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                {errors.otp_verified && (
                    <p className="text-sm text-destructive">{errors.otp_verified}</p>
                )}
            </div>

            {/* OTP input */}
            {otpSent && !form.otp_verified && (
                <div className="space-y-1.5">
                    <Label htmlFor="reg-otp" className="text-sm font-medium">
                        Verification code
                    </Label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Input
                            id="reg-otp"
                            type="text"
                            placeholder="6-digit code"
                            value={otpCode}
                            onChange={(e) =>
                                setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                            }
                            maxLength={6}
                            className="h-11 tracking-[0.35em] text-center font-mono text-base"
                        />
                        <Button
                            type="button"
                            className="h-11 bg-primary text-primary-foreground font-semibold hover:bg-primary/90"
                            onClick={handleVerifyOtp}
                            disabled={verifyingOtp || otpCode.length !== 6}
                        >
                            {verifyingOtp ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                "Verify"
                            )}
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="w-3 h-3" /> Check your inbox and spam folder.
                    </p>
                </div>
            )}

            {/* Password */}
            <div className="space-y-1.5">
                <Label htmlFor="reg-password" className="text-sm font-medium">
                    Password
                </Label>
                <div className="relative">
                    <Input
                        id="reg-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={form.password}
                        onChange={(e) => updateField("password", e.target.value)}
                        className="h-11 pr-10"
                    />
                    <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                        onClick={() => setShowPassword(!showPassword)}
                    >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                </div>
                {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}

                {/* Password strength indicator */}
                {form.password.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                        <div className="flex gap-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div
                                    key={i}
                                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                                        i < strength.score ? strength.color : "bg-muted"
                                    }`}
                                />
                            ))}
                        </div>
                        <p
                            className={`text-xs font-medium ${
                                strength.score <= 1
                                    ? "text-red-500"
                                    : strength.score <= 2
                                      ? "text-orange-500"
                                      : strength.score <= 3
                                        ? "text-yellow-600"
                                        : "text-emerald-600"
                            }`}
                        >
                            {strength.label}
                        </p>
                    </div>
                )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
                <Label htmlFor="reg-confirm-password" className="text-sm font-medium">
                    Confirm password
                </Label>
                <div className="relative">
                    <Input
                        id="reg-confirm-password"
                        type={showConfirm ? "text" : "password"}
                        placeholder="••••••••"
                        value={form.confirm_password}
                        onChange={(e) => updateField("confirm_password", e.target.value)}
                        className="h-11 pr-10"
                    />
                    <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                        onClick={() => setShowConfirm(!showConfirm)}
                    >
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                </div>
                {errors.confirm_password && (
                    <p className="text-sm text-destructive">{errors.confirm_password}</p>
                )}
            </div>
        </div>
    );
}
