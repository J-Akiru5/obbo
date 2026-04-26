"use client";

import { useState } from "react";
import {
    Settings, Bell, BellOff, Globe, Palette, Monitor, Moon, Sun,
    Shield, Database, HardDrive, Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

function SettingRow({
    icon,
    title,
    description,
    children,
}: {
    icon: React.ReactNode;
    title: string;
    description: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4 first:pt-0 last:pb-0">
            <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                    {icon}
                </div>
                <div>
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 max-w-sm">{description}</p>
                </div>
            </div>
            <div className="flex-shrink-0 ml-12 sm:ml-0">{children}</div>
        </div>
    );
}

function ToggleButton({ active, onChange, labelOn = "On", labelOff = "Off" }: {
    active: boolean; onChange: (v: boolean) => void; labelOn?: string; labelOff?: string;
}) {
    return (
        <button
            type="button"
            onClick={() => onChange(!active)}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 ${active ? "bg-[var(--color-industrial-blue)]" : "bg-gray-300"}`}
        >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${active ? "translate-x-6" : "translate-x-1"}`} />
            <span className="sr-only">{active ? labelOn : labelOff}</span>
        </button>
    );
}

export default function AdminSettingsPage() {
    const [emailNotifs, setEmailNotifs] = useState(true);
    const [orderAlerts, setOrderAlerts] = useState(true);
    const [kycAlerts, setKycAlerts] = useState(true);
    const [theme, setTheme] = useState<"system" | "light" | "dark">("system");

    const themeOptions = [
        { value: "system", icon: Monitor, label: "System" },
        { value: "light", icon: Sun, label: "Light" },
        { value: "dark", icon: Moon, label: "Dark" },
    ] as const;

    return (
        <div className="max-w-2xl mx-auto space-y-6 py-2">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
                <p className="text-muted-foreground mt-1">Configure your admin portal preferences.</p>
            </div>

            {/* Notifications */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Bell className="w-4 h-4" /> Notifications
                    </CardTitle>
                    <CardDescription className="text-xs">Control how you receive alerts and updates.</CardDescription>
                </CardHeader>
                <CardContent className="divide-y">
                    <SettingRow
                        icon={<Bell className="w-4 h-4 text-muted-foreground" />}
                        title="Email Notifications"
                        description="Receive important updates via email."
                    >
                        <ToggleButton active={emailNotifs} onChange={(v) => { setEmailNotifs(v); toast.success(v ? "Email notifications enabled." : "Email notifications disabled."); }} />
                    </SettingRow>

                    <SettingRow
                        icon={<Globe className="w-4 h-4 text-muted-foreground" />}
                        title="New Order Alerts"
                        description="Get notified when a client places a new order."
                    >
                        <ToggleButton active={orderAlerts} onChange={(v) => { setOrderAlerts(v); toast.success(v ? "Order alerts enabled." : "Order alerts disabled."); }} />
                    </SettingRow>

                    <SettingRow
                        icon={<Shield className="w-4 h-4 text-muted-foreground" />}
                        title="KYC Review Alerts"
                        description="Get notified when a new client is pending verification."
                    >
                        <ToggleButton active={kycAlerts} onChange={(v) => { setKycAlerts(v); toast.success(v ? "KYC alerts enabled." : "KYC alerts disabled."); }} />
                    </SettingRow>
                </CardContent>
            </Card>

            {/* Appearance */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Palette className="w-4 h-4" /> Appearance
                    </CardTitle>
                    <CardDescription className="text-xs">Customize the visual experience.</CardDescription>
                </CardHeader>
                <CardContent>
                    <SettingRow
                        icon={<Monitor className="w-4 h-4 text-muted-foreground" />}
                        title="Theme"
                        description="Choose how the admin portal looks."
                    >
                        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                            {themeOptions.map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => { setTheme(opt.value); toast.success(`Theme set to ${opt.label}.`); }}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                        theme === opt.value
                                            ? "bg-white text-foreground shadow-sm"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    <opt.icon className="w-3.5 h-3.5" />
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </SettingRow>
                </CardContent>
            </Card>

            {/* System Info */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Info className="w-4 h-4" /> System Information
                    </CardTitle>
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

            {/* Danger Zone */}
            <Card className="border-red-200">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base text-destructive flex items-center gap-2">
                        <Shield className="w-4 h-4" /> Danger Zone
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div>
                            <p className="text-sm font-medium text-red-900">Clear Activity Log</p>
                            <p className="text-xs text-red-700">Permanently remove all activity history. This cannot be undone.</p>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-xs text-destructive border-destructive hover:bg-destructive/10"
                            onClick={() => toast.error("This action is disabled in the current version.")}
                        >
                            Clear Log
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
