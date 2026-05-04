"use client";

import { useEffect, useState } from "react";
import {
    Activity,
    Database,
    Globe,
    HardDrive,
    Info,
    KeyRound,
    Mail,
    Moon,
    Monitor,
    Palette,
    Phone,
    Save,
    Settings,
    Shield,
    Sun,
    ShieldAlert,
    User,
    Lock,
    Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { fetchAuditLog, getAdminSetting, saveAdminSetting } from "@/lib/actions/admin-actions";
import { createClient } from "@/lib/supabase/client";

function SettingRow({ icon, title, description, children }: { icon: React.ReactNode; title: string; description: string; children: React.ReactNode; }) {
    return (
        <div className="flex flex-col gap-3 border-b border-border/60 py-4 last:border-b-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-muted">{icon}</div>
                <div>
                    <p className="text-sm font-semibold text-foreground">{title}</p>
                    <p className="mt-0.5 max-w-sm text-xs text-muted-foreground">{description}</p>
                </div>
            </div>
            <div>{children}</div>
        </div>
    );
}

export default function AdminSettingsPage() {
    const [theme, setTheme] = useState<"system" | "light" | "dark">("system");
    const [contactInfo, setContactInfo] = useState({ email: "", phone: "", address: "", businessHours: "" });
    const [isSavingContact, setIsSavingContact] = useState(false);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [securityEvents, setSecurityEvents] = useState<any[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(true);
    const [profileLoading, setProfileLoading] = useState(true);
    const [profile, setProfile] = useState<{ id: string; email: string; full_name: string; phone: string | null; role: string; } | null>(null);
    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [savingAccount, setSavingAccount] = useState(false);
    const [changingPassword, setChangingPassword] = useState(false);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const supabase = createClient();
                const [contact, logData, userData] = await Promise.all([
                    getAdminSetting("contact_info"),
                    fetchAuditLog(1, 60),
                    supabase.auth.getUser(),
                ]);

                if (contact) {
                    setContactInfo(contact as any);
                }

                setAuditLogs(logData.entries);
                setSecurityEvents(
                    logData.entries.filter((entry) =>
                        entry.action.includes("login") ||
                        entry.action.includes("password") ||
                        entry.action.includes("role") ||
                        entry.action.includes("setting") ||
                        entry.action.includes("kyc_rejected")
                    )
                );

                const user = userData.data.user;
                if (user) {
                    const { data } = await supabase.from("profiles").select("id,email,full_name,phone,role").eq("id", user.id).single();
                    if (data) {
                        setProfile(data);
                        setFullName(data.full_name || "");
                        setPhone(data.phone || "");
                    }
                }
            } catch (error) {
                console.error("Failed to load settings data", error);
            } finally {
                setLoadingLogs(false);
                setProfileLoading(false);
            }
        };

        void loadSettings();
    }, []);

    const handleSaveContact = async () => {
        setIsSavingContact(true);
        try {
            await saveAdminSetting("contact_info", contactInfo);
            toast.success("Contact information saved.");
        } catch (error) {
            toast.error("Failed to save contact information.");
        } finally {
            setIsSavingContact(false);
        }
    };

    const handleSaveAccount = async () => {
        if (!profile) return;
        setSavingAccount(true);
        try {
            const supabase = createClient();
            const { error } = await supabase
                .from("profiles")
                .update({ full_name: fullName.trim(), phone: phone.trim() || null, updated_at: new Date().toISOString() })
                .eq("id", profile.id);

            if (error) throw error;

            setProfile({ ...profile, full_name: fullName.trim(), phone: phone.trim() || null });
            toast.success("Account details updated.");
        } catch (error: any) {
            toast.error(error?.message || "Failed to update account details.");
        } finally {
            setSavingAccount(false);
        }
    };

    const handleChangePassword = async () => {
        if (newPassword.trim().length < 8) {
            toast.error("New password must be at least 8 characters.");
            return;
        }

        setChangingPassword(true);
        try {
            const supabase = createClient();
            const { error } = await supabase.auth.updateUser({ password: newPassword.trim() });
            if (error) throw error;
            setNewPassword("");
            toast.success("Password updated.");
        } catch (error: any) {
            toast.error(error?.message || "Failed to update password.");
        } finally {
            setChangingPassword(false);
        }
    };

    return (
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-4 md:px-6 lg:px-8">
            <header className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-industrial-blue)]/15 bg-[var(--color-industrial-blue)]/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--color-industrial-blue)]">
                    Settings
                </div>
                <div>
                    <h2 className="text-3xl font-semibold tracking-tight text-foreground">System controls</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                        Manage appearance, contact information, login security visibility, immutable audit trails, and your own admin account.
                    </p>
                </div>
            </header>

            <Tabs defaultValue="appearance" className="w-full">
                <TabsList className="grid w-full grid-cols-2 gap-2 sm:grid-cols-5">
                    <TabsTrigger value="appearance">Appearance</TabsTrigger>
                    <TabsTrigger value="contact">Contact Info</TabsTrigger>
                    <TabsTrigger value="security">Login Security</TabsTrigger>
                    <TabsTrigger value="audit">System Audits</TabsTrigger>
                    <TabsTrigger value="account">Admin Account</TabsTrigger>
                </TabsList>

                <TabsContent value="appearance" className="mt-6">
                    <Card className="border-border/70 shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Palette className="h-4 w-4" /> Appearance
                            </CardTitle>
                            <CardDescription>Choose how the admin interface should be presented.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-0">
                            <SettingRow icon={<Monitor className="h-4 w-4 text-muted-foreground" />} title="Theme" description="Select system, light, or dark mode for your admin workspace.">
                                <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
                                    {[
                                        { value: "system", icon: Monitor, label: "System" },
                                        { value: "light", icon: Sun, label: "Light" },
                                        { value: "dark", icon: Moon, label: "Dark" },
                                    ].map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => {
                                                setTheme(option.value as "system" | "light" | "dark");
                                                toast.success(`Theme set to ${option.label}.`);
                                            }}
                                            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${theme === option.value ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                                        >
                                            <option.icon className="h-3.5 w-3.5" /> {option.label}
                                        </button>
                                    ))}
                                </div>
                            </SettingRow>

                            <SettingRow icon={<Info className="h-4 w-4 text-muted-foreground" />} title="System information" description="Basic platform details for support and maintenance.">
                                <div className="grid gap-3 sm:grid-cols-3">
                                    {[
                                        { icon: <HardDrive className="h-4 w-4 text-blue-500" />, label: "Platform", value: "Next.js 16" },
                                        { icon: <Database className="h-4 w-4 text-emerald-500" />, label: "Database", value: "Supabase" },
                                        { icon: <Settings className="h-4 w-4 text-amber-500" />, label: "Version", value: "v1.0.0" },
                                    ].map((item) => (
                                        <div key={item.label} className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/30 px-3 py-3">
                                            {item.icon}
                                            <div>
                                                <p className="text-xs text-muted-foreground">{item.label}</p>
                                                <p className="text-sm font-semibold text-foreground">{item.value}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </SettingRow>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="contact" className="mt-6">
                    <Card className="border-border/70 shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Globe className="h-5 w-5 text-[var(--color-industrial-blue)]" /> Public contact information
                            </CardTitle>
                            <CardDescription>This data is synced to the client portal whenever it is saved.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Support email</Label>
                                    <Input value={contactInfo.email} onChange={(event) => setContactInfo({ ...contactInfo, email: event.target.value })} placeholder="support@obbo.com" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Support phone</Label>
                                    <Input value={contactInfo.phone} onChange={(event) => setContactInfo({ ...contactInfo, phone: event.target.value })} placeholder="+63 912 345 6789" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Physical address</Label>
                                <Input value={contactInfo.address} onChange={(event) => setContactInfo({ ...contactInfo, address: event.target.value })} placeholder="123 Industrial Ave" />
                            </div>
                            <div className="space-y-2">
                                <Label>Business hours</Label>
                                <Input value={contactInfo.businessHours} onChange={(event) => setContactInfo({ ...contactInfo, businessHours: event.target.value })} placeholder="Mon - Fri, 8:00 AM - 5:00 PM" />
                            </div>
                            <Button onClick={handleSaveContact} disabled={isSavingContact} className="bg-[var(--color-industrial-blue)] hover:bg-[var(--color-industrial-blue)]/90">
                                <Save className="mr-2 h-4 w-4" /> {isSavingContact ? "Saving..." : "Save contact info"}
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="security" className="mt-6">
                    <Card className="border-border/70 shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <ShieldAlert className="h-5 w-5 text-[var(--color-industrial-blue)]" /> Login security
                            </CardTitle>
                            <CardDescription>Recent auth-related and high-risk administrative events surfaced from the audit trail.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loadingLogs ? (
                                <div className="py-8 text-center text-sm text-muted-foreground">Loading security events...</div>
                            ) : securityEvents.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-border/70 py-10 text-center text-sm text-muted-foreground">
                                    No security events were recorded in the audit trail.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {securityEvents.slice(0, 10).map((entry) => (
                                        <div key={entry.id} className="flex items-start justify-between gap-4 rounded-xl border border-border/70 px-4 py-3">
                                            <div>
                                                <p className="text-sm font-medium text-foreground">{entry.action.replace(/_/g, " ")}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {entry.actor?.full_name || "System"} · {new Date(entry.created_at).toLocaleString()}
                                                </p>
                                            </div>
                                            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">Security</Badge>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="audit" className="mt-6">
                    <Card className="border-border/70 shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Activity className="h-5 w-5 text-[var(--color-industrial-blue)]" /> System audit log
                            </CardTitle>
                            <CardDescription>Immutable record of administrative actions taken in the system.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loadingLogs ? (
                                <div className="py-8 text-center text-sm text-muted-foreground">Loading audit logs...</div>
                            ) : (
                                <div className="overflow-x-auto rounded-xl border border-border/70">
                                    <Table>
                                        <TableHeader className="bg-muted/40">
                                            <TableRow>
                                                <TableHead className="w-[180px]">Timestamp</TableHead>
                                                <TableHead>Actor</TableHead>
                                                <TableHead>Action</TableHead>
                                                <TableHead>Entity</TableHead>
                                                <TableHead>Target ID</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {auditLogs.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No audit logs found.</TableCell>
                                                </TableRow>
                                            ) : (
                                                auditLogs.map((log) => (
                                                    <TableRow key={log.id}>
                                                        <TableCell className="font-mono text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</TableCell>
                                                        <TableCell className="text-sm font-medium">{log.actor?.full_name || "System"}</TableCell>
                                                        <TableCell className="text-sm"><code className="rounded bg-muted px-1.5 py-0.5 text-xs">{log.action}</code></TableCell>
                                                        <TableCell className="text-sm capitalize">{String(log.entity_type).replace(/_/g, " ")}</TableCell>
                                                        <TableCell className="font-mono text-xs text-muted-foreground" title={log.entity_id}>{String(log.entity_id).slice(0, 8)}...</TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="account" className="mt-6">
                    <Card className="border-border/70 shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <KeyRound className="h-5 w-5 text-[var(--color-industrial-blue)]" /> Admin account
                            </CardTitle>
                            <CardDescription>Update your display name, contact phone, and password.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            {profileLoading ? (
                                <div className="py-8 text-center text-sm text-muted-foreground">Loading account details...</div>
                            ) : profile ? (
                                <>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Full name</Label>
                                            <Input value={fullName} onChange={(event) => setFullName(event.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Phone</Label>
                                            <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+63 ..." />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email</Label>
                                        <Input value={profile.email} disabled className="bg-muted" />
                                        <p className="text-xs text-muted-foreground">Email changes are handled separately by the authentication provider.</p>
                                    </div>

                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="text-xs text-muted-foreground">
                                            Role: <span className="font-medium text-foreground capitalize">{profile.role.replace(/_/g, " ")}</span>
                                        </div>
                                        <Button onClick={handleSaveAccount} disabled={savingAccount} className="bg-[var(--color-industrial-blue)] hover:bg-[var(--color-industrial-blue)]/90">
                                            <Save className="mr-2 h-4 w-4" /> {savingAccount ? "Saving..." : "Save account details"}
                                        </Button>
                                    </div>

                                    <Separator />

                                    <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-4">
                                        <div>
                                            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                                <Lock className="h-4 w-4 text-[var(--color-industrial-blue)]" /> Change password
                                            </p>
                                            <p className="mt-1 text-xs text-muted-foreground">Enter a new password for your admin account.</p>
                                        </div>
                                        <div className="flex flex-col gap-3 sm:flex-row">
                                            <Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="New password" className="sm:max-w-xs" />
                                            <Button variant="outline" onClick={handleChangePassword} disabled={changingPassword}>
                                                {changingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />} Update password
                                            </Button>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="py-8 text-center text-sm text-muted-foreground">No profile loaded.</div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
