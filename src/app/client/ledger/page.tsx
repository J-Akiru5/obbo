"use client";

import { useMemo, useState } from "react";
import { Link2, RotateCcw, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  clientProducts,
  formatCurrency,
  getIndividualBagCount,
  getOrderSubtotal,
  getProductById,
  ledgerEntriesSeed,
  type CatalogSource,
  type ClientPaymentMethod,
  type ServiceType,
} from "@/lib/client-portal-data";

export default function ClientLedgerPage() {
  const [selectedLedgerId, setSelectedLedgerId] = useState(ledgerEntriesSeed[0]?.id ?? "");
  const [source, setSource] = useState<CatalogSource>("PORT");
  const [jbQty, setJbQty] = useState(0);
  const [sbQty, setSbQty] = useState(0);
  const [serviceType, setServiceType] = useState<ServiceType>("deliver");
  const [paymentMethod, setPaymentMethod] = useState<ClientPaymentMethod>("cash");
  const [splitDelivery, setSplitDelivery] = useState(false);
  const [bagsNow, setBagsNow] = useState(0);
  const [poFileName, setPoFileName] = useState("");
  const [driverName, setDriverName] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [pickupDate, setPickupDate] = useState("");

  const selectedLedger = useMemo(
    () => ledgerEntriesSeed.find((entry) => entry.id === selectedLedgerId),
    [selectedLedgerId]
  );

  const selectedProduct = useMemo(
    () => getProductById(selectedLedger?.productId ?? clientProducts[0]?.id ?? ""),
    [selectedLedger]
  );

  const totalPurchased = ledgerEntriesSeed.reduce((sum, entry) => sum + entry.totalPurchased, 0);
  const totalDelivered = ledgerEntriesSeed.reduce((sum, entry) => sum + entry.totalDelivered, 0);
  const remainingBalance = ledgerEntriesSeed.reduce((sum, entry) => sum + entry.remainingBalance, 0);

  const totalBags = getIndividualBagCount(jbQty, sbQty);
  const subtotal = getOrderSubtotal(selectedProduct?.id ?? "", source, totalBags);
  const balanceAfterRequest = Math.max((selectedLedger?.remainingBalance ?? 0) - totalBags, 0);
  const splitRemaining = Math.max(totalBags - (splitDelivery ? bagsNow : totalBags), 0);

  function validateRedelivery(): string | null {
    if (!selectedLedger) return "Please select a source PO entry.";
    if (totalBags <= 0) return "At least one of JB or SB must be greater than zero.";
    if (totalBags > selectedLedger.remainingBalance) {
      return "Requested quantity cannot exceed the remaining balance for this PO.";
    }
    if (!poFileName) return "Please upload the updated PO reference file.";
    if (splitDelivery && (bagsNow <= 0 || bagsNow > totalBags)) {
      return "Split delivery bags now must be greater than zero and not exceed total bags.";
    }
    if (serviceType === "pick-up") {
      if (!driverName.trim()) return "Driver name is required for pick-up.";
      if (!plateNumber.trim()) return "Plate number is required for pick-up.";
      if (!pickupDate) return "Preferred pick-up date is required.";
    }
    return null;
  }

  function submitRedelivery() {
    const error = validateRedelivery();
    if (error) {
      toast.error(error);
      return;
    }

    toast.success(`Re-delivery Request submitted and linked to ${selectedLedger?.poNumber}.`);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Balance Ledger</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Monitor purchased and delivered quantities, then request re-delivery of remaining balances.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-muted-foreground">Total Purchased</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-[var(--color-industrial-blue)]">{totalPurchased}</p>
            <p className="text-xs text-muted-foreground">Individual bags</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-muted-foreground">Total Delivered</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-[var(--color-industrial-blue)]">{totalDelivered}</p>
            <p className="text-xs text-muted-foreground">Individual bags</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-muted-foreground">Remaining Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-[var(--color-industrial-yellow)]">{remainingBalance}</p>
            <p className="text-xs text-muted-foreground">Individual bags</p>
          </CardContent>
        </Card>
      </section>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Transaction History by PO Number</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {ledgerEntriesSeed.map((entry) => {
            const product = getProductById(entry.productId);
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => setSelectedLedgerId(entry.id)}
                className={`w-full rounded-lg border p-3 text-left ${
                  selectedLedgerId === entry.id
                    ? "border-[var(--color-industrial-blue)] bg-[var(--color-industrial-blue)]/5"
                    : "border-border hover:border-[var(--color-industrial-blue)]/30"
                }`}
              >
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{entry.poNumber}</p>
                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                    Remaining {entry.remainingBalance} bags
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{product?.name ?? "Unknown Product"}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Purchased: {entry.totalPurchased} | Delivered: {entry.totalDelivered} | Last movement: {new Date(entry.lastMovementDate).toLocaleString()}
                </p>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <RotateCcw className="h-4 w-4 text-[var(--color-industrial-blue)]" /> Re-delivery Request Form
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Linked Original PO Number</Label>
              <Input value={selectedLedger?.poNumber ?? ""} disabled />
            </div>
            <div className="space-y-2">
              <Label>Product</Label>
              <Input value={selectedProduct?.name ?? ""} disabled />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Choose Source</Label>
              <Select value={source} onValueChange={(value) => setSource(value as CatalogSource)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PORT">PORT</SelectItem>
                  <SelectItem value="WAREHOUSE">WAREHOUSE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Number of JB</Label>
              <Input type="number" min={0} value={jbQty} onChange={(event) => setJbQty(Number(event.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label>Number of SB</Label>
              <Input type="number" min={0} value={sbQty} onChange={(event) => setSbQty(Number(event.target.value) || 0)} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Total Individual Bags</Label>
              <Input value={String(totalBags)} disabled />
            </div>
            <div className="space-y-2">
              <Label>Balance After This Request</Label>
              <Input value={String(balanceAfterRequest)} disabled />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 md:max-w-sm">
            <Button
              type="button"
              variant={serviceType === "pick-up" ? "default" : "outline"}
              onClick={() => {
                setServiceType("pick-up");
                setSplitDelivery(false);
              }}
              className={serviceType === "pick-up" ? "bg-[var(--color-industrial-blue)] hover:bg-[var(--color-industrial-blue)]/90" : ""}
            >
              Pick-up
            </Button>
            <Button
              type="button"
              variant={serviceType === "deliver" ? "default" : "outline"}
              onClick={() => setServiceType("deliver")}
              className={serviceType === "deliver" ? "bg-[var(--color-industrial-blue)] hover:bg-[var(--color-industrial-blue)]/90" : ""}
            >
              Deliver
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Payment Method</Label>
            <div className="grid max-w-xs grid-cols-2 gap-2">
              <Button
                type="button"
                variant={paymentMethod === "cash" ? "default" : "outline"}
                onClick={() => setPaymentMethod("cash")}
                className={paymentMethod === "cash" ? "bg-[var(--color-industrial-blue)] hover:bg-[var(--color-industrial-blue)]/90" : ""}
              >
                Cash
              </Button>
              <Button
                type="button"
                variant={paymentMethod === "check" ? "default" : "outline"}
                onClick={() => setPaymentMethod("check")}
                className={paymentMethod === "check" ? "bg-[var(--color-industrial-blue)] hover:bg-[var(--color-industrial-blue)]/90" : ""}
              >
                Check
              </Button>
            </div>
          </div>

          {serviceType === "deliver" && (
            <div className="space-y-3 rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>Split Delivery</Label>
                <Button
                  type="button"
                  size="sm"
                  variant={splitDelivery ? "default" : "outline"}
                  className={splitDelivery ? "bg-[var(--color-industrial-yellow)] text-[var(--color-industrial-blue)] hover:bg-[var(--color-industrial-yellow)]" : ""}
                  onClick={() => {
                    setSplitDelivery((value) => !value);
                    setBagsNow(totalBags);
                  }}
                >
                  {splitDelivery ? "Enabled" : "Enable Split Delivery"}
                </Button>
              </div>

              {splitDelivery && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>How many individual bags do you want to receive now?</Label>
                    <Input
                      type="number"
                      min={1}
                      max={totalBags}
                      value={bagsNow}
                      onChange={(event) => setBagsNow(Number(event.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Remaining Saved Balance</Label>
                    <Input value={String(splitRemaining)} disabled />
                  </div>
                </div>
              )}
            </div>
          )}

          {serviceType === "pick-up" && (
            <div className="grid gap-4 rounded-lg border border-border p-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Driver Name</Label>
                <Input value={driverName} onChange={(event) => setDriverName(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Plate Number</Label>
                <Input value={plateNumber} onChange={(event) => setPlateNumber(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Preferred Date of Pick-up</Label>
                <Input type="date" value={pickupDate} onChange={(event) => setPickupDate(event.target.value)} />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Updated PO Reference Upload</Label>
            <Input type="file" accept="image/*,.pdf" onChange={(event) => setPoFileName(event.target.files?.[0]?.name ?? "")} />
            {poFileName && <p className="text-xs text-muted-foreground">Attached: {poFileName}</p>}
          </div>

          <div className="rounded-lg border border-[var(--color-industrial-blue)]/20 bg-[var(--color-industrial-blue)]/5 p-3 text-sm">
            <div className="mb-1 flex items-center gap-2 font-medium text-[var(--color-industrial-blue)]">
              <Wallet className="h-4 w-4" /> Live Re-delivery Cost Preview
            </div>
            <p className="text-muted-foreground">
              Subtotal: <span className="font-semibold text-foreground">{formatCurrency(subtotal)}</span>
            </p>
            <p className="text-muted-foreground">
              {serviceType === "deliver"
                ? "Grand Total: Subtotal + manager-defined shipping fee after approval"
                : `Grand Total: ${formatCurrency(subtotal)}`}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="bg-[var(--color-industrial-blue)] hover:bg-[var(--color-industrial-blue)]/90"
              onClick={submitRedelivery}
            >
              Submit Re-delivery Request
            </Button>
            <Button type="button" variant="outline" onClick={() => toast.success("Draft re-delivery request saved.")}>Save as Draft</Button>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
            <Link2 className="h-4 w-4 shrink-0" />
            Submitted requests will appear in the Admin Panel as: Re-delivery Request - Linked to {selectedLedger?.poNumber ?? "PO"}.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
