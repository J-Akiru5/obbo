'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import {
  submitPaymentDetails,
  submitOrderReturn,
  deleteDraftOrder,
} from '@/lib/actions/client-actions';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CornerDownLeft,
  PackageSearch,
  CreditCard,
  UploadCloud,
  Truck,
  CheckCircle2,
  History,
  AlertCircle,
  Info,
  Search,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Package,
  ArrowRight,
  FileText,
  Trash2,
} from 'lucide-react';

import { Order, OrderItem } from '@/lib/types/database';

// ─── Tracking progress steps ─────────────────────────────────
const TRACKING_STEPS = [
  { key: 'approved', label: 'Approved', icon: CheckCircle2 },
  { key: 'payment_submitted', label: 'Payment Submitted', icon: CreditCard },
  { key: 'dispatched', label: 'Dispatched', icon: Package },
  { key: 'in_transit', label: 'In Transit', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: CircleDot },
];

function getActiveStep(order: Order): number {
  if (order.status === 'completed' || order.tracking_status === 'delivered') return 4;
  if (order.tracking_status === 'in_transit') return 3;
  if (order.status === 'dispatched') return 2;
  if (
    order.status === 'pending_final_confirmation' ||
    order.status === 'awaiting_check' ||
    (order.status === 'approved' && (order.check_number || order.payment_method === 'cash'))
  )
    return 1;
  if (order.status === 'approved') return 0;
  return -1;
}

function TrackingProgressBar({ order }: { order: Order }) {
  const activeStep = getActiveStep(order);
  if (activeStep < 0) return null;

  return (
    <div className="px-2 py-3">
      <div className="flex items-center justify-between">
        {TRACKING_STEPS.map((step, idx) => {
          const StepIcon = step.icon;
          const isCompleted = idx <= activeStep;
          const isCurrent = idx === activeStep;
          return (
            <div key={step.key} className="flex flex-1 items-center last:flex-initial">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all ${
                    isCompleted
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : isCurrent
                        ? 'border-primary text-primary bg-primary/10'
                        : 'text-muted-foreground dark:bg-muted border-gray-200 bg-white dark:border-gray-600'
                  }`}
                >
                  <StepIcon className="h-4 w-4" />
                </div>
                <span
                  className={`mt-1.5 max-w-[60px] text-center text-[9px] leading-tight ${isCompleted ? 'font-semibold text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'}`}
                >
                  {step.label}
                </span>
              </div>
              {idx < TRACKING_STEPS.length - 1 && (
                <div
                  className={`mx-1.5 mt-[-14px] h-0.5 flex-1 ${idx < activeStep ? 'bg-emerald-400' : 'bg-gray-200 dark:bg-gray-600'}`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function OrdersClient({
  orders,
  drafts: initialDrafts,
}: {
  orders: Order[];
  drafts: Order[];
}) {
  const router = useRouter();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Order[]>(initialDrafts);

  // Payment Form
  const [checkNumber, setCheckNumber] = useState('');
  const [checkFile, setCheckFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Return Report
  const [isReturnOpen, setIsReturnOpen] = useState(false);
  const [returnJb, setReturnJb] = useState(0);
  const [returnSb, setReturnSb] = useState(0);
  const [returnReason, setReturnReason] = useState('');

  // History filters
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const pendingOrders = orders.filter(
    (o) => o.status === 'pending' || o.status === 'partially_approved',
  );
  const activeOrders = orders.filter(
    (o) =>
      o.status === 'approved' ||
      o.status === 'awaiting_check' ||
      o.status === 'pending_final_confirmation' ||
      o.status === 'dispatched',
  );
  const historyOrders = useMemo(() => {
    let filtered = orders.filter((o) => o.status === 'completed' || o.status === 'rejected');

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (o) => o.po_number?.toLowerCase().includes(q) || o.dr_number?.toLowerCase().includes(q),
      );
    }
    if (dateFrom) {
      filtered = filtered.filter((o) => new Date(o.created_at) >= new Date(dateFrom));
    }
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59);
      filtered = filtered.filter((o) => new Date(o.created_at) <= end);
    }
    return filtered;
  }, [orders, searchQuery, dateFrom, dateTo]);

  const handleOpenPayment = (order: Order) => {
    setSelectedOrder(order);
    setCheckNumber('');
    setCheckFile(null);
    setIsPaymentOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setCheckFile(e.target.files[0]);
    }
  };

  const handleConfirmCash = async () => {
    if (!selectedOrder) return;
    setIsSubmitting(true);
    try {
      await submitPaymentDetails(selectedOrder.id, 'cash');
      toast.success('Cash payment submitted! Awaiting admin confirmation.');
      setIsPaymentOpen(false);
      router.refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to confirm payment.';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !checkFile || !checkNumber) return;

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const fileExt = checkFile.name.split('.').pop();
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(7);
      const fileName = `${user.id}/check_${timestamp}_${random}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('order-attachments')
        .upload(fileName, checkFile);

      if (uploadError) throw new Error('Failed to upload check image.');
      const {
        data: { publicUrl },
      } = supabase.storage.from('order-attachments').getPublicUrl(fileName);

      await submitPaymentDetails(selectedOrder.id, 'check', checkNumber, publicUrl);

      toast.success('Check payment submitted! Awaiting admin verification.');
      setIsPaymentOpen(false);
      router.refresh();
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : 'An error occurred while submitting check.';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleExpanded = (orderId: string) => {
    setExpandedOrderId(expandedOrderId === orderId ? null : orderId);
  };

  const handleOpenReturn = (order: Order) => {
    setSelectedOrder(order);
    setReturnJb(0);
    setReturnSb(0);
    setReturnReason('');
    setIsReturnOpen(true);
  };

  const handleSubmitReturn = async () => {
    if (!selectedOrder) return;
    if (returnJb <= 0 && returnSb <= 0) {
      toast.error('Please enter at least one bag quantity to return.');
      return;
    }
    if (!returnReason.trim()) {
      toast.error('Please provide a reason for the return.');
      return;
    }
    setIsSubmitting(true);
    try {
      await submitOrderReturn(selectedOrder.id, returnJb, returnSb, returnReason);
      toast.success('Return request submitted. The warehouse team will review it shortly.');
      setIsReturnOpen(false);
      router.refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to submit return request.';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDraft = async (orderId: string) => {
    try {
      await deleteDraftOrder(orderId);
      setDrafts((prev) => prev.filter((d) => d.id !== orderId));
      toast.success('Draft deleted.');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to delete draft.';
      toast.error(msg);
    }
  };

  const renderOrderCard = (order: Order, type: 'pending' | 'active' | 'history') => {
    const totalBags = order.items.reduce(
      (acc: number, item: OrderItem) => acc + (item.requested_qty || 0),
      0,
    );
    const grandTotal = order.total_amount + (order.shipping_fee || 0);
    const isExpanded = expandedOrderId === order.id;
    const isRedelivery = order.order_type === 'redelivery';

    return (
      <Card key={order.id} className="bg-card border-border mb-4 overflow-hidden shadow-sm">
        <CardHeader
          className="bg-muted/30 cursor-pointer border-b pt-4 pb-3"
          onClick={() => toggleExpanded(order.id)}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-foreground truncate text-base">
                  PO: {order.po_number}
                </CardTitle>
                {isRedelivery && (
                  <Badge
                    variant="outline"
                    className="border-status-info-text/30 text-status-info-text bg-status-info-bg/50 text-[10px]"
                  >
                    Re-delivery
                  </Badge>
                )}
              </div>
              <CardDescription className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
                {new Date(order.created_at).toLocaleDateString()}
                <span>•</span>
                <span className="capitalize">
                  {order.service_type === 'pickup' ? 'Pick-up' : 'Deliver'}
                </span>
                {isRedelivery && order.linked_po_number && (
                  <>
                    <span>•</span>
                    <span className="text-primary">Linked to {order.linked_po_number}</span>
                  </>
                )}
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-foreground font-bold">₱{grandTotal.toLocaleString()}</div>
                <div className="text-muted-foreground text-xs capitalize">
                  {order.payment_method}
                </div>
              </div>
              {isExpanded ? (
                <ChevronUp className="text-muted-foreground h-4 w-4" />
              ) : (
                <ChevronDown className="text-muted-foreground h-4 w-4" />
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <div>
              <p className="text-muted-foreground text-xs">Items</p>
              <p className="text-foreground font-medium">
                {totalBags} <span className="text-muted-foreground font-normal">indiv. bags</span>
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Shipping Fee</p>
              <p className="text-foreground font-medium">
                ₱{(order.shipping_fee || 0).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Source</p>
              <p className="text-foreground font-medium uppercase">{order.source}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Status</p>
              {order.status === 'pending' && (
                <Badge variant="secondary" className="text-center whitespace-normal">
                  Awaiting Approval
                </Badge>
              )}
              {order.status === 'partially_approved' && (
                <Badge className="bg-status-info-bg text-status-info-text border-status-info-text/20 text-center whitespace-normal">
                  Partially Approved
                </Badge>
              )}
              {order.status === 'approved' && (
                <Badge
                  className={
                    order.payment_method === 'cash'
                      ? 'bg-status-success-bg text-status-success-text border-status-success-border/20 text-center whitespace-normal'
                      : 'bg-status-pending-bg text-status-pending-text border-status-pending-border text-center whitespace-normal'
                  }
                >
                  {order.payment_method === 'cash' ? 'Ready for Dispatch' : 'Payment Required'}
                </Badge>
              )}
              {order.status === 'awaiting_check' && (
                <Badge className="bg-status-pending-bg text-status-pending-text border-status-pending-border text-center whitespace-normal">
                  Upload Check
                </Badge>
              )}
              {order.status === 'pending_final_confirmation' && (
                <Badge className="bg-status-success-bg text-status-success-text border-status-success-border text-center whitespace-normal">
                  ✅ Payment Submitted
                </Badge>
              )}
              {order.status === 'dispatched' && (
                <Badge className="bg-status-success-bg text-status-success-text border-status-success-border/20 text-center whitespace-normal">
                  {order.tracking_status === 'in_transit' ? 'In Transit' : 'Dispatched'}
                </Badge>
              )}
              {order.status === 'completed' && (
                <Badge
                  variant="outline"
                  className="border-status-success-border text-status-success-text text-center whitespace-normal"
                >
                  Completed
                </Badge>
              )}
              {order.status === 'rejected' && (
                <Badge variant="destructive" className="text-center whitespace-normal">
                  Rejected
                </Badge>
              )}
            </div>
          </div>

          {/* Report Return — for dispatched and completed orders */}
          {(order.status === 'dispatched' || order.status === 'completed') && (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950"
              onClick={() => handleOpenReturn(order)}
            >
              <CornerDownLeft className="h-4 w-4" />
              Report Return
            </Button>
          )}

          {/* Split delivery badge */}
          {order.is_split_delivery && (
            <div className="text-status-info-text bg-status-info-bg border-status-info-text/20 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs">
              <ArrowRight className="h-3 w-3" />
              <span>Split delivery: {order.deliver_now_qty} bags now, rest saved to balance</span>
            </div>
          )}

          {/* Check Payment Upload (Only for Check method + Awaiting status) */}
          {type === 'active' &&
            order.status === 'awaiting_check' &&
            order.payment_method === 'check' && (
              <div className="bg-status-pending-bg border-status-pending-border space-y-3 rounded-lg border p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="text-status-pending-text mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <span className="text-foreground text-sm font-medium">
                      Order Approved – Awaiting Payment.
                    </span>
                    {order.shipping_fee > 0 && (
                      <span className="text-foreground text-sm">
                        {' '}
                        Shipping Fee: <strong>₱{order.shipping_fee.toLocaleString()}</strong>.
                      </span>
                    )}
                    <p className="text-muted-foreground mt-1 text-xs">
                      Please upload a picture of your check to proceed.
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="bg-status-pending-text hover:bg-status-pending-text/80 text-background w-full sm:w-auto"
                  onClick={() => handleOpenPayment(order)}
                >
                  <UploadCloud className="mr-2 h-4 w-4" />
                  Upload Check Details
                </Button>
              </div>
            )}

          {/* Approved / Ready for Dispatch Banner (For Cash COD or Verified Check) */}
          {type === 'active' && order.status === 'approved' && (
            <div className="bg-status-success-bg border-status-success-border space-y-2 rounded-lg border p-3">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="text-status-success-text mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <span className="text-status-success-text text-sm font-bold">
                    Your order has been approved.
                  </span>
                  {order.shipping_fee > 0 && (
                    <span className="text-status-success-text text-sm">
                      {' '}
                      Shipping Fee: <strong>₱{order.shipping_fee.toLocaleString()}</strong>.
                    </span>
                  )}
                  <p className="text-status-success-text mt-1 text-xs">
                    Your order is queued for dispatch.{' '}
                    {order.payment_method === 'cash'
                      ? 'Please prepare the cash payment for collection upon delivery.'
                      : 'Your check payment has been verified.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Awaiting admin verification (Both cash & check) */}
          {type === 'active' && order.status === 'pending_final_confirmation' && (
            <div className="bg-status-success-bg border-status-success-border text-status-success-text flex items-center gap-2 rounded-lg border p-3 text-sm">
              <CheckCircle2 className="text-status-success-text h-4 w-4" />
              <span>Payment Submitted – Awaiting Admin Confirmation.</span>
            </div>
          )}

          {/* Tracking progress bar + details */}
          {type === 'active' &&
            (order.status === 'dispatched' ||
              order.status === 'approved' ||
              order.status === 'awaiting_check' ||
              order.status === 'pending_final_confirmation') && (
              <TrackingProgressBar order={order} />
            )}

          {type === 'active' && order.status === 'dispatched' && (
            <div className="bg-status-success-bg border-status-success-border/20 text-status-success-text flex flex-col justify-between gap-2 rounded-lg border p-3 text-sm sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4" />
                <span className="font-semibold">Tracking:</span>{' '}
                {order.tracking_status === 'in_transit'
                  ? 'Currently in transit'
                  : 'Prepared for dispatch'}
              </div>
              {order.dr_number && (
                <div>
                  DR: <span className="font-mono">{order.dr_number}</span>
                </div>
              )}
            </div>
          )}

          {/* Rejection reason */}
          {order.status === 'rejected' && order.rejection_reason && (
            <div className="bg-destructive/10 border-destructive/20 text-destructive flex items-start gap-2 rounded-lg border p-3 text-sm">
              <AlertCircle className="text-destructive mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <span className="font-medium">Rejection Reason:</span> {order.rejection_reason}
              </div>
            </div>
          )}

          {/* Expanded details */}
          {isExpanded && (
            <div className="border-border mt-3 space-y-3 border-t pt-3">
              <h4 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Order Items
              </h4>
              <div className="space-y-2">
                {order.items.map((item: any) => (
                  <div
                    key={item.id}
                    className="bg-muted/30 flex items-center justify-between gap-3 rounded p-2 text-sm"
                  >
                    <div className="min-w-0">
                      <span className="block truncate font-medium">
                        {item.product?.name || 'Product'}
                      </span>
                      <span className="text-muted-foreground">({item.bag_type})</span>
                    </div>
                    <div className="text-muted-foreground shrink-0 text-right text-xs">
                      <div>Requested: {item.requested_qty}</div>
                      {item.approved_qty > 0 && (
                        <div className="text-emerald-600">Approved: {item.approved_qty}</div>
                      )}
                      {item.dispatched_qty > 0 && (
                        <div className="text-blue-600">Dispatched: {item.dispatched_qty}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {order.supplier_name && (
                <div className="text-muted-foreground text-xs">
                  Supplier: <span className="text-foreground">{order.supplier_name}</span>
                </div>
              )}
              {order.driver_name && (
                <div className="text-muted-foreground text-xs">
                  Driver: <span className="text-foreground">{order.driver_name}</span> | Plate:{' '}
                  <span className="text-foreground">{order.plate_number}</span>
                </div>
              )}
              {order.dr_number && (
                <div className="text-muted-foreground text-xs">
                  DR Number: <span className="text-foreground font-mono">{order.dr_number}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-foreground text-2xl font-bold tracking-tight">My Orders</h2>
        <p className="text-muted-foreground text-sm">
          Track and manage all your cement orders and re-delivery requests.
        </p>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="no-scrollbar mb-6 h-auto w-full justify-start overflow-x-auto rounded-none border-b bg-transparent p-0">
          <TabsTrigger
            value="active"
            className="data-[state=active]:border-primary data-[state=active]:text-primary mr-6 shrink-0 rounded-none px-0 py-3 whitespace-nowrap shadow-none data-[state=active]:border-b-2"
          >
            Active & Tracking ({activeOrders.length})
          </TabsTrigger>
          <TabsTrigger
            value="pending"
            className="data-[state=active]:border-primary data-[state=active]:text-primary mr-6 shrink-0 rounded-none px-0 py-3 whitespace-nowrap shadow-none data-[state=active]:border-b-2"
          >
            Pending Approval ({pendingOrders.length})
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="data-[state=active]:border-primary data-[state=active]:text-primary shrink-0 rounded-none px-0 py-3 whitespace-nowrap shadow-none data-[state=active]:border-b-2"
          >
            Order History
          </TabsTrigger>
          {drafts.length > 0 && (
            <TabsTrigger
              value="drafts"
              className="data-[state=active]:border-primary data-[state=active]:text-primary mr-6 shrink-0 rounded-none px-0 py-3 whitespace-nowrap shadow-none data-[state=active]:border-b-2"
            >
              Drafts ({drafts.length})
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="active" className="mt-0">
          {activeOrders.length === 0 ? (
            <div className="text-muted-foreground border-border bg-card rounded-xl border border-dashed p-12 text-center">
              <Truck className="text-muted-foreground/30 mx-auto mb-3 h-8 w-8" />
              <p>No active shipments at the moment.</p>
            </div>
          ) : (
            activeOrders.map((o) => renderOrderCard(o, 'active'))
          )}
        </TabsContent>

        <TabsContent value="pending" className="mt-0">
          {pendingOrders.length === 0 ? (
            <div className="text-muted-foreground border-border bg-card rounded-xl border border-dashed p-12 text-center">
              <PackageSearch className="text-muted-foreground/30 mx-auto mb-3 h-8 w-8" />
              <p>No pending orders.</p>
            </div>
          ) : (
            pendingOrders.map((o) => renderOrderCard(o, 'pending'))
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-0 space-y-4">
          {/* History Filters */}
          <div className="bg-card border-border flex flex-col gap-3 rounded-lg border p-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Search by PO # or DR #..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <CalendarDays className="text-muted-foreground h-4 w-4 shrink-0" />
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[140px] min-w-0"
              />
              <span className="text-muted-foreground text-xs">to</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[140px] min-w-0"
              />
            </div>
          </div>

          {historyOrders.length === 0 ? (
            <div className="text-muted-foreground border-border bg-card rounded-xl border border-dashed p-12 text-center">
              <History className="text-muted-foreground/30 mx-auto mb-3 h-8 w-8" />
              <p>
                {searchQuery || dateFrom || dateTo
                  ? 'No orders match your filters.'
                  : 'No completed or rejected orders yet.'}
              </p>
            </div>
          ) : (
            historyOrders.map((o) => renderOrderCard(o, 'history'))
          )}
        </TabsContent>

        <TabsContent value="drafts" className="mt-0">
          {drafts.length === 0 ? (
            <div className="text-muted-foreground border-border bg-card rounded-xl border border-dashed p-12 text-center">
              <FileText className="text-muted-foreground/30 mx-auto mb-3 h-8 w-8" />
              <p>No saved drafts.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {drafts.map((draft) => {
                const totalBags = draft.items.reduce(
                  (acc: number, item: OrderItem) => acc + (item.requested_qty || 0),
                  0,
                );
                return (
                  <Card key={draft.id} className="bg-card border-border overflow-hidden shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
                            <span className="text-foreground truncate text-sm font-semibold">
                              PO: {draft.po_number || 'No PO #'}
                            </span>
                            <Badge variant="outline" className="border-dashed text-[10px]">
                              Draft
                            </Badge>
                          </div>
                          <p className="text-muted-foreground mt-1 text-xs">
                            {new Date(draft.created_at).toLocaleDateString()} &middot; {totalBags}{' '}
                            bags &middot;{' '}
                            {draft.items
                              .map((i: OrderItem) => `${i.requested_qty} ${i.bag_type}`)
                              .join(' + ')}
                          </p>
                          <p className="text-muted-foreground text-xs capitalize">
                            {draft.source} &middot;{' '}
                            {draft.service_type === 'pickup' ? 'Pick-up' : 'Deliver'} &middot;{' '}
                            {draft.payment_method}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Button
                            size="sm"
                            className="bg-primary gap-1.5"
                            onClick={() => router.push(`/client/orders/new?draft=${draft.id}`)}
                          >
                            <ArrowRight className="h-3.5 w-3.5" />
                            Resume
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
                            onClick={() => handleDeleteDraft(draft.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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
      </Tabs>

      {/* Payment Dialog */}
      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Payment Details</DialogTitle>
            <DialogDescription>
              Please submit the {selectedOrder?.payment_method} payment of ₱
              {(
                (selectedOrder?.total_amount || 0) + (selectedOrder?.shipping_fee || 0)
              ).toLocaleString()}{' '}
              to process your order.
            </DialogDescription>
          </DialogHeader>

          {selectedOrder?.payment_method === 'cash' ? (
            <div className="space-y-6 py-4">
              <div className="bg-status-info-bg border-status-info-text/20 flex items-start gap-3 rounded-lg border p-4">
                <Info className="text-status-info-text h-5 w-5 shrink-0" />
                <p className="text-status-info-text text-sm">
                  You have selected <strong>Cash</strong>. By confirming, you agree to pay the total
                  amount upon pick-up or delivery. Your order will be queued for dispatch
                  immediately.
                </p>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsPaymentOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-primary hover:bg-primary/90"
                  onClick={handleConfirmCash}
                  disabled={isSubmitting}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Confirm Cash Payment
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleSubmitCheck} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="check-number">
                  Check Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="check-number"
                  required
                  value={checkNumber}
                  onChange={(e) => setCheckNumber(e.target.value)}
                  placeholder="Enter exact check number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="check-upload">
                  Upload Picture of Check <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="check-upload"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileChange}
                  required
                />
                <p className="text-muted-foreground text-[10px]">
                  Please ensure all details are clearly visible.
                </p>
              </div>
              <DialogFooter className="pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsPaymentOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-primary" disabled={isSubmitting}>
                  <UploadCloud className="mr-2 h-4 w-4" />
                  {isSubmitting ? 'Uploading...' : 'Submit Check'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Return Report Dialog */}
      <Dialog open={isReturnOpen} onOpenChange={setIsReturnOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report Bag Return</DialogTitle>
            <DialogDescription>
              Report returned bags for PO {selectedOrder?.po_number}. The warehouse team will review
              your request and process the return.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>JB Bags Returned</Label>
                <Input
                  type="number"
                  min={0}
                  value={returnJb || ''}
                  onChange={(e) => setReturnJb(parseInt(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>SB Bags Returned</Label>
                <Input
                  type="number"
                  min={0}
                  value={returnSb || ''}
                  onChange={(e) => setReturnSb(parseInt(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>
                Reason for Return <span className="text-red-500">*</span>
              </Label>
              <textarea
                className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring min-h-[80px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="Explain why the bags are being returned (e.g., damaged on arrival, wrong product, excess quantity)..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsReturnOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitReturn}
              disabled={isSubmitting}
              className="bg-primary gap-2"
            >
              <CornerDownLeft className="h-4 w-4" />
              {isSubmitting ? 'Submitting...' : 'Submit Return Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
