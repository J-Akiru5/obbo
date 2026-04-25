"use client";

import Link from "next/link";
import { Package, ShoppingCart, Clock, ArrowRight, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const mockClientOrders = [
    { id: "ord-003", status: "pending", total: 250000, qty: 1000, date: "2025-04-20", type: "SB" },
    { id: "ord-001", status: "completed", total: 125000, qty: 500, date: "2025-03-15", type: "SB" },
];

const mockBalance = { remaining: 0, product: "Portland Cement Type I (Jumbo)", type: "JB" };

export default function ClientDashboard() {
    return (
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
            <div>
                <h2 className="text-2xl font-bold">My Dashboard</h2>
                <p className="text-muted-foreground mt-1">Welcome back, Maria Santos.</p>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="pt-5">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Active Orders</p>
                        <p className="text-3xl font-bold mt-1">1</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-5">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Total Orders</p>
                        <p className="text-3xl font-bold mt-1">2</p>
                    </CardContent>
                </Card>
                <Card className="col-span-2 sm:col-span-1">
                    <CardContent className="pt-5">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Pending Balance</p>
                        <p className="text-3xl font-bold mt-1 text-amber-600">0 bags</p>
                    </CardContent>
                </Card>
            </div>

            {/* Orders */}
            <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-base">My Orders</CardTitle>
                    <Button size="sm" className="bg-[var(--color-industrial-blue)] hover:bg-[var(--color-industrial-blue)]/90 h-8 text-xs gap-1">
                        <ShoppingCart className="w-3.5 h-3.5" /> New Order
                    </Button>
                </CardHeader>
                <CardContent className="p-2 divide-y">
                    {mockClientOrders.map(o => (
                        <div key={o.id} className="flex flex-col sm:flex-row sm:items-center gap-2 px-3 py-3">
                            <div className="flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-bold">#{o.id.split("-").pop()?.toUpperCase()}</span>
                                    <Badge variant="outline" className={`text-xs ${o.status === "pending" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
                                        {o.status}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs">{o.type}</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">{o.qty.toLocaleString()} bags · ₱{o.total.toLocaleString()} · {new Date(o.date).toLocaleDateString()}</p>
                            </div>
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 self-start sm:self-auto">
                                <FileText className="w-3 h-3" /> Details
                            </Button>
                        </div>
                    ))}
                </CardContent>
            </Card>

            {/* Product Catalog Preview */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">Available Products</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    {[
                        { name: "Portland Cement Type I", type: "SB", price: 250 },
                        { name: "Portland Cement Type I (Jumbo)", type: "JB", price: 5800 },
                        { name: "Portland Cement Type II", type: "SB", price: 275 },
                    ].map(p => (
                        <div key={p.name} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-[var(--color-industrial-blue)]/10 flex items-center justify-center">
                                    <Package className="w-4 h-4 text-[var(--color-industrial-blue)]" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold">{p.name}</p>
                                    <p className="text-xs text-muted-foreground">{p.type === "JB" ? "Jumbo Bag" : "Sling Bag"}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-bold text-[var(--color-industrial-blue)]">₱{p.price.toLocaleString()}</p>
                                <p className="text-xs text-muted-foreground">per bag</p>
                            </div>
                        </div>
                    ))}
                    <Button variant="outline" className="w-full gap-2 mt-2">
                        View Full Catalog <ArrowRight className="w-4 h-4" />
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
