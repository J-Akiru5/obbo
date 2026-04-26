"use client";

import { useMemo, useState } from "react";
import { Bell, Eye, EyeOff, LockKeyhole, Save, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clientProfile, loginActivitySeed } from "@/lib/client-portal-data";

type NotificationPreferences = {
    orderApprovalEmail: boolean;
    orderApprovalSms: boolean;
    paymentRequiredEmail: boolean;
    paymentRequiredSms: boolean;
    dispatchEmail: boolean;
    dispatchSms: boolean;
    deliveryStatusEmail: boolean;
    deliveryStatusSms: boolean;
};

export default function ClientProfilePage() {
    const [fullName, setFullName] = useState(clientProfile.fullName);
    const [companyName, setCompanyName] = useState(clientProfile.companyName);
    const [phone, setPhone] = useState(clientProfile.phone);
    const [address, setAddress] = useState(clientProfile.deliveryAddress);
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showOldPassword, setShowOldPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [preferences, setPreferences] = useState<NotificationPreferences>({
        orderApprovalEmail: true,
        orderApprovalSms: false,
        paymentRequiredEmail: true,
        paymentRequiredSms: true,
        dispatchEmail: true,
        dispatchSms: true,
        deliveryStatusEmail: true,
        deliveryStatusSms: true,
    });

    const initials = useMemo(
        () =>
            fullName
                .split(" ")
                .map((part) => part[0])
                .join("")
                .toUpperCase()
                .slice(0, 2),
        [fullName]
    );

    function togglePreference(key: keyof NotificationPreferences) {
        setPreferences((prev) => ({ ...prev, [key]: !prev[key] }));
    }

    function saveProfileDetails() {
        toast.success("Profile details updated.");
    }

    function updatePassword() {
        if (!oldPassword || !newPassword || !confirmPassword) {
            toast.error("Please complete all password fields.");
            return;
        }
        if (newPassword.length < 8) {
            toast.error("New password must be at least 8 characters.");
            return;
        }
        if (newPassword !== confirmPassword) {
            toast.error("New password and confirmation must match.");
            return;
        }
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
        toast.success("Password changed successfully.");
    }

    function savePreferences() {
        toast.success("Notification preferences updated.");
    }

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <div>
                <h2 className="text-2xl font-semibold tracking-tight">Profile & Settings</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Manage account details, security settings, and alert preferences.
                </p>
            </div>

            <Card className="shadow-sm">
                <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center">
                    <Avatar className="h-16 w-16">
                        <AvatarFallback className="bg-[var(--color-industrial-blue)] text-lg font-semibold text-white">
                            {initials}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                        <p className="text-lg font-semibold">{fullName}</p>
                        <p className="text-sm text-muted-foreground">{clientProfile.email}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                                <ShieldCheck className="mr-1 h-3.5 w-3.5" /> KYC Verified
                            </Badge>
                            <Badge variant="outline" className="border-[var(--color-industrial-blue)]/20 text-[var(--color-industrial-blue)]">
                                Client Account
                            </Badge>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <UserRound className="h-4 w-4 text-[var(--color-industrial-blue)]" /> Business / Personal Information
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="space-y-2">
                            <Label htmlFor="full-name">Full Name</Label>
                            <Input id="full-name" value={fullName} onChange={(event) => setFullName(event.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="company-name">Company Name</Label>
                            <Input id="company-name" value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">Phone Number</Label>
                            <Input id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="address">Delivery Address</Label>
                            <Input id="address" value={address} onChange={(event) => setAddress(event.target.value)} />
                        </div>
                        <Button type="button" onClick={saveProfileDetails} className="bg-[var(--color-industrial-blue)] hover:bg-[var(--color-industrial-blue)]/90">
                            <Save className="mr-1 h-4 w-4" /> Save Changes
                        </Button>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <LockKeyhole className="h-4 w-4 text-[var(--color-industrial-blue)]" /> Security Settings
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="space-y-2">
                            <Label htmlFor="old-password">Current Password</Label>
                            <div className="relative">
                                <Input
                                    id="old-password"
                                    type={showOldPassword ? "text" : "password"}
                                    value={oldPassword}
                                    onChange={(event) => setOldPassword(event.target.value)}
                                    className="pr-9"
                                />
                                <button
                                    type="button"
                                    aria-label="Toggle current password visibility"
                                    onClick={() => setShowOldPassword((value) => !value)}
                                    className="absolute right-2 top-2 text-muted-foreground"
                                >
                                    {showOldPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="new-password">New Password</Label>
                            <div className="relative">
                                <Input
                                    id="new-password"
                                    type={showNewPassword ? "text" : "password"}
                                    value={newPassword}
                                    onChange={(event) => setNewPassword(event.target.value)}
                                    className="pr-9"
                                />
                                <button
                                    type="button"
                                    aria-label="Toggle new password visibility"
                                    onClick={() => setShowNewPassword((value) => !value)}
                                    className="absolute right-2 top-2 text-muted-foreground"
                                >
                                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirm-password">Confirm New Password</Label>
                            <div className="relative">
                                <Input
                                    id="confirm-password"
                                    type={showConfirmPassword ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={(event) => setConfirmPassword(event.target.value)}
                                    className="pr-9"
                                />
                                <button
                                    type="button"
                                    aria-label="Toggle confirm password visibility"
                                    onClick={() => setShowConfirmPassword((value) => !value)}
                                    className="absolute right-2 top-2 text-muted-foreground"
                                >
                                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        <Button type="button" onClick={updatePassword} className="bg-[var(--color-industrial-blue)] hover:bg-[var(--color-industrial-blue)]/90">
                            Update Password
                        </Button>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-base">Login Activity Log</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {loginActivitySeed.map((activity) => (
                            <div key={activity.id} className="rounded-lg border border-border p-3">
                                <p className="text-sm font-medium">{activity.device}</p>
                                <p className="text-xs text-muted-foreground">IP: {activity.ip}</p>
                                <p className="text-xs text-muted-foreground">{new Date(activity.date).toLocaleString()}</p>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Bell className="h-4 w-4 text-[var(--color-industrial-blue)]" /> Notification Preferences
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {[
                            { label: "Order Approval", email: "orderApprovalEmail", sms: "orderApprovalSms" },
                            { label: "Payment Required", email: "paymentRequiredEmail", sms: "paymentRequiredSms" },
                            { label: "Dispatch", email: "dispatchEmail", sms: "dispatchSms" },
                            { label: "Delivery Status", email: "deliveryStatusEmail", sms: "deliveryStatusSms" },
                        ].map((item) => {
                            const emailKey = item.email as keyof NotificationPreferences;
                            const smsKey = item.sms as keyof NotificationPreferences;
                            return (
                                <div key={item.label} className="rounded-lg border border-border p-3">
                                    <p className="mb-2 text-sm font-medium">{item.label}</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant={preferences[emailKey] ? "default" : "outline"}
                                            className={preferences[emailKey] ? "bg-[var(--color-industrial-blue)] hover:bg-[var(--color-industrial-blue)]/90" : ""}
                                            onClick={() => togglePreference(emailKey)}
                                        >
                                            Email {preferences[emailKey] ? "On" : "Off"}
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant={preferences[smsKey] ? "default" : "outline"}
                                            className={preferences[smsKey] ? "bg-[var(--color-industrial-blue)] hover:bg-[var(--color-industrial-blue)]/90" : ""}
                                            onClick={() => togglePreference(smsKey)}
                                        >
                                            SMS {preferences[smsKey] ? "On" : "Off"}
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}

                        <Button type="button" variant="outline" onClick={savePreferences}>
                            Save Notification Preferences
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
