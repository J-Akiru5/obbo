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
import { MapPin, Truck, Check, CornerDownLeft, Edit2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

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
  ) => Promise<void>;
  loading: boolean;
}) {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [status, setStatus] = useState<string>('');
  const [jbReturned, setJbReturned] = useState(0);
  const [sbReturned, setSbReturned] = useState(0);
  const [returnReason, setReturnReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openUpdate = (order: Order) => {
    setSelectedOrder(order);
    setStatus(order.tracking_status || 'pending_dispatch');
    setJbReturned(0);
    setSbReturned(0);
    setReturnReason('');
  };

  const handleSubmit = async () => {
    if (!selectedOrder) return;
    const isReturnStatus = status === 'returned_good' || status === 'returned_waste';
    if (isReturnStatus && !jbReturned && !sbReturned) {
      return; // require at least some quantity
    }
    setIsSubmitting(true);
    try {
      await onUpdateTracking(
        selectedOrder.id,
        status,
        isReturnStatus ? jbReturned : undefined,
        isReturnStatus ? sbReturned : undefined,
        isReturnStatus ? returnReason : undefined,
      );
      setSelectedOrder(null);
    } finally {
      setIsSubmitting(false);
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
                  {order.dr_number ? (
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
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs font-bold">
                        {jbQty} JB
                      </Badge>
                      {isSplit && jbReq > 0 && (
                        <span className="text-muted-foreground text-[10px]">/ {jbReq}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs font-bold">
                        {sbQty} SB
                      </Badge>
                      {isSplit && sbReq > 0 && (
                        <span className="text-muted-foreground text-[10px]">/ {sbReq}</span>
                      )}
                    </div>
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
              <Select value={status} onValueChange={(v) => setStatus(v || '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending_dispatch">Pending Dispatch (Loading)</SelectItem>
                  <SelectItem value="in_transit">In Transit (On the road)</SelectItem>
                  <SelectItem value="delivered">Delivered (No returns)</SelectItem>
                  <SelectItem value="bags_returned">Delivered (With returned bags)</SelectItem>
                  <SelectItem value="returned_good">Returned (Good Stock)</SelectItem>
                  <SelectItem value="returned_waste">Returned (Waste/Damage)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(status === 'returned_good' || status === 'returned_waste') && (
              <div className="bg-primary/5 border-primary/10 space-y-4 rounded-lg border p-4">
                <p className="text-primary flex items-center gap-2 text-sm font-medium">
                  <CornerDownLeft className="h-4 w-4" /> Record Returned Bags —{' '}
                  {status === 'returned_good' ? 'Good Stock (restock)' : 'Waste/Damage (write-off)'}
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="jb-returned">JB Returned</Label>
                    <Input
                      id="jb-returned"
                      type="number"
                      min="0"
                      value={jbReturned || ''}
                      placeholder="0"
                      onChange={(e) => setJbReturned(parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sb-returned">SB Returned</Label>
                    <Input
                      id="sb-returned"
                      type="number"
                      min="0"
                      value={sbReturned || ''}
                      placeholder="0"
                      onChange={(e) => setSbReturned(parseInt(e.target.value) || 0)}
                    />
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
                    <Label htmlFor="jb-returned">JB Returned</Label>
                    <Input
                      id="jb-returned"
                      type="number"
                      min="0"
                      value={jbReturned || ''}
                      placeholder="0"
                      onChange={(e) => setJbReturned(parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sb-returned">SB Returned</Label>
                    <Input
                      id="sb-returned"
                      type="number"
                      min="0"
                      value={sbReturned || ''}
                      placeholder="0"
                      onChange={(e) => setSbReturned(parseInt(e.target.value) || 0)}
                    />
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
    </div>
  );
}
