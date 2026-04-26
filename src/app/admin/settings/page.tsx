"use client";

import { useState, useEffect } from "react";
import {
    Settings, Bell, Globe, Palette, Monitor, Moon, Sun,
    Shield, Database, HardDrive, Info, Activity, Save
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { fetchAuditLog, getAdminSetting, saveAdminSetting } from "@/lib/actions/admin-actions";

function SettingRow({ icon, title, description, children }: { icon: React.ReactNode; title: string; description: string; children: React.ReactNode; }) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4 first:pt-0 last:pb-0">
            <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">{icon}</div>
                <div>
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 max-w-sm">{description}</p>
                </div>
            </div>
            <div className="flex-shrink-0 ml-12 sm:ml-0">{children}</div>
        </div>
    );
}

function ToggleButton({ active, onChange }: { active: boolean; onChange: (v: boolean) => void; }) {
    return (
        <button type="button" onClick={() => onChange(!active)} className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 ${active ? "bg-[var(--color-industrial-blue)]" : "bg-gray-300"}`}>
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${active ? "translate-x-6" : "translate-x-1"}`} />
        </button>
    );
}

export default function AdminSettingsPage() {
    const [theme, setTheme] = useState<"system" | "light" | "dark">("system");
    
    // Contact Info State
    const [contactInfo, setContactInfo] = useState({ email: "", phone: "", address: "", businessHours: "" });
    const [isSavingContact, setIsSavingContact] = useState(false);

    // Audit Log State
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(true);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const info = await getAdminSetting("contact_info");
                if (info) setContactInfo(info as any);
                
                const { entries } = await fetchAuditLog(1, 50);
                setAuditLogs(entries);
            } catch (e) {
                console.error("Failed to load settings data", e);
            } finally {
                setLoadingLogs(false);
            }
        };
        loadSettings();
    }, []);

    const handleSaveContact = async () => {
        setIsSavingContact(true);
        try {
            await saveAdminSetting("contact_info", contactInfo);
            toast.success("Contact info saved. This will reflect on the client portal.");
        } catch (e) {
            toast.error("Failed to save contact info.");
        } finally {
            setIsSavingContact(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 py-2">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Settings & Audits</h2>
                <p className="text-muted-foreground mt-1">Configure portal preferences and review system activity.</p>
            </div>

            <Tabs defaultValue="general" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="general">General</TabsTrigger>
                    <TabsTrigger value="contact">Public Contact Info</TabsTrigger>
                    <TabsTrigger value="audit">System Audits</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="space-y-6 mt-6">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2"><Palette className="w-4 h-4" /> Appearance</CardTitle>
                            <CardDescription className="text-xs">Customize the visual experience.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <SettingRow icon={<Monitor className="w-4 h-4 text-muted-foreground" />} title="Theme" description="Choose how the admin portal looks.">
                                <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                                    {[{ value: "system", icon: Monitor, label: "System" }, { value: "light", icon: Sun, label: "Light" }, { value: "dark", icon: Moon, label: "Dark" }].map((opt) => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => { setTheme(opt.value as any); toast.success(`Theme set to ${opt.label}.`); }}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${theme === opt.value ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                                        >
                                            <opt.icon className="w-3.5 h-3.5" /> {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </SettingRow>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2"><Info className="w-4 h-4" /> System Information</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {[
                                    { icon: <HardDrive className="w-4 h-4 text-blue-500" />, label: "Platform", value: "Next.js 16" },
                                    { icon: <Database className="w-4 h-4 text-emerald-500" />, label: "Database", value: "Supabase" },
                                    { icon: <Settings className="w-4 h-4 text-amber-500" />, label: "Version", value: "v1.0.0" },
                                ].map((item) => (
                                    <div key={item.label} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                                        {item.icon}
                                        <div>
                                            <p className="text-xs text-muted-foreground">{item.label}</p>
                                            <p className="text-sm font-semibold">{item.value}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="contact" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Globe className="w-5 h-5 text-[var(--color-industrial-blue)]" /> Public Contact Information</CardTitle>
                            <CardDescription>This information will be displayed to clients on the portal.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Support Email</Label>
                                    <Input value={contactInfo.email} onChange={e => setContactInfo({...contactInfo, email: e.target.value})} placeholder="support@obbo.com" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Support Phone</Label>
                                    <Input value={contactInfo.phone} onChange={e => setContactInfo({...contactInfo, phone: e.target.value})} placeholder="+63 912 345 6789" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Physical Address</Label>
                                <Input value={contactInfo.address} onChange={e => setContactInfo({...contactInfo, address: e.target.value})} placeholder="123 Industrial Ave..." />
                            </div>
                            <div className="space-y-2">
                                <Label>Business Hours</Label>
                                <Input value={contactInfo.businessHours} onChange={e => setContactInfo({...contactInfo, businessHours: e.target.value})} placeholder="Mon - Fri, 8:00 AM - 5:00 PM" />
                            </div>
                            <Button onClick={handleSaveContact} disabled={isSavingContact} className="w-full mt-4 bg-[var(--color-industrial-blue)]">
                                <Save className="w-4 h-4 mr-2" /> {isSavingContact ? "Saving..." : "Save Contact Info"}
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="audit" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Activity className="w-5 h-5 text-[var(--color-industrial-blue)]" /> System Audit Log</CardTitle>
                            <CardDescription>Immutable record of all administrative actions taken in the system.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loadingLogs ? (
                                <div className="text-center py-8 text-muted-foreground animate-pulse">Loading audit logs...</div>
                            ) : (
                                <div className="border rounded-lg overflow-hidden max-h-[600px] overflow-y-auto">
                                    <Table>
                                        <TableHeader className="bg-muted/50 sticky top-0 z-10">
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
                                                <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No audit logs found.</TableCell></TableRow>
                                            ) : auditLogs.map((log) => (
                                                <TableRow key={log.id}>
                                                    <TableCell className="text-xs text-muted-foreground font-mono">{new Date(log.created_at).toLocaleString()}</TableCell>
                                                    <TableCell className="text-sm font-medium">{log.actor?.full_name || "System"}</TableCell>
                                                    <TableCell className="text-sm"><code className="bg-muted px-1.5 py-0.5 rounded text-xs">{log.action}</code></TableCell>
                                                    <TableCell className="text-sm capitalize">{log.entity_type.replace('_', ' ')}</TableCell>
                                                    <TableCell className="text-xs font-mono text-muted-foreground" title={log.entity_id}>{log.entity_id.slice(0, 8)}...</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
