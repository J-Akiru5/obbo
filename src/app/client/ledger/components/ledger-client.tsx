'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { submitRedeliveryRequest } from '@/lib/actions/client-actions';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import {
  Package,
  Truck,
  Info,
  History,
  ShoppingBag,
  TrendingDown,
  Split,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

import { CustomerBalance } from '@/lib/types/database';

interface BalanceSummary {
  totalPurchased: number;
  totalDelivered: number;
  remainingBalance: number;
}

export default function LedgerClient({
  balances,
  summary,
  pendingRedeliveryPos,
}: {
  balances: CustomerBalance[];
  summary: BalanceSummary;
  pendingRedeliveryPos: string[];
}) {
  const router = useRouter();
  const [selectedBalance, setSelectedBalance] = useState<CustomerBalance | null>(null);
  const [isRedeliveryOpen, setIsRedeliveryOpen] = useState(false);

  // Real-time synchronization
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel('balance-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customer_balances',
        },
        () => {
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  // Form state
  const [source, setSource] = useState<string>('warehouse');
  const [serviceType, setServiceType] = useState<string>('deliver');
  const [poNumber, setPoNumber] = useState('');
  const [poFile, setPoFile] = useState<File | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');

  // Split delivery (now available for BOTH pickup and deliver)
  const [wantsSplit, setWantsSplit] = useState(false);
  const [deliverNowQty, setDeliverNowQty] = useState<number>(0);

  // Driver (if pickup)
  const [driverName, setDriverName] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [pickupDate, setPickupDate] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const pendingBalances = balances.filter((b) => b.status === 'pending');
  const fulfilledBalances = balances.filter((b) => b.status === 'fulfilled');

  const handleOpenRedelivery = (balance: CustomerBalance) => {
    setSelectedBalance(balance);
    setPoNumber(balance.order?.po_number || '');
    setDeliverNowQty(balance.remaining_qty);
    setWantsSplit(false);
    setIsRedeliveryOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setPoFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedBalance) return;

    if (wantsSplit) {
      if (deliverNowQty <= 0 || deliverNowQty > selectedBalance.remaining_qty) {
        toast.error('Invalid split delivery quantity.');
        return;
      }
    }

    const linkedPoNumber = selectedBalance.order?.po_number?.trim() || '';
    if (!linkedPoNumber) {
      toast.error('Missing linked PO number for this balance.');
      return;
    }

    if (serviceType === 'pickup') {
      if (!driverName.trim()) {
        toast.error('Driver Name is required for Pick-up orders.');
        return;
      }
      if (!plateNumber.trim()) {
        toast.error('Plate Number is required for Pick-up orders.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      // 1. Upload Redelivery Form image (optional)
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let publicUrl = selectedBalance.order?.po_image_url || '';

      if (poFile) {
        const fileExt = poFile.name.split('.').pop();
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(7);
        const fileName = `${user.id}/redelivery_${timestamp}_${random}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('order-attachments')
          .upload(fileName, poFile, { upsert: true, contentType: poFile.type });

        if (uploadError)
          throw new Error(`Failed to upload redelivery form: ${uploadError.message}`);
        const {
          data: { publicUrl: uploadedUrl },
        } = supabase.storage.from('order-attachments').getPublicUrl(fileName);
        publicUrl = uploadedUrl;
      }

      const orderData = {
        source,
        service_type: serviceType,
        payment_method: paymentMethod,
        po_number: linkedPoNumber,
        po_image_url: publicUrl,
        driver_name: serviceType === 'pickup' ? driverName.trim() : null,
        plate_number: serviceType === 'pickup' ? plateNumber.trim() : null,
        notes:
          serviceType === 'pickup' && pickupDate ? `Preferred Pick-up Date: ${pickupDate}` : '',
        preferred_pickup_date: serviceType === 'pickup' ? pickupDate : undefined,
      };

      const adjustedSplitDetails = wantsSplit
        ? {
            wantsSplit: true,
            deliverNowQty,
            deliverNowJB: selectedBalance.bag_type === 'JB' ? deliverNowQty / 25 : 0,
            deliverNowSB: selectedBalance.bag_type === 'SB' ? deliverNowQty / 50 : 0,
            splitNote: `Redelivery split: Client requested ${deliverNowQty} indiv bags now.`,
          }
        : undefined;

      await submitRedeliveryRequest(selectedBalance.id, orderData, adjustedSplitDetails);

      toast.success('Re-delivery request submitted! It is now pending admin approval.');

      setIsRedeliveryOpen(false);
      setPoFile(null);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'An error occurred while submitting.';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-foreground text-2xl font-bold tracking-tight">Balance Ledger</h2>
        <p className="text-muted-foreground text-sm">
          Monitor your remaining cement balance and request re-delivery.
        </p>
      </div>

      {/* Balance Summary Counters */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-card border-border/50 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  Total Purchased
                </p>
                <p className="text-foreground mt-1 text-2xl font-bold">
                  {summary.totalPurchased.toLocaleString()}
                </p>
                <p className="text-muted-foreground text-xs">individual bags</p>
              </div>
              <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-xl">
                <ShoppingBag className="text-primary h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border/50 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  Total Delivered
                </p>
                <p className="text-foreground mt-1 text-2xl font-bold">
                  {summary.totalDelivered.toLocaleString()}
                </p>
                <p className="text-muted-foreground text-xs">individual bags</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                <Truck className="h-5 w-5 text-emerald-600 dark:text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-primary text-primary-foreground shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-primary-foreground/80 text-xs font-semibold tracking-wide uppercase">
                  Remaining Balance
                </p>
                <p className="text-primary-foreground mt-1 text-2xl font-bold">
                  {summary.remainingBalance.toLocaleString()}
                </p>
                <p className="text-primary-foreground/80 text-xs">available for re-delivery</p>
              </div>
              <div className="bg-primary-foreground/15 flex h-10 w-10 items-center justify-center rounded-xl">
                <TrendingDown className="text-primary-foreground/80 h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6">
        {/* Active Balances */}
        <Card className="border-primary/20 overflow-hidden shadow-sm">
          <CardHeader className="border-border/50 bg-primary/5 border-b pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="text-primary h-5 w-5" />
              Outstanding Balances
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Bags that have been paid for but not yet delivered
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {pendingBalances.length === 0 ? (
              <div className="border-border text-muted-foreground rounded-xl border-2 border-dashed py-12 text-center">
                <Info className="mx-auto mb-3 h-12 w-12 opacity-40" />
                <p>You have no outstanding balances.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="font-bold whitespace-nowrap">
                        Date of Original Order
                      </TableHead>
                      <TableHead className="font-bold whitespace-nowrap">PO #</TableHead>
                      <TableHead className="font-bold whitespace-nowrap">Product</TableHead>
                      <TableHead className="text-center font-bold whitespace-nowrap">
                        Original Qty
                      </TableHead>
                      <TableHead className="text-center font-bold whitespace-nowrap">
                        Delivered Qty
                      </TableHead>
                      <TableHead className="text-primary text-center font-bold whitespace-nowrap">
                        Remaining Balance
                      </TableHead>
                      <TableHead className="text-right font-bold">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingBalances.map((b) => (
                      <TableRow key={b.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="whitespace-nowrap">
                          {b.order?.created_at
                            ? new Date(b.order.created_at).toLocaleDateString()
                            : new Date(b.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {b.order?.po_number || 'N/A'}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{b.product?.name}</div>
                          <div className="text-muted-foreground text-[10px] uppercase">
                            {b.bag_type === 'JB' ? 'Jumbo Bag' : 'Sling Bag'}
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {b.total_purchase.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-center">
                          {(b.total_purchase - b.remaining_qty).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="bg-primary/10 text-primary inline-flex min-w-[3rem] items-center justify-center rounded-full px-3 py-1 text-sm font-bold">
                            {b.remaining_qty.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {b.remaining_qty > 0 ? (
                            pendingRedeliveryPos.includes(b.order?.po_number || '') ? (
                              <Button size="sm" disabled className="cursor-not-allowed opacity-60">
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                Re-delivery Pending
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm"
                                onClick={() => handleOpenRedelivery(b)}
                              >
                                <Truck className="mr-1.5 h-3.5 w-3.5" />
                                Request Balance Delivery
                              </Button>
                            )
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400"
                            >
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Completed
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fulfilled Balances */}
        <Card className="shadow-sm">
          <CardHeader className="border-border/50 border-b pb-3">
            <CardTitle className="text-muted-foreground flex items-center gap-2 text-base">
              <History className="h-5 w-5" />
              Fulfilled Balances
            </CardTitle>
            <CardDescription>Historically completed balance records</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {fulfilledBalances.length === 0 ? (
              <div className="text-muted-foreground p-8 text-center">
                <p>No completed balances yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto opacity-80 grayscale-[30%] transition-all duration-300 hover:opacity-100 hover:grayscale-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>PO #</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-center">Original Qty</TableHead>
                      <TableHead className="text-center">Total Delivered</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fulfilledBalances.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="text-muted-foreground text-xs">
                          {b.order?.created_at
                            ? new Date(b.order.created_at).toLocaleDateString()
                            : new Date(b.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="font-mono text-[10px]">
                          {b.order?.po_number || 'N/A'}
                        </TableCell>
                        <TableCell className="text-sm font-medium">{b.product?.name}</TableCell>
                        <TableCell className="text-center text-sm">{b.total_purchase}</TableCell>
                        <TableCell className="text-center text-sm font-bold text-emerald-600">
                          {b.total_purchase}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold tracking-wider text-emerald-600 uppercase">
                            Fulfilled
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Redelivery Dialog */}
      <Dialog open={isRedeliveryOpen} onOpenChange={setIsRedeliveryOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Request Re-delivery</DialogTitle>
            <DialogDescription>
              Submit details to dispatch your remaining balance.
            </DialogDescription>
          </DialogHeader>

          {selectedBalance && (
            <form onSubmit={handleSubmit} className="space-y-6 py-4">
              <div className="bg-primary/5 border-primary/10 rounded-lg border p-4">
                <div className="text-primary/80 text-sm font-medium">
                  You are requesting delivery from a balance of:
                </div>
                <div className="text-primary text-lg font-bold">
                  {selectedBalance.remaining_qty} individual bags of {selectedBalance.product?.name}
                </div>
                {selectedBalance.order?.po_number && (
                  <div className="text-primary/60 mt-1 text-xs italic">
                    Linked to original PO: {selectedBalance.order.po_number}
                  </div>
                )}
              </div>

              {/* Source & Service */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>
                    Source <span className="text-red-500">*</span>
                  </Label>
                  <Select value={source} onValueChange={(v) => setSource(v || 'warehouse')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="warehouse">Warehouse</SelectItem>
                      <SelectItem value="port">Port</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>
                    Service Type <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={serviceType}
                    onValueChange={(v) => {
                      setServiceType(v || 'deliver');
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pickup">Pick-up</SelectItem>
                      <SelectItem value="deliver">Deliver</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Order Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="redelivery-po-number">
                    PO Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="redelivery-po-number"
                    value={poNumber}
                    readOnly
                    className="bg-muted/30 cursor-not-allowed border-dashed"
                  />
                  <p className="text-muted-foreground text-[10px]">
                    This PO is linked to your original purchase.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>
                    Payment Method (For Shipping Fees) <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={paymentMethod}
                    onValueChange={(v) => setPaymentMethod(v || 'cash')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="check">Check</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="redelivery-doc">
                    Redelivery Authorization Document{' '}
                    <span className="text-muted-foreground ml-1 text-xs">
                      (Optional — original PO image will be used if not provided)
                    </span>
                  </Label>
                  <Input
                    id="redelivery-doc"
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleFileChange}
                    className="cursor-pointer"
                  />
                </div>
              </div>

              {/* Conditional Pickup fields */}
              {serviceType === 'pickup' && (
                <div className="space-y-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                  <h4 className="text-sm font-semibold text-amber-600 dark:text-amber-500">
                    Pick-up Details
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="driver-name">
                        Driver Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="driver-name"
                        required
                        value={driverName}
                        onChange={(e) => setDriverName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="plate-number">
                        Plate Number <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="plate-number"
                        required
                        value={plateNumber}
                        onChange={(e) => setPlateNumber(e.target.value)}
                      />
                    </div>
                    <div className="col-span-2 space-y-2">
                      <Label htmlFor="pickup-date">Preferred Date of Pick-up</Label>
                      <Input
                        id="pickup-date"
                        type="date"
                        value={pickupDate}
                        onChange={(e) => setPickupDate(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Split Redelivery — available for BOTH pickup and deliver */}
              <div className="border-primary/20 bg-primary/5 space-y-4 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Split className="text-primary h-4 w-4" />
                    <div>
                      <h4 className="text-foreground text-sm font-semibold">
                        Split Redelivery Option
                      </h4>
                      <p className="text-muted-foreground text-xs">
                        Don&apos;t need all {selectedBalance.remaining_qty} bags right now?
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={wantsSplit}
                    onChange={(e) => setWantsSplit(e.target.checked)}
                    className="text-primary border-border focus:ring-primary h-5 w-5 rounded"
                  />
                </div>
                {wantsSplit && (
                  <div className="border-border/50 space-y-2 border-t pt-2">
                    <Label htmlFor="deliver-now-qty" className="text-foreground">
                      How many individual bags do you want to receive now?
                    </Label>
                    <Input
                      id="deliver-now-qty"
                      type="number"
                      min="1"
                      max={selectedBalance.remaining_qty}
                      value={deliverNowQty || ''}
                      placeholder="0"
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setDeliverNowQty(parseInt(e.target.value) || 0)}
                    />
                    <p className="text-muted-foreground text-[10px] italic">
                      {selectedBalance.remaining_qty - deliverNowQty} bags will remain in your
                      balance.
                    </p>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsRedeliveryOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting...' : 'Submit Re-delivery Request'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
