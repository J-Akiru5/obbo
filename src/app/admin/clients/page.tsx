"use client";

import { useState } from "react";
import {
    UserCheck, UserX, Eye, ShieldAlert, Building2, Phone, Mail,
    CheckCircle2, XCircle, ChevronDown, ChevronRight, Users,
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
import { mockProfiles, mockCustomerBalances, mockOrders, mockProducts } from "@/lib/mock-data";
import { Profile } from "@/lib/types/database";

// ─── KYC Review Dialog ─────────────────────────────
function KycDialog({ profile, open, onClose }: { profile: Profile | null; open: boolean; onClose: () => void }) {
    if (!profile) return null;
    const initials = profile.full_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>KYC Review — {profile.full_name}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <Avatar className="w-12 h-12">
                            <AvatarFallback className="text-sm font-bold bg-[var(--color-industrial-blue)] text-white">{initials}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-bold">{profile.full_name}</p>
                            <p className="text-sm text-muted-foreground">{profile.email}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex items-start gap-2">
                            <Building2 className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-muted-foreground text-xs">Company</p>
                                <p className="font-medium">{profile.company_name || "Individual"}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-2">
                            <Phone className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-muted-foreground text-xs">Phone</p>
                                <p className="font-medium">{profile.phone || "—"}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-2 col-span-2">
                            <Mail className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-muted-foreground text-xs">Email</p>
                                <p className="font-medium">{profile.email}</p>
                            </div>
                        </div>
                    </div>
                    <Separator />
                    <div>
                        <p className="text-sm font-semibold mb-2">Submitted Documents</p>
                        {profile.kyc_documents && profile.kyc_documents.length > 0 ? (
                            <div className="space-y-2">
                                {profile.kyc_documents.map((doc, i) => (
                                    <div key={i} className="flex items-center justify-between p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                                        <span className="font-medium">{doc}</span>
                                        <Button size="sm" variant="ghost" className="h-6 text-xs text-blue-600 hover:text-blue-800 px-2">
                                            <Eye className="w-3 h-3 mr-1" /> View
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">No documents submitted.</p>
                        )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                        Registered: {new Date(profile.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}
                    </div>
                </div>
                <DialogFooter className="gap-2">
                    <Button variant="outline" className="text-destructive border-destructive hover:bg-destructive/10"
                        onClick={() => { toast.error(`${profile.full_name}'s account rejected.`); onClose(); }}>
                        <XCircle className="w-4 h-4 mr-1" /> Reject
                    </Button>
                    <Button className="bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => { toast.success(`${profile.full_name} verified and activated!`); onClose(); }}>
                        <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ─── Client Detail Dialog ─────────────────────────────
function ClientDetailDialog({ profile, open, onClose }: { profile: Profile | null; open: boolean; onClose: () => void }) {
    if (!profile) return null;
    const initials = profile.full_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    const clientOrders = mockOrders.filter(o => o.client_id === profile.id);
    const clientBalances = mockCustomerBalances.filter(b => b.client_id === profile.id && b.status === "pending");
    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Client Profile</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <Avatar className="w-12 h-12">
                            <AvatarFallback className="text-sm font-bold bg-[var(--color-industrial-blue)] text-white">{initials}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-bold">{profile.full_name}</p>
                            <p className="text-sm text-muted-foreground">{profile.company_name || "Individual"}</p>
                            <p className="text-xs text-muted-foreground">{profile.email}</p>
                        </div>
                    </div>
                    {clientBalances.length > 0 && (
                        <div>
                            <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                                <ShieldAlert className="w-4 h-4 text-amber-500" /> Outstanding Balances
                            </p>
                            {clientBalances.map(b => {
                                const prod = mockProducts.find(p => p.id === b.product_id);
                                return (
                                    <div key={b.id} className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
                                        <p className="font-medium">{prod?.name}</p>
                                        <p className="text-xs text-amber-700">{b.remaining_qty} {b.bag_type} remaining · Order #{b.order_id.split("-").pop()?.toUpperCase()}</p>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    <div>
                        <p className="text-sm font-semibold mb-2">Order History ({clientOrders.length})</p>
                        <div className="space-y-2">
                            {clientOrders.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No orders yet.</p>
                            ) : clientOrders.map(o => (
                                <div key={o.id} className="flex items-center justify-between p-2.5 border rounded-lg text-sm">
                                    <div>
                                        <span className="font-semibold">#{o.id.split("-").pop()?.toUpperCase()}</span>
                                        <span className="text-muted-foreground ml-2">{new Date(o.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-[var(--color-industrial-blue)]">₱{o.total_amount.toLocaleString()}</span>
                                        <Badge variant="outline" className="text-xs capitalize">{o.status.replace("_", " ")}</Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ─── KYC Status Badge ─────────────────────────────
function KycBadge({ status }: { status: string }) {
    if (status === "verified") return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100">Verified</Badge>;
    if (status === "rejected") return <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100">Rejected</Badge>;
    return <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100">Pending</Badge>;
}

export default function AdminClientsPage() {
    const [kycTarget, setKycTarget] = useState<Profile | null>(null);
    const [kycOpen, setKycOpen] = useState(false);
    const [detailTarget, setDetailTarget] = useState<Profile | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);

    const pending = mockProfiles.filter(p => p.role === "client" && p.kyc_status === "pending_verification");
    const verified = mockProfiles.filter(p => p.role === "client" && p.kyc_status === "verified");

    function getInitials(name: string) {
        return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    }

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Client Directory</h2>
                <p className="text-muted-foreground mt-1">Manage client verification and view balance ledgers.</p>
            </div>

            <Tabs defaultValue="kyc">
                <TabsList className="w-full sm:w-auto">
                    <TabsTrigger value="kyc" className="flex items-center gap-1.5">
                        Verification Hub
                        {pending.length > 0 && (
                            <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{pending.length}</span>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="directory">Client Directory</TabsTrigger>
                </TabsList>

                {/* KYC Hub */}
                <TabsContent value="kyc" className="space-y-3">
                    {pending.length === 0 ? (
                        <Card>
                            <CardContent className="py-16 text-center text-muted-foreground">
                                <UserCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                <p className="text-sm font-medium">All clients verified — no pending KYC requests</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-3">
                            <p className="text-sm text-muted-foreground font-medium">{pending.length} pending verification{pending.length > 1 ? "s" : ""}</p>
                            {pending.map(profile => {
                                const initials = getInitials(profile.full_name);
                                return (
                                    <Card key={profile.id} className="border-amber-200 bg-amber-50/40">
                                        <CardContent className="p-4">
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                                <Avatar className="w-10 h-10 flex-shrink-0">
                                                    <AvatarFallback className="text-xs font-bold bg-amber-200 text-amber-900">{initials}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="font-semibold text-sm">{profile.full_name}</p>
                                                        <KycBadge status={profile.kyc_status} />
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">{profile.email} · {profile.company_name || "Individual"}</p>
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        {profile.kyc_documents?.length || 0} document(s) submitted · Registered {new Date(profile.created_at).toLocaleDateString()}
                                                    </p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1"
                                                        onClick={() => { setKycTarget(profile); setKycOpen(true); }}>
                                                        <Eye className="w-3.5 h-3.5" /> Review
                                                    </Button>
                                                    <Button size="sm" className="h-8 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700"
                                                        onClick={() => toast.success(`${profile.full_name} approved!`)}>
                                                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                                                    </Button>
                                                    <Button size="sm" variant="outline" className="h-8 text-xs text-destructive border-destructive hover:bg-destructive/10"
                                                        onClick={() => toast.error(`${profile.full_name} rejected.`)}>
                                                        <XCircle className="w-3.5 h-3.5" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </TabsContent>

                {/* Directory */}
                <TabsContent value="directory" className="space-y-3">
                    <Card>
                        <CardContent className="p-2 divide-y">
                            {verified.map(profile => {
                                const initials = getInitials(profile.full_name);
                                const balances = mockCustomerBalances.filter(b => b.client_id === profile.id && b.status === "pending");
                                const orders = mockOrders.filter(o => o.client_id === profile.id);
                                return (
                                    <div key={profile.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-3 py-3 hover:bg-muted/50 rounded-lg transition-colors cursor-pointer group"
                                        onClick={() => { setDetailTarget(profile); setDetailOpen(true); }}>
                                        <Avatar className="w-9 h-9 flex-shrink-0">
                                            <AvatarFallback className="text-xs font-bold bg-[var(--color-industrial-blue)] text-white">{initials}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="font-semibold text-sm">{profile.full_name}</p>
                                                <KycBadge status={profile.kyc_status} />
                                            </div>
                                            <p className="text-xs text-muted-foreground">{profile.email} · {profile.company_name || "Individual"}</p>
                                        </div>
                                        <div className="flex items-center gap-3 text-right">
                                            <div>
                                                <p className="text-xs text-muted-foreground">Orders</p>
                                                <p className="text-sm font-bold">{orders.length}</p>
                                            </div>
                                            {balances.length > 0 && (
                                                <div className="p-1.5 rounded-lg bg-amber-100 border border-amber-200 text-center min-w-[64px]">
                                                    <p className="text-xs text-amber-700 font-medium">{balances.reduce((s, b) => s + b.remaining_qty, 0)} bags</p>
                                                    <p className="text-[10px] text-amber-600">owed</p>
                                                </div>
                                            )}
                                            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
                                        </div>
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <KycDialog profile={kycTarget} open={kycOpen} onClose={() => setKycOpen(false)} />
            <ClientDetailDialog profile={detailTarget} open={detailOpen} onClose={() => setDetailOpen(false)} />
        </div>
    );
}
