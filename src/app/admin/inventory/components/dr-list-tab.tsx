'use client';

import { useState } from 'react';
import { DeliveryReceipt, Shipment } from '@/lib/types/database';
import { OptimizedImage } from '@/components/ui/optimized-image';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Edit2, UploadCloud, CheckCircle2, X, FileImage } from 'lucide-react';
import { createDeliveryReceipt, updateDeliveryReceipt } from '@/lib/actions/admin-actions';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown, Eye, LayoutGrid, List, Package } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { PurchaseOrder } from '@/lib/types/database';

export function DrListTab({
  deliveryReceipts,
  shipments,
  purchaseOrders,
  loading,
  onReload,
}: {
  deliveryReceipts: DeliveryReceipt[];
  shipments: Shipment[];
  purchaseOrders: PurchaseOrder[];
  loading: boolean;
  onReload: () => void;
}) {
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [drDateFrom, setDrDateFrom] = useState('');
  const [drDateTo, setDrDateTo] = useState('');
  const [viewingDr, setViewingDr] = useState<DeliveryReceipt | null>(null);
  const [poSearch, setPoSearch] = useState('');
  const [isPoOpen, setIsPoOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDr, setEditingDr] = useState<DeliveryReceipt | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [drNumber, setDrNumber] = useState('');
  const [shipmentId, setShipmentId] = useState('');
  const [clientName, setClientName] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [jbQty, setJbQty] = useState(0);
  const [sbQty, setSbQty] = useState(0);
  const [driver, setDriver] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [destination, setDestination] = useState('');
  const [shippingFee, setShippingFee] = useState(0);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const openCreate = () => {
    setEditingDr(null);
    setJbQty(0);
    setSbQty(0);
    setDriver('');
    setPlateNumber('');
    setDestination('');
    setShippingFee(0);
    setPhotoFile(null);
    setIsDialogOpen(true);
  };

  const openEdit = (dr: DeliveryReceipt) => {
    setEditingDr(dr);
    setDrNumber(dr.dr_number);
    setShipmentId(dr.shipment_id);
    setClientName(dr.client_name || '');
    setPoNumber(dr.po_number || '');
    setJbQty(dr.jb || 0);
    setSbQty(dr.sb || 0);
    setDriver(dr.driver || '');
    setPlateNumber(dr.plate_number || '');
    setDestination(dr.destination || '');
    setShippingFee(dr.shipping_fee || 0);
    setPhotoFile(null);
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!drNumber || !shipmentId || !poNumber)
      return toast.error('DR Number, PO# Link, and Shipment Batch are required');
    setIsSubmitting(true);
    try {
      // Upload DR photo if provided
      let drImageUrl: string | undefined = editingDr?.dr_image_url ?? undefined;
      if (photoFile) {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');
        const ext = photoFile.name.split('.').pop();
        const fileName = `${user.id}/dr_${drNumber.replace(/\//g, '-')}_${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('order-attachments')
          .upload(fileName, photoFile, { upsert: true, contentType: photoFile.type });
        if (uploadError) throw new Error(`Failed to upload DR image: ${uploadError.message}`);
        const {
          data: { publicUrl },
        } = supabase.storage.from('order-attachments').getPublicUrl(fileName);
        drImageUrl = publicUrl;
      }

      if (editingDr) {
        await updateDeliveryReceipt(editingDr.id, {
          dr_number: drNumber,
          shipment_id: shipmentId,
          client_name: clientName,
          po_number: poNumber,
          jb: jbQty,
          sb: sbQty,
          driver,
          plate_number: plateNumber,
          shipping_fee: shippingFee,
          destination: destination || null,
          ...(drImageUrl ? { dr_image_url: drImageUrl } : {}),
        });
        toast.success('DR updated');
      } else {
        await createDeliveryReceipt({
          dr_number: drNumber,
          shipment_id: shipmentId,
          client_name: clientName,
          po_number: poNumber,
          jb: jbQty,
          sb: sbQty,
          driver,
          plate_number: plateNumber,
          shipping_fee: shippingFee,
          destination: destination || undefined,
          ...(drImageUrl ? { dr_image_url: drImageUrl } : {}),
        });
        toast.success('DR created and ledger updated');
      }
      setIsDialogOpen(false);
      setPhotoFile(null);
      onReload();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save DR');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = deliveryReceipts.filter((dr) => {
    const matchSearch =
      dr.dr_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (dr.client_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (dr.po_number || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchDateFrom = !drDateFrom || dr.received_date >= drDateFrom;
    const matchDateTo = !drDateTo || dr.received_date <= drDateTo;
    return matchSearch && matchDateFrom && matchDateTo;
  });

  if (loading)
    return (
      <div className="text-muted-foreground animate-pulse py-8 text-center">Loading DR list...</div>
    );

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full max-w-sm">
            <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
            <Input
              type="search"
              placeholder="Search DR, PO, or Client..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <div className="bg-muted/30 flex items-center rounded-md border p-1">
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setViewMode('list')}
                title="List View"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setViewMode('grid')}
                title="Grid View"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
            <Button onClick={openCreate} className="bg-primary h-9 shrink-0">
              <Plus className="mr-2 h-4 w-4" /> Add Manual DR
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={drDateFrom}
            onChange={(e) => setDrDateFrom(e.target.value)}
            className="h-8 w-[130px] text-xs"
            placeholder="From"
          />
          <span className="text-muted-foreground text-xs">—</span>
          <Input
            type="date"
            value={drDateTo}
            onChange={(e) => setDrDateTo(e.target.value)}
            className="h-8 w-[130px] text-xs"
            placeholder="To"
          />
          {(drDateFrom || drDateTo) && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground h-8 text-xs"
              onClick={() => {
                setDrDateFrom('');
                setDrDateTo('');
              }}
            >
              <X className="mr-1 h-3 w-3" /> Clear
            </Button>
          )}
        </div>

        {viewMode === 'list' ? (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Image</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>DR #</TableHead>
                  <TableHead>Client Name</TableHead>
                  <TableHead>PO# Link</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Driver Name</TableHead>
                  <TableHead>Plate #</TableHead>
                  <TableHead className="text-right">Total Bags</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-muted-foreground py-6 text-center">
                      No delivery receipts found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((dr) => (
                    <TableRow key={dr.id} className={dr.order_id ? 'bg-primary/5' : ''}>
                      <TableCell>
                        <div className="bg-muted border-border flex h-10 w-10 items-center justify-center overflow-hidden rounded border">
                          {dr.dr_image_url ? (
                            <OptimizedImage
                              src={dr.dr_image_url}
                              alt="DR"
                              fill
                              className="object-cover"
                              unoptimized
                              containerClassName="w-full h-full"
                            />
                          ) : (
                            <FileImage className="text-muted-foreground/40 h-5 w-5" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {new Date(dr.received_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-semibold">{dr.dr_number}</span>
                        {dr.order_id && (
                          <Badge
                            variant="outline"
                            className="border-primary/20 text-primary bg-primary/5 ml-2 text-[9px]"
                          >
                            AUTO
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{dr.client_name || '—'}</TableCell>
                      <TableCell>
                        {dr.po_number ? (
                          <Badge variant="outline" className="cursor-default font-mono text-xs">
                            {dr.po_number}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {dr.order ? (
                          <div className="flex items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className="bg-primary/5 border-primary/20 text-[10px] capitalize"
                            >
                              {dr.order.status}
                            </Badge>
                            <span className="text-muted-foreground font-mono text-[10px]">
                              {dr.order.id.slice(0, 8)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{dr.driver || '—'}</TableCell>
                      <TableCell className="text-sm">{dr.plate_number || '—'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="text-foreground text-xs font-bold">{dr.jb + dr.sb}</span>
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {dr.jb > 0 ? 'JB' : 'SB'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setViewingDr(dr);
                            setIsViewOpen(true);
                          }}
                          className="text-primary hover:text-primary hover:bg-primary/10 h-8 w-8"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(dr)}
                          className="text-primary hover:text-primary/90 hover:bg-primary/10 h-8 w-8"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.length === 0 ? (
              <div className="text-muted-foreground col-span-full rounded-xl border-2 border-dashed py-12 text-center">
                No delivery receipts found matching your search.
              </div>
            ) : (
              filtered.map((dr) => (
                <Card
                  key={dr.id}
                  className={`group overflow-hidden transition-shadow hover:shadow-md ${dr.order_id ? 'border-primary/10 bg-primary/5' : ''}`}
                >
                  <div className="bg-muted relative aspect-video overflow-hidden border-b">
                    {dr.dr_image_url ? (
                      <OptimizedImage
                        src={dr.dr_image_url}
                        alt="DR"
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        unoptimized
                        containerClassName="h-full w-full"
                      />
                    ) : (
                      <div className="text-muted-foreground/30 absolute inset-0 flex flex-col items-center justify-center">
                        <FileImage className="mb-2 h-12 w-12" />
                        <span className="text-[10px] font-bold tracking-widest uppercase">
                          No Document Preview
                        </span>
                      </div>
                    )}
                    <div className="absolute top-2 right-2 flex gap-1">
                      {dr.order_id && (
                        <Badge className="bg-primary text-primary-foreground border-none text-[9px]">
                          AUTO
                        </Badge>
                      )}
                      <Badge
                        variant="secondary"
                        className="bg-background/80 text-foreground border-none font-mono text-[10px] backdrop-blur-sm"
                      >
                        {new Date(dr.received_date).toLocaleDateString()}
                      </Badge>
                    </div>
                  </div>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-foreground text-sm font-bold">{dr.dr_number}</h4>
                        <p className="text-muted-foreground max-w-[150px] truncate text-xs">
                          {dr.client_name || 'Unknown Client'}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-muted-foreground mb-0.5 text-[10px] font-bold uppercase">
                          PO Link
                        </div>
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {dr.po_number || 'NONE'}
                        </Badge>
                      </div>
                    </div>

                    {dr.order && (
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-muted-foreground font-bold uppercase">Order</span>
                        <div className="flex items-center gap-1">
                          <Badge
                            variant="outline"
                            className="bg-primary/5 border-primary/20 text-[9px] capitalize"
                          >
                            {dr.order.status}
                          </Badge>
                          <span className="text-muted-foreground font-mono">
                            {dr.order.id.slice(0, 8)}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="border-border grid grid-cols-2 gap-2 border-y py-2">
                      <div>
                        <div className="text-muted-foreground mb-1 text-[9px] font-bold uppercase">
                          Driver / Plate
                        </div>
                        <p className="truncate text-[11px] font-medium">
                          {dr.driver || '—'} • {dr.plate_number || '—'}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-muted-foreground mb-1 text-[9px] font-bold uppercase">
                          Quantity
                        </div>
                        <p className="text-foreground text-[11px] font-bold">
                          {dr.jb + dr.sb} {dr.jb > 0 ? 'JB' : 'SB'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="bg-primary text-primary-foreground hover:bg-primary/90 h-8 gap-1.5 text-[11px] font-bold"
                        onClick={() => {
                          setViewingDr(dr);
                          setIsViewOpen(true);
                        }}
                      >
                        <Eye className="h-3.5 w-3.5" /> View Details
                      </Button>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(dr)}
                          className="text-primary hover:text-primary/90 hover:bg-primary/10 h-8 w-8"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </CardContent>

      {/* View Details Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent
          showCloseButton={false}
          className="max-h-[90vh] overflow-hidden overflow-y-auto rounded-xl border-none p-0 sm:max-w-2xl"
        >
          <div className="bg-primary text-primary-foreground p-6">
            <div className="flex items-start justify-between">
              <div>
                <Badge className="mb-2 border-none bg-white/20 text-[10px] text-white hover:bg-white/30">
                  Delivery Receipt Details
                </Badge>
                <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
                  {viewingDr?.dr_number}
                  {viewingDr?.order_id && (
                    <Badge className="border-none bg-amber-400 text-[9px] font-black text-amber-950 uppercase">
                      Automated
                    </Badge>
                  )}
                </h2>
                <p className="text-primary-foreground/70 mt-1 text-sm">
                  Received on{' '}
                  {viewingDr &&
                    new Date(viewingDr.received_date).toLocaleDateString(undefined, {
                      dateStyle: 'full',
                    })}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsViewOpen(false)}
                className="h-8 w-8 rounded-full text-white hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-0 md:grid-cols-2">
            <div className="space-y-6 p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-muted-foreground/60 text-[10px] font-black tracking-wider uppercase">
                    Client Name
                  </p>
                  <p className="text-foreground font-bold">{viewingDr?.client_name || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground/60 text-[10px] font-black tracking-wider uppercase">
                    PO Number Link
                  </p>
                  <p className="text-primary font-mono font-bold">
                    {viewingDr?.po_number || 'NONE'}
                  </p>
                </div>
              </div>

              <div className="bg-muted/30 border-border space-y-3 rounded-lg border p-4">
                <p className="text-muted-foreground/60 text-[10px] font-black tracking-wider uppercase">
                  Shipment Details
                </p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2 font-medium">
                    <Package className="h-4 w-4" /> Quantity
                  </span>
                  <span className="text-foreground font-black">
                    {(viewingDr?.jb || 0) + (viewingDr?.sb || 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2 font-medium">
                    <Package className="h-4 w-4" /> Bag Type
                  </span>
                  <span className="text-foreground font-black">
                    {(viewingDr?.jb ?? 0) > 0 ? 'JB' : 'SB'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-muted-foreground/60 text-[10px] font-black tracking-wider uppercase">
                    Driver / Plate
                  </p>
                  <p className="text-foreground text-sm font-bold">
                    {viewingDr?.driver || '—'} / {viewingDr?.plate_number || '—'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground/60 text-[10px] font-black tracking-wider uppercase">
                    Shipping Fee
                  </p>
                  <p className="text-sm font-bold text-emerald-600">
                    ₱{viewingDr?.shipping_fee?.toLocaleString() || '0.00'}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-muted-foreground/60 text-[10px] font-black tracking-wider uppercase">
                  Destination Address
                </p>
                <p className="text-foreground border-accent border-l-2 pl-3 text-sm leading-relaxed font-medium italic">
                  {viewingDr?.destination || 'No destination specified.'}
                </p>
              </div>
            </div>

            <div className="bg-muted relative flex min-h-[300px] items-center justify-center border-t md:border-t-0 md:border-l">
              {viewingDr?.dr_image_url ? (
                <>
                  <OptimizedImage
                    src={viewingDr.dr_image_url}
                    alt="DR Document"
                    fill
                    className="object-contain p-2"
                    unoptimized
                    containerClassName="h-full w-full"
                  />
                  <a
                    href={viewingDr.dr_image_url}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-background/90 hover:bg-background text-foreground absolute right-4 bottom-4 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-bold shadow-lg backdrop-blur-sm transition-colors"
                  >
                    <FileImage className="h-3.5 w-3.5" /> Full Resolution
                  </a>
                </>
              ) : (
                <div className="text-muted-foreground/40 flex flex-col items-center justify-center p-8 text-center">
                  <FileImage className="mb-4 h-16 w-16" />
                  <p className="text-xs font-bold tracking-widest uppercase">
                    No Document Uploaded
                  </p>
                  <p className="mt-2 text-[10px]">
                    Manual entries without photos do not show previews.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-muted/20 flex justify-end border-t p-4">
            <Button
              variant="outline"
              onClick={() => setIsViewOpen(false)}
              className="rounded-lg text-xs font-bold tracking-widest uppercase"
            >
              Close Record
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create / Edit Dialog */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setPhotoFile(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingDr ? 'Edit Delivery Receipt' : 'Add Manual Delivery Receipt'}
            </DialogTitle>
            <DialogDescription>
              {editingDr
                ? 'Update the details of this delivery receipt.'
                : 'Create a manual DR entry for walk-in or offline transactions.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="dr-number">
                DR Number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="dr-number"
                value={drNumber}
                onChange={(e) => setDrNumber(e.target.value)}
                placeholder="e.g. DR-2026-001"
              />
            </div>
            <div className="space-y-2">
              <Label>
                Source Shipment Batch <span className="text-red-500">*</span>
              </Label>
              <Select
                value={shipmentId}
                onValueChange={(v) => setShipmentId(v || '')}
                disabled={!!editingDr}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select batch" />
                </SelectTrigger>
                <SelectContent>
                  {shipments.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.batch_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!editingDr && (
                <p className="text-muted-foreground text-xs">
                  Adding a DR will automatically add a ledger entry to this batch.
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dr-client">Client Name</Label>
                <Input
                  id="dr-client"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  PO# Link <span className="text-red-500">*</span>
                </Label>
                <Popover open={isPoOpen} onOpenChange={setIsPoOpen}>
                  <PopoverTrigger
                    render={
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={isPoOpen}
                        className="w-full justify-between font-normal"
                      >
                        {poNumber || 'Select PO Number...'}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    }
                  />
                  <PopoverContent className="w-[200px] p-0" align="start">
                    <div className="flex flex-col">
                      <div className="border-b p-2">
                        <Input
                          placeholder="Search PO..."
                          className="h-8"
                          value={poSearch}
                          onChange={(e) => setPoSearch(e.target.value)}
                        />
                      </div>
                      <div className="max-h-[200px] overflow-y-auto p-1">
                        {purchaseOrders
                          .filter((po) =>
                            po.po_number.toLowerCase().includes(poSearch.toLowerCase()),
                          )
                          .map((po) => (
                            <div
                              key={po.id}
                              className="hover:bg-accent flex cursor-pointer items-center justify-between rounded-sm px-2 py-1.5 text-sm"
                              onClick={() => {
                                setPoNumber(po.po_number);
                                setClientName(po.client_name || '');
                                setIsPoOpen(false);
                                setPoSearch('');
                              }}
                            >
                              <div className="flex flex-col">
                                <span>{po.po_number}</span>
                                <span className="text-muted-foreground text-[10px]">
                                  {po.client_name}
                                </span>
                              </div>
                              {poNumber === po.po_number && <Check className="h-4 w-4" />}
                            </div>
                          ))}
                        {purchaseOrders.filter((po) =>
                          po.po_number.toLowerCase().includes(poSearch.toLowerCase()),
                        ).length === 0 && (
                          <div className="text-muted-foreground p-2 text-center text-xs">
                            No PO found
                          </div>
                        )}

                        {poSearch && !purchaseOrders.some((po) => po.po_number === poSearch) && (
                          <div
                            className="hover:bg-accent mt-1 cursor-pointer border-t p-2 text-xs font-medium text-blue-600"
                            onClick={() => {
                              setPoNumber(poSearch);
                              setIsPoOpen(false);
                              setPoSearch('');
                            }}
                          >
                            Use manual: &quot;{poSearch}&quot;
                          </div>
                        )}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                {!editingDr && (
                  <p className="text-[10px] leading-tight text-emerald-600">
                    Linking a PO automatically syncs its payment data into the Shipment Ledger.
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dr-jb-quantity">Quantity JB (Jumbo Bag)</Label>
                <Input
                  id="dr-jb-quantity"
                  type="number"
                  min="0"
                  value={jbQty || ''}
                  placeholder="0"
                  onChange={(e) => setJbQty(parseInt(e.target.value) || 0)}
                  className="font-bold"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dr-sb-quantity">Quantity SB (Sling Bag)</Label>
                <Input
                  id="dr-sb-quantity"
                  type="number"
                  min="0"
                  value={sbQty || ''}
                  placeholder="0"
                  onChange={(e) => setSbQty(parseInt(e.target.value) || 0)}
                  className="font-bold"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dr-driver">Driver Name</Label>
                <Input id="dr-driver" value={driver} onChange={(e) => setDriver(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dr-plate">Plate Number</Label>
                <Input
                  id="dr-plate"
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dr-destination">Destination</Label>
              <Input
                id="dr-destination"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Delivery address or location"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dr-shipping-fee">Shipping Fee (₱)</Label>
              <Input
                id="dr-shipping-fee"
                type="number"
                min="0"
                value={shippingFee || ''}
                placeholder="0"
                onChange={(e) => setShippingFee(parseFloat(e.target.value) || 0)}
              />
            </div>

            {/* Photo Upload */}
            <div className="space-y-2">
              <Label>
                DR Photo <span className="text-muted-foreground text-xs">(optional)</span>
              </Label>
              {editingDr?.dr_image_url && !photoFile && (
                <div className="text-primary flex items-center gap-2 text-xs">
                  <FileImage className="h-3.5 w-3.5" />
                  <a
                    href={editingDr.dr_image_url}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline"
                  >
                    View current photo
                  </a>
                  <span className="text-muted-foreground">— upload a new one to replace</span>
                </div>
              )}
              {photoFile ? (
                <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span className="flex-1 truncate text-sm text-emerald-800">{photoFile.name}</span>
                  <button
                    type="button"
                    onClick={() => setPhotoFile(null)}
                    className="text-emerald-700 hover:text-red-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div
                  className="border-border hover:border-primary/50 hover:bg-muted/30 cursor-pointer rounded-lg border-2 border-dashed p-4 text-center transition-colors"
                  onClick={() => document.getElementById('dr-photo-upload')?.click()}
                >
                  <UploadCloud className="text-muted-foreground mx-auto mb-1 h-6 w-6" />
                  <p className="text-muted-foreground text-xs">Click to attach DR photo</p>
                  <p className="text-muted-foreground/60 mt-0.5 text-[10px]">JPG, PNG, PDF</p>
                  <input
                    id="dr-photo-upload"
                    type="file"
                    className="hidden"
                    accept="image/*,.pdf"
                    onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                  />
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-primary">
              {isSubmitting ? 'Saving...' : 'Save DR'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
