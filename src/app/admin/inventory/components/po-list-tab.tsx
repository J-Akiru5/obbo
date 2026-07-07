'use client';

import { useState, useEffect } from 'react';
import { PurchaseOrder, Profile, Product } from '@/lib/types/database';
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
import {
  Plus,
  Search,
  Edit2,
  MapPin,
  Truck,
  UploadCloud,
  CheckCircle2,
  X,
  FileImage,
  Eye,
  LayoutGrid,
  List,
  Check,
  ChevronsUpDown,
  ShoppingBag,
  Clock,
  FileText,
} from 'lucide-react';
import {
  createPurchaseOrder,
  updatePurchaseOrder,
  generateAdminPoNumber,
} from '@/lib/actions/admin-actions';
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
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

function deriveJBAndSB(totalBags: number): { jb: number; sb: number } {
  const jb = Math.floor(totalBags / 25);
  const remaining = totalBags % 25;
  const sb = Math.floor(remaining / 50);
  const finalRemaining = remaining % 50;
  const adjustedJb = finalRemaining >= 25 ? jb + 1 : jb;
  return { jb: adjustedJb, sb };
}

export function PoListTab({
  purchaseOrders,
  loading,
  onReload,
}: {
  purchaseOrders: PurchaseOrder[];
  loading: boolean;
  onReload: () => void;
}) {
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewingPo, setViewingPo] = useState<PurchaseOrder | null>(null);
  const [editingPo, setEditingPo] = useState<PurchaseOrder | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Client search state
  const [clients, setClients] = useState<Profile[]>([]);
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientOpen, setClientOpen] = useState(false);

  // SYSTEM CACHE: Lagayan para sa live catalog active product reference rates
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);

  // Form state
  const [poNumber, setPoNumber] = useState('');
  const [clientName, setClientName] = useState('');
  const [jbQty, setJbQty] = useState(0);
  const [source, setSource] = useState('warehouse');
  const [serviceType, setServiceType] = useState('pickup');
  const [checkNumber, setCheckNumber] = useState('');
  const [checkAmount, setCheckAmount] = useState(0);
  const [cashAmount, setCashAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'check'>('cash');
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  // DATABASE CALL LOOKUP: Kukunin ang mga produkto para malaman ang pinakabagong Port vs Warehouse selling prices
  const fetchCatalogPrices = async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase.from('products').select('*').eq('is_active', true);
      if (data) setCatalogProducts(data);
    } catch (e) {
      console.error('Error reading live parameters:', e);
    }
  };

  const fetchClients = async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'client')
        .eq('kyc_status', 'verified')
        .order('company_name', { ascending: true })
        .order('full_name', { ascending: true });
      setClients(data ?? []);
    } catch (e) {
      console.error('Error fetching clients:', e);
    }
  };

  // REAL-TIME AUTOMATIC COMPUTATION CALCULATOR LOGIC ENGINE
  useEffect(() => {
    if (!isDialogOpen) return;

    const jbProduct = catalogProducts.find((p) => p.bag_type === 'JB');

    const pricePerBag =
      source === 'port'
        ? Number((jbProduct as any)?.price_port ?? 0)
        : Number((jbProduct as any)?.price_warehouse ?? 0);

    const computedTotal = jbQty * pricePerBag;

    if (paymentMethod === 'cash') {
      setCashAmount(computedTotal);
      setCheckAmount(0);
    } else {
      setCheckAmount(computedTotal);
      setCashAmount(0);
    }
  }, [source, jbQty, paymentMethod, catalogProducts, isDialogOpen]);

  const openCreate = async () => {
    setEditingPo(null);
    setJbQty(0);
    setClientName('');
    setClientId(null);
    setPhotoFile(null);
    setSource('warehouse');
    setPaymentMethod('cash');
    setCheckNumber('');
    setCheckAmount(0);
    setCashAmount(0);
    await Promise.all([fetchClients(), fetchCatalogPrices()]);
    setIsDialogOpen(true);

    const nextPo = await generateAdminPoNumber();
    setPoNumber(nextPo);
  };

  const openEdit = async (po: PurchaseOrder) => {
    setEditingPo(po);
    setPoNumber(po.po_number);
    setClientName(po.client_name || '');
    setClientId(po.client_id || null);
    setJbQty((po.jb || 0) * 25 + (po.sb || 0) * 50);
    setSource(po.source || 'warehouse');
    setServiceType(po.service_type || 'pickup');
    setCheckNumber(po.check_number || '');
    setCheckAmount(po.check_amount || 0);
    setCashAmount(po.cash_amount || 0);
    setPaymentMethod(po.check_number ? 'check' : 'cash');
    setPhotoFile(null);
    await Promise.all([fetchClients(), fetchCatalogPrices()]);
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!poNumber.trim()) {
      toast.error('PO Number is required.');
      return;
    }
    if (!photoFile && !editingPo?.photo_url) {
      toast.error('PO Photo is required.');
      return;
    }
    setIsSubmitting(true);
    try {
      let photoUrl: string | undefined;
      if (photoFile) {
        const supabase = createClient();
        const ext = photoFile.name.split('.').pop();
        const fileName = `po_${poNumber.replace(/\//g, '-')}_${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('order-attachments')
          .upload(fileName, photoFile, { upsert: true });
        if (!uploadError) {
          const {
            data: { publicUrl },
          } = supabase.storage.from('order-attachments').getPublicUrl(fileName);
          photoUrl = publicUrl;
        }
      }

      const currentCheckNo = paymentMethod === 'check' ? checkNumber : null;
      const currentCheckAmt = paymentMethod === 'check' ? checkAmount : null;
      const currentCashAmt = paymentMethod === 'cash' ? cashAmount : null;

      const { jb, sb } = deriveJBAndSB(jbQty);

      if (editingPo) {
        await updatePurchaseOrder(editingPo.id, {
          po_number: poNumber,
          client_name: clientName,
          client_id: clientId,
          jb,
          sb,
          source,
          service_type: serviceType,
          check_number: currentCheckNo,
          check_amount: currentCheckAmt,
          cash_amount: currentCashAmt,
          ...(photoUrl ? { photo_url: photoUrl } : {}),
        });
        toast.success('PO updated configurations saved.');
      } else {
        await createPurchaseOrder({
          po_number: poNumber,
          client_name: clientName,
          client_id: clientId,
          jb,
          sb,
          source,
          service_type: serviceType,
          check_number: currentCheckNo,
          check_amount: currentCheckAmt,
          cash_amount: currentCashAmt,
          ...(photoUrl ? { photo_url: photoUrl } : {}),
        });
        toast.success('Manual PO recorded successfully.');
      }
      setIsDialogOpen(false);
      setPhotoFile(null);
      onReload();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save PO');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = purchaseOrders.filter((po) => {
    const matchSearch =
      po.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (po.client_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === 'all' || po.status === statusFilter;
    const matchSource = sourceFilter === 'all' || po.source === sourceFilter;
    const matchDateFrom = !dateFrom || po.date >= dateFrom;
    const matchDateTo = !dateTo || po.date <= dateTo;
    return matchSearch && matchStatus && matchSource && matchDateFrom && matchDateTo;
  });

  const poMetrics = filtered.reduce(
    (acc, po) => {
      acc.totalBags += (po.jb || 0) + (po.sb || 0);
      acc.totalValue += (Number(po.cash_amount) || 0) + (Number(po.check_amount) || 0);
      if (po.status === 'pending') acc.pendingCount += 1;
      return acc;
    },
    { totalBags: 0, totalValue: 0, pendingCount: 0 },
  );

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return (
          <Badge className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-500 capitalize">
            Pending
          </Badge>
        );
      case 'dispatched':
        return (
          <Badge className="rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 font-semibold text-blue-500 capitalize">
            Dispatched
          </Badge>
        );
      case 'completed':
        return (
          <Badge className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-500 capitalize">
            Completed
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="rounded-md px-2 py-0.5 font-semibold capitalize">
            {status}
          </Badge>
        );
    }
  };

  if (loading)
    return (
      <div className="text-muted-foreground animate-pulse py-8 text-center">
        Loading PO list data...
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-border bg-card relative overflow-hidden rounded-2xl border shadow-sm">
          <div className="bg-primary absolute top-0 right-0 left-0 h-1" />
          <CardContent className="flex items-center justify-between p-5">
            <div className="space-y-1.5">
              <span className="text-muted-foreground block text-xs font-bold tracking-wider uppercase">
                Total PO Bag Volume
              </span>
              <div className="text-foreground text-2xl font-extrabold tracking-tight">
                {poMetrics.totalBags.toLocaleString()}{' '}
                <span className="text-muted-foreground text-sm font-medium">bags</span>
              </div>
              <span className="text-muted-foreground block text-[11px] font-medium">
                Accumulated cement units inside current filter
              </span>
            </div>
            <div className="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-xl shadow-sm">
              <ShoppingBag className="text-primary h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card relative overflow-hidden rounded-2xl border shadow-sm">
          <div className="absolute top-0 right-0 left-0 h-1 bg-amber-500" />
          <CardContent className="flex items-center justify-between p-5">
            <div className="space-y-1.5">
              <span className="text-muted-foreground block text-xs font-bold tracking-wider uppercase">
                Active Pending POs
              </span>
              <div className="text-2xl font-extrabold tracking-tight text-amber-500">
                {poMetrics.pendingCount}{' '}
                <span className="text-muted-foreground text-sm font-medium">orders</span>
              </div>
              <span className="text-muted-foreground block text-[11px] font-medium">
                Orders waiting for dispatch confirmation
              </span>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 shadow-sm">
              <Clock className="h-6 w-6 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card relative overflow-hidden rounded-2xl border shadow-sm">
          <div className="absolute top-0 right-0 left-0 h-1 bg-blue-500" />
          <CardContent className="flex items-center justify-between p-5">
            <div className="space-y-1.5">
              <span className="text-muted-foreground block text-xs font-bold tracking-wider uppercase">
                Total PO Financial Value
              </span>
              <div className="text-foreground text-2xl font-extrabold tracking-tight">
                ₱
                {poMetrics.totalValue.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <span className="text-muted-foreground block text-[11px] font-medium">
                Combined cash and check clearing amount
              </span>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 shadow-sm">
              <FileText className="h-6 w-6 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full max-w-sm">
              <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
              <Input
                type="search"
                placeholder="Search PO or Client..."
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
                  className="h-8 w-8 p-0"
                  onClick={() => setViewMode('list')}
                  title="List View"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setViewMode('grid')}
                  title="Grid View"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </div>
              <Button onClick={openCreate} className="bg-primary flex-1 shrink-0 sm:flex-none">
                <Plus className="mr-2 h-4 w-4" /> Add Manual PO
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="dispatched">Dispatched</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={(v) => v && setSourceFilter(v)}>
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="warehouse">Warehouse</SelectItem>
                <SelectItem value="port">Port</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-8 w-[130px] text-xs"
                placeholder="From"
              />
              <span className="text-muted-foreground text-xs">—</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-8 w-[130px] text-xs"
                placeholder="To"
              />
            </div>
            {(statusFilter !== 'all' || sourceFilter !== 'all' || dateFrom || dateTo) && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground h-8 text-xs"
                onClick={() => {
                  setStatusFilter('all');
                  setSourceFilter('all');
                  setDateFrom('');
                  setDateTo('');
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
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">PO #</TableHead>
                    <TableHead className="text-xs">Client Name</TableHead>
                    <TableHead className="text-xs">Service</TableHead>
                    <TableHead className="text-right text-xs">Quantity</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Check No.</TableHead>
                    <TableHead className="text-xs">Cash</TableHead>
                    <TableHead className="text-xs">Image</TableHead>
                    <TableHead className="w-[100px] text-right text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={11}
                        className="text-muted-foreground py-6 text-center text-xs"
                      >
                        No purchase orders found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((po) => (
                      <TableRow key={po.id} className={po.order_id ? 'bg-primary/5' : ''}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {new Date(po.date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-semibold">{po.po_number}</span>
                          {po.order_id && (
                            <Badge
                              variant="outline"
                              className="border-primary/20 text-primary bg-primary/5 ml-2 text-[9px]"
                            >
                              AUTO
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs font-medium">
                          {po.client_name || '—'}
                        </TableCell>
                        <TableCell>
                          <div className="text-muted-foreground flex items-center gap-1 text-[10px] font-bold whitespace-nowrap uppercase">
                            {po.service_type === 'deliver' ? (
                              <Truck className="h-3 w-3" />
                            ) : (
                              <MapPin className="h-3 w-3" />
                            )}
                            {po.service_type === 'deliver' ? 'Delivery' : 'Pick-up'}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-xs font-bold">
                          {(po.jb || 0) + (po.sb || 0)}
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className="h-4 px-1 font-mono text-[9px]">
                            {po.jb > 0 ? 'JB' : 'SB'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{getStatusBadge(po.status)}</TableCell>
                        <TableCell className="text-xs">
                          {po.check_number ? (
                            <div>
                              <span className="text-xs font-medium">{po.check_number}</span>
                              {po.check_amount ? (
                                <p className="text-muted-foreground text-[10px]">
                                  ₱{Number(po.check_amount).toLocaleString()}
                                </p>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {po.cash_amount ? (
                            <span className="text-xs font-medium">
                              ₱{Number(po.cash_amount).toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {po.photo_url ? (
                            <a
                              href={po.photo_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:text-primary/90 hover:bg-primary/10 inline-flex h-7 w-7 items-center justify-center rounded-md"
                            >
                              <FileImage className="h-4 w-4" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setViewingPo(po);
                              setIsViewOpen(true);
                            }}
                            className="mr-1 h-7 w-7 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(po)}
                            className="text-primary hover:text-primary/90 hover:bg-primary/10 h-7 w-7"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.length === 0 ? (
                <div className="text-muted-foreground col-span-full rounded-xl border-2 border-dashed py-12 text-center text-xs">
                  No purchase orders found.
                </div>
              ) : (
                filtered.map((po) => (
                  <Card
                    key={po.id}
                    className="group border-border overflow-hidden transition-shadow hover:shadow-md"
                  >
                    <div className="bg-muted relative flex aspect-[4/3] items-center justify-center overflow-hidden">
                      {po.photo_url ? (
                        <img
                          src={po.photo_url}
                          alt={po.po_number}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="text-muted-foreground/40 flex flex-col items-center">
                          <FileImage className="mb-2 h-10 w-10" />
                          <span className="text-[10px] font-bold tracking-widest uppercase">
                            No Document
                          </span>
                        </div>
                      )}
                      <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          size="icon"
                          variant="secondary"
                          className="h-8 w-8 shadow-sm"
                          onClick={() => {
                            setViewingPo(po);
                            setIsViewOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4 text-emerald-600" />
                        </Button>
                        <Button
                          size="icon"
                          variant="secondary"
                          className="h-8 w-8 shadow-sm"
                          onClick={() => openEdit(po)}
                        >
                          <Edit2 className="text-primary h-4 w-4" />
                        </Button>
                      </div>
                      <div className="absolute top-2 left-2">
                        <Badge
                          variant="secondary"
                          className="text-foreground border-none bg-white/90 text-[10px] font-semibold shadow-sm backdrop-blur-sm"
                        >
                          {new Date(po.date).toLocaleDateString()}
                        </Badge>
                      </div>
                    </div>
                    <CardContent className="space-y-3 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-foreground truncate text-sm font-bold">
                            {po.po_number}
                          </p>
                          <p className="text-muted-foreground truncate text-xs font-medium">
                            {po.client_name || 'Unknown Client'}
                          </p>
                        </div>
                        {po.order_id && (
                          <Badge
                            variant="outline"
                            className="bg-primary/5 text-primary border-primary/10 h-5 shrink-0 text-[9px]"
                          >
                            AUTO
                          </Badge>
                        )}
                      </div>

                      <div className="border-border/50 flex items-center gap-3 border-y py-2">
                        <div className="flex-1">
                          <p className="text-muted-foreground text-[9px] font-bold uppercase">
                            Quantity
                          </p>
                          <p className="text-sm font-bold">{(po.jb || 0) + (po.sb || 0)}</p>
                        </div>
                        <div className="bg-muted h-6 w-px"></div>
                        <div className="flex-1">
                          <p className="text-muted-foreground text-[9px] font-bold uppercase">
                            Type
                          </p>
                          <Badge variant="outline" className="h-4 px-1 font-mono text-[9px]">
                            {po.jb > 0 ? 'JB' : 'SB'}
                          </Badge>
                        </div>
                        <div className="bg-muted h-6 w-px"></div>
                        <div className="flex-1 text-right">
                          <div className="text-muted-foreground inline-flex items-center text-[10px] font-bold uppercase">
                            {po.service_type === 'deliver' ? (
                              <Truck className="mr-1 h-3 w-3" />
                            ) : (
                              <MapPin className="mr-1 h-3 w-3" />
                            )}
                            {po.service_type === 'deliver' ? 'DLV' : 'PCK'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-[10px]">
                          {po.check_number ? (
                            <div className="text-muted-foreground font-medium">
                              CHK:{' '}
                              <span className="text-foreground font-semibold">
                                {po.check_number}
                              </span>
                            </div>
                          ) : po.cash_amount ? (
                            <div className="text-muted-foreground font-medium">
                              CASH:{' '}
                              <span className="text-foreground font-bold">
                                ₱{Number(po.cash_amount).toLocaleString()}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic">No payment</span>
                          )}
                        </div>
                        {getStatusBadge(po.status)}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
              {editingPo ? 'Edit Purchase Order' : 'Add Manual Purchase Order'}
            </DialogTitle>
            <DialogDescription>
              {editingPo
                ? 'Update the details of this purchase order.'
                : 'Create a manual PO entry for walk-in or offline transactions.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="po-number">
                PO Number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="po-number"
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                placeholder="e.g. PO-2026-001"
              />
            </div>
            <div className="space-y-2">
              <Label>Client Name</Label>
              <Popover open={clientOpen} onOpenChange={setClientOpen}>
                {/* 🌟 FIXED PRIMITIVE TRIGGER: Ginawa nating semantic button element ito para mawala ang syntax error */}
                <PopoverTrigger className="border-input bg-background hover:border-primary/50 flex h-10 w-full cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-sm font-normal shadow-sm transition-colors">
                  <span className={clientName ? '' : 'text-muted-foreground'}>
                    {clientName || 'Select a verified client...'}
                  </span>
                  <ChevronsUpDown className="text-muted-foreground ml-2 h-4 w-4 shrink-0" />
                </PopoverTrigger>
                <PopoverContent
                  className="w-[var(--radix-popover-trigger-width)] p-0"
                  align="start"
                >
                  <Command>
                    <CommandInput placeholder="Search clients..." />
                    <CommandList>
                      <CommandEmpty>No verified clients found.</CommandEmpty>
                      <CommandGroup>
                        {clients.map((client) => {
                          const displayName = client.company_name || client.full_name;
                          return (
                            <CommandItem
                              key={client.id}
                              value={displayName}
                              onSelect={() => {
                                setClientName(displayName);
                                setClientId(client.id);
                                setClientOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  clientId === client.id ? 'opacity-100' : 'opacity-0',
                                )}
                              />
                              {displayName}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Service Type</Label>
                <Select value={serviceType} onValueChange={(v) => setServiceType(v || '')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pickup">Pick-up</SelectItem>
                    <SelectItem value="deliver">Delivery</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-primary font-bold">Pricing Source Matrix</Label>
                <Select value={source} onValueChange={(v) => setSource(v || '')}>
                  <SelectTrigger className="border-primary/40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warehouse">Warehouse Rate</SelectItem>
                    <SelectItem value="port">Port Rate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="po-total-quantity">Quantity (Individual Bags)</Label>
                <Input
                  id="po-total-quantity"
                  type="number"
                  min="0"
                  value={jbQty || ''}
                  placeholder="Enter total number of bags"
                  onChange={(e) => {
                    const total = parseInt(e.target.value) || 0;
                    setJbQty(total);
                  }}
                  className="text-lg font-bold"
                />
                <p className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-600">
                  💡 25 individual bags = 1 JB | 50 individual bags = 1 SB
                </p>
              </div>
            </div>

            {/* Payment Details Container */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                  Payment Information (Auto-Computed)
                </p>
                <Select value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)}>
                  <SelectTrigger className="h-7 w-[100px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">💵 Cash</SelectItem>
                    <SelectItem value="check">🏦 Check</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {paymentMethod === 'check' ? (
                <div className="bg-muted/30 animate-in fade-in grid grid-cols-2 gap-4 rounded-xl border border-dashed p-3 duration-200">
                  <div className="space-y-2">
                    <Label htmlFor="po-check-number">Check No.</Label>
                    <Input
                      id="po-check-number"
                      value={checkNumber}
                      onChange={(e) => setCheckNumber(e.target.value)}
                      placeholder="Check number"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="po-check-amount" className="font-bold text-blue-500">
                      Computed Check Amount (₱)
                    </Label>
                    <Input
                      id="po-check-amount"
                      type="number"
                      value={checkAmount}
                      disabled
                      className="bg-background font-black text-blue-600 shadow-sm disabled:opacity-100"
                    />
                  </div>
                </div>
              ) : (
                <div className="bg-muted/30 animate-in fade-in space-y-2 rounded-xl border border-dashed p-3 duration-200">
                  <Label htmlFor="po-cash-amount" className="font-bold text-emerald-500">
                    Computed Cash Amount (₱)
                  </Label>
                  <Input
                    id="po-cash-amount"
                    type="number"
                    value={cashAmount}
                    disabled
                    className="bg-background font-black text-emerald-600 shadow-sm disabled:opacity-100"
                  />
                </div>
              )}
            </div>

            {/* Photo Upload */}
            <div className="space-y-2">
              <Label htmlFor="po-photo-upload">
                PO Attachment Image <span className="text-red-500">*</span>
              </Label>
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
                  onClick={() => document.getElementById('po-photo-upload')?.click()}
                >
                  <UploadCloud className="text-muted-foreground mx-auto mb-1 h-6 w-6" />
                  <p className="text-muted-foreground text-xs">
                    Click to attach validation photo sheet
                  </p>
                  <input
                    id="po-photo-upload"
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
              {isSubmitting ? 'Syncing...' : editingPo ? '✓ Update PO' : '✓ Create PO'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Purchase Order Details</DialogTitle>
            <DialogDescription>Full details for PO {viewingPo?.po_number}</DialogDescription>
          </DialogHeader>
          {viewingPo && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                    PO Number
                  </p>
                  <p className="text-sm font-semibold">{viewingPo.po_number}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                    Date
                  </p>
                  <p className="text-sm">{new Date(viewingPo.date).toLocaleDateString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                    Client
                  </p>
                  <p className="text-sm font-medium">{viewingPo.client_name || '—'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                    Status
                  </p>
                  <div>{getStatusBadge(viewingPo.status)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t pt-4">
                <div className="space-y-1">
                  <p className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                    Quantity
                  </p>
                  <p className="text-sm font-bold">
                    {((viewingPo.jb || 0) + (viewingPo.sb || 0)).toLocaleString()} bags
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                    Bag Type
                  </p>
                  <p className="text-sm font-bold">
                    {viewingPo.jb > 0 ? 'Jumbo Bag (JB)' : 'Sling Bag (SB)'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                    Service Type
                  </p>
                  <p className="text-sm capitalize">{viewingPo.service_type || '—'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                    Source
                  </p>
                  <p className="text-sm capitalize">{viewingPo.source || '—'}</p>
                </div>
              </div>

              <div className="space-y-3 border-t pt-4">
                <p className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                  Payment Information
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {viewingPo.check_number ? (
                    <>
                      <div className="space-y-1">
                        <p className="text-muted-foreground text-xs">Check No.</p>
                        <p className="text-sm font-medium">{viewingPo.check_number}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-muted-foreground text-xs">Amount</p>
                        <p className="text-sm font-bold text-blue-500">
                          ₱{Number(viewingPo.check_amount).toLocaleString()}
                        </p>
                      </div>
                    </>
                  ) : viewingPo.cash_amount ? (
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-xs">Cash Amount</p>
                      <p className="text-sm font-bold text-emerald-500">
                        ₱{Number(viewingPo.cash_amount).toLocaleString()}
                      </p>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-xs italic">No payment data recorded</p>
                  )}
                </div>
              </div>

              {viewingPo.photo_url && (
                <div className="space-y-2 border-t pt-4">
                  <p className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                    PO Document
                  </p>
                  <div className="bg-muted group relative aspect-[4/3] overflow-hidden rounded-lg border">
                    <img
                      src={viewingPo.photo_url}
                      alt="PO Document"
                      className="h-full w-full object-contain"
                    />
                    <a
                      href={viewingPo.photo_url}
                      target="_blank"
                      rel="noreferrer"
                      className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/20 group-hover:opacity-100"
                    >
                      <Button variant="secondary" size="sm">
                        Open Original
                      </Button>
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="border-t pt-3">
            <Button onClick={() => setIsViewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
