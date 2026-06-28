'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  ShoppingCart,
  Truck,
  Users,
  ArrowUpRight,
  Package,
  AlertTriangle,
  ShieldAlert,
  TrendingUp,
  DollarSign,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import { fetchDashboardKPIs, fetchActivityFeed, fetchOrders } from '@/lib/actions/admin-actions';
import type { ActivityLog, Order } from '@/lib/types/database';
import Link from 'next/link';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface DashboardClientProps {
  initialKpis: any;
  initialActivityFeed: ActivityLog[];
  initialRecentOrders: Order[];
  initialUserRole: string | null;
}

// ── Activity helpers ───────────────────────────────────────────
function getActivityLabel(action: string) {
  const labels: Record<string, string> = {
    order_placed: 'New Order Placed',
    order_approved: 'Order Approved',
    order_dispatched: 'Order Dispatched',
    order_rejected: 'Order Rejected',
    order_check_confirmed: 'Check Payment Confirmed',
    kyc_submitted: 'KYC Documents Submitted',
    kyc_approved: 'Client Verified',
    kyc_rejected: 'Client KYC Rejected',
    shipment_created: 'Shipment Batch Created',
    shipment_added: 'Shipment Batch Added',
    product_updated: 'Product Updated',
    tracking_updated: 'Tracking Updated',
    ledger_entry_added: 'Ledger Entry Added',
    po_created: 'PO Created',
    dr_created: 'DR Created',
    warehouse_report_submitted: 'Warehouse Report Submitted',
    setting_updated: 'Setting Updated',
  };
  return labels[action] ?? action.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

export default function DashboardClient({
  initialKpis,
  initialActivityFeed,
  initialRecentOrders,
  initialUserRole,
}: DashboardClientProps) {
  const [kpis, setKpis] = useState(initialKpis);
  const [activityFeed, setActivityFeed] = useState<ActivityLog[]>(initialActivityFeed);
  const [recentOrders, setRecentOrders] = useState<Order[]>(initialRecentOrders);
  const [userRole] = useState(initialUserRole);

  const loadData = useCallback(async () => {
    try {
      const isAdmin = userRole === 'admin';
      const [kpiData, feed, pOrders] = await Promise.all([
        fetchDashboardKPIs(),
        fetchActivityFeed(20),
        isAdmin ? Promise.resolve([]) : fetchOrders('pending'),
      ]);
      setKpis(kpiData);
      setActivityFeed(feed as ActivityLog[]);
      setRecentOrders((pOrders as Order[]).slice(0, 5));
    } catch (e) {
      console.error('Dashboard reload error:', e);
    }
  }, [userRole]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('admin-dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        loadData();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log' }, () => {
        loadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  const activityEvents = activityFeed.filter(
    (a) =>
      a.action === 'successful_login' ||
      a.action.includes('login') ||
      a.action === 'password_reset' ||
      a.action === 'warehouse_report_submitted',
  );

  const JB_THRESHOLD = 100;
  const SB_THRESHOLD = 200;
  const jbIsLow = kpis.jbGood < JB_THRESHOLD;
  const sbIsLow = kpis.sbGood < SB_THRESHOLD;

  const jbAlert = {
    bg: jbIsLow ? 'bg-red-500/10' : 'bg-emerald-500/10',
    border: jbIsLow ? 'border-red-500/20' : 'border-emerald-500/20',
    text: jbIsLow ? 'text-red-500' : 'text-emerald-500',
    label: jbIsLow ? 'Low Stock' : 'Safe',
  };

  const sbAlert = {
    bg: sbIsLow ? 'bg-red-500/10' : 'bg-emerald-500/10',
    border: sbIsLow ? 'border-red-500/20' : 'border-emerald-500/20',
    text: sbIsLow ? 'text-red-500' : 'text-emerald-500',
    label: sbIsLow ? 'Low Stock' : 'Safe',
  };

  const chartData = [
    {
      name: 'Jumbo Bags (JB)',
      good: kpis.jbGood,
      obligated: Math.abs(kpis.jbBalance),
      net: kpis.jbNet,
    },
    {
      name: 'Sling Bags (SB)',
      good: kpis.sbGood,
      obligated: Math.abs(kpis.sbBalance),
      net: kpis.sbNet,
    },
  ];

  return (
    <div className="mx-auto min-h-screen max-w-7xl space-y-6 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-foreground text-[28px] font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Real-time operational overview of warehouse performance
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-4">
        {/* Total Good Stock */}
        <Card className="border-border bg-card relative overflow-hidden rounded-xl shadow-sm">
          <div className="absolute top-0 right-0 left-0 h-1 bg-[var(--color-chart-accent-1)]" />
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="w-full space-y-4">
                <p className="text-muted-foreground text-[13px] font-medium tracking-wide uppercase">
                  Total Good Stock
                </p>
                <div className="flex w-full items-baseline justify-between">
                  <p className="text-foreground text-3xl leading-none font-bold tracking-tight sm:text-[38px]">
                    {kpis.grandTotal.toLocaleString()}
                  </p>
                  <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-lg">
                    <Package className="h-5 w-5 text-[var(--color-chart-accent-1)]" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-[13px] font-medium">
                    JB: {kpis.jbGood.toLocaleString()} - SB: {kpis.sbGood.toLocaleString()}
                  </p>
                  <p className="flex items-center gap-1 text-[12px] font-semibold text-emerald-500">
                    <ArrowUpRight className="h-3 w-3" /> +2.4% from yesterday
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Client Balances */}
        <Card className="border-border bg-card relative overflow-hidden rounded-xl shadow-sm">
          <div className="absolute top-0 right-0 left-0 h-1 bg-[var(--color-chart-accent-2)]" />
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="w-full space-y-4">
                <p className="text-muted-foreground text-[13px] font-medium tracking-wide uppercase">
                  Client Balances
                </p>
                <div className="flex w-full items-baseline justify-between">
                  <p className="text-foreground text-3xl leading-none font-bold tracking-tight sm:text-[38px]">
                    {kpis.grandBalance.toLocaleString()}
                  </p>
                  <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-lg">
                    <Users className="h-5 w-5 text-[var(--color-chart-accent-2)]" />
                  </div>
                </div>
                <div className="mt-4 space-y-1">
                  <p className="text-muted-foreground text-[13px] font-medium">
                    Total owed in-bags
                  </p>
                  <p className="text-[12px] font-semibold text-transparent select-none">&nbsp;</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pending KYC */}
        <Card className="border-border bg-card relative overflow-hidden rounded-xl shadow-sm">
          <div className="absolute top-0 right-0 left-0 h-1 bg-[var(--color-chart-accent-3)]" />
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="w-full space-y-4">
                <p className="text-muted-foreground text-[13px] font-medium tracking-wide uppercase">
                  Pending KYC
                </p>
                <div className="flex w-full items-baseline justify-between">
                  <p className="text-foreground text-3xl leading-none font-bold tracking-tight sm:text-[38px]">
                    {kpis.pendingKyc}
                  </p>
                  <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-lg">
                    <ShieldAlert className="h-5 w-5 text-[var(--color-chart-accent-3)]" />
                  </div>
                </div>
                <div className="mt-4 space-y-1">
                  <p className="text-muted-foreground text-[13px] font-medium">Unverified users</p>
                  <p className="text-[12px] font-semibold text-transparent select-none">&nbsp;</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Net Available */}
        <Card className="border-border bg-card relative overflow-hidden rounded-xl shadow-sm">
          <div className="absolute top-0 right-0 left-0 h-1 bg-[var(--color-chart-accent-4)]" />
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="w-full space-y-4">
                <p className="text-muted-foreground text-[13px] font-medium tracking-wide uppercase">
                  Net Available
                </p>
                <div className="flex w-full items-baseline justify-between">
                  <p className="text-foreground text-3xl leading-none font-bold tracking-tight sm:text-[38px]">
                    {kpis.grandNet.toLocaleString()}
                  </p>
                  <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-lg">
                    <Package className="h-5 w-5 text-[var(--color-chart-accent-4)]" />
                  </div>
                </div>
                <div className="mt-4 space-y-1">
                  <p className="text-muted-foreground text-[13px] font-medium">
                    Physical - Balances
                  </p>
                  <p className="text-[12px] font-semibold text-transparent select-none">&nbsp;</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Financial KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6">
        {/* Today's Revenue */}
        <Card className="border-border bg-card relative overflow-hidden rounded-xl shadow-sm">
          <div className="absolute top-0 right-0 left-0 h-1 bg-emerald-500" />
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="w-full space-y-4">
                <p className="text-muted-foreground text-[13px] font-medium tracking-wide uppercase">
                  Today&apos;s Revenue
                </p>
                <div className="flex w-full items-baseline justify-between">
                  <p className="text-foreground text-3xl leading-none font-bold tracking-tight sm:text-[38px]">
                    ₱{kpis.todayRevenue?.toLocaleString() ?? '0'}
                  </p>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                    <DollarSign className="h-5 w-5 text-emerald-500" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-[13px] font-medium">Total sales today</p>
                  <p className="text-[12px] font-semibold text-emerald-500">
                    Gross: ₱{kpis.todayGrossProfit?.toLocaleString() ?? '0'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Today's Net Profit */}
        <Card className="border-border bg-card relative overflow-hidden rounded-xl shadow-sm">
          <div className="absolute top-0 right-0 left-0 h-1 bg-blue-500" />
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="w-full space-y-4">
                <p className="text-muted-foreground text-[13px] font-medium tracking-wide uppercase">
                  Today&apos;s Net Profit
                </p>
                <div className="flex w-full items-baseline justify-between">
                  <p className="text-foreground text-3xl leading-none font-bold tracking-tight sm:text-[38px]">
                    ₱{kpis.todayNetProfit?.toLocaleString() ?? '0'}
                  </p>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                    <TrendingUp className="h-5 w-5 text-blue-500" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-[13px] font-medium">
                    Owner&apos;s income today
                  </p>
                  <p className="text-[12px] font-semibold text-transparent select-none">&nbsp;</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Visual Analytics */}
      <Card className="border-border bg-card mt-8 overflow-hidden rounded-xl p-6 shadow-sm">
        <CardHeader className="border-border mb-4 border-b p-0 pb-4">
          <CardTitle className="text-foreground text-base font-semibold tracking-wide">
            Warehouse Stock Overview
          </CardTitle>
        </CardHeader>
        <div className="mt-4 h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="hsl(var(--border) / 0.5)"
              />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(var(--foreground))', fontSize: 12, fontWeight: 500 }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(var(--foreground))', fontSize: 12, fontWeight: 500 }}
                tickFormatter={(value) => value.toLocaleString()}
              />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted)/0.15)' }}
                contentStyle={{
                  borderRadius: '12px',
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  color: 'hsl(var(--foreground))',
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                  padding: '12px',
                }}
              />
              <Legend
                wrapperStyle={{ paddingTop: '30px' }}
                formatter={(value) => (
                  <span className="text-foreground/80 text-xs font-medium">{value}</span>
                )}
              />
              <Bar
                dataKey="good"
                name="Good Stock"
                fill="#1dd1a1"
                radius={[6, 6, 0, 0]}
                maxBarSize={50}
              />
              <Bar
                dataKey="obligated"
                name="Obligated (Balances)"
                fill="#feca57"
                radius={[6, 6, 0, 0]}
                maxBarSize={50}
              />
              <Bar
                dataKey="net"
                name="Net Available"
                fill="#3b82f6"
                radius={[6, 6, 0, 0]}
                maxBarSize={50}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Low Stock Alerts */}
      <Card className="border-border bg-card mt-8 overflow-hidden rounded-xl shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-muted-foreground h-5 w-5" />
            <CardTitle className="text-foreground text-base font-semibold tracking-wide">
              Low Stock Alerts
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 pt-2 pb-6 md:grid-cols-2">
          <div
            className={`${jbAlert.bg} border ${jbAlert.border} flex items-center justify-between rounded-xl p-5 shadow-sm transition-colors`}
          >
            <div>
              <h4 className="text-foreground text-[15px] font-bold">Jumbo Bags (JB)</h4>
              <p className="text-muted-foreground mt-1 text-[12px] font-medium">
                Threshold: {JB_THRESHOLD} bags
              </p>
            </div>
            <div className="text-right">
              <p
                className={`text-[28px] font-bold ${jbAlert.text} mb-1 leading-none tracking-tight`}
              >
                {kpis.jbGood.toLocaleString()}
              </p>
              <span className={`text-[10px] font-bold tracking-widest ${jbAlert.text} uppercase`}>
                {jbAlert.label}
              </span>
            </div>
          </div>
          <div
            className={`${sbAlert.bg} border ${sbAlert.border} flex items-center justify-between rounded-xl p-5 shadow-sm transition-colors`}
          >
            <div>
              <h4 className="text-foreground text-[15px] font-bold">Sling Bags (SB)</h4>
              <p className="text-muted-foreground mt-1 text-[12px] font-medium">
                Threshold: {SB_THRESHOLD} bags
              </p>
            </div>
            <div className="text-right">
              <p
                className={`text-[28px] font-bold ${sbAlert.text} mb-1 leading-none tracking-tight`}
              >
                {kpis.sbGood.toLocaleString()}
              </p>
              <span className={`text-[10px] font-bold tracking-widest ${sbAlert.text} uppercase`}>
                {sbAlert.label}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div
        className={`grid grid-cols-1 ${userRole !== 'admin' ? 'lg:grid-cols-2' : ''} mt-8 gap-6`}
      >
        {/* Pending Tasks */}
        {userRole !== 'admin' && (
          <Card className="border-border bg-card overflow-hidden rounded-xl shadow-sm">
            <CardHeader className="border-border border-b pb-4">
              <CardTitle className="text-foreground text-base font-semibold tracking-wide">
                Pending Tasks
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-border divide-y">
                <Link
                  href="/admin/clients"
                  className="hover:bg-muted/50 group flex items-center justify-between p-5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <ShieldAlert className="h-5 w-5 text-[var(--color-chart-accent-3)]" />
                    <span className="text-foreground text-[14px] font-medium">
                      New Users Awaiting Verification
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="min-w-[24px] rounded-full bg-[var(--color-chart-accent-3)] px-2 py-0.5 text-center text-[11px] font-bold text-white">
                      {kpis.pendingKyc}
                    </span>
                    <ArrowUpRight className="text-muted-foreground group-hover:text-foreground h-4 w-4 transition-colors" />
                  </div>
                </Link>
                <Link
                  href="/admin/orders#new"
                  className="hover:bg-muted/50 group flex items-center justify-between p-5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <ShoppingCart className="h-5 w-5 text-[var(--color-chart-accent-1)]" />
                    <span className="text-foreground text-[14px] font-medium">
                      Pending Orders / Requests
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="min-w-[24px] rounded-full bg-[var(--color-chart-accent-1)] px-2 py-0.5 text-center text-[11px] font-bold text-white">
                      {kpis.pendingOrders}
                    </span>
                    <ArrowUpRight className="text-muted-foreground group-hover:text-foreground h-4 w-4 transition-colors" />
                  </div>
                </Link>
                <Link
                  href="/admin/orders#fulfillment"
                  className="hover:bg-muted/50 group flex items-center justify-between p-5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Truck className="h-5 w-5 text-[var(--color-chart-1)]" />
                    <span className="text-foreground text-[14px] font-medium">
                      Pending Fulfillment
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="min-w-[24px] rounded-full bg-[var(--color-chart-1)] px-2 py-0.5 text-center text-[11px] font-bold text-white">
                      {kpis.pendingFulfillment}
                    </span>
                    <ArrowUpRight className="text-muted-foreground group-hover:text-foreground h-4 w-4 transition-colors" />
                  </div>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* System Activity Feed */}
        <Card className="border-border bg-card overflow-hidden rounded-xl shadow-sm">
          <CardHeader className="border-border border-b pb-4">
            <CardTitle className="text-foreground text-base font-semibold tracking-wide">
              System Activity Feed
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-4 p-5">
              {activityEvents.length === 0 && (
                <p className="text-muted-foreground text-sm italic">No recent system activity.</p>
              )}
              {activityEvents.slice(0, 4).map((activity) => (
                <div key={activity.id} className="flex items-center justify-between">
                  <div className="flex items-start gap-4">
                    <span className="text-muted-foreground mt-0.5 font-mono text-[12px]">
                      {new Date(activity.created_at).toLocaleTimeString([], { hour12: false })}
                    </span>
                    <div>
                      <p className="text-foreground text-[14px] font-bold">
                        {getActivityLabel(activity.action)}
                      </p>
                      <p className="text-muted-foreground text-[12px]">
                        {activity.action === 'warehouse_report_submitted'
                          ? `Report for ${String((activity.metadata as any)?.date ?? 'Unknown')}`
                          : `User: ${activity.actor?.email ?? 'Unknown'} · IP: ${String((activity.metadata as any)?.ip ?? 'Unknown')}`}
                      </p>
                    </div>
                  </div>
                  <Badge
                    className={`${activity.action === 'warehouse_report_submitted' ? 'border-0 bg-indigo-500/10 text-indigo-500' : 'border-0 bg-emerald-500/10 text-emerald-500'} hidden text-[10px] font-bold uppercase sm:flex`}
                  >
                    {activity.action === 'warehouse_report_submitted' ? 'Report' : 'Success'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Pending Orders */}
      {userRole !== 'admin' && (
        <Card className="border-border bg-card mt-8 overflow-hidden rounded-xl shadow-sm">
          <CardHeader className="border-border border-b pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-foreground text-base font-semibold tracking-wide">
                Recent Pending Orders
              </CardTitle>
              <Link
                href="/admin/orders"
                className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-[13px] font-medium transition-colors"
              >
                View All <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="hidden overflow-x-auto sm:block">
              <Table className="w-full text-left whitespace-nowrap">
                <TableHeader className="bg-muted/50 text-muted-foreground text-[12px] font-medium tracking-wider uppercase">
                  <TableRow>
                    <TableHead className="px-6 py-4">PO #</TableHead>
                    <TableHead className="px-6 py-4">Client</TableHead>
                    <TableHead className="px-6 py-4 text-right">Total Bags</TableHead>
                    <TableHead className="px-6 py-4">Payment</TableHead>
                    <TableHead className="px-6 py-4 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-border divide-y">
                  {recentOrders.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-muted-foreground px-6 py-12 text-center font-medium"
                      >
                        No pending orders
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentOrders.map((order) => {
                      const total =
                        order.items?.reduce((sum: number, i: any) => sum + i.requested_qty, 0) ?? 0;
                      return (
                        <TableRow key={order.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="text-foreground px-6 py-4 font-mono font-medium">
                            {order.po_number || `#${order.id.slice(0, 8).toUpperCase()}`}
                          </TableCell>
                          <TableCell className="text-primary px-6 py-4 font-semibold">
                            {(order as any).client?.full_name ?? 'Unknown'}
                          </TableCell>
                          <TableCell className="text-foreground px-6 py-4 text-right font-bold">
                            {total}
                          </TableCell>
                          <TableCell className="px-6 py-4">
                            <Badge
                              className={
                                order.payment_method === 'cash'
                                  ? 'border-0 bg-emerald-500/10 text-emerald-500'
                                  : 'border-0 bg-blue-500/10 text-blue-500'
                              }
                            >
                              {order.payment_method.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-6 py-4 text-right">
                            <Link
                              href={`/admin/orders#${order.id}`}
                              className="text-primary text-xs font-medium hover:underline"
                            >
                              Review
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
            {/* Mobile card view */}
            <div className="divide-border divide-y sm:hidden">
              {recentOrders.length === 0 ? (
                <div className="text-muted-foreground px-4 py-12 text-center text-sm">
                  No pending orders
                </div>
              ) : (
                recentOrders.map((order) => {
                  const total =
                    order.items?.reduce((sum: number, i: any) => sum + i.requested_qty, 0) ?? 0;
                  return (
                    <Link
                      key={order.id}
                      href={`/admin/orders#${order.id}`}
                      className="hover:bg-muted/30 flex items-center justify-between px-4 py-3 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-medium">
                          {order.po_number || `#${order.id.slice(0, 8).toUpperCase()}`}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {(order as any).client?.full_name ?? 'Unknown'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge
                          className={
                            order.payment_method === 'cash'
                              ? 'border-0 bg-emerald-500/10 text-xs text-emerald-500'
                              : 'border-0 bg-blue-500/10 text-xs text-blue-500'
                          }
                        >
                          {order.payment_method.toUpperCase()}
                        </Badge>
                        <span className="text-sm font-bold">{total}</span>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
