"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShoppingCart, Clock, Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import type { Order } from "@/lib/types/database";

type OrderWithItems = Order & {
    order_items: Array<{ requested_qty: number; bag_type: string; product?: { name: string } }>;
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

export default function ClientOrdersPage() {
    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState<OrderWithItems[]>([]);

    useEffect(() => {
        async function fetchOrders() {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase
                .from("orders")
                .select("*, order_items(requested_qty, bag_type, product:products(name))")
                .eq("client_id", user.id)
                .order("created_at", { ascending: false });

            setOrders((data as OrderWithItems[]) ?? []);
            setLoading(false);
        }
        fetchOrders();
    }, []);

    const active = orders.filter((o) => !["completed", "rejected"].includes(o.status));
    const completed = orders.filter((o) => o.status === "completed");
    const rejected = orders.filter((o) => o.status === "rejected");

    function OrderRow({ order }: { order: OrderWithItems }) {
        const totalQty = order.order_items?.reduce((s, i) => s + i.requested_qty, 0) ?? 0;
        return (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-4 hover:bg-muted/30 transition-colors">
                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-sm font-bold font-mono">#{order.id.split("-").pop()?.toUpperCase()}</span>
                        <StatusBadge status={order.status} />
                        <Badge variant="outline" className="text-xs capitalize">{order.payment_method}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {totalQty.toLocaleString()} bags · ₱{Number(order.total_amount).toLocaleString()} · {new Date(order.created_at).toLocaleDateString("en-PH")}
                    </p>
                    {order.order_items?.slice(0, 2).map((item, idx) => (
                        <p key={idx} className="text-xs text-muted-foreground/70 mt-0.5">
                            {item.product?.name || "Product"} — {item.requested_qty.toLocaleString()} {item.bag_type}
                        </p>
                    ))}
                </div>
                <Link href={`/client/orders/${order.id}`}>
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1 shrink-0">
                        <FileText className="w-3 h-3" /> View Details
                    </Button>
                </Link>
            </div>
        );
    }

    function EmptyState({ label }: { label: string }) {
        return (
            <div className="py-16 text-center text-muted-foreground">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">{label}</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">My Orders</h2>
                    <p className="text-muted-foreground mt-1">Track and manage your cement orders.</p>
                </div>
                <Link href="/client/orders/new">
                    <Button className="bg-[var(--color-industrial-blue)] hover:bg-[var(--color-industrial-blue)]/90 gap-2">
                        <Plus className="w-4 h-4" /> New Order
                    </Button>
                </Link>
            </div>

            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
                </div>
            ) : orders.length === 0 ? (
                <Card>
                    <CardContent className="py-20 text-center">
                        <ShoppingCart className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                        <p className="text-muted-foreground mb-4">You haven&apos;t placed any orders yet.</p>
                        <Link href="/client/orders/new">
                            <Button className="bg-[var(--color-industrial-blue)] hover:bg-[var(--color-industrial-blue)]/90 gap-2">
                                <Plus className="w-4 h-4" /> Place First Order
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            ) : (
                <Tabs defaultValue="all">
                    <TabsList>
                        <TabsTrigger value="all">All ({orders.length})</TabsTrigger>
                        <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
                        <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
                        {rejected.length > 0 && <TabsTrigger value="rejected">Rejected ({rejected.length})</TabsTrigger>}
                    </TabsList>

                    <TabsContent value="all">
                        <Card>
                            <CardHeader className="pb-0"><CardTitle className="text-sm text-muted-foreground font-normal">{orders.length} order{orders.length !== 1 ? "s" : ""}</CardTitle></CardHeader>
                            <CardContent className="p-0 divide-y">
                                {orders.map((o) => <OrderRow key={o.id} order={o} />)}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="active">
                        <Card>
                            <CardContent className="p-0 divide-y">
                                {active.length === 0 ? <EmptyState label="No active orders." /> : active.map((o) => <OrderRow key={o.id} order={o} />)}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="completed">
                        <Card>
                            <CardContent className="p-0 divide-y">
                                {completed.length === 0 ? <EmptyState label="No completed orders." /> : completed.map((o) => <OrderRow key={o.id} order={o} />)}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="rejected">
                        <Card>
                            <CardContent className="p-0 divide-y">
                                {rejected.map((o) => <OrderRow key={o.id} order={o} />)}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            )}
        </div>
    );
}
