"use client";

import { useEffect, useState, useCallback } from "react";
import {
    UserCheck, Eye, Building2, Phone, Mail,
    CheckCircle2, XCircle, Users, Loader2, ShieldAlert, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types/database";
import { updateCustomerBalance } from "@/lib/actions/admin-actions";
import { Input } from "@/components/ui/input";

function KycBadge({ status }: { status: string }) {
    if (status === "verified") return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100">Verified</Badge>;
    if (status === "rejected") return <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100">Rejected</Badge>;
    return <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100">Pending</Badge>;
}

function getInitials(name: string) {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function KycDialog({
    profile, open, onClose, onAction,
}: {
    profile: Profile | null; open: boolean;
    onClose: () => void;
    onAction: (id: string, status: "verified" | "rejected") => Promise<void>;
}) {
    const [acting, setActing] = useState(false);
    if (!profile) return null;
    const initials = getInitials(profile.full_name);

    async function handle(status: "verified" | "rejected") {
        setActing(true);
        await onAction(profile!.id, status);
        setActing(false);
        onClose();
    }

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>KYC Review — {profile.full_name}</DialogTitle></DialogHeader>
                <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <Avatar className="w-12 h-12"><AvatarFallback className="text-sm font-bold bg-[var(--color-industrial-blue)] text-white">{initials}</AvatarFallback></Avatar>
                        <div><p className="font-bold">{profile.full_name}</p><p className="text-sm text-muted-foreground">{profile.email}</p></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex items-start gap-2"><Building2 className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" /><div><p className="text-muted-foreground text-xs">Company</p><p className="font-medium">{profile.company_name || "Individual"}</p></div></div>
                        <div className="flex items-start gap-2"><Phone className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" /><div><p className="text-muted-foreground text-xs">Phone</p><p className="font-medium">{profile.phone || "—"}</p></div></div>
                        <div className="flex items-start gap-2 col-span-2"><Mail className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" /><div><p className="text-muted-foreground text-xs">Email</p><p className="font-medium">{profile.email}</p></div></div>
                    </div>
                    <Separator />
                    <div>
                        <p className="text-sm font-semibold mb-2">Submitted Documents</p>
                        {profile.kyc_documents && profile.kyc_documents.length > 0 ? (
                            <div className="space-y-2">
                                {profile.kyc_documents.map((doc, i) => (
                                    <div key={i} className="flex items-center justify-between p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                                        <span className="font-medium truncate">{doc.split("/").pop()}</span>
                                        <a href={`/api/admin/kyc-document?path=${encodeURIComponent(doc)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 h-6 text-xs text-blue-600 hover:text-blue-800 px-2 ml-2 flex-shrink-0 rounded hover:bg-blue-100 transition-colors">
                                            <Eye className="w-3 h-3" /> View
                                        </a>
                                    </div>
                                ))}
                            </div>
                        ) : <p className="text-sm text-muted-foreground">No documents submitted.</p>}
                    </div>
                    <p className="text-xs text-muted-foreground">Registered: {new Date(profile.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}</p>
                </div>
                <DialogFooter className="gap-2">
                    <Button variant="outline" className="text-destructive border-destructive hover:bg-destructive/10" onClick={() => handle("rejected")} disabled={acting}>
                        {acting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <XCircle className="w-4 h-4 mr-1" />} Reject
                    </Button>
                    <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handle("verified")} disabled={acting}>
                        {acting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />} Approve
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function ClientDetailDialog({ profile, open, onClose }: { profile: Profile | null; open: boolean; onClose: () => void }) {
    const [orders, setOrders] = useState<Array<{ id: string; total_amount: number; status: string; created_at: string }>>([]);
    const [balances, setBalances] = useState<Array<{ id: string; remaining_qty: number; bag_type: string; status: string; product?: { name: string } }>>([]);
    const [editingBalanceId, setEditingBalanceId] = useState<string | null>(null);
    const [editQty, setEditQty] = useState<number>(0);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!profile || !open) return;
        const supabase = createClient();
        supabase.from("orders").select("id,total_amount,status,created_at").eq("client_id", profile.id).order("created_at", { ascending: false }).then(({ data }) => setOrders(data ?? []));
        supabase.from("customer_balances").select("id,remaining_qty,bag_type,status,product:products(name)").eq("client_id", profile.id).eq("status", "pending").then(({ data }) => setBalances((data as unknown as typeof balances) ?? []));
    }, [profile, open]);

    const handleSaveBalance = async (id: string) => {
        setIsSaving(true);
        try {
            // If qty is 0, we can mark it completed
            const newStatus = editQty <= 0 ? "completed" : "pending";
            const finalQty = Math.max(0, editQty);
            await updateCustomerBalance(id, finalQty, newStatus);
            toast.success("Balance updated");
            setBalances(prev => prev.map(b => b.id === id ? { ...b, remaining_qty: finalQty, status: newStatus } : b).filter(b => b.status === "pending"));
            setEditingBalanceId(null);
        } catch (e: any) {
            toast.error("Failed to update balance");
        } finally {
            setIsSaving(false);
        }
    };

    if (!profile) return null;
    const initials = getInitials(profile.full_name);
    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Client Profile</DialogTitle></DialogHeader>
                <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <Avatar className="w-12 h-12"><AvatarFallback className="text-sm font-bold bg-[var(--color-industrial-blue)] text-white">{initials}</AvatarFallback></Avatar>
                        <div><p className="font-bold">{profile.full_name}</p><p className="text-sm text-muted-foreground">{profile.company_name || "Individual"}</p><p className="text-xs text-muted-foreground">{profile.email}</p></div>
                    </div>
                    {balances.length > 0 && (
                        <div>
                            <p className="text-sm font-semibold mb-2 flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-amber-500" />Outstanding Balances</p>
                            {balances.map((b) => (
                                <div key={b.id} className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900 mb-2 flex items-center justify-between">
                                    <div>
                                        <p className="font-medium">{b.product?.name ?? "Product"}</p>
                                        {editingBalanceId === b.id ? (
                                            <div className="flex items-center gap-2 mt-1">
                                                <Input type="number" min="0" value={editQty} onChange={(e) => setEditQty(parseInt(e.target.value) || 0)} className="h-7 w-20 text-xs bg-white" />
                                                <span className="text-xs">{b.bag_type}</span>
                                            </div>
                                        ) : (
                                            <p className="text-xs text-amber-700">{b.remaining_qty} {b.bag_type} remaining</p>
                                        )}
                                    </div>
                                    <div>
                                        {editingBalanceId === b.id ? (
                                            <div className="flex gap-1">
                                                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditingBalanceId(null)} disabled={isSaving}>Cancel</Button>
                                                <Button size="sm" className="h-7 px-2 text-xs bg-amber-600 hover:bg-amber-700 text-white" onClick={() => handleSaveBalance(b.id)} disabled={isSaving}>Save</Button>
                                            </div>
                                        ) : (
                                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs border-amber-300 text-amber-800 hover:bg-amber-100" onClick={() => { setEditingBalanceId(b.id); setEditQty(b.remaining_qty); }}>Edit</Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <div>
                        <p className="text-sm font-semibold mb-2">Order History ({orders.length})</p>
                        {orders.length === 0 ? <p className="text-sm text-muted-foreground">No orders yet.</p>
                            : orders.map((o) => (
                                <div key={o.id} className="flex items-center justify-between p-2.5 border rounded-lg text-sm mb-2">
                                    <div><span className="font-semibold">#{o.id.split("-").pop()?.toUpperCase()}</span><span className="text-muted-foreground ml-2">{new Date(o.created_at).toLocaleDateString()}</span></div>
                                    <div className="flex items-center gap-2"><span className="font-bold text-[var(--color-industrial-blue)]">₱{Number(o.total_amount).toLocaleString()}</span><Badge variant="outline" className="text-xs capitalize">{o.status.replace(/_/g, " ")}</Badge></div>
                                </div>
                            ))}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function AdminClientsPage() {
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [kycTarget, setKycTarget] = useState<Profile | null>(null);
    const [kycOpen, setKycOpen] = useState(false);
    const [detailTarget, setDetailTarget] = useState<Profile | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);

    const fetchProfiles = useCallback(async () => {
        const supabase = createClient();
        const { data } = await supabase.from("profiles").select("*").eq("role", "client").order("created_at", { ascending: false });
        setProfiles(data ?? []);
        setLoading(false);
    }, []);

    useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

    async function handleKycAction(id: string, status: "verified" | "rejected") {
        const supabase = createClient();
        const { error } = await supabase.from("profiles").update({ kyc_status: status }).eq("id", id);
        if (error) {
            toast.error("Failed to update status.");
            return;
        }
        const profile = profiles.find((p) => p.id === id);
        if (status === "verified") {
            toast.success(`${profile?.full_name} has been approved!`);
            // Log activity
            await supabase.from("activity_log").insert({ actor_id: id, action: "kyc_approved", entity_type: "profile", entity_id: id, metadata: {} });
        } else {
            toast.error(`${profile?.full_name}'s account has been rejected.`);
            await supabase.from("activity_log").insert({ actor_id: id, action: "kyc_rejected", entity_type: "profile", entity_id: id, metadata: {} });
        }
        // Optimistic update
        setProfiles((prev) => prev.map((p) => p.id === id ? { ...p, kyc_status: status } : p));
    }

    const pending = profiles.filter((p) => p.kyc_status === "pending_verification");
    const verified = profiles.filter((p) => p.kyc_status === "verified");

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Client Directory</h2>
                <p className="text-muted-foreground mt-1">Manage client verification and view account details.</p>
            </div>

            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: "Total Clients", value: profiles.length, color: "text-foreground" },
                    { label: "Pending KYC", value: pending.length, color: "text-amber-600" },
                    { label: "Verified", value: verified.length, color: "text-emerald-600" },
                ].map((stat) => (
                    <Card key={stat.label}>
                        <CardContent className="pt-5 pb-4">
                            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">{stat.label}</p>
                            <p className={`text-3xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {loading ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground">Loading clients...</CardContent></Card>
            ) : (
                <Tabs defaultValue="kyc">
                    <TabsList className="w-full sm:w-auto">
                        <TabsTrigger value="kyc" className="flex items-center gap-1.5">
                            Verification Hub
                            {pending.length > 0 && <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{pending.length}</span>}
                        </TabsTrigger>
                        <TabsTrigger value="directory">Client Directory</TabsTrigger>
                    </TabsList>

                    {/* KYC Hub */}
                    <TabsContent value="kyc" className="space-y-3">
                        {pending.length === 0 ? (
                            <Card><CardContent className="py-16 text-center text-muted-foreground"><UserCheck className="w-10 h-10 mx-auto mb-3 opacity-30" /><p className="text-sm font-medium">All clients verified — no pending KYC requests</p></CardContent></Card>
                        ) : (
                            <div className="space-y-3">
                                <p className="text-sm text-muted-foreground font-medium">{pending.length} pending verification{pending.length > 1 ? "s" : ""}</p>
                                {pending.map((profile) => (
                                    <Card key={profile.id} className="border-amber-200 bg-amber-50/40">
                                        <CardContent className="p-4">
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                                <Avatar className="w-10 h-10 flex-shrink-0"><AvatarFallback className="text-xs font-bold bg-amber-200 text-amber-900">{getInitials(profile.full_name)}</AvatarFallback></Avatar>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-sm">{profile.full_name}</p><KycBadge status={profile.kyc_status} /></div>
                                                    <p className="text-xs text-muted-foreground">{profile.email} · {profile.company_name || "Individual"}</p>
                                                    <p className="text-xs text-muted-foreground mt-0.5">{profile.kyc_documents?.length || 0} document(s) · Registered {new Date(profile.created_at).toLocaleDateString()}</p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => { setKycTarget(profile); setKycOpen(true); }}><Eye className="w-3.5 h-3.5" />Review</Button>
                                                    <Button size="sm" className="h-8 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleKycAction(profile.id, "verified")}><CheckCircle2 className="w-3.5 h-3.5" />Approve</Button>
                                                    <Button size="sm" variant="outline" className="h-8 text-xs text-destructive border-destructive hover:bg-destructive/10" onClick={() => handleKycAction(profile.id, "rejected")}><XCircle className="w-3.5 h-3.5" /></Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    {/* Directory */}
                    <TabsContent value="directory" className="space-y-3">
                        {verified.length === 0 ? (
                            <Card><CardContent className="py-16 text-center text-muted-foreground"><Users className="w-10 h-10 mx-auto mb-3 opacity-30" /><p className="text-sm font-medium">No verified clients yet.</p></CardContent></Card>
                        ) : (
                            <Card>
                                <CardContent className="p-2 divide-y">
                                    {verified.map((profile) => (
                                        <div key={profile.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-3 py-3 hover:bg-muted/50 rounded-lg cursor-pointer group" onClick={() => { setDetailTarget(profile); setDetailOpen(true); }}>
                                            <Avatar className="w-9 h-9 flex-shrink-0"><AvatarFallback className="text-xs font-bold bg-[var(--color-industrial-blue)] text-white">{getInitials(profile.full_name)}</AvatarFallback></Avatar>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-sm">{profile.full_name}</p><KycBadge status={profile.kyc_status} /></div>
                                                <p className="text-xs text-muted-foreground">{profile.email} · {profile.company_name || "Individual"}</p>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>
                </Tabs>
            )}

            <KycDialog profile={kycTarget} open={kycOpen} onClose={() => setKycOpen(false)} onAction={handleKycAction} />
            <ClientDetailDialog profile={detailTarget} open={detailOpen} onClose={() => setDetailOpen(false)} />
        </div>
    );
}
