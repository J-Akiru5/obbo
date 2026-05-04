"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { updateNotificationPreferences } from "@/lib/actions/client-actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CircleUserRound, Lock, ShieldCheck, Bell, Eye, EyeOff, Monitor, Globe } from "lucide-react";

export default function ProfileClient({ profile, email }: { profile: any; email: string }) {
    // Password state
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);

    // Notification preferences
    const defaultPrefs = profile?.notification_preferences || {
        order_approval: true,
        payment_required: true,
        dispatch: true,
        delivery_status: true,
    };
    const [prefs, setPrefs] = useState(defaultPrefs);
    const [isSavingPrefs, setIsSavingPrefs] = useState(false);

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            toast.error("Passwords do not match.");
            return;
        }
        if (password.length < 6) {
            toast.error("Password must be at least 6 characters.");
            return;
        }

        setIsUpdating(true);
        const supabase = createClient();
        const { error } = await supabase.auth.updateUser({ password });
        setIsUpdating(false);

        if (error) {
            toast.error(error.message);
        } else {
            toast.success("Password updated successfully.");
            setPassword("");
            setConfirmPassword("");
        }
    };

    const handleSavePrefs = async () => {
        setIsSavingPrefs(true);
        try {
            await updateNotificationPreferences(prefs);
            toast.success("Notification preferences updated.");
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Failed to save preferences.";
            toast.error(msg);
        } finally {
            setIsSavingPrefs(false);
        }
    };

    const togglePref = (key: string) => {
        setPrefs((prev: typeof prefs) => ({ ...prev, [key]: !prev[key as keyof typeof prev] }));
    };

    if (!profile) return <div className="p-8 text-center text-gray-500 animate-pulse">Loading profile...</div>;

    return (
        <div className="space-y-6 max-w-4xl">
            <div>
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Profile & Settings</h2>
                <p className="text-sm text-gray-500">Manage your account information and security preferences.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Business Information */}
                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CircleUserRound className="w-5 h-5 text-gray-500" />
                            Business Information
                        </CardTitle>
                        <CardDescription>Your verified details. Contact admin to update.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-1">
                            <Label className="text-xs text-gray-500 uppercase tracking-wide">Company Name</Label>
                            <div className="font-medium text-gray-900">{profile.company_name || profile.full_name}</div>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-gray-500 uppercase tracking-wide">Contact Person</Label>
                            <div className="font-medium text-gray-900">{profile.full_name}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label className="text-xs text-gray-500 uppercase tracking-wide">Email</Label>
                                <div className="font-medium text-gray-900">{email}</div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-gray-500 uppercase tracking-wide">Phone</Label>
                                <div className="font-medium text-gray-900">{profile.phone || "Not provided"}</div>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-gray-500 uppercase tracking-wide">Business Address</Label>
                            <div className="font-medium text-gray-900 text-sm">
                                {[profile.address_street, profile.address_city, profile.address_province].filter(Boolean).join(", ") || "Not provided"}
                            </div>
                        </div>
                        <div className="pt-4 border-t flex items-center gap-2 text-sm">
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                            <span className="text-emerald-700 font-medium">KYC Verified Account</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Security */}
                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Lock className="w-5 h-5 text-gray-500" />
                            Security
                        </CardTitle>
                        <CardDescription>Update your password to keep your account secure.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleUpdatePassword} className="space-y-4">
                            <div className="space-y-2">
                                <Label>New Password</Label>
                                <div className="relative">
                                    <Input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        required
                                        className="pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Confirm New Password</Label>
                                <div className="relative">
                                    <Input
                                        type={showConfirm ? "text" : "password"}
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        required
                                        className="pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirm(!showConfirm)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                            <Button type="submit" className="w-full bg-[var(--color-industrial-blue)]" disabled={isUpdating}>
                                {isUpdating ? "Updating..." : "Change Password"}
                            </Button>
                        </form>

                        {/* Login Activity */}
                        <div className="mt-6 pt-6 border-t">
                            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                <Monitor className="w-4 h-4 text-gray-500" />
                                Recent Login Activity
                            </h4>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm p-2.5 bg-gray-50 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <Globe className="w-3.5 h-3.5 text-gray-400" />
                                        <span className="text-gray-700">Current Session</span>
                                    </div>
                                    <span className="text-xs text-emerald-600 font-medium">Active</span>
                                </div>
                                <p className="text-[10px] text-gray-400 mt-1">Full login history is managed by the admin security team.</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Notification Preferences */}
            <Card className="shadow-sm max-w-4xl">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Bell className="w-5 h-5 text-gray-500" />
                        Notification Preferences
                    </CardTitle>
                    <CardDescription>Choose which notifications you want to receive.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {[
                            { key: "order_approval", label: "Order Approval", desc: "When your order is approved or rejected by the admin" },
                            { key: "payment_required", label: "Payment Required", desc: "When payment is needed for an approved order" },
                            { key: "dispatch", label: "Dispatch Updates", desc: "When your order is dispatched from the warehouse" },
                            { key: "delivery_status", label: "Delivery Status", desc: "Real-time updates on in-transit and delivered shipments" },
                        ].map(item => (
                            <div key={item.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                                <div>
                                    <p className="text-sm font-medium text-gray-900">{item.label}</p>
                                    <p className="text-xs text-gray-500">{item.desc}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => togglePref(item.key)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                        prefs[item.key as keyof typeof prefs] ? "bg-[var(--color-industrial-blue)]" : "bg-gray-300"
                                    }`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                        prefs[item.key as keyof typeof prefs] ? "translate-x-6" : "translate-x-1"
                                    }`} />
                                </button>
                            </div>
                        ))}
                        <Button onClick={handleSavePrefs} disabled={isSavingPrefs} className="bg-[var(--color-industrial-blue)] mt-2">
                            {isSavingPrefs ? "Saving..." : "Save Preferences"}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
