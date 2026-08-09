'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Package, Clock, CheckCircle2, Truck, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { createClient } from '@/lib/supabase/client';
import type { Order, OrderItem, Product } from '@/lib/types/database';
import { BAG_EQUIVALENT, getSubtotal } from '@/components/orders/wizard/order-schema';

type FullOrder = Order & {
  order_items: (OrderItem & { product: Product | null })[];
};

const STATUS_STEPS = ['pending', 'approved', 'dispatched', 'completed'];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    approved: 'bg-blue-50 text-blue-700 border-blue-200',
    partially_approved: 'bg-orange-50 text-orange-700 border-orange-200',
    awaiting_check: 'bg-purple-50 text-purple-700 border-purple-200',
    dispatched: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
  };
  return (
    <Badge variant="outline" className={`capitalize ${map[status] ?? ''}`}>
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}

function StatusTimeline({ status }: { status: string }) {
  if (status === 'rejected') {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
        <XCircle className="h-5 w-5 flex-shrink-0 text-red-500" />
        <p className="text-sm font-medium text-red-800">Order was rejected by admin.</p>
      </div>
    );
  }
  const currentIdx = STATUS_STEPS.indexOf(status);
  const icons = [Clock, CheckCircle2, Truck, CheckCircle2];
  return (
    <div className="space-y-2">
      {STATUS_STEPS.map((s, idx) => {
        const done = idx <= currentIdx;
        const active = idx === currentIdx;
        const Icon = icons[idx];
        return (
          <div
            key={s}
            className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${done ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/30'}`}
          >
            <div
              className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${done ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <p
                className={`text-sm font-semibold capitalize ${done ? 'text-foreground' : 'text-muted-foreground'}`}
              >
                {s.replace(/_/g, ' ')}
              </p>
            </div>
            {active && (
              <span className="text-primary bg-primary/10 rounded-full px-2 py-0.5 text-xs font-medium">
                Current
              </span>
            )}
            {done && !active && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          </div>
        );
      })}
    </div>
  );
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<FullOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function fetchOrder() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*, product:products(*))')
        .eq('id', id)
        .eq('client_id', user.id)
        .single();
      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setOrder(data as FullOrder);
      setLoading(false);
    }
    fetchOrder();
  }, [id]);

  if (loading)
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );

  if (notFound)
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <AlertCircle className="text-muted-foreground/40 mx-auto mb-3 h-12 w-12" />
        <p className="text-muted-foreground mb-4">Order not found.</p>
        <Link href="/client/orders">
          <Button variant="outline">Back to Orders</Button>
        </Link>
      </div>
    );

  if (!order) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/client/orders')}
          className="text-muted-foreground gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" /> Orders
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-bold">Order #{order.id.split('-').pop()?.toUpperCase()}</h2>
        <StatusBadge status={order.status} />
        <Badge variant="outline" className="capitalize">
          {order.payment_method}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-4 w-4" />
                Items Ordered
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {order.order_items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="text-sm font-semibold">{item.product?.name ?? 'Product'}</p>
                    <p className="text-muted-foreground text-xs">
                      {item.bag_type === 'JB' ? 'Jumbo Bag' : 'Sling Bag'}
                    </p>
                    <div className="text-muted-foreground mt-1 flex gap-3 text-xs">
                      <span>
                        Requested: <strong>{item.requested_qty.toLocaleString()}</strong>
                      </span>
                      {item.approved_qty > 0 && (
                        <span>
                          Approved:{' '}
                          <strong className="text-blue-600">
                            {item.approved_qty.toLocaleString()}
                          </strong>
                        </span>
                      )}
                      {item.dispatched_qty > 0 && (
                        <span>
                          Dispatched:{' '}
                          <strong className="text-indigo-600">
                            {item.dispatched_qty.toLocaleString()}
                          </strong>
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-primary text-sm font-bold">
                    {/* requested_qty is stored in JB/SB UNITS, not individual bags —
                                            must convert through BAG_EQUIVALENT before pricing. See §3.2. */}
                    ₱
                    {getSubtotal(
                      item.requested_qty * BAG_EQUIVALENT[item.bag_type],
                      Number(item.product?.price_per_bag ?? 0),
                    ).toLocaleString()}
                  </p>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span className="text-primary">₱{Number(order.total_amount).toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>

          {order.notes && (
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-muted-foreground mb-1 text-xs font-semibold tracking-wide uppercase">
                  Notes
                </p>
                <p className="text-sm">{order.notes}</p>
              </CardContent>
            </Card>
          )}

          <p className="text-muted-foreground text-xs">
            Placed on{' '}
            {new Date(order.created_at).toLocaleDateString('en-PH', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Order Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <StatusTimeline status={order.status} />
            </CardContent>
          </Card>

          {order.status === 'awaiting_check' && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="pt-4 pb-4">
                <p className="mb-1 text-sm font-semibold text-amber-900">Action Required</p>
                <p className="text-sm text-amber-800">
                  Your check is being verified. Please ensure you have submitted the physical check
                  to our office.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
