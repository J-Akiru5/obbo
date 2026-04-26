"use client";

import { useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { CircleAlert, PackageCheck, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  clientProducts,
  clientProfile,
  formatCurrency,
  getIndividualBagCount,
  getOrderSubtotal,
  getProductById,
  type CatalogSource,
  type ClientPaymentMethod,
  type ServiceType,
} from "@/lib/client-portal-data";

const defaultProductId = clientProducts[0]?.id ?? "";

function CatalogForm() {
  const searchParams = useSearchParams();
  const searchProductId = searchParams.get("product");
  const initialProductId =
    searchProductId && clientProducts.some((product) => product.id === searchProductId)
      ? searchProductId
      : defaultProductId;

  const [selectedProductId, setSelectedProductId] = useState(initialProductId);
  const [source, setSource] = useState<CatalogSource>("PORT");
  const [jbQty, setJbQty] = useState(0);
  const [sbQty, setSbQty] = useState(0);
  const [serviceType, setServiceType] = useState<ServiceType>("deliver");
  const [poNumber, setPoNumber] = useState("");
  const [poFileName, setPoFileName] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<ClientPaymentMethod>("cash");
  const [splitDelivery, setSplitDelivery] = useState(false);
  const [bagsNow, setBagsNow] = useState(0);
  const [driverName, setDriverName] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const selectedProduct = useMemo(() => getProductById(selectedProductId), [selectedProductId]);

  const totalBags = useMemo(() => getIndividualBagCount(jbQty, sbQty), [jbQty, sbQty]);

  const subtotal = getOrderSubtotal(selectedProductId, source, totalBags);
  const bagsReceivingNow = splitDelivery ? bagsNow : totalBags;
  const remainingBalance = Math.max(totalBags - bagsReceivingNow, 0);

  function resetForm() {
    setSource("PORT");
    setJbQty(0);
    setSbQty(0);
    setServiceType("deliver");
    setPoNumber("");
    setPoFileName("");
    setSupplierName("");
    setPaymentMethod("cash");
    setSplitDelivery(false);
    setBagsNow(0);
    setDriverName("");
    setPlateNumber("");
    setPickupDate("");
    setSuccessMessage("");
  }

  function validateForm(): string | null {
    if (!selectedProductId) return "Please select a product.";
    if (totalBags <= 0) return "At least one of JB or SB must be greater than zero.";
    if (!poNumber.trim()) return "PO Number is required.";
    if (!poFileName) return "PO Picture upload is required.";
    if (splitDelivery && (bagsNow <= 0 || bagsNow > totalBags)) {
      return "Split delivery bags now must be greater than zero and not exceed total bags.";
    }
    if (serviceType === "pick-up") {
      if (!driverName.trim()) return "Driver Name is required for pick-up.";
      if (!plateNumber.trim()) return "Plate Number is required for pick-up.";
      if (!pickupDate) return "Preferred Date of Pick-up is required.";
    }
    return null;
  }

  function handleSubmit() {
    const error = validateForm();
    if (error) {
      toast.error(error);
      setSuccessMessage("");
      return;
    }

    setSuccessMessage(
      "Your order has been submitted successfully and is now pending admin approval. If you selected Check as payment method, you will be able to upload your check details once the order is approved."
    );
    toast.success("Order submitted for approval.");
  }

  function handleDraft() {
    const error = selectedProductId ? null : "Please select a product before saving draft.";
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Draft saved. You can continue this order later.");
  }

  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {clientProducts.map((product) => {
          const selected = selectedProductId === product.id;
          return (
            <button
              key={product.id}
              type="button"
              className={`overflow-hidden rounded-xl border text-left transition-all ${
                selected
                  ? "border-[var(--color-industrial-blue)] shadow-sm"
                  : "border-border hover:border-[var(--color-industrial-blue)]/40"
              }`}
              onClick={() => setSelectedProductId(product.id)}
            >
              <div className="relative h-28 w-full">
                <Image src={product.imageUrl} alt={product.name} fill className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                <Badge className="absolute left-2 top-2 bg-[var(--color-industrial-yellow)] text-[var(--color-industrial-blue)] hover:bg-[var(--color-industrial-yellow)]">
                  JB / SB
                </Badge>
              </div>
              <div className="space-y-2 p-3">
                <p className="text-sm font-semibold leading-snug">{product.name}</p>
                <div className="space-y-1 text-xs">
                  <p className="text-muted-foreground">
                    PORT price per individual bag: <span className="font-semibold text-foreground">{formatCurrency(product.portPricePerBag)}</span>
                  </p>
                  <p className="text-muted-foreground">
                    WAREHOUSE price per individual bag: <span className="font-semibold text-foreground">{formatCurrency(product.warehousePricePerBag)}</span>
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </section>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>New Order Form</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="source">1. Choose Source</Label>
              <Select value={source} onValueChange={(value) => setSource(value as CatalogSource)}>
                <SelectTrigger id="source" className="w-full">
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PORT">PORT</SelectItem>
                  <SelectItem value="WAREHOUSE">WAREHOUSE</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>3. Choose Service Type</Label>
              <div className="grid grid-cols-2 gap-2">
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
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="jbQty">2. Number of JB</Label>
              <Input
                id="jbQty"
                type="number"
                min={0}
                value={jbQty}
                onChange={(event) => setJbQty(Number(event.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sbQty">2. Number of SB</Label>
              <Input
                id="sbQty"
                type="number"
                min={0}
                value={sbQty}
                onChange={(event) => setSbQty(Number(event.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label>Total Individual Bags</Label>
              <Input value={String(totalBags)} disabled />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="poNumber">4. PO Number</Label>
              <Input
                id="poNumber"
                value={poNumber}
                onChange={(event) => setPoNumber(event.target.value)}
                placeholder="Client-provided PO number"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier">4. Supplier Name (Optional)</Label>
              <Input
                id="supplier"
                value={supplierName}
                onChange={(event) => setSupplierName(event.target.value)}
                placeholder="Supplier name"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="poPicture">4. PO Picture Upload</Label>
              <div className="rounded-lg border border-dashed border-border p-3">
                <label htmlFor="poPicture" className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                  <UploadCloud className="h-4 w-4" />
                  {poFileName || "Upload PO image"}
                </label>
                <Input
                  id="poPicture"
                  type="file"
                  accept="image/*"
                  className="mt-2"
                  onChange={(event) => setPoFileName(event.target.files?.[0]?.name ?? "")}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientName">4. Client Name</Label>
              <Input id="clientName" value={clientProfile.fullName} disabled />
            </div>
          </div>

          <div className="space-y-2">
            <Label>5. Payment Method</Label>
            <div className="grid grid-cols-2 gap-2 md:max-w-xs">
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
                <Label>6. Split Delivery</Label>
                <Button
                  type="button"
                  variant={splitDelivery ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setSplitDelivery((value) => {
                      const nextValue = !value;
                      if (nextValue) setBagsNow(totalBags);
                      return nextValue;
                    });
                  }}
                  className={splitDelivery ? "bg-[var(--color-industrial-yellow)] text-[var(--color-industrial-blue)] hover:bg-[var(--color-industrial-yellow)]" : ""}
                >
                  {splitDelivery ? "Enabled" : "I want to split this delivery"}
                </Button>
              </div>

              {splitDelivery && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="bagsNow">How many individual bags do you want to receive now?</Label>
                    <Input
                      id="bagsNow"
                      type="number"
                      min={1}
                      max={totalBags}
                      value={bagsNow}
                      onChange={(event) => setBagsNow(Number(event.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Remaining Balance (Saved for re-delivery)</Label>
                    <Input value={String(remainingBalance)} disabled />
                  </div>
                </div>
              )}
            </div>
          )}

          {serviceType === "pick-up" && (
            <div className="space-y-3 rounded-lg border border-border p-4">
              <Label>7. Pick-up Details</Label>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="driverName">Driver Name</Label>
                  <Input
                    id="driverName"
                    value={driverName}
                    onChange={(event) => setDriverName(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plateNumber">Plate Number</Label>
                  <Input
                    id="plateNumber"
                    value={plateNumber}
                    onChange={(event) => setPlateNumber(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pickupDate">Preferred Date of Pick-up</Label>
                  <Input
                    id="pickupDate"
                    type="date"
                    value={pickupDate}
                    onChange={(event) => setPickupDate(event.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-[var(--color-industrial-blue)]/20 bg-[var(--color-industrial-blue)]/5 p-4">
            <div className="mb-3 flex items-center gap-2 text-[var(--color-industrial-blue)]">
              <PackageCheck className="h-4 w-4" />
              <p className="text-sm font-semibold">Live Price Calculation</p>
            </div>
            <div className="grid gap-2 text-sm md:grid-cols-2">
              <p>
                Product: <span className="font-semibold">{selectedProduct?.name ?? "-"}</span>
              </p>
              <p>
                Source: <span className="font-semibold">{source}</span>
              </p>
              <p>
                Subtotal: <span className="font-semibold">{formatCurrency(subtotal)}</span>
              </p>
              {serviceType === "deliver" ? (
                <p>
                  Grand Total: <span className="font-semibold">{formatCurrency(subtotal)} + shipping fee (added by manager)</span>
                </p>
              ) : (
                <p>
                  Grand Total: <span className="font-semibold">{formatCurrency(subtotal)}</span>
                </p>
              )}
            </div>
          </div>

          {successMessage && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              {successMessage}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="bg-[var(--color-industrial-blue)] hover:bg-[var(--color-industrial-blue)]/90"
              onClick={handleSubmit}
            >
              Submit Order for Approval
            </Button>
            <Button type="button" variant="outline" onClick={handleDraft}>
              Save as Draft
            </Button>
            <Button type="button" variant="ghost" onClick={resetForm}>
              Cancel
            </Button>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            If you select Check as payment method, check details can be uploaded once the order is approved in My Orders.
          </div>
        </CardContent>
      </Card>
    </>
  );
}

export default function ClientCatalogPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Product Catalog</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse available cement products and submit a new order for approval.
        </p>
      </div>
      <Suspense fallback={<div className="flex h-32 items-center justify-center text-muted-foreground">Loading catalog...</div>}>
        <CatalogForm />
      </Suspense>
    </div>
  );
}
