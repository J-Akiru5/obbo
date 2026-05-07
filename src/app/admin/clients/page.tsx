"use client";

import { useCallback, useEffect, useState, Suspense, type ComponentType } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
    AlertTriangle,
    Building2,
    CheckCircle2,
    ChevronRight,
    Eye,
    FileText,
    Loader2,
    Mail,
    MapPin,
    Phone,
    Plus,
    ShieldAlert,
    Users,
    UserCheck,
    XCircle,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { createManualClient } from "@/lib/actions/admin-actions";
import type { Profile } from "@/lib/types/database";

function getInitials(name: string) {
    return name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
}

function getAddressLine(profile: Profile) {
    return [profile.address_street, profile.address_city, profile.address_province, profile.address_postal_code]
        .filter(Boolean)
        .join(", ");
}

function KycBadge({ status }: { status: string }) {
    if (status === "verified") {
        return <Badge className="border-emerald-200 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Verified</Badge>;
    }
    if (status === "rejected") {
        return <Badge className="border-red-200 bg-red-100 text-red-800 hover:bg-red-100">Rejected</Badge>;
    }
    return <Badge className="border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-100">Pending</Badge>;
}

function SummaryCard({ title, value, description, icon: Icon }: { title: string; value: string; description: string; icon: ComponentType<{ className?: string }>; }) {
    return (
        <Card className="border-border/70 shadow-sm">
            <CardContent className="flex items-start justify-between gap-4 p-5">
                <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{title}</p>
                    <p className="text-3xl font-semibold tracking-tight text-foreground">{value}</p>
                    <p className="text-sm text-muted-foreground">{description}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/70">
                    <Icon className="h-5 w-5 text-[var(--color-industrial-blue)]" />
                </div>
            </CardContent>
        </Card>
    );
}

function KycDialog({
    profile,
    open,
    canManage,
    onClose,
    onAction,
}: {
    profile: Profile | null;
    open: boolean;
    canManage: boolean;
    onClose: () => void;
    onAction: (id: string, status: "verified" | "rejected", reason?: string) => Promise<void>;
}) {
    const [reason, setReason] = useState("");
    const [saving, setSaving] = useState(false);

    if (!profile) return null;

    const initials = getInitials(profile.full_name);

    async function handleApprove() {
        setSaving(true);
        try {
            await onAction(profile!.id, "verified");
            onClose();
        } finally {
            setSaving(false);
        }
    }

    async function handleReject() {
        if (!reason.trim()) {
            toast.error("A rejection reason is required.");
            return;
        }
        setSaving(true);
        try {
            await onAction(profile!.id, "rejected", reason.trim());
            onClose();
        } finally {
            setSaving(false);
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (!nextOpen) {
                    setReason("");
                    setSaving(false);
                    onClose();
                }
            }}
        >
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>KYC review - {profile.full_name}</DialogTitle>
                    <DialogDescription>Review uploaded documents, then approve or reject with a reason.</DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/30 p-4">
                        <Avatar className="h-12 w-12">
                            <AvatarFallback className="bg-[var(--color-industrial-blue)] text-sm font-bold text-white">{initials}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-foreground">{profile.full_name}</p>
                                <KycBadge status={profile.kyc_status} />
                            </div>
                            <p className="text-sm text-muted-foreground">{profile.email}</p>
                            <p className="text-xs text-muted-foreground">{profile.company_name || "Individual account"}</p>
                        </div>
                    </div>

                    <div className="grid gap-3 rounded-xl border border-border/70 p-4 sm:grid-cols-2">
                        <div className="space-y-1">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Phone</p>
                            <p className="text-sm text-foreground">{profile.phone || "-"}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Business permit</p>
                            <p className="text-sm text-foreground">{profile.business_permit_no || "-"}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">TIN</p>
                            <p className="text-sm text-foreground">{profile.tin_no || "-"}</p>
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Delivery address</p>
                            <p className="text-sm text-foreground">{getAddressLine(profile) || "-"}</p>
                        </div>
                    </div>

                    <div>
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-foreground">Submitted documents</p>
                            <Badge variant="outline" className="text-xs">{profile.kyc_documents?.length || 0} files</Badge>
                        </div>
                        {profile.kyc_documents && profile.kyc_documents.length > 0 ? (
                            <div className="space-y-2">
                                {profile.kyc_documents.map((doc, index) => (
                                    <div key={`${doc}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-card px-3 py-2">
                                        <div className="flex min-w-0 items-center gap-2">
                                            <FileText className="h-4 w-4 text-[var(--color-industrial-blue)]" />
                                            <span className="truncate text-sm text-foreground">{doc.split("/").pop()}</span>
                                        </div>
                                        <a
                                            href={`/api/admin/kyc-document?path=${encodeURIComponent(doc)}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-xs font-medium text-[var(--color-industrial-blue)] hover:underline"
                                        >
                                            View
                                        </a>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-lg border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
                                No documents submitted.
                            </div>
                        )}
                    </div>

                    {canManage ? (
                        <div className="space-y-2">
                            <Label htmlFor="rejection-reason">Rejection reason</Label>
                            <Textarea
                                id="rejection-reason"
                                value={reason}
                                onChange={(event) => setReason(event.target.value)}
                                placeholder="Explain why the application was rejected"
                                className="min-h-24"
                            />
                        </div>
                    ) : (
                        <div className="rounded-xl border border-border/70 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                            Read-only review mode.
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={onClose}>Close</Button>
                    {canManage && (
                        <>
                            <Button variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" onClick={handleReject} disabled={saving}>
                                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />} Reject
                            </Button>
                            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleApprove} disabled={saving}>
                                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />} Approve
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function ManualClientDialog({
    open,
    onClose,
    onCreated,
}: {
    open: boolean;
    onClose: () => void;
    onCreated: () => void;
}) {
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        fullName: "",
        email: "",
        password: "",
        phone: "",
        companyName: "",
        accountType: "individual" as "individual" | "company",
        addressStreet: "",
        addressCity: "",
        addressProvince: "",
        addressPostalCode: "",
        businessPermitNo: "",
        tinNo: "",
    });

    async function handleCreate() {
        if (!form.fullName.trim() || !form.email.trim() || !form.password.trim()) {
            toast.error("Full name, email, and temporary password are required.");
            return;
        }
        if (form.password.trim().length < 6) {
            toast.error("Temporary password must be at least 6 characters.");
            return;
        }

        setSaving(true);
        try {
            await createManualClient({
                fullName: form.fullName.trim(),
                email: form.email.trim(),
                password: form.password.trim(),
                phone: form.phone.trim() || undefined,
                companyName: form.companyName.trim() || undefined,
                accountType: form.accountType,
                addressStreet: form.addressStreet.trim() || undefined,
                addressCity: form.addressCity.trim() || undefined,
                addressProvince: form.addressProvince.trim() || undefined,
                addressPostalCode: form.addressPostalCode.trim() || undefined,
                businessPermitNo: form.accountType === "company" && form.businessPermitNo.trim() ? form.businessPermitNo.trim() : undefined,
                tinNo: form.tinNo.trim() || undefined,
            });
            toast.success("Client created.");
            onCreated();
            onClose();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Failed to create client.";
            toast.error(message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (!nextOpen) {
                    setSaving(false);
                    setForm({
                        fullName: "",
                        email: "",
                        password: "",
                        phone: "",
                        companyName: "",
                        accountType: "individual",
                        addressStreet: "",
                        addressCity: "",
                        addressProvince: "",
                        addressPostalCode: "",
                        businessPermitNo: "",
                        tinNo: "",
                    });
                    onClose();
                }
            }}
        >
            <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Add manual client</DialogTitle>
                    <DialogDescription>Create a verified client record without the standard KYC flow.</DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                        <Label>Account type</Label>
                        <div className="grid grid-cols-2 gap-2">
                            <Button type="button" variant={form.accountType === "individual" ? "default" : "outline"} onClick={() => setForm((prev) => ({ ...prev, accountType: "individual" }))}>
                                Individual
                            </Button>
                            <Button type="button" variant={form.accountType === "company" ? "default" : "outline"} onClick={() => setForm((prev) => ({ ...prev, accountType: "company" }))}>
                                Company
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Full name</Label>
                        <Input value={form.fullName} onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                        <Label>Email</Label>
                        <Input type="email" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                        <Label>Temporary password</Label>
                        <Input type="password" value={form.password} onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                        <Label>Phone</Label>
                        <Input value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                        <Label>Company name</Label>
                        <Input value={form.companyName} onChange={(event) => setForm((prev) => ({ ...prev, companyName: event.target.value }))} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                        <Label>Street address</Label>
                        <Input value={form.addressStreet} onChange={(event) => setForm((prev) => ({ ...prev, addressStreet: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                        <Label>Municipality</Label>
                        <Input value={form.addressCity} onChange={(event) => setForm((prev) => ({ ...prev, addressCity: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                        <Label>Province</Label>
                        <Input value={form.addressProvince} onChange={(event) => setForm((prev) => ({ ...prev, addressProvince: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                        <Label>Postal code</Label>
                        <Input value={form.addressPostalCode} onChange={(event) => setForm((prev) => ({ ...prev, addressPostalCode: event.target.value }))} />
                    </div>
                    {form.accountType === "company" && (
                        <div className="space-y-2">
                            <Label>Business permit no.</Label>
                            <Input value={form.businessPermitNo} onChange={(event) => setForm((prev) => ({ ...prev, businessPermitNo: event.target.value }))} />
                        </div>
                    )}
                    <div className="space-y-2 md:col-span-2">
                        <Label>TIN no.</Label>
                        <Input value={form.tinNo} onChange={(event) => setForm((prev) => ({ ...prev, tinNo: event.target.value }))} />
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleCreate} disabled={saving} className="bg-[var(--color-industrial-blue)] hover:bg-[var(--color-industrial-blue)]/90">
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Create client
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function ClientDetailDialog({
    profile,
    open,
    onClose,
}: {
    profile: Profile | null;
    open: boolean;
    onClose: () => void;
}) {
    const [orders, setOrders] = useState<Array<{ id: string; total_amount: number; status: string; created_at: string }>>([]);
    const [balances, setBalances] = useState<Array<{ id: string; remaining_qty: number; bag_type: string; status: string; product?: { name: string } }>>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!profile || !open) return;

        const load = async () => {
            setLoading(true);
            const supabase = createClient();
            const [ordersResult, balancesResult] = await Promise.all([
                supabase.from("orders").select("id,total_amount,status,created_at").eq("client_id", profile.id).order("created_at", { ascending: false }),
                supabase.from("customer_balances").select("id,remaining_qty,bag_type,status,product:products(name)").eq("client_id", profile.id).eq("status", "pending"),
            ]);
            setOrders(ordersResult.data ?? []);
            setBalances((balancesResult.data as unknown as typeof balances) ?? []);
            setLoading(false);
        };

        void load();
    }, [profile, open]);

    if (!profile) return null;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Client profile</DialogTitle>
                    <DialogDescription>Full client record, current balances, and a compact order history summary.</DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/30 p-4">
                        <Avatar className="h-12 w-12">
                            <AvatarFallback className="bg-[var(--color-industrial-blue)] text-sm font-bold text-white">{getInitials(profile.full_name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-foreground">{profile.full_name}</p>
                                <KycBadge status={profile.kyc_status} />
                            </div>
                            <p className="text-sm text-muted-foreground">{profile.company_name || "Individual account"}</p>
                            <p className="text-xs text-muted-foreground">{profile.email}</p>
                        </div>
                    </div>

                    <div className="grid gap-3 rounded-xl border border-border/70 p-4 sm:grid-cols-2">
                        <div className="flex items-start gap-2">
                            <Phone className="mt-0.5 h-4 w-4 text-muted-foreground" />
                            <div>
                                <p className="text-xs text-muted-foreground">Phone</p>
                                <p className="text-sm font-medium">{profile.phone || "-"}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-2">
                            <Mail className="mt-0.5 h-4 w-4 text-muted-foreground" />
                            <div>
                                <p className="text-xs text-muted-foreground">Email</p>
                                <p className="text-sm font-medium">{profile.email}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-2">
                            <Building2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                            <div>
                                <p className="text-xs text-muted-foreground">Business permit</p>
                                <p className="text-sm font-medium">{profile.business_permit_no || "-"}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-2">
                            <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                            <div>
                                <p className="text-xs text-muted-foreground">Delivery address</p>
                                <p className="text-sm font-medium">{getAddressLine(profile) || "-"}</p>
                            </div>
                        </div>
                    </div>

                    {balances.length > 0 && (
                        <div>
                            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                                <ShieldAlert className="h-4 w-4 text-amber-500" /> Outstanding balances
                            </p>
                            <div className="space-y-2">
                                {balances.map((balance) => (
                                    <div key={balance.id} className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
                                        <div>
                                            <p className="font-medium text-amber-950">{balance.product?.name ?? "Product"}</p>
                                            <p className="text-xs text-amber-800">{balance.remaining_qty} {balance.bag_type} remaining</p>
                                        </div>
                                        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">{balance.status}</Badge>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div>
                        <div className="mb-2 flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-foreground">Order history summary</p>
                            <Badge variant="outline" className="text-xs">{orders.length} orders</Badge>
                        </div>
                        {loading ? (
                            <div className="rounded-lg border border-dashed border-border/70 py-8 text-center text-sm text-muted-foreground">Loading history...</div>
                        ) : orders.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-border/70 py-8 text-center text-sm text-muted-foreground">No orders yet.</div>
                        ) : (
                            <div className="space-y-2">
                                {orders.slice(0, 5).map((order) => (
                                    <div key={order.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2">
                                        <div>
                                            <p className="text-sm font-medium">#{order.id.slice(0, 8).toUpperCase()}</p>
                                            <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString()}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-xs capitalize">{order.status.replace(/_/g, " ")}</Badge>
                                            <span className="text-sm font-semibold text-[var(--color-industrial-blue)]">₱{Number(order.total_amount).toLocaleString()}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function ClientsContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const activeTab = searchParams.get("tab") || "kyc";
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
    const [kycTarget, setKycTarget] = useState<Profile | null>(null);
    const [kycOpen, setKycOpen] = useState(false);
    const [detailTarget, setDetailTarget] = useState<Profile | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [manualOpen, setManualOpen] = useState(false);

    const fetchProfiles = useCallback(async () => {
        const supabase = createClient();
        try {
            const { data, error } = await supabase.from("profiles").select("*").eq("role", "client").order("created_at", { ascending: false });
            if (error) throw error;
            setProfiles(data ?? []);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to load clients.";
            toast.error(message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchProfiles();
    }, [fetchProfiles]);

    useEffect(() => {
        const loadCurrentRole = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
            setCurrentUserRole(data?.role ?? null);
        };

        void loadCurrentRole();
    }, []);

    const handleTabChange = (val: string) => {
        router.push(`${pathname}?tab=${val}`);
    };

    async function handleKycAction(id: string, status: "verified" | "rejected", reason?: string) {
        if (status === "rejected" && !reason?.trim()) {
            toast.error("A rejection reason is required.");
            return;
        }

        const supabase = createClient();
        const { error } = await supabase.from("profiles").update({ kyc_status: status, updated_at: new Date().toISOString() }).eq("id", id);
        if (error) {
            toast.error("Failed to update status.");
            return;
        }

        if (status === "verified") {
            await supabase.from("activity_log").insert({ actor_id: id, action: "kyc_approved", entity_type: "profile", entity_id: id, metadata: {} });
            toast.success("Client verified.");
        } else {
            await supabase.from("activity_log").insert({ actor_id: id, action: "kyc_rejected", entity_type: "profile", entity_id: id, metadata: { reason } });
            toast.error("Client rejected.");
        }

        setProfiles((previous) => previous.map((profile) => (profile.id === id ? { ...profile, kyc_status: status } : profile)));
    }

    const pending = profiles.filter((profile) => profile.kyc_status === "pending_verification");
    const verified = profiles.filter((profile) => profile.kyc_status === "verified");
    const rejected = profiles.filter((profile) => profile.kyc_status === "rejected");
    const canManageClients = currentUserRole === "admin";

    return (
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-4 md:px-6 lg:px-8">
            <header className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card p-5 shadow-sm lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-industrial-blue)]/15 bg-[var(--color-industrial-blue)]/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--color-industrial-blue)]">
                        Clients
                    </div>
                    <div>
                        <h2 className="text-3xl font-semibold tracking-tight text-foreground">Verification hub and directory</h2>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                            Admins can approve or reject KYC, add walk-in clients manually, and review verified customer details.
                        </p>
                    </div>
                </div>
                {canManageClients && (
                    <Button onClick={() => setManualOpen(true)} className="bg-[var(--color-industrial-blue)] hover:bg-[var(--color-industrial-blue)]/90">
                        <Plus className="mr-2 h-4 w-4" /> Add customer
                    </Button>
                )}
            </header>

            <section className="grid gap-4 md:grid-cols-3">
                <SummaryCard title="Total clients" value={profiles.length.toString()} description="All client profiles in the system." icon={Users} />
                <SummaryCard title="Pending KYC" value={pending.length.toString()} description="New registrations waiting for review." icon={ShieldAlert} />
                <SummaryCard title="Verified clients" value={verified.length.toString()} description="Clients ready for portal use." icon={UserCheck} />
            </section>

            <Card className="border-border/70 shadow-sm">
                <CardContent className="p-5">
                    {loading ? (
                        <div className="py-16 text-center text-sm text-muted-foreground">Loading clients...</div>
                    ) : (
                        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                            <TabsList className="grid w-full grid-cols-2 sm:w-auto">
                                <TabsTrigger value="kyc" className="gap-2">
                                    Verification Hub
                                    {pending.length > 0 && <span className="rounded-full bg-[var(--color-industrial-yellow)] px-2 py-0.5 text-[10px] font-bold text-white">{pending.length}</span>}
                                </TabsTrigger>
                                <TabsTrigger value="directory">Client Directory</TabsTrigger>
                            </TabsList>

                            <TabsContent value="kyc" className="mt-6 space-y-3">
                                {pending.length === 0 ? (
                                    <Card className="border-border/70 shadow-sm">
                                        <CardContent className="py-16 text-center text-muted-foreground">
                                            <UserCheck className="mx-auto mb-3 h-10 w-10 opacity-30" />
                                            <p className="text-sm font-medium">All clients have been verified.</p>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    <div className="space-y-3">
                                        {pending.map((profile) => (
                                            <Card key={profile.id} className="border-amber-200 bg-amber-50/40 shadow-sm">
                                                <CardContent className="p-4">
                                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                                                        <Avatar className="h-10 w-10 flex-shrink-0">
                                                            <AvatarFallback className="bg-amber-200 text-xs font-bold text-amber-900">{getInitials(profile.full_name)}</AvatarFallback>
                                                        </Avatar>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <p className="font-semibold text-foreground">{profile.full_name}</p>
                                                                <KycBadge status={profile.kyc_status} />
                                                            </div>
                                                            <p className="text-xs text-muted-foreground">{profile.email} · {profile.company_name || "Individual"}</p>
                                                            <p className="text-xs text-muted-foreground">{profile.kyc_documents?.length || 0} document(s) · Registered {new Date(profile.created_at).toLocaleDateString()}</p>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => { setKycTarget(profile); setKycOpen(true); }}>
                                                                <Eye className="h-3.5 w-3.5" /> Review
                                                            </Button>
                                                            {canManageClients && (
                                                                <Button size="sm" className="h-8 gap-1 bg-emerald-600 text-xs hover:bg-emerald-700" onClick={() => handleKycAction(profile.id, "verified")}>
                                                                    <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="directory" className="mt-6 space-y-3">
                                {verified.length === 0 ? (
                                    <Card className="border-border/70 shadow-sm">
                                        <CardContent className="py-16 text-center text-muted-foreground">
                                            <Users className="mx-auto mb-3 h-10 w-10 opacity-30" />
                                            <p className="text-sm font-medium">No verified clients yet.</p>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    <div className="grid gap-3 lg:grid-cols-2">
                                        {verified.map((profile) => (
                                            <Card key={profile.id} className="cursor-pointer border-border/70 shadow-sm transition-colors hover:border-[var(--color-industrial-blue)]/35 hover:bg-[var(--color-industrial-blue)]/5" onClick={() => { setDetailTarget(profile); setDetailOpen(true); }}>
                                                <CardContent className="p-4">
                                                    <div className="flex items-start gap-3">
                                                        <Avatar className="h-10 w-10 flex-shrink-0">
                                                            <AvatarFallback className="bg-[var(--color-industrial-blue)] text-xs font-bold text-white">{getInitials(profile.full_name)}</AvatarFallback>
                                                        </Avatar>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <p className="font-semibold text-foreground">{profile.full_name}</p>
                                                                <KycBadge status={profile.kyc_status} />
                                                            </div>
                                                            <p className="text-xs text-muted-foreground">{profile.email} · {profile.company_name || "Individual"}</p>
                                                            <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                                                                <Phone className="h-3.5 w-3.5" /> {profile.phone || "No phone"}
                                                            </p>
                                                        </div>
                                                        <ChevronRight className="mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    )}
                </CardContent>
            </Card>

            {rejected.length > 0 && (
                <Card className="border-border/70 shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <AlertTriangle className="h-4 w-4 text-red-500" /> Rejected registrations
                        </CardTitle>
                        <CardDescription>Blocked profiles remain visible for audit and support tracing.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {rejected.map((profile) => (
                            <div key={profile.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2 text-sm">
                                <div>
                                    <p className="font-medium text-foreground">{profile.full_name}</p>
                                    <p className="text-xs text-muted-foreground">{profile.email}</p>
                                </div>
                                <KycBadge status={profile.kyc_status} />
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            <KycDialog
                profile={kycTarget}
                open={kycOpen}
                canManage={canManageClients}
                onClose={() => setKycOpen(false)}
                onAction={handleKycAction}
            />
            <ClientDetailDialog profile={detailTarget} open={detailOpen} onClose={() => setDetailOpen(false)} />
            <ManualClientDialog open={manualOpen} onClose={() => setManualOpen(false)} onCreated={fetchProfiles} />
        </div>
    );
}

export default function AdminClientsPage() {
    return (
        <Suspense fallback={<div className="py-8 text-center text-muted-foreground animate-pulse">Loading clients...</div>}>
            <ClientsContent />
        </Suspense>
    );
}
