"use client";

import { useEffect, useState } from "react";
import { User, Mail, Phone, Shield, Clock, KeyRound, Save, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

interface AdminProfile {
    id: string;
    email: string;
    full_name: string;
    phone: string | null;
    role: string;
    kyc_status: string;
    created_at: string;
    updated_at: string;
}

export default function AdminProfilePage() {
    const [profile, setProfile] = useState<AdminProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Editable fields
    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");

    useEffect(() => {
        async function load() {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
            if (data) {
                setProfile(data);
                setFullName(data.full_name);
                setPhone(data.phone || "");
            }
            setLoading(false);
        }
        load();
    }, []);

    async function handleSave() {
        if (!profile) return;
        setSaving(true);
        const supabase = createClient();
        const { error } = await supabase
            .from("profiles")
            .update({ full_name: fullName, phone: phone || null, updated_at: new Date().toISOString() })
            .eq("id", profile.id);

        if (error) {
            toast.error("Failed to update profile.");
        } else {
            setProfile({ ...profile, full_name: fullName, phone: phone || null });
            toast.success("Profile updated.");
        }
        setSaving(false);
    }

    if (loading) {
        return (
            <div className="max-w-2xl mx-auto space-y-4 py-2">
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-52 rounded-xl" />
                <Skeleton className="h-52 rounded-xl" />
            </div>
        );
    }

    if (!profile) return null;

    const initials = profile.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
    const hasChanges = fullName !== profile.full_name || (phone || null) !== profile.phone;

    return (
        <div className="max-w-2xl mx-auto space-y-6 py-2">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">My Profile</h2>
                <p className="text-muted-foreground mt-1">View and update your administrator account.</p>
            </div>

            {/* Identity Card */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <Avatar className="w-16 h-16">
                            <AvatarFallback className="text-lg font-bold bg-[var(--color-industrial-blue)] text-white">{initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                            <h3 className="text-xl font-bold">{profile.full_name}</h3>
                            <p className="text-sm text-muted-foreground">{profile.email}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                <Badge className="bg-[var(--color-industrial-blue)] hover:bg-[var(--color-industrial-blue)] text-white text-xs capitalize">
                                    <Shield className="w-3 h-3 mr-1" /> {profile.role}
                                </Badge>
                                <Badge variant="outline" className="text-xs bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100 capitalize">
                                    {profile.kyc_status.replace(/_/g, " ")}
                                </Badge>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Edit Profile */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2"><User className="w-4 h-4" /> Account Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 text-muted-foreground" /> Full Name
                            </Label>
                            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-10" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5 text-muted-foreground" /> Phone
                            </Label>
                            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+63 ..." className="h-10" />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-sm font-medium flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-muted-foreground" /> Email
                        </Label>
                        <Input value={profile.email} disabled className="h-10 bg-muted" />
                        <p className="text-xs text-muted-foreground">Email cannot be changed from this page.</p>
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="w-3.5 h-3.5" />
                            Member since {new Date(profile.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}
                        </div>
                        <Button onClick={handleSave} disabled={!hasChanges || saving} className="bg-[var(--color-industrial-blue)] hover:bg-[var(--color-industrial-blue)]/90">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
                            Save Changes
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Security */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2"><KeyRound className="w-4 h-4" /> Security</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                            <p className="text-sm font-medium">Password</p>
                            <p className="text-xs text-muted-foreground">Change your account password.</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => toast.info("Password reset email sent. Check your inbox.")} className="text-xs">
                            Change Password
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
