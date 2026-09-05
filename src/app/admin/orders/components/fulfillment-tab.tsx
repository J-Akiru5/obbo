import { useState } from 'react';
import { Order, Shipment } from '@/lib/types/database';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CheckCircle2,
  ExternalLink,
  Truck,
  UploadCloud,
  X,
  Banknote,
  FileText,
  FileImage,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { BAG_EQUIVALENT } from '@/components/orders/wizard/order-schema';
import type { OrderDeliveryReceipt } from '@/lib/types/database';
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

// DRs render in dispatch order (oldest first) — never the overwritten
// orders.dr_number single value.
function sortedReceipts(receipts: OrderDeliveryReceipt[] | undefined) {
  return [...(receipts ?? [])].sort(
    (a, b) =>
      a.received_date.localeCompare(b.received_date) || a.created_at.localeCompare(b.created_at),
  );
}

export function FulfillmentTab({
  orders,
  shipments,
  onDispatch,
  loading,
}: {
  orders: Order[];
  shipments: Shipment[];
  onDispatch: (
    id: string,
    shipmentId: string,
    drNumber: string,
    drImageUrl: string | null,
    driverName: string | null,
    plateNumber: string | null,
  ) => Promise<void>;
  loading: boolean;
}) {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [actionType, setActionType] = useState<'dispatch' | null>(null);

  // Dispatch form state
  const [shipmentId, setShipmentId] = useState('');
  const [drNumber, setDrNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [drImageFile, setDrImageFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDispatchConfirm, setShowDispatchConfirm] = useState(false);

  const openAction = (order: Order, type: 'dispatch') => {
    setSelectedOrder(order);
    setActionType(type);
    setShipmentId('');
    setDrNumber('');
    setDriverName('');
    setPlateNumber('');
    setDrImageFile(null);
  };

  const handleSubmit = () => {
    if (!selectedOrder || !actionType) return;
    // Validate form before showing confirmation
    if (actionType === 'dispatch') {
      if (!shipmentId || !drNumber) {
        alert('Please select a shipment batch and provide a DR number.');
        return;
      }
      if (selectedOrder.service_type === 'deliver' && (!driverName || !plateNumber)) {
        alert('Please provide driver name and plate number for delivery orders.');
        return;
      }
      if (!drImageFile) {
        alert('Please upload a DR image before dispatch.');
        return;
      }
    }
    setShowDispatchConfirm(true);
  };

  const performDispatch = async () => {
    if (!selectedOrder || !actionType) return;
    setIsSubmitting(true);
    setShowDispatchConfirm(false);
    try {
      if (actionType === 'dispatch') {
        // Upload DR image to Supabase Storage if a file was provided
        let drImageUrl: string | null = null;
        if (drImageFile) {
          const { createClient } = await import('@/lib/supabase/client');
          const supabase = createClient();
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) throw new Error('Not authenticated');
          const ext = drImageFile.name.split('.').pop();
          const timestamp = Date.now();
          const sanitizedDrNumber = drNumber.replace(/\//g, '-');
          const fileName = `${user.id}/dr_${sanitizedDrNumber}_${timestamp}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from('order-attachments')
            .upload(fileName, drImageFile, { upsert: true, contentType: drImageFile.type });
          if (uploadError) throw new Error(`Failed to upload DR image: ${uploadError.message}`);
          const {
            data: { publicUrl },
          } = supabase.storage.from('order-attachments').getPublicUrl(fileName);
          drImageUrl = publicUrl;
        }
        const resolvedDriverName =
          selectedOrder.service_type === 'deliver' ? driverName.trim() : selectedOrder.driver_name;
        const resolvedPlateNumber =
          selectedOrder.service_type === 'deliver'
            ? plateNumber.trim()
            : selectedOrder.plate_number;
        if (
          selectedOrder.service_type === 'pickup' &&
          (!resolvedDriverName || !resolvedPlateNumber)
        ) {
          alert(
            'Pickup order is missing driver and/or plate details. Please contact the client to update the request.',
          );
          setIsSubmitting(false);
          return;
        }

        await onDispatch(
          selectedOrder.id,
          shipmentId,
          drNumber.trim(),
          drImageUrl,
          resolvedDriverName,
          resolvedPlateNumber,
        );
      }
      setSelectedOrder(null);
      setActionType(null);
      setDrImageFile(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading)
    return (
      <div className="text-muted-foreground animate-pulse py-8 text-center">
        Loading fulfillment queue...
      </div>
    );
  if (orders.length === 0)
    return (
      <div className="text-muted-foreground rounded-xl border-2 border-dashed py-12 text-center">
        No orders ready for fulfillment.
      </div>
    );

  const readyForDispatch = orders.filter(
    (o) => o.status === 'approved' || o.status === 'partially_approved',
  );

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h3 className="text-primary flex items-center gap-2 text-lg font-semibold">
          <Truck className="h-5 w-5" /> Ready for Dispatch
        </h3>
        {readyForDispatch.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No approved orders waiting to be dispatched.
          </p>
        ) : (
          readyForDispatch.map((order) => {
            const jbQty = order.items
              .filter((i) => i.bag_type === 'JB')
              .reduce((s, i) => s + i.approved_qty, 0);
            const sbQty = order.items
              .filter((i) => i.bag_type === 'SB')
              .reduce((s, i) => s + i.approved_qty, 0);
            const jbReq = order.items
              .filter((i) => i.bag_type === 'JB')
              .reduce((s, i) => s + i.requested_qty, 0);
            const sbReq = order.items
              .filter((i) => i.bag_type === 'SB')
              .reduce((s, i) => s + i.requested_qty, 0);
            const isSplit =
              order.is_split_delivery || order.items.some((i) => i.approved_qty < i.requested_qty);
            const drs = sortedReceipts(order.delivery_receipts);

            return (
              <Card key={order.id} className="border-l-primary border-l-4">
                <CardContent className="flex flex-col gap-6 p-5 md:flex-row">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={order.status === 'partially_approved' ? 'secondary' : 'default'}
                        className={order.status === 'approved' ? 'bg-primary' : ''}
                      >
                        {order.status === 'partially_approved' ? 'Partial Approval' : 'Approved'}
                      </Badge>
                      {isSplit && (
                        <Badge
                          variant="outline"
                          className="border-amber-500 bg-amber-50 text-[10px] font-bold text-amber-600 uppercase dark:bg-amber-900/30 dark:text-amber-400"
                        >
                          SPLIT
                        </Badge>
                      )}
                      <span className="text-muted-foreground text-xs">
                        ID: {order.id.slice(0, 8)}
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
                      <h4 className="text-lg font-bold">
                        {order.client?.company_name || order.client?.full_name}
                      </h4>
                    </div>
                    <div className="mt-2 flex gap-4 text-sm">
                      {jbQty > 0 && (
                        <div className="bg-muted rounded-md px-3 py-1.5">
                          <span className="text-muted-foreground mb-0.5 block text-xs tracking-wider uppercase">
                            Approved JB
                          </span>
                          <span className="font-bold">
                            {(jbQty * BAG_EQUIVALENT.JB).toLocaleString()} bags
                            <span className="text-muted-foreground ml-1 text-xs font-normal">
                              ({jbQty} JB{isSplit && jbReq > 0 ? ` / ${jbReq} JB` : ''})
                            </span>
                          </span>
                        </div>
                      )}
                      {sbQty > 0 && (
                        <div className="bg-muted rounded-md px-3 py-1.5">
                          <span className="text-muted-foreground mb-0.5 block text-xs tracking-wider uppercase">
                            Approved SB
                          </span>
                          <span className="font-bold">
                            {(sbQty * BAG_EQUIVALENT.SB).toLocaleString()} bags
                            <span className="text-muted-foreground ml-1 text-xs font-normal">
                              ({sbQty} SB{isSplit && sbReq > 0 ? ` / ${sbReq} SB` : ''})
                            </span>
                          </span>
                        </div>
                      )}
                      <div className="bg-muted rounded-md px-3 py-1.5">
                        <span className="text-muted-foreground mb-0.5 block text-xs tracking-wider uppercase">
                          Service
                        </span>
                        <span className="text-muted-foreground font-bold uppercase">
                          {order.service_type}
                        </span>
                      </div>
                    </div>
                    {order.service_type === 'pickup' && (
                      <div className="text-muted-foreground mt-1 flex items-center gap-3 text-xs">
                        <span>
                          Driver:{' '}
                          <span className="text-foreground font-semibold">
                            {order.driver_name || <em className="text-red-500">missing</em>}
                          </span>
                        </span>
                        <span>
                          Plate:{' '}
                          <span className="text-foreground font-mono font-semibold">
                            {order.plate_number || <em className="text-red-500">missing</em>}
                          </span>
                        </span>
                      </div>
                    )}
                    {order.po_image_url ? (
                      <a
                        href={order.po_image_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary mt-1 flex items-center gap-1 text-xs hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" /> View PO
                      </a>
                    ) : (
                      <span
                        className="text-muted-foreground mt-1 block w-fit text-[10px] font-semibold tracking-wide uppercase"
                        title="No purchase order was ever created for this dispatch — a manual/walk-in DR entry, not a missing upload."
                      >
                        No PO
                      </span>
                    )}
                    {drs.length > 0 && (
                      <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <span className="tracking-wider uppercase">Dispatched:</span>
                        {drs.map((dr) =>
                          dr.dr_image_url ? (
                            <a
                              key={dr.id}
                              href={dr.dr_image_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary flex items-center gap-1 font-medium hover:underline"
                            >
                              <FileImage className="h-3 w-3" /> {dr.dr_number}
                            </a>
                          ) : (
                            <span key={dr.id} className="text-foreground font-medium">
                              {dr.dr_number}
                            </span>
                          ),
                        )}
                      </div>
                    )}
                    {/* Payment info */}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge
                        variant={order.payment_method === 'check' ? 'secondary' : 'outline'}
                        className="text-[10px] font-bold uppercase"
                      >
                        <Banknote className="mr-1 h-3 w-3" />
                        {order.payment_method}
                      </Badge>
                      {order.payment_method === 'check' && order.check_number && (
                        <>
                          <span className="text-muted-foreground text-xs">
                            Check #:{' '}
                            <span className="text-foreground font-semibold">
                              {order.check_number}
                            </span>
                          </span>
                          {order.check_image_url && (
                            <a
                              href={order.check_image_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary flex items-center gap-1 text-xs hover:underline"
                            >
                              <FileText className="h-3 w-3" /> View Check
                            </a>
                          )}
                        </>
                      )}
                      <span className="text-foreground ml-auto text-xs font-bold">
                        ₱{Number(order.total_amount).toLocaleString()}
                      </span>
                    </div>
                    {order.notes && (
                      <div className="bg-muted/50 border-border mt-2 rounded border border-dashed p-2 text-xs">
                        <span className="text-muted-foreground mb-0.5 block font-semibold">
                          Order Notes:
                        </span>
                        <p className="text-muted-foreground whitespace-pre-wrap">{order.notes}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {jbQty + sbQty <= 0 && (
                      <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
                        No approved quantity found for this order (0 JB / 0 SB). Re-confirm the
                        order&apos;s quantities before dispatching — dispatching now would record ₱
                        {Number(order.total_amount).toLocaleString()} in sales against 0 bags
                        shipped.
                      </div>
                    )}
                    <Button
                      onClick={() => openAction(order, 'dispatch')}
                      disabled={jbQty + sbQty <= 0}
                      className="bg-primary hover:bg-primary/90 h-12 w-full px-8 md:w-auto"
                    >
                      <Truck className="mr-2 h-4 w-4" /> Dispatch Now
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[600px]">
          {/* ── Header ── */}
          <div className="px-6 pt-6 pb-0">
            <DialogTitle className="text-lg font-semibold tracking-tight">
              Dispatch Order
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm">
              Fill in dispatch details and confirm stock deduction.
            </DialogDescription>
          </div>

          {selectedOrder && actionType === 'dispatch' && (
            <div className="space-y-6 px-6 py-6">
              {/* ── Section 1: Dispatch Summary (read-only) ── */}
              <div>
                <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase">
                  Dispatch Summary
                </p>
                <div className="bg-muted/50 grid grid-cols-2 gap-4 rounded-lg border p-4">
                  <div>
                    <p className="text-muted-foreground mb-1 text-[11px] font-medium tracking-wider uppercase">
                      Items to Deduct
                    </p>
                    <p className="text-sm font-semibold">
                      {(() => {
                        const deductJb = selectedOrder.items
                          .filter((i) => i.bag_type === 'JB')
                          .reduce((s, i) => s + i.approved_qty, 0);
                        const deductSb = selectedOrder.items
                          .filter((i) => i.bag_type === 'SB')
                          .reduce((s, i) => s + i.approved_qty, 0);
                        const parts: string[] = [];
                        if (deductJb > 0)
                          parts.push(
                            `${(deductJb * BAG_EQUIVALENT.JB).toLocaleString()} bags (${deductJb} JB)`,
                          );
                        if (deductSb > 0)
                          parts.push(
                            `${(deductSb * BAG_EQUIVALENT.SB).toLocaleString()} bags (${deductSb} SB)`,
                          );
                        return parts.length > 0 ? parts.join(' · ') : '—';
                      })()}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1 text-[11px] font-medium tracking-wider uppercase">
                      Service Type
                    </p>
                    <p className="text-sm font-semibold uppercase">{selectedOrder.service_type}</p>
                  </div>
                </div>
              </div>

              {/* ── Section 2: Shipment Source ── */}
              <div>
                <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase">
                  Shipment Source
                </p>
                {(() => {
                  const jbBags = selectedOrder.items
                    .filter((i) => i.bag_type === 'JB')
                    .reduce((s, i) => s + i.approved_qty, 0);
                  const sbBags = selectedOrder.items
                    .filter((i) => i.bag_type === 'SB')
                    .reduce((s, i) => s + i.approved_qty, 0);
                  const shipmentOptions = shipments.map((s) => {
                    const hasEnough = s.remaining_jb >= jbBags && s.remaining_sb >= sbBags;
                    return { ...s, hasEnough, jbBags, sbBags };
                  });

                  const selectedBatch = shipments.find((s) => s.id === shipmentId);

                  return (
                    <div className="space-y-3">
                      <Label className="text-sm">
                        Shipment Batch <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        items={shipmentOptions.map((s) => ({
                          value: s.id,
                          label: s.batch_name,
                          disabled: !s.hasEnough,
                        }))}
                        value={shipmentId}
                        onValueChange={(v) => setShipmentId(v ?? '')}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a shipment batch" />
                        </SelectTrigger>
                        <SelectContent>
                          {shipmentOptions.map((opt) => (
                            <SelectItem
                              key={opt.id}
                              value={opt.id}
                              disabled={!opt.hasEnough}
                              className="py-2.5"
                            >
                              <div className="flex min-w-0 flex-col gap-1.5">
                                <span className="truncate text-sm font-medium">
                                  {opt.batch_name}
                                </span>
                                <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                                  <span>
                                    Avail:{' '}
                                    <span className="text-foreground font-medium">
                                      {(opt.remaining_jb * BAG_EQUIVALENT.JB).toLocaleString()} bags
                                    </span>{' '}
                                    ({opt.remaining_jb} JB)
                                  </span>
                                  <span>
                                    <span className="text-foreground font-medium">
                                      {(opt.remaining_sb * BAG_EQUIVALENT.SB).toLocaleString()} bags
                                    </span>{' '}
                                    ({opt.remaining_sb} SB)
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                                  <span className="text-muted-foreground">
                                    Need:{' '}
                                    <span className="text-foreground font-medium">
                                      {(opt.jbBags * BAG_EQUIVALENT.JB).toLocaleString()} bags
                                    </span>{' '}
                                    ({opt.jbBags} JB)
                                  </span>
                                  <span className="text-muted-foreground">
                                    <span className="text-foreground font-medium">
                                      {(opt.sbBags * BAG_EQUIVALENT.SB).toLocaleString()} bags
                                    </span>{' '}
                                    ({opt.sbBags} SB)
                                  </span>
                                </div>
                                {!opt.hasEnough && (
                                  <span className="text-[11px] font-medium text-red-600">
                                    Insufficient stock
                                  </span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Selected batch summary card */}
                      {selectedBatch && (
                        <div className="bg-background rounded-lg border border-dashed p-3">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-foreground font-medium">
                              {selectedBatch.batch_name}
                            </span>
                            <span
                              className={
                                selectedBatch.remaining_jb >= jbBags &&
                                selectedBatch.remaining_sb >= sbBags
                                  ? 'font-medium text-emerald-600'
                                  : 'font-medium text-red-600'
                              }
                            >
                              {selectedBatch.remaining_jb >= jbBags &&
                              selectedBatch.remaining_sb >= sbBags
                                ? 'Sufficient stock'
                                : 'Insufficient stock'}
                            </span>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <span className="text-muted-foreground block">Remaining</span>
                              <span className="font-semibold">
                                {(selectedBatch.remaining_jb * BAG_EQUIVALENT.JB).toLocaleString()}{' '}
                                bags ({selectedBatch.remaining_jb} JB)
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block">Remaining</span>
                              <span className="font-semibold">
                                {(selectedBatch.remaining_sb * BAG_EQUIVALENT.SB).toLocaleString()}{' '}
                                bags ({selectedBatch.remaining_sb} SB)
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* ── Section 3: Dispatch Details ── */}
              <div>
                <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase">
                  Dispatch Details
                </p>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="dr-number" className="text-sm">
                      DR Number <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="dr-number"
                      value={drNumber}
                      onChange={(e) => setDrNumber(e.target.value)}
                      placeholder="e.g. DR-2026-001"
                    />
                  </div>

                  {selectedOrder.service_type === 'deliver' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="driver-name" className="text-sm">
                          Driver Name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="driver-name"
                          value={driverName}
                          onChange={(e) => setDriverName(e.target.value)}
                          placeholder="Full name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="plate-number" className="text-sm">
                          Plate Number <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="plate-number"
                          value={plateNumber}
                          onChange={(e) => setPlateNumber(e.target.value)}
                          placeholder="e.g. ABC 1234"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="dr-image-upload" className="text-sm">
                      DR Picture <span className="text-red-500">*</span>
                    </Label>
                    {drImageFile ? (
                      <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                        <span className="flex-1 truncate text-sm text-emerald-800">
                          {drImageFile.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => setDrImageFile(null)}
                          className="text-emerald-700 hover:text-red-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div
                        className="hover:bg-muted/30 border-muted-foreground/25 hover:border-muted-foreground/40 cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors"
                        onClick={() => document.getElementById('dr-image-upload')?.click()}
                      >
                        <UploadCloud className="text-muted-foreground/40 mx-auto mb-2 h-8 w-8" />
                        <p className="text-muted-foreground text-sm font-medium">
                          Click to upload DR photo
                        </p>
                        <p className="text-muted-foreground/60 mt-1 text-xs">
                          JPG, PNG, or PDF — required before dispatch
                        </p>
                        <input
                          id="dr-image-upload"
                          type="file"
                          className="hidden"
                          accept="image/*,.pdf"
                          onChange={(e) => setDrImageFile(e.target.files?.[0] || null)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Footer ── */}
          <div className="bg-muted/30 flex items-center justify-between border-t px-6 py-4">
            <Button variant="ghost" onClick={() => setSelectedOrder(null)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Processing...' : 'Dispatch & Deduct Stock'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dispatch Confirmation */}
      <AlertDialog open={showDispatchConfirm} onOpenChange={setShowDispatchConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Dispatch</AlertDialogTitle>
            <AlertDialogDescription>
              Dispatch order for{' '}
              <strong>
                {selectedOrder?.client?.company_name || selectedOrder?.client?.full_name}
              </strong>
              ? This will deduct{' '}
              <strong>
                {(() => {
                  const jb =
                    selectedOrder?.items
                      .filter((i) => i.bag_type === 'JB')
                      .reduce((s, i) => s + i.approved_qty, 0) ?? 0;
                  return `${(jb * BAG_EQUIVALENT.JB).toLocaleString()} bags (${jb} JB)`;
                })()}
              </strong>{' '}
              and{' '}
              <strong>
                {(() => {
                  const sb =
                    selectedOrder?.items
                      .filter((i) => i.bag_type === 'SB')
                      .reduce((s, i) => s + i.approved_qty, 0) ?? 0;
                  return `${(sb * BAG_EQUIVALENT.SB).toLocaleString()} bags (${sb} SB)`;
                })()}
              </strong>{' '}
              from warehouse stock. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={performDispatch}>Confirm Dispatch</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
