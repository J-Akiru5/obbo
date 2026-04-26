"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Package, ShoppingCart, ArrowRight, FileText, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Order, Product, CustomerBalance } from "@/lib/types/database";

type OrderWithItems = Order & {
    order_items: Array<{ requested_qty: number; bag_type: string }>;
};

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, string> = {
        pending: "bg-amber-50 text-amber-700 border-amber-200",
        approved: "bg-blue-50 text-blue-700 border-blue-200",
        dispatched: "bg-indigo-50 text-indigo-700 border-indigo-200",
        completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
        rejected: "bg-red-50 text-red-700 border-red-200",
        partially_approved: "bg-orange-50 text-orange-700 border-orange-200",
        awaiting_check: "bg-purple-50 text-purple-700 border-purple-200",
    };
    return (
        <Badge variant="outline" className={`text-xs capitalize ${map[status] ?? ""}`}>
            {status.replace(/_/g, " ")}
        </Badge>
    );
}

export default function ClientDashboard() {
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [orders, setOrders] = useState<OrderWithItems[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [balances, setBalances] = useState<CustomerBalance[]>([]);

    useEffect(() => {
        async function fetchData() {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const [profileRes, ordersRes, productsRes, balancesRes] = await Promise.all([
                supabase.from("profiles").select("*").eq("id", user.id).single(),
                supabase
                    .from("orders")
                    .select("*, order_items(requested_qty, bag_type)")
                    .eq("client_id", user.id)
                    .order("created_at", { ascending: false })
                    .limit(5),
                supabase.from("products").select("*").eq("is_active", true).order("name"),
                supabase
                    .from("customer_balances")
                    .select("*")
                    .eq("client_id", user.id)
                    .eq("status", "pending"),
            ]);

            setProfile(profileRes.data);
            setOrders((ordersRes.data as OrderWithItems[]) ?? []);
            setProducts(productsRes.data ?? []);
            setBalances(balancesRes.data ?? []);
            setLoading(false);
        }
        fetchData();
    }, []);

    const activeOrders = orders.filter((o) => !["completed", "rejected"].includes(o.status));
    const totalBalanceBags = balances.reduce((s, b) => s + b.remaining_qty, 0);

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
                <Skeleton className="h-8 w-48" />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
                </div>
                <Skeleton className="h-64 rounded-xl" />
                <Skeleton className="h-64 rounded-xl" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
            <div>
                <h2 className="text-2xl font-bold">My Dashboard</h2>
                <p className="text-muted-foreground mt-1">
                    Welcome back, {profile?.full_name || "Client"}.
                </p>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="pt-5">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Active Orders</p>
                        <p className="text-3xl font-bold mt-1">{activeOrders.length}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-5">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Total Orders</p>
                        <p className="text-3xl font-bold mt-1">{orders.length}</p>
                    </CardContent>
                </Card>
                <Card className="col-span-2 sm:col-span-1">
                    <CardContent className="pt-5">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Pending Balance</p>
                        <p className={`text-3xl font-bold mt-1 ${totalBalanceBags > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                            {totalBalanceBags.toLocaleString()} bags
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Orders */}
            <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-base">Recent Orders</CardTitle>
                    <Link href="/client/orders/new">
                        <Button size="sm" className="bg-[var(--color-industrial-blue)] hover:bg-[var(--color-industrial-blue)]/90 h-8 text-xs gap-1">
                            <ShoppingCart className="w-3.5 h-3.5" /> New Order
                        </Button>
                    </Link>
                </CardHeader>
                <CardContent className="p-2 divide-y">
                    {orders.length === 0 ? (
                        <div className="py-12 text-center text-muted-foreground">
                            <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">No orders yet. Place your first order!</p>
                        </div>
                    ) : orders.map((o) => {
                        const totalQty = o.order_items?.reduce((s, i) => s + i.requested_qty, 0) ?? 0;
                        return (
                            <div key={o.id} className="flex flex-col sm:flex-row sm:items-center gap-2 px-3 py-3">
                                <div className="flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-bold">#{o.id.split("-").pop()?.toUpperCase()}</span>
                                        <StatusBadge status={o.status} />
                                        <Badge variant="outline" className="text-xs capitalize">{o.payment_method}</Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {totalQty.toLocaleString()} bags · ₱{o.total_amount.toLocaleString()} · {new Date(o.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                                <Link href={`/client/orders/${o.id}`}>
                                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 self-start sm:self-auto">
                                        <FileText className="w-3 h-3" /> Details
                                    </Button>
                                </Link>
                            </div>
                        );
                    })}
                </CardContent>
            </Card>

            {/* Product Catalog Preview */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">Available Products</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    {products.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">No products available yet.</p>
                    ) : products.slice(0, 4).map((p) => (
                        <div key={p.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-[var(--color-industrial-blue)]/10 flex items-center justify-center">
                                    <Package className="w-4 h-4 text-[var(--color-industrial-blue)]" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold">{p.name}</p>
                                    <p className="text-xs text-muted-foreground">{p.bag_type === "JB" ? "Jumbo Bag" : "Sling Bag"}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-bold text-[var(--color-industrial-blue)]">₱{Number(p.price_per_bag).toLocaleString()}</p>
                                <p className="text-xs text-muted-foreground">per bag</p>
                            </div>
                        </div>
                    ))}
                    <Link href="/client/orders/new">
                        <Button variant="outline" className="w-full gap-2 mt-2">
                            Place an Order <ArrowRight className="w-4 h-4" />
                        </Button>
                    </Link>
                </CardContent>
            </Card>
        </div>
    );
}
