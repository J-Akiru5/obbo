"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CircleUserRound, Lock, ShieldCheck } from "lucide-react";

export default function ClientProfilePage() {
    const [profile, setProfile] = useState<any>(null);
    const [email, setEmail] = useState("");
    
    // Password state
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        const fetchProfile = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setEmail(user.email || "");
                const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
                setProfile(data);
            }
        };
        fetchProfile();
    }, []);

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

    if (!profile) return <div className="p-8 text-center text-gray-500 animate-pulse">Loading profile...</div>;

    return (
        <div className="space-y-6 max-w-4xl">
            <div>
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Profile & Settings</h2>
                <p className="text-sm text-gray-500">Manage your account information and security preferences.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
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
                                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                            </div>
                            <div className="space-y-2">
                                <Label>Confirm New Password</Label>
                                <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
                            </div>
                            <Button type="submit" className="w-full bg-[var(--color-industrial-blue)]" disabled={isUpdating}>
                                {isUpdating ? "Updating..." : "Change Password"}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
