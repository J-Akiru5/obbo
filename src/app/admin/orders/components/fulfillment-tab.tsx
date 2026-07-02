import { useState } from 'react';
import { Order, Shipment } from '@/lib/types/database';
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
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

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

  const openAction = (order: Order, type: 'dispatch') => {
    setSelectedOrder(order);
    setActionType(type);
    setShipmentId('');
    setDrNumber('');
    setDriverName('');
    setPlateNumber('');
    setDrImageFile(null);
  };

  const handleSubmit = async () => {
    if (!selectedOrder || !actionType) return;
    setIsSubmitting(true);
    try {
      if (actionType === 'dispatch') {
        if (!shipmentId || !drNumber) {
          alert('Please select a shipment batch and provide a DR number.');
          setIsSubmitting(false);
          return;
        }
        if (selectedOrder.service_type === 'deliver' && (!driverName || !plateNumber)) {
          alert('Please provide driver name and plate number for delivery orders.');
          setIsSubmitting(false);
          return;
        }
        if (!drImageFile) {
          alert('Please upload a DR image before dispatch.');
          setIsSubmitting(false);
          return;
        }

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
                      <div className="bg-muted rounded-md px-3 py-1.5">
                        <span className="text-muted-foreground mb-0.5 block text-xs tracking-wider uppercase">
                          Approved JB
                        </span>
                        <span className="font-bold">
                          {jbQty}
                          {isSplit && jbReq > 0 && (
                            <span className="text-muted-foreground ml-1 text-xs font-normal">
                              / {jbReq}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="bg-muted rounded-md px-3 py-1.5">
                        <span className="text-muted-foreground mb-0.5 block text-xs tracking-wider uppercase">
                          Approved SB
                        </span>
                        <span className="font-bold">
                          {sbQty}
                          {isSplit && sbReq > 0 && (
                            <span className="text-muted-foreground ml-1 text-xs font-normal">
                              / {sbReq}
                            </span>
                          )}
                        </span>
                      </div>
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
                    {order.po_image_url && (
                      <a
                        href={order.po_image_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary mt-1 flex items-center gap-1 text-xs hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" /> View PO
                      </a>
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
                  <div className="flex items-center">
                    <Button
                      onClick={() => openAction(order, 'dispatch')}
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
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Dispatch Order</DialogTitle>
            <DialogDescription>
              Fill in dispatch details and select the shipment batch to deduct stock from.
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && actionType === 'dispatch' && (
            <div className="space-y-4 py-4">
              <div className="bg-muted mb-2 grid grid-cols-2 gap-4 rounded-lg p-3 text-sm">
                <div>
                  <p className="text-muted-foreground mb-1 text-xs">Items to Deduct</p>
                  <p className="font-bold">
                    {selectedOrder.items.find((i) => i.bag_type === 'JB')?.approved_qty || 0} JB
                    {' · '}
                    {selectedOrder.items.find((i) => i.bag_type === 'SB')?.approved_qty || 0} SB
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1 text-xs">Service Type</p>
                  <p className="text-primary font-bold uppercase">{selectedOrder.service_type}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>
                  Select Shipment Batch (Source of Truth) <span className="text-red-500">*</span>
                </Label>
                <Select value={shipmentId} onValueChange={(v) => setShipmentId(v || '')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a shipment batch" />
                  </SelectTrigger>
                  <SelectContent>
                    {shipments.map((s) => {
                      const jbNeed =
                        selectedOrder.items.find((i) => i.bag_type === 'JB')?.approved_qty || 0;
                      const sbNeed =
                        selectedOrder.items.find((i) => i.bag_type === 'SB')?.approved_qty || 0;
                      const hasEnough = s.remaining_jb >= jbNeed && s.remaining_sb >= sbNeed;
                      const labelText = `${s.batch_name} (Avail: ${s.remaining_jb} JB, ${s.remaining_sb} SB)${!hasEnough ? ' - Insufficient' : ''}`;
                      return (
                        <SelectItem key={s.id} value={s.id} disabled={!hasEnough} label={labelText}>
                          {labelText}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dr-number">
                  DR Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="dr-number"
                  value={drNumber}
                  onChange={(e) => setDrNumber(e.target.value)}
                />
              </div>

              {selectedOrder.service_type === 'deliver' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="driver-name">
                      Driver Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="driver-name"
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
                      value={plateNumber}
                      onChange={(e) => setPlateNumber(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="mt-4 space-y-2 border-t pt-2">
                <Label htmlFor="dr-image-upload">
                  DR Picture
                  <span className="ml-1 text-red-500">*</span>
                </Label>
                {drImageFile ? (
                  <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
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
                    className="hover:bg-muted/30 cursor-pointer rounded-lg border-2 border-dashed border-red-300 p-4 text-center transition-colors hover:border-red-400"
                    onClick={() => document.getElementById('dr-image-upload')?.click()}
                  >
                    <UploadCloud className="mx-auto mb-1 h-6 w-6 text-red-400" />
                    <p className="text-muted-foreground text-xs">
                      DR photo is required before dispatch
                    </p>
                    <p className="text-muted-foreground/60 mt-0.5 text-[10px]">JPG, PNG, PDF</p>
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
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelectedOrder(null)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-primary">
              {isSubmitting ? 'Processing...' : 'Dispatch & Deduct Stock'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
