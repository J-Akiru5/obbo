'use client';
import { useState, useEffect } from 'react';
import { Shipment, ShipmentLedgerEntry } from '@/lib/types/database';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  ChevronDown,
  ChevronRight,
  PackagePlus,
  Plus,
  Edit2,
  MoreVertical,
  Save,
  AlertTriangle,
  Pencil,
  DollarSign,
  TrendingUp,
  Landmark,
} from 'lucide-react';
import {
  createShipment,
  fetchShipmentLedger,
  addLedgerEntry,
  updateLedgerEntry,
  updateShipment,
} from '@/lib/actions/admin-actions';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LedgerEntryDialog } from './ledger-entry-dialog';

export function ShipmentsTab({
  shipments,
  loading,
  onReload,
}: {
  shipments: Shipment[];
  loading: boolean;
  onReload: () => void;
}) {
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const [ledgerData, setLedgerData] = useState<Record<string, ShipmentLedgerEntry[]>>({});
  const [isCreating, setIsCreating] = useState(false);

  // New batch form
  const [newBatchName, setNewBatchName] = useState('');
  const [newJbBags, setNewJbBags] = useState(0);
  const [newSbBags, setNewSbBags] = useState(0);
  const [newDamagedJb, setNewDamagedJb] = useState(0);
  const [newDamagedSb, setNewDamagedSb] = useState(0);
  const [newArrivalDate, setNewArrivalDate] = useState(new Date().toISOString().split('T')[0]);

  // Edit batch dialog
  const [editingShipment, setEditingShipment] = useState<Shipment | null>(null);
  const [editForm, setEditForm] = useState({
    batch_name: '',
    total_jb: 0,
    total_sb: 0,
    arrival_date: '',
  });
  const [isUpdating, setIsUpdating] = useState(false);

  // Manual remaining override
  const [overrideShipment, setOverrideShipment] = useState<Shipment | null>(null);
  const [overrideRemJb, setOverrideRemJb] = useState(0);
  const [overrideRemSb, setOverrideRemSb] = useState(0);
  const [isSavingOverride, setIsSavingOverride] = useState(false);

  // Ledger entry dialog
  const [ledgerDialogOpen, setLedgerDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ShipmentLedgerEntry | null>(null);
  const [activeShipmentId, setActiveShipmentId] = useState<string>('');

  // ── PRE-FETCH ALL LEDGER ENTRIES FOR ACCURATE LIVE GLOBAL SUMMARY CARDS ──
  useEffect(() => {
    const loadAllLedgers = async () => {
      if (shipments && shipments.length > 0) {
        const ledgerPromises = shipments.map(async (s) => {
          if (!ledgerData[s.id]) {
            const ledger = await fetchShipmentLedger(s.id);
            return { id: s.id, data: ledger as ShipmentLedgerEntry[] };
          }
          return null;
        });
        const results = await Promise.all(ledgerPromises);
        const newLedgerData = { ...ledgerData };
        let stateUpdated = false;
        results.forEach((res) => {
          if (res) {
            newLedgerData[res.id] = res.data;
            stateUpdated = true;
          }
        });
        if (stateUpdated) {
          setLedgerData(newLedgerData);
        }
      }
    };
    loadAllLedgers();
  }, [shipments]);

  // ── FIXED CORRECTION: FINANCIAL MATRIX CALCULATION USING TRUE 'amount' COLUMN ──
  const globalMetrics = Object.values(ledgerData)
    .flat()
    .reduce(
      (acc, entry) => {
        const rowAmount = Number(entry.amount) || 0;
        acc.totalRevenue += rowAmount;
        acc.totalGross += Number(entry.gross_profit) || 0;
        acc.totalNet += Number(entry.net_profit) || 0;
        return acc;
      },
      { totalRevenue: 0, totalGross: 0, totalNet: 0 },
    );

  const refreshLedger = async (shipmentId: string) => {
    const ledger = await fetchShipmentLedger(shipmentId);
    setLedgerData((prev) => ({ ...prev, [shipmentId]: ledger as ShipmentLedgerEntry[] }));
  };

  const toggleExpand = async (shipmentId: string) => {
    if (expandedBatch === shipmentId) {
      setExpandedBatch(null);
      return;
    }
    setExpandedBatch(shipmentId);
    if (!ledgerData[shipmentId]) await refreshLedger(shipmentId);
  };

  const handleCreateBatch = async () => {
    if (!newBatchName) return toast.error('Batch name is required.');
    const totalBags = newJbBags + newSbBags;
    if (totalBags <= 0) return toast.error('Total bags must be greater than 0.');
    setIsCreating(true);
    try {
      await createShipment(
        newBatchName,
        newJbBags,
        newSbBags,
        newArrivalDate,
        newDamagedJb,
        newDamagedSb,
      );
      toast.success('Shipment batch created.');
      setNewBatchName('');
      setNewJbBags(0);
      setNewSbBags(0);
      setNewDamagedJb(0);
      setNewDamagedSb(0);
      setNewArrivalDate(new Date().toISOString().split('T')[0]);
      onReload();
    } catch (e: any) {
      toast.error(e.message || 'Failed to create batch.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateShipment = async () => {
    if (!editingShipment) return;
    setIsUpdating(true);
    try {
      await updateShipment(editingShipment.id, editForm);
      toast.success('Shipment batch updated.');
      setEditingShipment(null);
      onReload();
    } catch (e: any) {
      toast.error(e.message || 'Failed to update batch.');
    } finally {
      setIsUpdating(false);
    }
  };

  const openEditDialog = (s: Shipment) => {
    setEditingShipment(s);
    setEditForm({
      batch_name: s.batch_name,
      total_jb: s.total_jb,
      total_sb: s.total_sb,
      arrival_date: s.arrival_date.split('T')[0],
    });
  };

  const openOverrideDialog = (s: Shipment) => {
    setOverrideShipment(s);
    setOverrideRemJb(s.remaining_jb);
    setOverrideRemSb(s.remaining_sb);
  };

  const handleSaveOverride = async () => {
    if (!overrideShipment) return;
    setIsSavingOverride(true);
    try {
      await updateShipment(overrideShipment.id, {
        remaining_jb: overrideRemJb,
        remaining_sb: overrideRemSb,
      });
      toast.success('Remaining stock updated. Dashboard totals will reflect this change.');
      setOverrideShipment(null);
      onReload();
    } catch (e: any) {
      toast.error(e.message || 'Failed to update.');
    } finally {
      setIsSavingOverride(false);
    }
  };

  // Ledger entry add
  const openAddEntry = (shipmentId: string) => {
    setActiveShipmentId(shipmentId);
    setEditingEntry(null);
    setLedgerDialogOpen(true);
  };

  // Ledger entry edit
  const openEditEntry = (entry: ShipmentLedgerEntry, shipmentId: string) => {
    setActiveShipmentId(shipmentId);
    setEditingEntry(entry);
    setLedgerDialogOpen(true);
  };

  const handleLedgerSubmit = async (data: Record<string, unknown>) => {
    if (editingEntry) {
      await updateLedgerEntry(
        editingEntry.id,
        activeShipmentId,
        {
          jb: editingEntry.jb,
          sb: editingEntry.sb,
          bags_returned: editingEntry.bags_returned,
          bag_returned_type: editingEntry.bag_returned_type,
          return_reason: editingEntry.return_reason,
        },
        data as any,
      );
      toast.success('Ledger entry updated.');
    } else {
      await addLedgerEntry(activeShipmentId, data as any);
      toast.success('Ledger entry added.');
    }
    await refreshLedger(activeShipmentId);
    onReload();
  };

  if (loading)
    return (
      <div className="text-muted-foreground animate-pulse py-8 text-center">
        Loading shipment batches...
      </div>
    );

  return (
    <div className="space-y-6">
      {/* ── NEW FIXED REQUIREMENT 2: FINANCIAL ANALYTICS SUMMARY CARDS ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Global Revenue Card */}
        <Card className="border-border bg-card relative overflow-hidden rounded-2xl border shadow-sm">
          <div className="absolute top-0 right-0 left-0 h-1 bg-emerald-500" />
          <CardContent className="flex items-center justify-between p-5">
            <div className="space-y-1.5">
              <span className="text-muted-foreground block text-xs font-bold tracking-wider uppercase">
                Total Consignment Revenue
              </span>
              <div className="text-foreground text-2xl font-extrabold tracking-tight">
                ₱
                {globalMetrics.totalRevenue.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <span className="text-muted-foreground block text-[11px] font-medium">
                Aggregate gross sales across all batches
              </span>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 shadow-sm">
              <DollarSign className="h-6 w-6 text-emerald-500" />
            </div>
          </CardContent>
        </Card>

        {/* Global Gross Profit Card */}
        <Card className="border-border bg-card relative overflow-hidden rounded-2xl border shadow-sm">
          <div className="absolute top-0 right-0 left-0 h-1 bg-blue-500" />
          <CardContent className="flex items-center justify-between p-5">
            <div className="space-y-1.5">
              <span className="text-muted-foreground block text-xs font-bold tracking-wider uppercase">
                Batch Gross Profit
              </span>
              <div className="text-foreground text-2xl font-extrabold tracking-tight">
                ₱
                {globalMetrics.totalGross.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <span className="text-muted-foreground block text-[11px] font-medium">
                Revenue adjusted with production landed costs
              </span>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 shadow-sm">
              <TrendingUp className="h-6 w-6 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        {/* Global Net Profit Card */}
        <Card className="border-border bg-card relative overflow-hidden rounded-2xl border shadow-sm">
          <div className="absolute top-0 right-0 left-0 h-1 bg-orange-500" />
          <CardContent className="flex items-center justify-between p-5">
            <div className="space-y-1.5">
              <span className="text-muted-foreground block text-xs font-bold tracking-wider uppercase">
                Batch Net Margin Earnings
              </span>
              <div
                className={`text-2xl font-extrabold tracking-tight ${globalMetrics.totalNet >= 0 ? 'text-orange-500' : 'text-red-500'}`}
              >
                ₱
                {globalMetrics.totalNet.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <span className="text-muted-foreground block text-[11px] font-medium">
                Actual net earnings generated for business owners
              </span>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/10 shadow-sm">
              <Landmark className="h-6 w-6 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Header + Create */}
      <div className="bg-card border-border flex items-center justify-between rounded-xl border p-4 shadow-sm">
        <div>
          <h3 className="text-lg font-semibold">Shipment Batches</h3>
          <p className="text-muted-foreground text-sm">
            Each batch tracks a shipment of Portland Cement Type 1.
          </p>
        </div>
        <Dialog>
          <DialogTrigger render={<Button className="bg-primary" />}>
            <PackagePlus className="mr-2 h-4 w-4" /> New Batch
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Shipment Batch</DialogTitle>
              <DialogDescription>Enter the batch name and total bags received.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="shipment-batch-name">
                  Batch Name / Vessel <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="shipment-batch-name"
                  value={newBatchName}
                  onChange={(e) => setNewBatchName(e.target.value)}
                  placeholder="e.g. MV Alpha - May 2026"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="shipment-jb-bags">
                    JB Bags <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="shipment-jb-bags"
                    type="number"
                    min={0}
                    value={newJbBags || ''}
                    onChange={(e) => setNewJbBags(parseInt(e.target.value) || 0)}
                    placeholder="Jumbo Bags"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shipment-sb-bags">
                    SB Bags <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="shipment-sb-bags"
                    type="number"
                    min={0}
                    value={newSbBags || ''}
                    onChange={(e) => setNewSbBags(parseInt(e.target.value) || 0)}
                    placeholder="Standard Bags"
                  />
                </div>
              </div>
              <div className="border-border border-t pt-4">
                <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
                  Damaged (optional)
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="shipment-damaged-jb">Damaged JB</Label>
                    <Input
                      id="shipment-damaged-jb"
                      type="number"
                      min={0}
                      value={newDamagedJb || ''}
                      onChange={(e) =>
                        setNewDamagedJb(Math.min(parseInt(e.target.value) || 0, newJbBags))
                      }
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shipment-damaged-sb">Damaged SB</Label>
                    <Input
                      id="shipment-damaged-sb"
                      type="number"
                      min={0}
                      value={newDamagedSb || ''}
                      onChange={(e) =>
                        setNewDamagedSb(Math.min(parseInt(e.target.value) || 0, newSbBags))
                      }
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
              <div className="bg-muted border-border rounded-lg border border-dashed p-3">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span className="text-muted-foreground">Calculated Total:</span>
                  <span className="text-foreground">{newJbBags + newSbBags} bags</span>
                </div>
                <div className="text-muted-foreground mt-1 flex items-center justify-between text-xs">
                  <span>Good stock:</span>
                  <span>{newJbBags - newDamagedJb + (newSbBags - newDamagedSb)} bags</span>
                </div>
                {(newDamagedJb > 0 || newDamagedSb > 0) && (
                  <div className="mt-0.5 flex items-center justify-between text-xs text-red-500">
                    <span>Damaged:</span>
                    <span>
                      {newDamagedJb + newDamagedSb} bags ({newDamagedJb} JB / {newDamagedSb} SB)
                    </span>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="shipment-arrival-date">Arrival Date</Label>
                <Input
                  id="shipment-arrival-date"
                  type="date"
                  value={newArrivalDate}
                  onChange={(e) => setNewArrivalDate(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreateBatch}
                disabled={isCreating || !newBatchName || newJbBags + newSbBags <= 0}
                className="bg-primary"
              >
                {isCreating ? 'Creating...' : 'Create Batch'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Batch List */}
      <div className="space-y-4">
        {shipments.map((shipment) => {
          const totalRemaining = shipment.remaining_jb + shipment.remaining_sb;
          const totalInitial = shipment.total_jb + shipment.total_sb;
          return (
            <Card
              key={shipment.id}
              className="border-border overflow-hidden border shadow-sm transition-shadow hover:shadow-md"
            >
              {/* Batch Header */}
              <div
                className="hover:bg-muted/30 flex cursor-pointer items-center justify-between p-4 transition-colors"
                onClick={() => toggleExpand(shipment.id)}
              >
                <div className="flex items-center gap-4">
                  {expandedBatch === shipment.id ? (
                    <ChevronDown className="text-muted-foreground h-5 w-5" />
                  ) : (
                    <ChevronRight className="text-muted-foreground h-5 w-5" />
                  )}
                  <div>
                    <h4 className="text-lg font-bold">{shipment.batch_name}</h4>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      Arrived: {new Date(shipment.arrival_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-muted-foreground mb-0.5 text-[10px] font-bold tracking-wider uppercase">
                      Initial Total
                    </p>
                    <p className="text-sm font-semibold">{totalInitial} bags</p>
                  </div>
                  <div className="text-right">
                    <p className="text-primary mb-0.5 text-[10px] font-bold tracking-wider uppercase">
                      Remaining
                    </p>
                    <p className="text-primary text-base font-bold">{totalRemaining} bags</p>
                    <p className="text-muted-foreground text-[10px]">
                      {shipment.remaining_jb} JB · {shipment.remaining_sb} SB
                    </p>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-foreground h-8 w-8"
                          />
                        }
                      >
                        <MoreVertical className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(shipment)}>
                          <Edit2 className="mr-2 h-4 w-4" /> Rename / Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openOverrideDialog(shipment)}>
                          <Pencil className="mr-2 h-4 w-4" /> Adjust Remaining
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>

              {/* Expanded Ledger */}
              {expandedBatch === shipment.id && (
                <div className="border-border bg-muted/10 space-y-4 border-t p-4">
                  {/* Remaining Stock + Add Entry */}
                  <div className="bg-card flex flex-col items-start justify-between gap-3 rounded-lg border p-3 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-4">
                      <div className="bg-primary/10 border-primary/20 rounded-md border px-3 py-1.5">
                        <p className="text-primary text-[10px] font-bold tracking-wider uppercase">
                          Remaining
                        </p>
                        <p className="text-primary text-lg font-bold">{totalRemaining}</p>
                      </div>
                      <div className="text-muted-foreground space-y-0.5 text-xs">
                        <p>
                          JB:{' '}
                          <span className="text-foreground font-bold">{shipment.remaining_jb}</span>
                        </p>
                        <p>
                          SB:{' '}
                          <span className="text-foreground font-bold">{shipment.remaining_sb}</span>
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => openOverrideDialog(shipment)}
                      >
                        <Pencil className="mr-1 h-3 w-3" /> Adjust
                      </Button>
                    </div>
                    {ledgerData[shipment.id] && ledgerData[shipment.id].length > 0 && (
                      <div className="flex items-center gap-3">
                        {(() => {
                          const entries = ledgerData[shipment.id];
                          const batchSales = entries.reduce(
                            (s, e) => s + (Number(e.amount) || 0),
                            0,
                          );
                          const batchGross = entries.reduce(
                            (s, e) => s + (Number(e.gross_profit) || 0),
                            0,
                          );
                          const batchNet = entries.reduce(
                            (s, e) => s + (Number(e.net_profit) || 0),
                            0,
                          );
                          return (
                            <>
                              <div className="text-right">
                                <p className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                                  Sales
                                </p>
                                <p className="text-sm font-bold text-emerald-600">
                                  ₱{batchSales.toLocaleString()}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                                  Gross
                                </p>
                                <p className="text-sm font-bold text-blue-600">
                                  ₱{batchGross.toLocaleString()}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                                  Net
                                </p>
                                <p
                                  className={`text-sm font-bold ${batchNet >= 0 ? 'text-emerald-600' : 'text-red-500'}`}
                                >
                                  ₱{batchNet.toLocaleString()}
                                </p>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}
                    <Button
                      size="sm"
                      onClick={() => openAddEntry(shipment.id)}
                      className="bg-primary"
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" /> Add Entry
                    </Button>
                  </div>

                  {/* Ledger Table */}
                  <div className="bg-card border-border overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead className="w-[80px] text-[10px]">Date</TableHead>
                          <TableHead className="text-[10px]">PO #</TableHead>
                          <TableHead className="text-[10px]">DR #</TableHead>
                          <TableHead className="text-[10px]">Client</TableHead>
                          <TableHead className="text-[10px]">Driver</TableHead>
                          <TableHead className="text-[10px]">Plate</TableHead>
                          <TableHead className="text-[10px]">Destination</TableHead>
                          <TableHead className="text-[10px]">Service</TableHead>
                          <TableHead className="text-right text-[10px]">JB</TableHead>
                          <TableHead className="text-right text-[10px]">SB</TableHead>
                          <TableHead className="text-right text-[10px]">Total</TableHead>
                          <TableHead className="text-[10px]">Payment</TableHead>
                          <TableHead className="text-[10px]">Check No.</TableHead>
                          <TableHead className="text-right text-[10px]">Amount</TableHead>
                          <TableHead className="text-right text-[10px] text-emerald-600">
                            Sales
                          </TableHead>
                          <TableHead className="text-right text-[10px] text-emerald-600">
                            Gross
                          </TableHead>
                          <TableHead className="text-right text-[10px] text-emerald-600">
                            Net
                          </TableHead>
                          <TableHead className="text-right text-[10px] text-emerald-600">
                            Returns
                          </TableHead>
                          <TableHead className="text-[10px]">Ret. Type</TableHead>
                          <TableHead className="text-[10px]">Reason</TableHead>
                          <TableHead className="w-[70px] text-right"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {!ledgerData[shipment.id] ? (
                          <TableRow>
                            <TableCell
                              colSpan={21}
                              className="text-muted-foreground py-4 text-center text-xs"
                            >
                              Loading...
                            </TableCell>
                          </TableRow>
                        ) : ledgerData[shipment.id].length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={21}
                              className="text-muted-foreground py-4 text-center text-xs"
                            >
                              No ledger entries yet.
                            </TableCell>
                          </TableRow>
                        ) : (
                          ledgerData[shipment.id].map((e) => {
                            const rowSales = Number(e.amount) || 0;
                            return (
                              <TableRow key={e.id}>
                                <TableCell className="text-[11px] whitespace-nowrap">
                                  {new Date(e.date).toLocaleDateString()}
                                </TableCell>
                                <TableCell className="text-[11px] font-medium">
                                  {e.po_number || '—'}
                                </TableCell>
                                <TableCell className="text-[11px] font-medium">
                                  {e.dr_number || '—'}
                                </TableCell>
                                <TableCell className="max-w-[100px] truncate text-[11px]">
                                  {e.client_name || '—'}
                                </TableCell>
                                <TableCell className="text-[11px]">
                                  {e.driver_name || '—'}
                                </TableCell>
                                <TableCell className="text-[11px]">
                                  {e.plate_number || '—'}
                                </TableCell>
                                <TableCell
                                  className="max-w-[100px] truncate text-[11px]"
                                  title={e.destination || ''}
                                >
                                  {e.destination || '—'}
                                </TableCell>
                                <TableCell className="text-[10px] uppercase">
                                  {e.service_type === 'deliver'
                                    ? 'Delivery'
                                    : e.service_type === 'pickup'
                                      ? 'Pick-up'
                                      : '—'}
                                </TableCell>
                                <TableCell className="text-right text-[11px] font-medium text-red-500">
                                  {e.jb > 0 ? `-${e.jb}` : '—'}
                                </TableCell>
                                <TableCell className="text-right text-[11px] font-medium text-red-500">
                                  {e.sb > 0 ? `-${e.sb}` : '—'}
                                </TableCell>
                                <TableCell className="text-right text-[11px] font-bold">
                                  {e.jb + e.sb > 0 ? e.jb + e.sb : '—'}
                                </TableCell>
                                <TableCell className="text-[10px] uppercase">
                                  {e.payment_method || '—'}
                                </TableCell>
                                <TableCell className="text-[11px]">
                                  {e.check_number || '—'}
                                </TableCell>
                                <TableCell className="text-right text-[11px]">
                                  {e.amount ? `₱${Number(e.amount).toLocaleString()}` : '—'}
                                </TableCell>

                                {/* Row Inline Dynamic Calculations */}
                                <TableCell className="text-right text-[11px] font-medium text-emerald-600">
                                  {rowSales ? `₱${rowSales.toLocaleString()}` : '—'}
                                </TableCell>
                                <TableCell className="text-right text-[11px] font-medium text-blue-600">
                                  {Number(e.gross_profit)
                                    ? `₱${Number(e.gross_profit).toLocaleString()}`
                                    : '—'}
                                </TableCell>
                                <TableCell className="text-right text-[11px] font-bold text-emerald-600">
                                  {Number(e.net_profit)
                                    ? `₱${Number(e.net_profit).toLocaleString()}`
                                    : '—'}
                                </TableCell>

                                <TableCell className="text-right text-[11px] font-bold text-emerald-600">
                                  {e.bags_returned > 0 ? `+${e.bags_returned}` : '—'}
                                </TableCell>
                                <TableCell className="text-[10px]">
                                  {e.bag_returned_type || '—'}
                                </TableCell>
                                <TableCell className="text-[10px]">
                                  {e.bags_returned > 0 ? (
                                    <span
                                      className={
                                        e.return_reason === 'return' || !e.return_reason
                                          ? 'font-medium text-emerald-600'
                                          : 'font-medium text-red-500'
                                      }
                                    >
                                      {e.return_reason === 'waste'
                                        ? 'Waste'
                                        : e.return_reason === 'damage'
                                          ? 'Damage'
                                          : 'Return'}
                                    </span>
                                  ) : (
                                    '—'
                                  )}
                                </TableCell>
                                <TableCell className="text-right whitespace-nowrap">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-primary h-6 w-6"
                                    onClick={() => openEditEntry(e, shipment.id)}
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Edit Shipment Dialog */}
      <Dialog open={!!editingShipment} onOpenChange={(open) => !open && setEditingShipment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Shipment Batch</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="shipment-edit-batch-name">
                Batch Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="shipment-edit-batch-name"
                value={editForm.batch_name}
                onChange={(e) => setEditForm({ ...editForm, batch_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shipment-edit-arrival-date">Arrival Date</Label>
              <Input
                id="shipment-edit-arrival-date"
                type="date"
                value={editForm.arrival_date}
                onChange={(e) => setEditForm({ ...editForm, arrival_date: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="shipment-edit-initial-jb">Initial JB</Label>
                <Input
                  id="shipment-edit-initial-jb"
                  type="number"
                  min={0}
                  value={editForm.total_jb || ''}
                  placeholder="0"
                  onChange={(e) =>
                    setEditForm({ ...editForm, total_jb: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shipment-edit-initial-sb">Initial SB</Label>
                <Input
                  id="shipment-edit-initial-sb"
                  type="number"
                  min={0}
                  value={editForm.total_sb || ''}
                  placeholder="0"
                  onChange={(e) =>
                    setEditForm({ ...editForm, total_sb: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
            </div>
            <div className="bg-muted border-border rounded-lg border border-dashed p-3">
              <div className="flex items-center justify-between text-sm font-medium">
                <span className="text-muted-foreground">Total Initial Stock:</span>
                <span className="text-foreground">
                  {editForm.total_jb + editForm.total_sb} bags
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingShipment(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateShipment} disabled={isUpdating} className="bg-primary">
              {isUpdating ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Remaining Override Dialog */}
      <Dialog open={!!overrideShipment} onOpenChange={(open) => !open && setOverrideShipment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Remaining Stock</DialogTitle>
            <DialogDescription>
              Manually override the remaining bag counts for{' '}
              <strong>{overrideShipment?.batch_name}</strong>. Use this for damage, spoilage, or
              inventory corrections.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="border-accent/20 bg-accent/5 text-foreground rounded-lg border p-3 text-xs">
              <p className="text-accent-foreground flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="text-accent h-4 w-4" /> Manual Override
              </p>
              <p className="text-muted-foreground mt-1">
                Changes here instantly affect the Dashboard&apos;s &quot;Total Good Stock&quot;
                counter.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="shipment-override-remaining-jb">Remaining JB</Label>
                <Input
                  id="shipment-override-remaining-jb"
                  type="number"
                  min={0}
                  value={overrideRemJb || ''}
                  placeholder="0"
                  onChange={(e) => setOverrideRemJb(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shipment-override-remaining-sb">Remaining SB</Label>
                <Input
                  id="shipment-override-remaining-sb"
                  type="number"
                  min={0}
                  value={overrideRemSb || ''}
                  placeholder="0"
                  onChange={(e) => setOverrideRemSb(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>
            <div className="bg-muted rounded-lg p-3 text-sm">
              <p className="text-muted-foreground">
                New Total:{' '}
                <span className="text-foreground font-bold">
                  {overrideRemJb + overrideRemSb} bags
                </span>
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideShipment(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveOverride} disabled={isSavingOverride} className="bg-primary">
              <Save className="mr-2 h-4 w-4" /> {isSavingOverride ? 'Saving...' : 'Save Override'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ledger Entry Add/Edit Dialog */}
      <LedgerEntryDialog
        open={ledgerDialogOpen}
        onOpenChange={setLedgerDialogOpen}
        entry={editingEntry}
        onSubmit={handleLedgerSubmit}
      />
    </div>
  );
}
