"use client";

import { useEffect, useState } from "react";
import { User, Mail, Phone, MapPin, Building2, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types/database";

type ExtendedProfile = Profile & {
    account_type?: string | null;
    address_street?: string | null;
    address_city?: string | null;
    address_province?: string | null;
    address_postal_code?: string | null;
};

export default function ClientProfilePage() {
    const [profile, setProfile] = useState<ExtendedProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchProfile() {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
            setProfile(data);
            setLoading(false);
        }
        fetchProfile();
    }, []);

    if (loading) {
        return (
            <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-48 rounded-xl" />
                <Skeleton className="h-48 rounded-xl" />
            </div>
        );
    }

    if (!profile) return null;

    const initials = profile.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
    const kycColors: Record<string, string> = {
        verified: "bg-emerald-100 text-emerald-800 border-emerald-200",
        pending_verification: "bg-amber-100 text-amber-800 border-amber-200",
        rejected: "bg-red-100 text-red-800 border-red-200",
    };

    const profileRow = (icon: React.ReactNode, label: string, value: string | null | undefined) => value ? (
        <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                {icon}
            </div>
            <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-sm font-semibold mt-0.5">{value}</p>
            </div>
        </div>
    ) : null;

    const addressParts = [
        profile.address_street,
        profile.address_city,
        profile.address_province,
        profile.address_postal_code,
    ].filter(Boolean) as string[];

    return (
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
            <div>
                <h2 className="text-2xl font-bold">My Profile</h2>
                <p className="text-muted-foreground mt-1">Your account information and KYC status.</p>
            </div>

            {/* Identity card */}
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
                                <Badge variant="outline" className="capitalize text-xs">
                                    {profile.account_type || "Individual"}
                                </Badge>
                                <Badge variant="outline" className={`text-xs capitalize ${kycColors[profile.kyc_status] ?? ""}`}>
                                    {profile.kyc_status.replace(/_/g, " ")}
                                </Badge>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Contact & Address */}
            <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><User className="w-4 h-4" />Contact Information</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                    {profileRow(<Mail className="w-4 h-4 text-muted-foreground" />, "Email", profile.email)}
                    {profileRow(<Phone className="w-4 h-4 text-muted-foreground" />, "Phone", profile.phone)}
                    {addressParts.length > 0 && profileRow(<MapPin className="w-4 h-4 text-muted-foreground" />, "Address", addressParts.join(", "))}
                    {profile.company_name && profileRow(<Building2 className="w-4 h-4 text-muted-foreground" />, "Company", profile.company_name)}
                    {profileRow(<Clock className="w-4 h-4 text-muted-foreground" />, "Member Since", new Date(profile.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }))}
                </CardContent>
            </Card>

            {/* KYC documents */}
            {profile.kyc_documents && profile.kyc_documents.length > 0 && (
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-base">Submitted Documents</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                        {profile.kyc_documents.map((doc, i) => (
                            <div key={i} className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                                    <User className="w-4 h-4 text-blue-600" />
                                </div>
                                <span className="text-sm text-blue-800 font-medium truncate">
                                    {doc.split("/").pop()}
                                </span>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
