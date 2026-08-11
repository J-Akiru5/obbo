import { useState } from 'react';
import { Order } from '@/lib/types/database';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MapPin, Truck, Check, CornerDownLeft, Edit2, ExternalLink } from 'lucide-react';
import { BAG_EQUIVALENT } from '@/components/orders/wizard/order-schema';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Restocking a return credits shipment stock in whole JB/SB UNITS, rounded
// DOWN from the individual bag count entered here — a return that isn't an
// exact multiple of 25 (JB) or 50 (SB) leaves a small remainder that isn't
// restocked. Disclosed here so the admin isn't surprised stock didn't move
// by the full amount typed. See ledger-actions.ts's denomination-mismatch
// bug writeup for why this conversion exists.
function ReturnStockHint({ bags, type }: { bags: number; type: 'JB' | 'SB' }) {
  if (bags <= 0) return null;
  const units = Math.floor(bags / BAG_EQUIVALENT[type]);
  const creditedBags = units * BAG_EQUIVALENT[type];
  const remainder = bags - creditedBags;
  if (remainder === 0) return null;
  return (
    <p className="text-muted-foreground mt-1 text-[11px] leading-snug">
      Credits {units} {type} unit{units === 1 ? '' : 's'} ({creditedBags} bags) back to stock —{' '}
      {remainder} bag{remainder === 1 ? '' : 's'} short of a full unit won&apos;t be restocked.
    </p>
  );
}

export function TrackingTab({
  orders,
  onUpdateTracking,
  loading,
}: {
  orders: Order[];
  onUpdateTracking: (
    id: string,
    status: string,
    jb?: number,
    sb?: number,
    reason?: string,
    wasteCategory?: 'waste' | 'damage',
  ) => Promise<void>;
  loading: boolean;
}) {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [status, setStatus] = useState<string>('');
  const [jbReturned, setJbReturned] = useState(0);
  const [sbReturned, setSbReturned] = useState(0);
  const [returnReason, setReturnReason] = useState('');
  const [wasteCategory, setWasteCategory] = useState<'waste' | 'damage'>('waste');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const openUpdate = (order: Order) => {
    setSelectedOrder(order);
    setStatus(order.tracking_status || 'pending_dispatch');
    setJbReturned(0);
    setSbReturned(0);
    setReturnReason('');
    setWasteCategory('waste');
  };

  const handleSubmit = () => {
    if (!selectedOrder) return;
    const isReturnStatus = status === 'returned_good' || status === 'returned_waste';
    if (isReturnStatus && !jbReturned && !sbReturned) {
      return;
    }
    setShowConfirm(true);
  };

  const performUpdate = async () => {
    if (!selectedOrder) return;
    const isReturnStatus = status === 'returned_good' || status === 'returned_waste';
    setIsSubmitting(true);
    setShowConfirm(false);
    try {
      await onUpdateTracking(
        selectedOrder.id,
        status,
        isReturnStatus ? jbReturned : undefined,
        isReturnStatus ? sbReturned : undefined,
        isReturnStatus ? returnReason : undefined,
        status === 'returned_waste' ? wasteCategory : undefined,
      );
      setSelectedOrder(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusLabel = (s: string) => {
    switch (s) {
      case 'delivered':
        return 'Delivered';
      case 'bags_returned':
        return 'Delivered (With returned bags)';
      case 'returned_good':
        return 'Returned (Good Stock)';
      case 'returned_waste':
        return 'Returned (Waste/Damage)';
      default:
        return s;
    }
  };

  if (loading)
    return (
      <div className="text-muted-foreground animate-pulse py-8 text-center">
        Loading active deliveries...
      </div>
    );
  if (orders.length === 0)
    return (
      <div className="text-muted-foreground rounded-xl border-2 border-dashed py-12 text-center">
        No active deliveries to track.
      </div>
    );

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_dispatch':
        return (
          <Badge className="bg-accent/10 text-accent hover:bg-accent/20 border-accent/20">
            Pending Dispatch
          </Badge>
        );
      case 'in_transit':
        return (
          <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/10">
            In Transit
          </Badge>
        );
      case 'delivered':
        return <Badge className="bg-primary text-primary-foreground">Delivered</Badge>;
      case 'bags_returned':
        return (
          <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-200">Bags Returned</Badge>
        );
      case 'returned_good':
        return (
          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
            Returned (Good)
          </Badge>
        );
      case 'returned_waste':
        return (
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
            Returned (Waste)
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="bg-card border-border overflow-x-auto rounded-xl border shadow-sm">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead>Order ID</TableHead>
            <TableHead>Client & Service</TableHead>
            <TableHead>DR & Driver</TableHead>
            <TableHead>Check</TableHead>
            <TableHead>Quantities</TableHead>
            <TableHead>Tracking Status</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => {
            const jbQty = order.items
              .filter((i) => i.bag_type === 'JB')
              .reduce((s, i) => s + i.dispatched_qty, 0);
            const sbQty = order.items
              .filter((i) => i.bag_type === 'SB')
              .reduce((s, i) => s + i.dispatched_qty, 0);
            const jbReq = order.items
              .filter((i) => i.bag_type === 'JB')
              .reduce((s, i) => s + i.requested_qty, 0);
            const sbReq = order.items
              .filter((i) => i.bag_type === 'SB')
              .reduce((s, i) => s + i.requested_qty, 0);
            const isSplit =
              order.is_split_delivery ||
              order.items.some((i) => i.dispatched_qty < i.requested_qty);

            return (
              <TableRow key={order.id}>
                <TableCell className="font-mono text-xs">
                  {order.id.slice(0, 8)}
                  {isSplit && (
                    <div className="mt-1">
                      <Badge
                        variant="outline"
                        className="border-amber-500 bg-amber-50 px-1 py-0 text-[9px] font-bold text-amber-600 uppercase dark:bg-amber-900/30 dark:text-amber-400"
                      >
                        SPLIT
                      </Badge>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="border-border/50 h-8 w-8 shrink-0 border">
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
                    <div>
                      <p className="font-medium">
                        {order.client?.company_name || order.client?.full_name}
                      </p>
                      <div className="text-muted-foreground mt-1 flex items-center gap-1 text-[10px] font-bold uppercase">
                        {order.service_type === 'deliver' ? (
                          <Truck className="h-3 w-3" />
                        ) : (
                          <MapPin className="h-3 w-3" />
                        )}
                        {order.service_type}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {order.delivery_receipts && order.delivery_receipts.length > 0 ? (
                    <div className="space-y-1">
                      {order.delivery_receipts.length > 1 && (
                        <p className="text-[10px] font-bold text-amber-600 uppercase">
                          {order.delivery_receipts.length} DRs
                        </p>
                      )}
                      {order.delivery_receipts.map((dr) => (
                        <div key={dr.dr_number}>
                          <p className="text-sm font-semibold">{dr.dr_number}</p>
                          {order.service_type === 'deliver' && (dr.driver || dr.plate_number) && (
                            <p className="text-muted-foreground mt-0.5 text-xs">
                              {dr.driver} · {dr.plate_number}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : order.dr_number ? (
                    <>
                      <p className="text-sm font-semibold">{order.dr_number}</p>
                      {order.service_type === 'deliver' && (
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {order.driver_name} · {order.plate_number}
                        </p>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground text-xs italic">No DR attached</span>
                  )}
                </TableCell>
                <TableCell>
                  {order.check_image_url ? (
                    <a
                      href={order.check_image_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View Check
                    </a>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {jbQty > 0 && (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-bold">
                          {(jbQty * BAG_EQUIVALENT.JB).toLocaleString()} bags ({jbQty} JB)
                        </Badge>
                        {isSplit && jbReq > 0 && (
                          <span className="text-muted-foreground text-[10px]">/ {jbReq} JB</span>
                        )}
                      </div>
                    )}
                    {sbQty > 0 && (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-bold">
                          {(sbQty * BAG_EQUIVALENT.SB).toLocaleString()} bags ({sbQty} SB)
                        </Badge>
                        {isSplit && sbReq > 0 && (
                          <span className="text-muted-foreground text-[10px]">/ {sbReq} SB</span>
                        )}
                      </div>
                    )}
                    {jbQty === 0 && sbQty === 0 && (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {renderStatusBadge(order.tracking_status || 'pending_dispatch')}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openUpdate(order)}
                    className="text-xs"
                  >
                    <Edit2 className="mr-1.5 h-3.5 w-3.5" /> Update
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Tracking Status</DialogTitle>
            <DialogDescription>
              Update the current location or status of this order. Marking it as Delivered or
              Returned will move it to History.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tracking Status</Label>
              {(() => {
                const statusOptions = [
                  { value: 'pending_dispatch', label: 'Pending Dispatch (Loading)' },
                  { value: 'in_transit', label: 'In Transit (On the road)' },
                  { value: 'delivered', label: 'Delivered (No returns)' },
                  { value: 'bags_returned', label: 'Delivered (With returned bags)' },
                  { value: 'returned_good', label: 'Returned (Good Stock)' },
                  { value: 'returned_waste', label: 'Returned (Waste/Damage)' },
                ];

                return (
                  <Select
                    items={statusOptions}
                    value={status}
                    onValueChange={(v) => setStatus(v || '')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                );
              })()}
            </div>

            {(status === 'returned_good' || status === 'returned_waste') && (
              <div className="bg-primary/5 border-primary/10 space-y-4 rounded-lg border p-4">
                <p className="text-primary flex items-center gap-2 text-sm font-medium">
                  <CornerDownLeft className="h-4 w-4" /> Record Returned Bags —{' '}
                  {status === 'returned_good' ? 'Good Stock (restock)' : 'Waste/Damage (write-off)'}
                </p>
                {status === 'returned_waste' && (
                  <div className="space-y-2">
                    <Label>Category</Label>
                    {(() => {
                      const wasteOptions = [
                        { value: 'waste', label: 'Waste (e.g. spoiled, expired)' },
                        { value: 'damage', label: 'Damage (e.g. torn, wet, crushed in transit)' },
                      ];
                      return (
                        <Select
                          items={wasteOptions}
                          value={wasteCategory}
                          onValueChange={(v) =>
                            setWasteCategory((v as 'waste' | 'damage') || 'waste')
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {wasteOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      );
                    })()}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="jb-returned">Individual bags returned (JB)</Label>
                    <Input
                      id="jb-returned"
                      type="number"
                      min="0"
                      value={jbReturned || ''}
                      placeholder="0"
                      onChange={(e) => setJbReturned(parseInt(e.target.value) || 0)}
                    />
                    {status === 'returned_good' && <ReturnStockHint bags={jbReturned} type="JB" />}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sb-returned">Individual bags returned (SB)</Label>
                    <Input
                      id="sb-returned"
                      type="number"
                      min="0"
                      value={sbReturned || ''}
                      placeholder="0"
                      onChange={(e) => setSbReturned(parseInt(e.target.value) || 0)}
                    />
                    {status === 'returned_good' && <ReturnStockHint bags={sbReturned} type="SB" />}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="return-reason">Reason for Return</Label>
                  <Textarea
                    id="return-reason"
                    placeholder={
                      status === 'returned_good'
                        ? 'e.g. Customer changed mind, wrong size...'
                        : 'e.g. Damaged in transit, manufacturing defect...'
                    }
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    rows={2}
                  />
                </div>
                <p className="text-primary/70 text-xs">
                  {status === 'returned_good'
                    ? 'Bags will be added back to warehouse stock and reflected in reports as Customer Returns.'
                    : 'Bags will NOT be restocked. Recorded as Waste/Damage in reports for accounting.'}
                </p>
              </div>
            )}

            {status === 'bags_returned' && (
              <div className="bg-primary/5 border-primary/10 space-y-4 rounded-lg border p-4">
                <p className="text-primary flex items-center gap-2 text-sm font-medium">
                  <CornerDownLeft className="h-4 w-4" /> Record Returned Bags
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="jb-returned">Individual bags returned (JB)</Label>
                    <Input
                      id="jb-returned"
                      type="number"
                      min="0"
                      value={jbReturned || ''}
                      placeholder="0"
                      onChange={(e) => setJbReturned(parseInt(e.target.value) || 0)}
                    />
                    <ReturnStockHint bags={jbReturned} type="JB" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sb-returned">Individual bags returned (SB)</Label>
                    <Input
                      id="sb-returned"
                      type="number"
                      min="0"
                      value={sbReturned || ''}
                      placeholder="0"
                      onChange={(e) => setSbReturned(parseInt(e.target.value) || 0)}
                    />
                    <ReturnStockHint bags={sbReturned} type="SB" />
                  </div>
                </div>
                <p className="text-primary/70 text-xs">
                  Automatically creates a shipment ledger entry — bags will be added back to
                  warehouse physical stock and reflected in reports.
                </p>
              </div>
            )}

            {status === 'delivered' && (
              <div className="bg-primary/5 border-primary/10 text-primary flex items-center gap-2 rounded-lg border p-3 text-sm">
                <Check className="h-4 w-4" />
                This will mark the order as Completed.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelectedOrder(null)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-primary">
              {isSubmitting ? 'Saving...' : 'Save Status'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tracking Update Confirmation */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Status Update</AlertDialogTitle>
            <AlertDialogDescription>
              Update tracking status to <strong>{getStatusLabel(status)}</strong> for order{' '}
              <strong>{selectedOrder?.id.slice(0, 8)}</strong>?
              {(status === 'returned_good' || status === 'returned_waste') && (
                <span className="mt-2 block">
                  This will record {jbReturned} individual JB bags and {sbReturned} individual SB
                  bags returned{status === 'returned_waste' ? ` as ${wasteCategory}` : ''}.
                </span>
              )}
              {status === 'delivered' && (
                <span className="mt-2 block">This will mark the order as Completed.</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={performUpdate}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
