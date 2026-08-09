import {
  fetchClientDashboardKPIs,
  fetchRecentOrders,
  fetchClientNotifications,
  fetchActiveProducts,
} from '@/lib/actions/client-actions';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle,
  Bell,
  Clock,
  Package,
  PackageSearch,
  Truck,
  Info,
  ShieldAlert,
  Lock,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

import { Order, Product, Notification, OrderItem } from '@/lib/types/database';

export const metadata = {
  title: 'Client Dashboard | OBBO iManage',
};

export default async function ClientDashboardPage() {
  const [kpis, recentOrders, notifications, products] = await Promise.all([
    fetchClientDashboardKPIs(),
    fetchRecentOrders(),
    fetchClientNotifications(),
    fetchActiveProducts(),
  ]);

  // Fetch kyc_status server-side for conditional rendering
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from('profiles').select('kyc_status').eq('id', user.id).single()
    : { data: null };
  const isVerified = profile?.kyc_status === 'verified';

  const unreadNotifications = notifications.filter((n: Notification) => !n.is_read);
  const popularProducts = products.slice(0, 2);

  return (
    <div className="space-y-6">
      {/* KYC Pending Banner — shown for unverified users */}
      {!isVerified && (
        <div className="border-status-pending-border bg-status-pending-bg flex items-start gap-3 rounded-xl border p-4">
          <ShieldAlert className="text-status-pending-text mt-0.5 h-5 w-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <h4 className="text-foreground text-sm font-semibold">
              Account pending KYC verification
            </h4>
            <p className="text-muted-foreground mt-0.5 text-sm">
              You can browse the catalog, but placing orders and accessing your ledger require a
              verified account. Our team will review your documents shortly.
            </p>
          </div>
          <Link href="/client/contact-admin" className="shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="border-status-pending-border text-foreground hover:bg-muted h-8 text-xs"
            >
              Contact Admin
            </Button>
          </Link>
        </div>
      )}

      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-foreground text-2xl font-bold tracking-tight">
            Welcome back, {kpis.clientName}
          </h2>
          <p className="text-muted-foreground text-sm">Here&apos;s an overview of your account.</p>
        </div>
        <div className="flex gap-2">
          {isVerified ? (
            <Link href="/client/catalog">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm">
                <PackageSearch className="mr-2 h-4 w-4" />
                New Order
              </Button>
            </Link>
          ) : (
            <Button
              disabled
              className="bg-primary/40 text-primary-foreground cursor-not-allowed gap-2"
              title="Complete KYC verification to place orders"
            >
              <Lock className="h-4 w-4" />
              New Order
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards — now clickable */}
      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/client/orders">
          <Card className="bg-card border-border cursor-pointer shadow-sm transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                Pending Orders
              </CardTitle>
              <Clock className="text-status-pending-text h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-foreground text-2xl font-bold">{kpis.pendingOrders}</div>
              <p className="text-muted-foreground mt-1 text-xs">Awaiting approval or payment</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/client/orders">
          <Card className="bg-card border-border cursor-pointer shadow-sm transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                Active Shipments
              </CardTitle>
              <Truck className="text-status-success-text h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-foreground text-2xl font-bold">{kpis.activeShipments}</div>
              <p className="text-muted-foreground mt-1 text-xs">Dispatched or In Transit</p>
            </CardContent>
          </Card>
        </Link>

        {isVerified ? (
          <Link href="/client/ledger">
            <Card className="bg-primary text-primary-foreground cursor-pointer shadow-md transition-shadow hover:shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-primary-foreground/90 text-sm font-medium">
                  Remaining Balance
                </CardTitle>
                <Package className="text-primary-foreground/70 h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">
                  {kpis.remainingBags.toLocaleString()}{' '}
                  <span className="text-primary-foreground/70 text-sm font-normal">
                    indiv. bags
                  </span>
                </div>
                <p className="text-primary-foreground/70 mt-1 text-xs">Available for re-delivery</p>
              </CardContent>
            </Card>
          </Link>
        ) : (
          <div className="cursor-not-allowed" title="Requires verified account">
            <Card className="bg-muted text-muted-foreground opacity-60 shadow-sm select-none">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-muted-foreground text-sm font-medium">
                  Remaining Balance
                </CardTitle>
                <Lock className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-muted-foreground text-2xl font-bold">—</div>
                <p className="text-muted-foreground mt-1 text-xs">Available after KYC approval</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Notification Alerts */}
      {unreadNotifications.length > 0 && (
        <div className="space-y-2">
          {unreadNotifications.slice(0, 3).map((notif: Notification) => (
            <Link key={notif.id} href={notif.href || '/client/orders'}>
              <div
                className={`flex cursor-pointer items-start gap-3 rounded-xl p-4 transition-colors ${
                  notif.severity === 'warning'
                    ? 'bg-status-pending-bg/20 border-status-pending-border/30 hover:bg-status-pending-bg/30 border'
                    : notif.severity === 'success'
                      ? 'bg-status-success-bg/20 border-status-success-border/30 hover:bg-status-success-bg/30 border'
                      : 'bg-status-info-bg/20 border-status-info-border/30 hover:bg-status-info-bg/30 border'
                }`}
              >
                {notif.severity === 'warning' ? (
                  <AlertCircle className="text-status-pending-text mt-0.5 h-5 w-5 shrink-0" />
                ) : notif.severity === 'success' ? (
                  <Bell className="text-status-success-text mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <Info className="text-status-info-text mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <h4 className="text-foreground text-sm font-semibold">{notif.title}</h4>
                  <p className="text-muted-foreground mt-0.5 text-sm">{notif.message}</p>
                  <p className="text-muted-foreground/60 mt-1 text-[10px]">
                    {new Date(notif.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pending orders banner (fallback when no notifications) */}
      {unreadNotifications.length === 0 && kpis.pendingOrders > 0 && (
        <div className="bg-status-pending-bg/20 border-status-pending-border/30 flex items-start gap-3 rounded-xl border p-4">
          <AlertCircle className="text-status-pending-text mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <h4 className="text-foreground text-sm font-semibold">
              You have orders awaiting action
            </h4>
            <p className="text-muted-foreground mt-1 text-sm">
              Please check your pending orders. If an order has been approved, you may need to
              submit payment details before it can be dispatched.
            </p>
            <Link href="/client/orders">
              <Button
                variant="link"
                className="text-primary mt-1 h-auto px-0 py-1 font-semibold hover:underline"
              >
                View Pending Orders &rarr;
              </Button>
            </Link>
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
            <CardDescription>Your latest transactions and their status</CardDescription>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <div className="text-muted-foreground py-12 text-center">
                <PackageSearch className="text-muted-foreground mx-auto mb-3 h-12 w-12" />
                <p>You haven&apos;t placed any orders yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentOrders.map((order: Order) => {
                  // Same priority as the Orders page: once dispatched,
                  // dispatched_qty is the true amount that went out (can be
                  // less than requested on a split delivery); before that,
                  // approved_qty; before that, the original request.
                  const totalBags = order.items.reduce((acc: number, item: OrderItem) => {
                    const requested = item.requested_qty || 0;
                    const effective =
                      item.dispatched_qty > 0
                        ? item.dispatched_qty
                        : item.approved_qty > 0
                          ? item.approved_qty
                          : requested;
                    return acc + effective;
                  }, 0);

                  let statusVariant: 'default' | 'secondary' | 'destructive' | 'outline' =
                    'outline';
                  let statusLabel: string = order.status;

                  if (order.status === 'pending') {
                    statusVariant = 'secondary';
                    statusLabel = 'Awaiting Approval';
                  } else if (order.status === 'approved' || order.status === 'partially_approved') {
                    statusVariant = 'default';
                    statusLabel = 'Approved - Awaiting Payment';
                  } else if (order.status === 'awaiting_check') {
                    statusVariant = 'secondary';
                    statusLabel = 'Check Verifying';
                  } else if (order.status === 'dispatched') {
                    statusVariant = 'default';
                    statusLabel =
                      order.tracking_status === 'in_transit' ? 'In Transit' : 'Dispatched';
                  } else if (order.status === 'completed') {
                    statusLabel = 'Completed';
                  } else if (order.status === 'rejected') {
                    statusVariant = 'destructive';
                    statusLabel = 'Rejected';
                  }

                  return (
                    <Link key={order.id} href="/client/orders">
                      <div className="border-border bg-muted/20 hover:bg-muted/40 flex cursor-pointer flex-col justify-between rounded-lg border p-4 transition-colors sm:flex-row sm:items-center">
                        <div>
                          <div className="mb-1 flex items-center gap-2">
                            <span className="text-foreground font-semibold">
                              PO: {order.po_number}
                            </span>
                            <Badge
                              variant={statusVariant}
                              className="text-[10px] tracking-wider uppercase"
                            >
                              {statusLabel}
                            </Badge>
                            {order.order_type === 'redelivery' && (
                              <Badge
                                variant="outline"
                                className="border-status-info-border text-status-info-text text-[10px]"
                              >
                                Re-delivery
                              </Badge>
                            )}
                          </div>
                          <div className="text-muted-foreground text-sm">
                            {new Date(order.created_at).toLocaleDateString()} • {totalBags} bags •{' '}
                            {order.service_type === 'pickup' ? 'Pick-up' : 'Delivery'}
                          </div>
                        </div>
                        <div className="mt-3 text-left sm:mt-0 sm:text-right">
                          <div className="text-foreground font-medium">
                            ₱{order.total_amount.toLocaleString()}
                          </div>
                          <div className="text-muted-foreground text-xs capitalize">
                            {order.payment_method}
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
                <div className="pt-2">
                  <Link href="/client/orders">
                    <Button variant="outline" className="w-full">
                      View All Orders
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-foreground">Quick Order</CardTitle>
            <CardDescription className="text-muted-foreground">Need more cement?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {popularProducts.length > 0 ? (
              <div className="space-y-3">
                {popularProducts.map((p: Product) => (
                  <div
                    key={p.id}
                    className="bg-muted/20 border-border flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="text-foreground text-sm font-medium">{p.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {p.bag_type === 'JB' ? 'Jumbo' : 'Sling'} • From ₱
                        {(p.price_warehouse || p.price_per_bag).toLocaleString()}/bag
                      </p>
                    </div>
                    <Badge className="bg-primary text-primary-foreground text-[10px]">
                      {p.bag_type}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                Head over to the Product Catalog to browse our Portland Cement offerings in Jumbo
                Bags (JB) and Sling Bags (SB).
              </p>
            )}
            <Link href="/client/catalog" className="block">
              <Button className="bg-primary w-full">Browse Catalog</Button>
            </Link>

            <div className="border-border mt-6 border-t pt-6">
              <h4 className="text-foreground mb-2 text-sm font-semibold">Have a balance?</h4>
              <p className="text-muted-foreground mb-3 text-xs">
                If you have remaining bags from a previous order, you can request a re-delivery
                without placing a new PO.
              </p>
              {isVerified ? (
                <Link href="/client/ledger" className="block">
                  <Button variant="secondary" className="w-full">
                    View Ledger
                  </Button>
                </Link>
              ) : (
                <Button
                  variant="secondary"
                  disabled
                  className="w-full cursor-not-allowed gap-2 opacity-60"
                >
                  <Lock className="h-3.5 w-3.5" />
                  View Ledger
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
