"use client";

import { useMemo, useState } from "react";
import {
    CircleCheckBig,
    CircleDot,
    Clock3,
    CreditCard,
    Search,
    Truck,
    UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    clientOrdersSeed,
    formatCurrency,
    getIndividualBagCount,
    getProductById,
    type ClientOrderRecord,
} from "@/lib/client-portal-data";

const statusClasses: Record<ClientOrderRecord["status"], string> = {
    pending_approval: "border-amber-200 bg-amber-50 text-amber-700",
    approved_payment_required: "border-blue-200 bg-blue-50 text-blue-700",
    payment_submitted: "border-indigo-200 bg-indigo-50 text-indigo-700",
    in_transit: "border-cyan-200 bg-cyan-50 text-cyan-700",
    delivered: "border-emerald-200 bg-emerald-50 text-emerald-700",
    completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const statusLabels: Record<ClientOrderRecord["status"], string> = {
    pending_approval: "Pending Approval",
    approved_payment_required: "Approved - Payment Required",
    payment_submitted: "Payment Submitted - Awaiting Dispatch",
    in_transit: "In Transit",
    delivered: "Delivered",
    completed: "Completed",
};

function TrackingLine({ status }: { status: ClientOrderRecord["status"] }) {
    const steps = [
        { key: "approved_payment_required", label: "Approved" },
        { key: "payment_submitted", label: "Payment Submitted" },
        { key: "in_transit", label: "In Transit" },
        { key: "delivered", label: "Delivered" },
    ] as const;

    const indexMap: Record<ClientOrderRecord["status"], number> = {
        pending_approval: -1,
        approved_payment_required: 0,
        payment_submitted: 1,
        in_transit: 2,
        delivered: 3,
        completed: 3,
    };

    const currentIndex = indexMap[status];

    return (
        <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Tracking</p>
            <div className="grid gap-2 sm:grid-cols-4">
                {steps.map((step, idx) => (
                    <div
                        key={step.key}
                        className={`rounded-lg border px-3 py-2 text-xs ${
                            idx <= currentIndex
                                ? "border-[var(--color-industrial-blue)]/30 bg-[var(--color-industrial-blue)]/10 text-[var(--color-industrial-blue)]"
                                : "border-border bg-background text-muted-foreground"
                        }`}
                    >
                        {step.label}
                    </div>
                ))}
            </div>
        </div>
    );
}

function OrderMeta({ order }: { order: ClientOrderRecord }) {
    const product = getProductById(order.productId);
    const totalBags = getIndividualBagCount(order.jbQty, order.sbQty);

    return (
        <div className="space-y-1 text-sm text-muted-foreground">
            <p>
                Product: <span className="font-medium text-foreground">{product?.name ?? "Unknown Product"}</span>
            </p>
            <p>
                Quantities: <span className="font-medium text-foreground">{order.jbQty} JB + {order.sbQty} SB = {totalBags} individual bags</span>
            </p>
            <p>
                Service Type: <span className="font-medium text-foreground">{order.serviceType === "deliver" ? "Deliver" : "Pick-up"}</span>
            </p>
            <p>
                Payment Method: <span className="font-medium text-foreground">{order.paymentMethod.toUpperCase()}</span>
            </p>
        </div>
    );
}

export default function ClientOrdersPage() {
    const [orders, setOrders] = useState(clientOrdersSeed);
    const [checkNumbers, setCheckNumbers] = useState<Record<string, string>>({});
    const [checkFiles, setCheckFiles] = useState<Record<string, string>>({});
    const [historyStartDate, setHistoryStartDate] = useState("");
    const [historyEndDate, setHistoryEndDate] = useState("");
    const [historySearch, setHistorySearch] = useState("");

    const pendingOrders = useMemo(
        () => orders.filter((order) => order.status === "pending_approval"),
        [orders]
    );

    const activeOrders = useMemo(
        () =>
            orders.filter((order) =>
                ["approved_payment_required", "payment_submitted", "in_transit"].includes(order.status)
            ),
        [orders]
    );

    const historyOrders = useMemo(
        () => orders.filter((order) => ["delivered", "completed"].includes(order.status)),
        [orders]
    );

    const filteredHistory = useMemo(() => {
        return historyOrders.filter((order) => {
            const orderDate = new Date(order.createdAt);
            const startOk = historyStartDate ? orderDate >= new Date(historyStartDate) : true;
            const endOk = historyEndDate ? orderDate <= new Date(`${historyEndDate}T23:59:59`) : true;
            const searchTerm = historySearch.toLowerCase();
            const searchOk = searchTerm
                ? order.poNumber.toLowerCase().includes(searchTerm) || (order.drNumber ?? "").toLowerCase().includes(searchTerm)
                : true;

            return startOk && endOk && searchOk;
        });
    }, [historyOrders, historySearch, historyEndDate, historyStartDate]);

    function updateOrderStatus(orderId: string, status: ClientOrderRecord["status"]) {
        setOrders((prev) =>
            prev.map((order) =>
                order.id === orderId
                    ? {
                            ...order,
                            status,
                            updatedAt: new Date().toISOString(),
                        }
                    : order
            )
        );
    }

    function handleCashPayment(orderId: string) {
        updateOrderStatus(orderId, "payment_submitted");
        toast.success("Cash payment submitted. Status is now awaiting dispatch.");
    }

    function handleCheckPayment(orderId: string) {
        const checkNumber = checkNumbers[orderId]?.trim();
        const checkFile = checkFiles[orderId];

        if (!checkNumber || !checkFile) {
            toast.error("Please provide check number and upload check image.");
            return;
        }

        updateOrderStatus(orderId, "payment_submitted");
        toast.success("Check payment submitted. Status is now awaiting dispatch.");
    }

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <div>
                <h2 className="text-2xl font-semibold tracking-tight">My Orders</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Track pending approvals, active shipments, payment submissions, and completed transactions.
                </p>
            </div>

            <Tabs defaultValue="pending" className="space-y-4">
                <TabsList className="h-auto w-full flex-wrap gap-1 bg-muted p-1 sm:w-auto">
                    <TabsTrigger value="pending">Pending Approval ({pendingOrders.length})</TabsTrigger>
                    <TabsTrigger value="active">Active Shipments & Tracking ({activeOrders.length})</TabsTrigger>
                    <TabsTrigger value="history">Order History ({historyOrders.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="pending" className="space-y-3">
                    {pendingOrders.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center text-sm text-muted-foreground">
                                No pending approvals right now.
                            </CardContent>
                        </Card>
                    ) : (
                        pendingOrders.map((order) => (
                            <Card key={order.id} className="shadow-sm">
                                <CardHeader className="pb-2">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <CardTitle className="text-base">{order.poNumber}</CardTitle>
                                        <Badge variant="outline" className={statusClasses[order.status]}>
                                            {statusLabels[order.status]}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <OrderMeta order={order} />
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Clock3 className="h-3.5 w-3.5" />
                                        Submitted on {new Date(order.createdAt).toLocaleString()}
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </TabsContent>

                <TabsContent value="active" className="space-y-3">
                    {activeOrders.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center text-sm text-muted-foreground">
                                No active shipments at the moment.
                            </CardContent>
                        </Card>
                    ) : (
                        activeOrders.map((order) => (
                            <Card key={order.id} className="shadow-sm">
                                <CardHeader className="pb-2">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <CardTitle className="text-base">{order.poNumber}</CardTitle>
                                        <Badge variant="outline" className={statusClasses[order.status]}>
                                            {statusLabels[order.status]}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <OrderMeta order={order} />

                                    {order.status === "approved_payment_required" && (
                                        <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                                            <p className="text-sm font-medium text-blue-800">
                                                Your order has been approved. Shipping Fee: {formatCurrency(order.shippingFee)} (for Deliver orders). Please complete your payment below.
                                            </p>

                                            {order.paymentMethod === "cash" ? (
                                                <Button
                                                    type="button"
                                                    className="bg-[var(--color-industrial-blue)] hover:bg-[var(--color-industrial-blue)]/90"
                                                    onClick={() => handleCashPayment(order.id)}
                                                >
                                                    <CircleCheckBig className="mr-1 h-4 w-4" /> Confirm Cash Payment
                                                </Button>
                                            ) : (
                                                <div className="grid gap-3 md:grid-cols-2">
                                                    <div className="space-y-2">
                                                        <Label htmlFor={`check-${order.id}`}>Check Number</Label>
                                                        <Input
                                                            id={`check-${order.id}`}
                                                            value={checkNumbers[order.id] ?? ""}
                                                            onChange={(event) =>
                                                                setCheckNumbers((prev) => ({
                                                                    ...prev,
                                                                    [order.id]: event.target.value,
                                                                }))
                                                            }
                                                            placeholder="Enter check number"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor={`check-file-${order.id}`}>Upload Check Image</Label>
                                                        <Input
                                                            id={`check-file-${order.id}`}
                                                            type="file"
                                                            accept="image/*"
                                                            onChange={(event) =>
                                                                setCheckFiles((prev) => ({
                                                                    ...prev,
                                                                    [order.id]: event.target.files?.[0]?.name ?? "",
                                                                }))
                                                            }
                                                        />
                                                        {checkFiles[order.id] && (
                                                            <p className="text-xs text-muted-foreground">{checkFiles[order.id]}</p>
                                                        )}
                                                    </div>
                                                    <Button type="button" variant="outline" onClick={() => handleCheckPayment(order.id)}>
                                                        <UploadCloud className="mr-1 h-4 w-4" /> Submit Check Payment
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <TrackingLine status={order.status} />

                                    <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                                        <div className="flex items-center gap-1.5">
                                            <CircleDot className="h-3.5 w-3.5" /> Last update: {new Date(order.updatedAt).toLocaleString()}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <CreditCard className="h-3.5 w-3.5" /> Payment: {order.paymentMethod.toUpperCase()}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <Truck className="h-3.5 w-3.5" /> Service: {order.serviceType === "deliver" ? "Deliver" : "Pick-up"}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <CircleCheckBig className="h-3.5 w-3.5" /> DR: {order.drNumber ?? "Pending"}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </TabsContent>

                <TabsContent value="history" className="space-y-4">
                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-base">Filter History</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-3 md:grid-cols-[1fr_1fr_1.5fr]">
                            <div className="space-y-2">
                                <Label htmlFor="start-date">Date From</Label>
                                <Input
                                    id="start-date"
                                    type="date"
                                    value={historyStartDate}
                                    onChange={(event) => setHistoryStartDate(event.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="end-date">Date To</Label>
                                <Input
                                    id="end-date"
                                    type="date"
                                    value={historyEndDate}
                                    onChange={(event) => setHistoryEndDate(event.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="history-search">Search by DR Number or PO Number</Label>
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="history-search"
                                        value={historySearch}
                                        onChange={(event) => setHistorySearch(event.target.value)}
                                        className="pl-8"
                                        placeholder="PO-xxxxxx or DR-xxxxxx"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Read-only Order Archive</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>PO Number</TableHead>
                                        <TableHead>DR Number</TableHead>
                                        <TableHead>Quantity (Bags)</TableHead>
                                        <TableHead>Payment Method</TableHead>
                                        <TableHead>Shipping Fee</TableHead>
                                        <TableHead>Service Type</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredHistory.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center text-muted-foreground">
                                                No history records found for the selected filters.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredHistory.map((order) => (
                                            <TableRow key={order.id}>
                                                <TableCell className="font-medium">{order.poNumber}</TableCell>
                                                <TableCell>{order.drNumber ?? "Pending"}</TableCell>
                                                <TableCell>{getIndividualBagCount(order.jbQty, order.sbQty)}</TableCell>
                                                <TableCell className="uppercase">{order.paymentMethod}</TableCell>
                                                <TableCell>{formatCurrency(order.shippingFee)}</TableCell>
                                                <TableCell>{order.serviceType === "deliver" ? "Deliver" : "Pick-up"}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className={statusClasses[order.status]}>
                                                        {statusLabels[order.status]}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
