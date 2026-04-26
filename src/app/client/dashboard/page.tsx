"use client";

import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  BellRing,
  ClipboardList,
  Package2,
  Truck,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  clientNotificationsSeed,
  clientOrdersSeed,
  clientProducts,
  clientProfile,
  formatCurrency,
  getIndividualBagCount,
  getProductById,
  getSourceUnitPrice,
  ledgerEntriesSeed,
} from "@/lib/client-portal-data";

const statusStyles: Record<string, string> = {
  pending_approval: "border-amber-200 bg-amber-50 text-amber-700",
  approved_payment_required: "border-blue-200 bg-blue-50 text-blue-700",
  payment_submitted: "border-indigo-200 bg-indigo-50 text-indigo-700",
  in_transit: "border-cyan-200 bg-cyan-50 text-cyan-700",
  delivered: "border-emerald-200 bg-emerald-50 text-emerald-700",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const statusLabels: Record<string, string> = {
  pending_approval: "Pending Approval",
  approved_payment_required: "Payment Required",
  payment_submitted: "Payment Submitted",
  in_transit: "In Transit",
  delivered: "Delivered",
  completed: "Completed",
};

export default function ClientDashboardPage() {
  const pendingOrders = clientOrdersSeed.filter((order) => order.status === "pending_approval");
  const activeShipments = clientOrdersSeed.filter((order) =>
    ["approved_payment_required", "payment_submitted", "in_transit"].includes(order.status)
  );
  const remainingBalance = ledgerEntriesSeed.reduce((sum, entry) => sum + entry.remainingBalance, 0);

  const quickOrderProducts = clientProducts.filter((product) => product.popular);
  const recentOrders = [...clientOrdersSeed].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Welcome back, {clientProfile.fullName}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor orders, shipments, and balances in real time.
          </p>
        </div>
        <Link href="/client/catalog">
          <Button className="bg-[var(--color-industrial-blue)] hover:bg-[var(--color-industrial-blue)]/90">
            Place New Order
          </Button>
        </Link>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-muted-foreground">Pending Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <p className="text-3xl font-semibold text-[var(--color-industrial-blue)]">{pendingOrders.length}</p>
              <ClipboardList className="h-5 w-5 text-[var(--color-industrial-blue)]/70" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-muted-foreground">Active Shipments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <p className="text-3xl font-semibold text-[var(--color-industrial-blue)]">{activeShipments.length}</p>
              <Truck className="h-5 w-5 text-[var(--color-industrial-blue)]/70" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm sm:col-span-2 lg:col-span-1">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-muted-foreground">Remaining Balance (Bags)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <p className="text-3xl font-semibold text-[var(--color-industrial-yellow)]">{remainingBalance}</p>
              <Wallet className="h-5 w-5 text-[var(--color-industrial-yellow)]" />
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <BellRing className="h-4 w-4 text-[var(--color-industrial-blue)]" />
          <h3 className="text-sm font-semibold">Notification Alerts</h3>
        </div>
        <div className="grid gap-3">
          {clientNotificationsSeed.map((notification) => {
            const severityClass =
              notification.severity === "warning"
                ? "border-amber-200 bg-amber-50"
                : notification.severity === "success"
                ? "border-emerald-200 bg-emerald-50"
                : "border-blue-200 bg-blue-50";

            return (
              <Link
                key={notification.id}
                href={notification.href}
                className={`group flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-background ${severityClass}`}
              >
                <AlertCircle className="mt-0.5 h-4 w-4 text-[var(--color-industrial-blue)]" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">{notification.title}</p>
                  <p className="text-sm text-muted-foreground">{notification.message}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </Link>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.05fr_1.2fr]">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle>Quick-Order Products</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {quickOrderProducts.map((product) => (
              <div key={product.id} className="rounded-lg border border-border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{product.name}</p>
                  <Badge variant="outline" className="border-[var(--color-industrial-blue)]/20 text-[var(--color-industrial-blue)]">
                    Popular
                  </Badge>
                </div>
                <div className="mb-3 text-xs text-muted-foreground">
                  PORT {formatCurrency(product.portPricePerBag)} / bag | WAREHOUSE {formatCurrency(product.warehousePricePerBag)} / bag
                </div>
                <Link href={`/client/catalog?product=${product.id}`}>
                  <Button size="sm" variant="outline" className="w-full justify-between">
                    Order This Product <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Recent Orders Summary</CardTitle>
              <Link href="/client/orders">
                <Button variant="ghost" size="sm" className="text-xs">
                  View All
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentOrders.slice(0, 4).map((order) => {
              const product = getProductById(order.productId);
              const totalBags = getIndividualBagCount(order.jbQty, order.sbQty);
              const subtotal = getSourceUnitPrice(order.productId, order.source) * totalBags;
              return (
                <Link key={order.id} href="/client/orders" className="block rounded-lg border border-border p-3 hover:bg-muted/40">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{order.poNumber}</span>
                    <Badge variant="outline" className={statusStyles[order.status]}>
                      {statusLabels[order.status]}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {product?.name ?? "Unknown Product"} | {totalBags} bags | {order.serviceType === "deliver" ? "Deliver" : "Pick-up"}
                  </p>
                  <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Service Type: {order.serviceType}</span>
                    <span>{formatCurrency(subtotal + order.shippingFee)}</span>
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </section>

      <Card className="shadow-sm">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-industrial-blue)]/10">
              <Package2 className="h-4 w-4 text-[var(--color-industrial-blue)]" />
            </div>
            <div>
              <p className="text-sm font-semibold">Need to request re-delivery for remaining bags?</p>
              <p className="text-xs text-muted-foreground">Open Balance Ledger to submit linked requests by PO number.</p>
            </div>
          </div>
          <Link href="/client/ledger">
            <Button variant="outline" className="border-[var(--color-industrial-blue)]/20 text-[var(--color-industrial-blue)]">
              Open Balance Ledger
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
