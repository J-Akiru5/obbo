import { useState, useMemo } from 'react';
import { Order } from '@/lib/types/database';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Check,
  X,
  FileText,
  Truck,
  MapPin,
  ExternalLink,
  Car,
  Search,
  Filter,
  Clock,
  CreditCard,
} from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function NewRequestsTab({
  orders,
  onApprove,
  onReject,
  onConfirmCheck,
  loading,
}: {
  orders: Order[];
  onApprove: (
    id: string,
    items: { itemId: string; qty: number }[],
    shippingFee?: number,
  ) => Promise<void>;
  onReject: (id: string, reason: string) => Promise<void>;
  onConfirmCheck?: (id: string) => Promise<void>;
  loading: boolean;
}) {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'check' | null>(null);
  const [approvedQtys, setApprovedQtys] = useState<Record<string, number>>({});
  const [shippingFee, setShippingFee] = useState<number>(0);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        (order.po_number || '').toLowerCase().includes(q) ||
        (order.client?.company_name || order.client?.full_name || '').toLowerCase().includes(q) ||
        order.id.toLowerCase().includes(q);
      const matchesService = serviceFilter === 'all' || order.service_type === serviceFilter;
      const matchesPayment = paymentFilter === 'all' || order.payment_method === paymentFilter;
      return matchesSearch && matchesService && matchesPayment;
    });
  }, [orders, searchQuery, serviceFilter, paymentFilter]);

  const openAction = (order: Order, type: 'approve' | 'reject' | 'check') => {
    setSelectedOrder(order);
    setActionType(type);
    if (type === 'approve') {
      const initialQtys: Record<string, number> = {};
      if (order.is_split_delivery) {
        // Default approved quantities to the 'deliver now' request
        order.items.forEach((item) => {
          if (item.bag_type === 'JB') initialQtys[item.id] = order.deliver_now_jb || 0;
          else if (item.bag_type === 'SB') initialQtys[item.id] = order.deliver_now_sb || 0;
          else initialQtys[item.id] = item.requested_qty;
        });
      } else {
        order.items.forEach((item) => {
          initialQtys[item.id] = item.requested_qty;
        });
      }
      setApprovedQtys(initialQtys);
      setShippingFee(order.service_type === 'deliver' ? order.shipping_fee || 0 : 0);
    } else {
      setRejectionReason('');
    }
  };

  const handleSubmit = async () => {
    if (!selectedOrder || !actionType) return;
    setIsSubmitting(true);
    try {
      if (actionType === 'approve') {
        const itemsToApprove = selectedOrder.items.map((item) => ({
          itemId: item.id,
          qty: approvedQtys[item.id] ?? item.requested_qty,
        }));
        await onApprove(
          selectedOrder.id,
          itemsToApprove,
          selectedOrder.service_type === 'deliver' ? shippingFee : undefined,
        );
      } else if (actionType === 'reject') {
        if (!rejectionReason.trim()) {
          toast.error('Please provide a rejection reason.');
          setIsSubmitting(false);
          return;
        }
        await onReject(selectedOrder.id, rejectionReason);
      } else if (actionType === 'check') {
        if (onConfirmCheck) {
          await onConfirmCheck(selectedOrder.id);
        }
      }
      setSelectedOrder(null);
      setActionType(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading)
    return (
      <div className="text-muted-foreground animate-pulse py-8 text-center">
        Loading requests...
      </div>
    );
  if (orders.length === 0)
    return (
      <div className="text-muted-foreground rounded-xl border-2 border-dashed py-12 text-center">
        No pending requests.
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="bg-card border-border mb-6 flex flex-col gap-4 rounded-xl border p-4 shadow-sm md:flex-row">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
          <Input
            placeholder="Search by Client Name, PO Number, or ID..."
            className="bg-background pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-4">
          <div className="w-40">
            <Select value={serviceFilter} onValueChange={(val) => setServiceFilter(val || 'all')}>
              <SelectTrigger className="bg-background">
                <Filter className="text-muted-foreground mr-2 h-4 w-4" />
                <SelectValue placeholder="Service" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                <SelectItem value="deliver">Delivery</SelectItem>
                <SelectItem value="pickup">Pick-up</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-40">
            <Select value={paymentFilter} onValueChange={(val) => setPaymentFilter(val || 'all')}>
              <SelectTrigger className="bg-background">
                <Filter className="text-muted-foreground mr-2 h-4 w-4" />
                <SelectValue placeholder="Payment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payments</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="check">Check</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="text-muted-foreground rounded-xl border-2 border-dashed py-12 text-center">
          No requests match your filters.
        </div>
      ) : (
        filteredOrders.map((order) => {
          const jbItem = order.items.find((i) => i.bag_type === 'JB');
          const sbItem = order.items.find((i) => i.bag_type === 'SB');
          const totalBags = order.items.reduce((sum, item) => sum + item.requested_qty, 0);

          return (
            <Card
              key={order.id}
              className="border-l-accent overflow-hidden border-l-4 transition-shadow hover:shadow-md"
            >
              <CardContent className="p-0">
                <div className="flex flex-col md:flex-row">
                  <div className="flex-1 space-y-4 p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="mb-1 flex items-center gap-2">
                          {order.status === 'pending_final_confirmation' ? (
                            <Badge className="border-blue-200 bg-blue-100 text-blue-700">
                              Check Uploaded - Needs Review
                            </Badge>
                          ) : order.status === 'awaiting_check' ? (
                            <Badge className="border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                              Awaiting Client Check Upload
                            </Badge>
                          ) : (
                            <Badge className="bg-accent text-accent-foreground hover:bg-accent/90">
                              New Request
                            </Badge>
                          )}
                          {order.is_split_delivery && (
                            <Badge
                              variant="outline"
                              className="border-amber-500 bg-amber-50 font-bold text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                            >
                              SPLIT
                            </Badge>
                          )}
                          <span className="text-muted-foreground text-xs">
                            ID: {order.id.slice(0, 8)}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            • {new Date(order.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Avatar className="border-border/50 h-8 w-8 border">
                            {order.client?.avatar_url ? (
                              <AvatarImage
                                src={order.client.avatar_url}
                                alt="Client"
                                className="object-cover"
                              />
                            ) : (
                              <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-bold">
                                {(order.client?.full_name || 'CL')
                                  .split(' ')
                                  .map((n) => n[0])
                                  .join('')
                                  .toUpperCase()
                                  .slice(0, 2)}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <h3 className="text-lg font-bold">
                            {order.client?.company_name || order.client?.full_name}
                          </h3>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                          Payment Method
                        </p>
                        <Badge
                          variant="outline"
                          className={`mt-1 font-mono uppercase ${order.payment_method === 'check' ? 'border-accent text-accent' : 'border-primary text-primary'}`}
                        >
                          {order.payment_method}
                        </Badge>
                      </div>
                    </div>

                    <div className="border-border/50 bg-muted/20 grid grid-cols-2 gap-4 border-y py-3 md:grid-cols-4">
                      <div>
                        <p className="text-muted-foreground mb-1 text-xs">PO Details</p>
                        {order.po_number ? (
                          <div className="flex items-center gap-1.5 text-sm font-medium">
                            <FileText className="text-primary h-4 w-4" />
                            {order.po_number}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm italic">None</span>
                        )}
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1 text-xs">Source & Service</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px] uppercase">
                            {order.source}
                          </Badge>
                          <Badge
                            variant="secondary"
                            className="flex items-center gap-1 text-[10px] uppercase"
                          >
                            {order.service_type === 'deliver' ? (
                              <Truck className="h-3 w-3" />
                            ) : (
                              <MapPin className="h-3 w-3" />
                            )}
                            {order.service_type}
                          </Badge>
                        </div>
                      </div>
                      <div className="col-span-2">
                        <p className="text-muted-foreground mb-1 text-xs">Ordered Quantity</p>
                        <div className="flex flex-wrap gap-3">
                          {jbItem && (jbItem.requested_qty > 0 || order.deliver_now_jb > 0) && (
                            <div className="bg-primary/5 border-primary/10 rounded border px-2 py-1">
                              <p className="text-foreground text-lg leading-none font-bold">
                                {order.is_split_delivery ? (
                                  <span>
                                    {order.deliver_now_jb}{' '}
                                    <span className="text-muted-foreground text-[10px] font-normal">
                                      / {jbItem.requested_qty}
                                    </span>
                                  </span>
                                ) : (
                                  jbItem.requested_qty
                                )}
                                <span className="text-muted-foreground ml-1 text-xs font-medium uppercase">
                                  JB
                                </span>
                              </p>
                              <p className="text-muted-foreground text-[9px]">
                                ={' '}
                                {(order.is_split_delivery
                                  ? order.deliver_now_jb
                                  : jbItem.requested_qty) * 25}{' '}
                                bags
                              </p>
                            </div>
                          )}
                          {sbItem && (sbItem.requested_qty > 0 || order.deliver_now_sb > 0) && (
                            <div className="bg-primary/5 border-primary/10 rounded border px-2 py-1">
                              <p className="text-foreground text-lg leading-none font-bold">
                                {order.is_split_delivery ? (
                                  <span>
                                    {order.deliver_now_sb}{' '}
                                    <span className="text-muted-foreground text-[10px] font-normal">
                                      / {sbItem.requested_qty}
                                    </span>
                                  </span>
                                ) : (
                                  sbItem.requested_qty
                                )}
                                <span className="text-muted-foreground ml-1 text-xs font-medium uppercase">
                                  SB
                                </span>
                              </p>
                              <p className="text-muted-foreground text-[9px]">
                                ={' '}
                                {(order.is_split_delivery
                                  ? order.deliver_now_sb
                                  : sbItem.requested_qty) * 50}{' '}
                                bags
                              </p>
                            </div>
                          )}
                          {totalBags > 0 && !jbItem && !sbItem && (
                            <p className="text-foreground text-lg font-bold">{totalBags} bags</p>
                          )}
                        </div>
                        <p className="mt-1 text-[9px] text-amber-600">
                          💡 1 JB = 25 bags | 1 SB = 50 bags
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Total Value: </span>
                        <span className="text-primary font-bold">
                          ₱
                          {order.total_amount.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                      {order.check_image_url && (
                        <div className="flex gap-2">
                          <a
                            href={order.check_image_url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1.5 rounded border border-emerald-100 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-600 hover:text-emerald-700"
                          >
                            <ExternalLink className="h-3 w-3" />
                            View Check
                          </a>
                          {order.po_image_url && (
                            <a
                              href={order.po_image_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:text-primary/80 bg-primary/5 border-primary/10 flex items-center gap-1.5 rounded border px-2 py-1 text-xs font-medium"
                            >
                              <ExternalLink className="h-3 w-3" />
                              View PO
                            </a>
                          )}
                        </div>
                      )}
                      {!order.check_image_url && order.po_image_url && (
                        <a
                          href={order.po_image_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:text-primary/80 bg-primary/5 border-primary/10 flex items-center gap-1.5 rounded border px-2 py-1 text-xs font-medium"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View PO Document
                        </a>
                      )}
                    </div>
                    {order.status === 'pending_final_confirmation' && (
                      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                        <p className="mb-1 flex items-center gap-1.5 font-semibold">
                          <CreditCard className="h-4 w-4" /> Payment Details
                        </p>
                        <p className="text-xs">
                          {order.payment_method === 'check' ? (
                            <>
                              Check Number:{' '}
                              <span className="font-mono font-bold">{order.check_number}</span>
                            </>
                          ) : (
                            <>
                              Payment Method: <span className="font-bold uppercase">Cash</span>
                            </>
                          )}
                        </p>
                      </div>
                    )}
                    {order.service_type === 'pickup' && (
                      <div className="border-accent/20 bg-accent/5 text-accent rounded-md border px-4 py-3 text-sm">
                        <p className="text-accent mb-2 flex items-center gap-1.5 font-semibold">
                          <Car className="h-4 w-4" />
                          Pick-up Details
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-accent/60 text-xs font-medium tracking-wider uppercase">
                              Driver
                            </p>
                            <p className="text-accent font-semibold">
                              {order.driver_name || (
                                <span className="text-destructive font-normal italic">
                                  Not provided
                                </span>
                              )}
                            </p>
                          </div>
                          <div>
                            <p className="text-accent/60 text-xs font-medium tracking-wider uppercase">
                              Plate No.
                            </p>
                            <p className="text-accent font-mono font-semibold">
                              {order.plate_number || (
                                <span className="text-destructive font-normal italic">
                                  Not provided
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    {order.notes && (
                      <div className="border-muted bg-muted/20 rounded-md border px-4 py-3 text-sm">
                        <p className="text-muted-foreground mb-1 flex items-center gap-1.5 font-semibold">
                          <FileText className="h-4 w-4" /> Notes
                        </p>
                        <p className="text-muted-foreground whitespace-pre-wrap">{order.notes}</p>
                      </div>
                    )}
                  </div>
                  <div className="bg-muted/40 border-border/50 flex flex-col justify-center gap-3 border-l p-5 md:w-48">
                    {order.status === 'pending_final_confirmation' ? (
                      <Button
                        onClick={() => openAction(order, 'check')}
                        className="w-full bg-blue-600 hover:bg-blue-700"
                      >
                        <Check className="mr-2 h-4 w-4" /> Review & Confirm
                      </Button>
                    ) : order.status === 'awaiting_check' ? (
                      <Button
                        disabled
                        className="bg-muted text-muted-foreground border-border w-full"
                      >
                        <Clock className="mr-2 h-4 w-4" /> Waiting...
                      </Button>
                    ) : (
                      <Button
                        onClick={() => openAction(order, 'approve')}
                        className="bg-primary hover:bg-primary/90 w-full"
                      >
                        <Check className="mr-2 h-4 w-4" /> Approve
                      </Button>
                    )}
                    <Button
                      onClick={() => openAction(order, 'reject')}
                      variant="outline"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20 w-full"
                      disabled={order.status === 'awaiting_check'}
                    >
                      <X className="mr-2 h-4 w-4" /> Reject
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve'
                ? 'Approve Order'
                : actionType === 'check'
                  ? 'Final Payment Confirmation'
                  : 'Reject Order'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'approve'
                ? 'Review requested quantities and set shipping details. You can partially approve items if stock is low.'
                : actionType === 'check'
                  ? `Are you sure you want to confirm this ${selectedOrder?.payment_method} payment? This will move the order to the Fulfillment queue.`
                  : 'Please provide a reason for rejecting this order.'}
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && actionType === 'approve' && (
            <div className="space-y-5 py-4">
              <div className="bg-accent/10 text-accent border-accent/20 rounded-lg border p-3 text-sm">
                <p className="mb-1 font-semibold">Approval Workflow</p>
                <ul className="list-disc space-y-0.5 pl-5 text-xs">
                  {selectedOrder.payment_method === 'check' ? (
                    <li>
                      This is a <b>Check</b> payment. Approval will move it to &quot;Awaiting
                      Check&quot; status.
                    </li>
                  ) : (
                    <li>
                      This is a <b>Cash</b> payment. Approval will move it directly to Fulfillment.
                    </li>
                  )}
                  {selectedOrder.is_split_delivery && (
                    <li className="font-bold text-amber-700">
                      CLIENT REQUESTED SPLIT: Deliver <b>{selectedOrder.deliver_now_jb}</b> JB and{' '}
                      <b>{selectedOrder.deliver_now_sb}</b> SB now.
                    </li>
                  )}
                  <li>
                    If you approve less than requested, the remaining bags will automatically become
                    a Customer Balance.
                  </li>
                </ul>
              </div>

              <div className="space-y-4">
                <h4 className="border-b pb-2 text-sm font-semibold">Requested Quantities</h4>
                {selectedOrder.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-4">
                    <div className="w-16">
                      <Badge variant="outline" className="font-mono">
                        {item.bag_type}
                      </Badge>
                    </div>
                    <div className="flex-1">
                      <p className="text-muted-foreground text-xs">
                        Requested: {item.requested_qty} units (
                        {item.requested_qty * (item.bag_type === 'JB' ? 25 : 50)} bags)
                      </p>
                    </div>
                    <div className="w-32">
                      <Label className="mb-1 block text-xs" htmlFor={`approve-qty-${item.id}`}>
                        Approve Qty
                      </Label>
                      <Input
                        id={`approve-qty-${item.id}`}
                        type="number"
                        min="0"
                        max={item.requested_qty}
                        value={approvedQtys[item.id] || ''}
                        placeholder="0"
                        onChange={(e) =>
                          setApprovedQtys((prev) => ({
                            ...prev,
                            [item.id]: parseInt(e.target.value) || 0,
                          }))
                        }
                      />
                    </div>
                  </div>
                ))}
                <p className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-600">
                  💡 1 JB = 25 bags | 1 SB = 50 bags
                </p>
              </div>

              {selectedOrder.service_type === 'deliver' && (
                <div className="space-y-2 border-t pt-2">
                  <Label htmlFor="shipping-fee">Shipping Fee (₱)</Label>
                  <Input
                    id="shipping-fee"
                    type="number"
                    value={shippingFee || ''}
                    placeholder="0"
                    onChange={(e) => setShippingFee(parseFloat(e.target.value) || 0)}
                  />
                  <p className="text-muted-foreground text-xs">Required for delivery orders.</p>
                </div>
              )}
              {selectedOrder.po_image_url && (
                <div className="bg-muted/50 mt-3 flex items-center justify-between rounded-lg border p-2 text-sm">
                  <span className="text-muted-foreground">PO Document</span>
                  <a
                    href={selectedOrder.po_image_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary flex items-center gap-1 font-medium hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    View
                  </a>
                </div>
              )}
              {selectedOrder.service_type === 'pickup' && (
                <div className="bg-accent/5 border-accent/20 mt-3 rounded-lg border p-3 text-sm">
                  <p className="text-accent mb-1.5 flex items-center gap-1.5 font-semibold">
                    <Car className="h-4 w-4" />
                    Pick-up Details
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-amber-900">
                    <div>
                      <p className="text-xs font-medium text-amber-600">Driver</p>
                      <p className="font-semibold">
                        {selectedOrder.driver_name || (
                          <span className="font-normal text-red-500 italic">Missing</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-amber-600">Plate</p>
                      <p className="font-mono font-semibold">
                        {selectedOrder.plate_number || (
                          <span className="font-normal text-red-500 italic">Missing</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {selectedOrder && actionType === 'reject' && (
            <div className="space-y-2 py-4">
              <Label htmlFor="rejection-reason">
                Reason for Rejection <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="rejection-reason"
                placeholder="e.g. Insufficient stock, Invalid PO, etc."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
              />
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelectedOrder(null)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={
                actionType === 'approve'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : actionType === 'check'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-destructive hover:bg-destructive/90'
              }
            >
              {isSubmitting
                ? 'Processing...'
                : actionType === 'approve'
                  ? 'Confirm Approval'
                  : actionType === 'check'
                    ? 'Confirm Final Payment'
                    : 'Confirm Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
