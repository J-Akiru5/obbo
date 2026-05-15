"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { submitOrder, saveOrderDraft, generateNextPoNumber } from "@/lib/actions/client-actions";
import { createClient } from "@/lib/supabase/client";
import { useClientKyc } from "@/lib/context/client-kyc-context";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { PackageSearch, ShoppingCart, Building2, Anchor, Save, CheckCircle2, Split, ShieldAlert, Car } from "lucide-react";
import type { Product } from "@/lib/types/database";
import { OptimizedImage } from "@/components/ui/optimized-image";

const generateFileName = (userId: string, prefix: string, fileExt: string) => {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    return `${userId}/${prefix}_${timestamp}_${randomId}.${fileExt}`;
};

export default function CatalogClient({ products }: { products: Product[] }) {
    const router = useRouter();
    const { kycStatus } = useClientKyc();
    const isVerified = kycStatus === "verified";
    const [isOrderOpen, setIsOrderOpen] = useState(false);
    const [clientName, setClientName] = useState<string>("");
    
    // Form state
    const [source, setSource] = useState<string>("warehouse");
    const [serviceType, setServiceType] = useState<string>("pickup");
    
    // Split quantities
    const [jbQty, setJbQty] = useState<number>(0);
    const [sbQty, setSbQty] = useState<number>(0);
    
    const [poNumber, setPoNumber] = useState("");
    const [poFile, setPoFile] = useState<File | null>(null);
    const [supplierName, setSupplierName] = useState("");
    const [paymentMethod, setPaymentMethod] = useState<string>("cash");
    
    // Split delivery (now available for BOTH pickup and deliver)
    const [wantsSplit, setWantsSplit] = useState(false);
    const [deliverNowJB, setDeliverNowJB] = useState<number>(0);
    const [deliverNowSB, setDeliverNowSB] = useState<number>(0);
    
    // Driver (if pickup)
    const [driverName, setDriverName] = useState("");
    const [plateNumber, setPlateNumber] = useState("");
    const [pickupDate, setPickupDate] = useState("");
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSavingDraft, setIsSavingDraft] = useState(false);

    // Identify products
    const jbProduct = products.find(p => p.bag_type === "JB");
    const sbProduct = products.find(p => p.bag_type === "SB");

    // Fetch client name on mount
    useEffect(() => {
        const fetchProfile = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase.from("profiles").select("full_name, company_name").eq("id", user.id).single();
                setClientName(data?.company_name || data?.full_name || "");
            }
        };
        fetchProfile();
    }, []);

    // Price logic based on source
    const getPrice = (product: Product | undefined) => {
        if (!product) return 0;
        return source === "port" ? (product.price_port || 0) : (product.price_warehouse || 0);
    };

    const jbPrice = getPrice(jbProduct);
    const sbPrice = getPrice(sbProduct);

    const totalIndividualBags = jbQty + sbQty;
    const subtotal = (jbQty * jbPrice) + (sbQty * sbPrice);
    const totalDeliverNow = deliverNowJB + deliverNowSB;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setPoFile(e.target.files[0]);
        }
    };

    const resetForm = () => {
        setJbQty(0);
        setSbQty(0);
        setPoNumber("");
        setPoFile(null);
        setSupplierName("");
        setWantsSplit(false);
        setDeliverNowJB(0);
        setDeliverNowSB(0);
        setDriverName("");
        setPlateNumber("");
        setPickupDate("");
        setPaymentMethod("cash");
        setSource("warehouse");
        setServiceType("pickup");
    };

    const buildOrderData = async (poImageUrl: string) => {
        const items = [];
        if (jbQty > 0 && jbProduct) {
            items.push({ 
                product_id: jbProduct.id, 
                bag_type: "JB", 
                requested_qty: jbQty 
            });
        }
        if (sbQty > 0 && sbProduct) {
            items.push({ 
                product_id: sbProduct.id, 
                bag_type: "SB", 
                requested_qty: sbQty 
            });
        }

        return {
            source,
            service_type: serviceType,
            payment_method: paymentMethod,
            po_number: poNumber.trim(),
            po_image_url: poImageUrl,
            supplier_name: supplierName,
            driver_name: serviceType === "pickup" ? driverName.trim() : null,
            plate_number: serviceType === "pickup" ? plateNumber.trim() : null,
            total_amount: subtotal,
            items,
            notes: serviceType === "pickup" && pickupDate ? `Preferred Pick-up Date: ${pickupDate}` : "",
            preferred_pickup_date: serviceType === "pickup" ? pickupDate : undefined,
        };
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (totalIndividualBags <= 0) {
            toast.error("Please specify at least one valid quantity.");
            return;
        }

        if (wantsSplit) {
            if (totalDeliverNow <= 0) {
                toast.error("Please specify a quantity to deliver now.");
                return;
            }
            if (deliverNowJB > jbQty || deliverNowSB > sbQty) {
                toast.error("Deliver now quantity cannot exceed total ordered quantity for each bag type.");
                return;
            }
        }

        if (!poNumber.trim()) {
            toast.error("PO Number is required.");
            return;
        }

        if (!poFile) {
            toast.error("Please upload a PO picture.");
            return;
        }

        if (serviceType === "pickup") {
            if (!driverName.trim()) {
                toast.error("Driver Name is required for Pick-up orders.");
                return;
            }
            if (!plateNumber.trim()) {
                toast.error("Plate Number is required for Pick-up orders.");
                return;
            }
        }

        setIsSubmitting(true);
        try {
            // 1. Upload PO image
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            const fileExt = poFile.name.split('.').pop() || "jpg";
            const fileName = generateFileName(user.id, "po", fileExt);
            const { error: uploadError } = await supabase.storage
                .from('order-attachments')
                .upload(fileName, poFile, { upsert: true, contentType: poFile.type });

            if (uploadError) throw new Error(`Failed to upload PO image: ${uploadError.message}`);
            
            const { data: { publicUrl } } = supabase.storage.from('order-attachments').getPublicUrl(fileName);

            const orderData = await buildOrderData(publicUrl);

            const splitDetails = wantsSplit ? {
                wantsSplit: true,
                deliverNowQty: totalDeliverNow,
                deliverNowJB,
                deliverNowSB,
                splitNote: `Client requested ${totalDeliverNow} total bags now (${deliverNowJB} JB, ${deliverNowSB} SB). Service: ${serviceType}.`
            } : undefined;

            await submitOrder(orderData, splitDetails);
            
            toast.success("Your order has been submitted successfully and is now pending admin approval. If you selected Check as payment method, you will be able to upload your check details once the order is approved.");
            
            setIsOrderOpen(false);
            resetForm();
            router.push("/client/orders");
            
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : "An error occurred while submitting.";
            toast.error(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSaveDraft = async () => {
        if (totalIndividualBags <= 0) {
            toast.error("Please specify a quantity to save a draft.");
            return;
        }

        setIsSavingDraft(true);
        try {
            let poImageUrl = "";
            if (poFile) {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error("Not authenticated");
                const fileExt = poFile.name.split('.').pop() || "jpg";
                const fileName = generateFileName(user.id, "draft", fileExt);
                const { error: uploadError } = await supabase.storage.from('order-attachments').upload(fileName, poFile, { upsert: true, contentType: poFile.type });
                if (!uploadError) {
                    const { data: { publicUrl } } = supabase.storage.from('order-attachments').getPublicUrl(fileName);
                    poImageUrl = publicUrl;
                }
            }

            const items = [];
            if (jbQty > 0 && jbProduct) {
                items.push({ 
                    product_id: jbProduct.id, 
                    bag_type: "JB", 
                    requested_qty: jbQty 
                });
            }
            if (sbQty > 0 && sbProduct) {
                items.push({ 
                    product_id: sbProduct.id, 
                    bag_type: "SB", 
                    requested_qty: sbQty 
                });
            }

            await saveOrderDraft({
                source,
                service_type: serviceType,
                payment_method: paymentMethod,
                po_number: poNumber || "DRAFT",
                po_image_url: poImageUrl || undefined,
                supplier_name: supplierName,
                driver_name: serviceType === "pickup" ? driverName : null,
                plate_number: serviceType === "pickup" ? plateNumber : null,
                total_amount: subtotal,
                items,
                notes: serviceType === "pickup" && pickupDate ? `Preferred Pick-up Date: ${pickupDate}` : "",
                preferred_pickup_date: serviceType === "pickup" ? pickupDate : undefined,
            }, wantsSplit ? { 
                wantsSplit: true, 
                deliverNowQty: totalDeliverNow,
                deliverNowJB,
                deliverNowSB
            } : undefined);

            toast.success("Order saved as draft. You can find it in the catalog later.");
            setIsOrderOpen(false);
            resetForm();
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : "Failed to save draft.";
            toast.error(msg);
        } finally {
            setIsSavingDraft(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-foreground tracking-tight">Product Catalog</h2>
                <p className="text-sm text-muted-foreground">Browse our available Portland Cement configurations and place your orders.</p>
            </div>

            <div className="bg-card border-border border p-4 sm:p-6 rounded-xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-left">
                    <h3 className="text-lg font-bold text-foreground">Ready to place an order?</h3>
                    <p className="text-sm text-muted-foreground">Select your desired quantities and source to generate your PO.</p>
                </div>

                {!isVerified ? (
                    <div className="flex items-center gap-2 rounded-lg border border-status-pending-border bg-status-pending-bg px-4 py-2.5 text-sm text-status-pending-text">
                        <ShieldAlert className="w-4 h-4 text-status-pending-text shrink-0" />
                        <span className="hidden sm:inline">KYC verification required.</span>
                        <Link href="/client/pending-kyc" className="font-semibold underline underline-offset-2 hover:brightness-75">Learn more</Link>
                    </div>
                ) : (
                    <Button 
                        onClick={async () => { 
                            const nextPo = await generateNextPoNumber();
                            setPoNumber(nextPo);
                            setIsOrderOpen(true); 
                        }} 
                        className="bg-primary hover:bg-primary/90" 
                        size="lg"
                    >
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        Create New Order
                    </Button>
                )}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {products.map(product => (
                    <Card key={product.id} className="overflow-hidden shadow-sm flex flex-col bg-card border-border">
                        <div className="h-48 sm:h-64 w-full bg-muted flex shrink-0 items-center justify-center border-b overflow-hidden relative">
                            {product.image_url ? (
                                <OptimizedImage 
                                    src={product.image_url} 
                                    alt={product.name} 
                                    fill
                                    className="object-cover" 
                                    containerClassName="h-full w-full"
                                />
                            ) : (
                                <PackageSearch className="w-16 h-16 text-muted-foreground/50 z-10" />
                            )}
                        </div>
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-lg">{product.name}</CardTitle>
                                    <CardDescription className="mt-1">{product.bag_type === "JB" ? "Jumbo Bag" : "Sling Bag"}</CardDescription>
                                </div>
                                <div className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded font-semibold tracking-wider">
                                    {product.bag_type}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1">
                            <p className="text-sm text-muted-foreground mb-4">{product.description}</p>
                            
                            <div className="space-y-3">
                                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border">
                                    <div className="flex items-center gap-2 text-sm font-medium text-foreground/80">
                                        <Anchor className="w-4 h-4 text-muted-foreground" />
                                        PORT Price
                                    </div>
                                    <div className="font-bold text-foreground">
                                        ₱{(product.price_port || product.price_per_bag).toLocaleString()}<span className="text-xs font-normal text-muted-foreground"> / indiv. bag</span>
                                    </div>
                                </div>
                                
                                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border">
                                    <div className="flex items-center gap-2 text-sm font-medium text-foreground/80">
                                        <Building2 className="w-4 h-4 text-muted-foreground" />
                                        WAREHOUSE Price
                                    </div>
                                    <div className="font-bold text-foreground">
                                        ₱{(product.price_warehouse || product.price_per_bag).toLocaleString()}<span className="text-xs font-normal text-muted-foreground"> / indiv. bag</span>
                                    </div>
                                </div>
                            </div>
                            {product.bag_type === "JB" && <p className="text-xs text-center text-muted-foreground mt-3">* 1 JB contains 25 individual bags</p>}
                            {product.bag_type === "SB" && <p className="text-xs text-center text-muted-foreground mt-3">* 1 SB contains 50 individual bags</p>}
                        </CardContent>
                        <div className="p-6 pt-0 mt-auto">
                            <Button 
                                className="w-full bg-primary hover:bg-primary/90" 
                                disabled={!isVerified}
                                onClick={async () => {
                                    const nextPo = await generateNextPoNumber();
                                    setPoNumber(nextPo);
                                    if (product.bag_type === "JB") {
                                        setJbQty(25); // Default to 1 JB
                                        setSbQty(0);
                                    } else {
                                        setSbQty(50); // Default to 1 SB
                                        setJbQty(0);
                                    }
                                    setIsOrderOpen(true);
                                }}
                            >
                                <ShoppingCart className="w-4 h-4 mr-2" />
                                {isVerified ? "Place Order" : "Verification Required"}
                            </Button>
                        </div>
                    </Card>
                ))}
            </div>

            {isVerified && (
                <Dialog open={isOrderOpen} onOpenChange={setIsOrderOpen}>
                    <DialogContent className="max-w-[100vw] w-[100vw] h-[100dvh] !rounded-none border-0 p-4 sm:p-6 sm:max-w-4xl sm:w-full sm:h-auto sm:max-h-[90vh] sm:!rounded-xl overflow-y-auto sm:border">
                        <DialogHeader>
                            <DialogTitle>New Order Placement</DialogTitle>
                            <DialogDescription>
                                Specify the quantities for Jumbo Bags (JB) and Sling Bags (SB).
                            </DialogDescription>
                        </DialogHeader>

                        <form onSubmit={handleSubmit} className="space-y-6 py-4">
                            {/* Source & Service */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Source <span className="text-red-500">*</span></Label>
                                    <Select value={source} onValueChange={(v) => setSource(v || "warehouse")}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="warehouse">Warehouse</SelectItem>
                                            <SelectItem value="port">Port</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Service Type <span className="text-red-500">*</span></Label>
                                    <Select value={serviceType} onValueChange={(v) => { setServiceType(v || "pickup"); }}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="pickup">Pick-up</SelectItem>
                                            <SelectItem value="deliver">Deliver</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Quantities */}
                            <div className="p-4 bg-muted/30 border border-border rounded-lg space-y-4">
                                <h4 className="text-sm font-bold text-foreground uppercase tracking-tight">Quantity Selection</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    {/* JB Quantity */}
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold uppercase text-muted-foreground flex justify-between">
                                            <span>Jumbo Bag (JB)</span>
                                            <span className="text-primary">₱{jbPrice.toLocaleString()}/indiv. bag</span>
                                        </Label>
                                        <div className="flex gap-2">
                                            <Input 
                                                type="number" 
                                                min="0" 
                                                step="25"
                                                value={jbQty || ""} 
                                                placeholder="0" 
                                                onFocus={(e) => e.target.select()} 
                                                onChange={(e) => setJbQty(parseInt(e.target.value) || 0)} 
                                                className="bg-background text-lg font-bold h-12" 
                                            />
                                            <div className="flex flex-col justify-center text-[10px] text-muted-foreground font-medium min-w-[60px]">
                                                <span>{(jbQty / 25).toFixed(1)} JB</span>
                                                <span>indiv. bags</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* SB Quantity */}
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold uppercase text-muted-foreground flex justify-between">
                                            <span>Sling Bag (SB)</span>
                                            <span className="text-primary">₱{sbPrice.toLocaleString()}/indiv. bag</span>
                                        </Label>
                                        <div className="flex gap-2">
                                            <Input 
                                                type="number" 
                                                min="0" 
                                                step="50"
                                                value={sbQty || ""} 
                                                placeholder="0" 
                                                onFocus={(e) => e.target.select()} 
                                                onChange={(e) => setSbQty(parseInt(e.target.value) || 0)} 
                                                className="bg-background text-lg font-bold h-12" 
                                            />
                                            <div className="flex flex-col justify-center text-[10px] text-muted-foreground font-medium min-w-[60px]">
                                                <span>{(sbQty / 50).toFixed(1)} SB</span>
                                                <span>indiv. bags</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-[10px] text-muted-foreground text-center italic">
                                    * JB contains 25 bags, SB contains 50 bags. Please input multiples for full bags.
                                </p>
                            </div>

                            {/* Order Details */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>PO Number <span className="text-muted-foreground text-xs">(Optional)</span></Label>
                                    <Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="e.g. PO-2026-001" />
                                    <p className="text-[10px] text-muted-foreground">System will auto-generate if left blank.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label>Supplier Name (Optional)</Label>
                                    <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Enter supplier name" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Client Name</Label>
                                    <Input value={clientName} readOnly className="bg-muted/50 cursor-not-allowed border-dashed" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Payment Method <span className="text-red-500">*</span></Label>
                                    <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v || "cash")}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="cash">Cash</SelectItem>
                                            <SelectItem value="check">Check</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2 sm:col-span-2">
                                    <Label>PO Picture Upload <span className="text-red-500">*</span></Label>
                                    <Input type="file" accept="image/*,.pdf" onChange={handleFileChange} required className="cursor-pointer" />
                                </div>
                            </div>

                            {/* Conditional Pickup fields */}
                            {serviceType === "pickup" && (
                                <div className="p-4 border border-amber-500/20 bg-amber-500/5 rounded-lg space-y-4">
                                    <h4 className="text-sm font-bold text-amber-600 dark:text-amber-400 uppercase tracking-tight flex items-center gap-2">
                                        <Car className="w-4 h-4" />
                                        Pick-up Details
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-amber-700 dark:text-amber-300/80">Driver Name <span className="text-red-500">*</span></Label>
                                            <Input required value={driverName} onChange={(e) => setDriverName(e.target.value)} placeholder="Name of driver" className="bg-background border-amber-500/20 focus-visible:ring-amber-500" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-amber-700 dark:text-amber-300/80">Plate Number <span className="text-red-500">*</span></Label>
                                            <Input required value={plateNumber} onChange={(e) => setPlateNumber(e.target.value)} placeholder="Vehicle plate" className="bg-background border-amber-500/20 focus-visible:ring-amber-500" />
                                        </div>
                                        <div className="space-y-2 sm:col-span-2">
                                            <Label className="text-amber-700 dark:text-amber-300/80">Preferred Date of Pick-up</Label>
                                            <Input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} className="bg-background border-amber-500/20 focus-visible:ring-amber-500" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Split Delivery — available for BOTH pickup and deliver */}
                            <div className="p-4 border border-blue-500/20 bg-blue-500/5 rounded-lg space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Split className="w-4 h-4 text-blue-500" />
                                        <div>
                                            <h4 className="text-sm font-bold text-blue-600 dark:text-blue-400 uppercase tracking-tight">Split Delivery Option</h4>
                                            <p className="text-[10px] text-blue-500/80 font-medium">
                                                {serviceType === "deliver"
                                                    ? "Save your remaining balance for later re-delivery."
                                                    : "Only pick up part of your order now; the rest stays at the warehouse."}
                                            </p>
                                        </div>
                                    </div>
                                    <input type="checkbox" checked={wantsSplit} onChange={e => setWantsSplit(e.target.checked)} className="w-5 h-5 text-blue-600 rounded border-blue-500/30 focus:ring-blue-500 bg-background" />
                                </div>
                                {wantsSplit && (
                                    <div className="pt-3 space-y-4 border-t border-blue-500/20">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs text-blue-600 font-bold uppercase">JB to Deliver Now</Label>
                                                <Input 
                                                    type="number" 
                                                    min="0" 
                                                    max={jbQty} 
                                                    value={deliverNowJB || ""} 
                                                    placeholder="0"
                                                    onChange={(e) => setDeliverNowJB(parseInt(e.target.value) || 0)} 
                                                    className="bg-background border-blue-500/20 focus-visible:ring-blue-500 h-10 font-semibold"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs text-blue-600 font-bold uppercase">SB to Deliver Now</Label>
                                                <Input 
                                                    type="number" 
                                                    min="0" 
                                                    max={sbQty} 
                                                    value={deliverNowSB || ""} 
                                                    placeholder="0"
                                                    onChange={(e) => setDeliverNowSB(parseInt(e.target.value) || 0)} 
                                                    className="bg-background border-blue-500/20 focus-visible:ring-blue-500 h-10 font-semibold"
                                                />
                                            </div>
                                        </div>

                                        <div className="p-2 bg-blue-500/10 rounded border border-blue-500/20">
                                            <p className="text-[11px] text-blue-600 font-bold flex justify-between">
                                                <span>Delivering Now:</span>
                                                <span>{totalDeliverNow.toLocaleString()} total bags</span>
                                            </p>
                                            <p className="text-[11px] text-blue-400 font-medium flex justify-between mt-0.5">
                                                <span>Remaining Balance:</span>
                                                <span>{(totalIndividualBags - totalDeliverNow).toLocaleString()} bags</span>
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Live Price Calculation */}
                            <div className="p-4 bg-primary text-primary-foreground rounded-lg shadow-inner space-y-2">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <div className="text-sm text-blue-200">Subtotal</div>
                                        {serviceType === "deliver" && <div className="text-[10px] text-blue-300">+ Shipping Fee (to be added upon approval)</div>}
                                    </div>
                                    <div className="text-2xl font-bold">₱{subtotal.toLocaleString()}</div>
                                </div>
                                <div className="space-y-1">
                                    {jbQty > 0 && (
                                        <div className="flex justify-between items-center text-[10px] text-blue-200">
                                            <span>JB: {jbQty.toLocaleString()} bags × ₱{jbPrice.toLocaleString()} per bag</span>
                                            <span>₱{(jbQty * jbPrice).toLocaleString()}</span>
                                        </div>
                                    )}
                                    {sbQty > 0 && (
                                        <div className="flex justify-between items-center text-[10px] text-blue-200">
                                            <span>SB: {sbQty.toLocaleString()} bags × ₱{sbPrice.toLocaleString()} per bag</span>
                                            <span>₱{(sbQty * sbPrice).toLocaleString()}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <DialogFooter className="gap-3 sm:gap-2 flex-col sm:flex-row mt-6 pb-6 sm:pb-0">
                                <Button type="button" variant="outline" onClick={() => { setIsOrderOpen(false); resetForm(); }} disabled={isSubmitting || isSavingDraft}>Cancel</Button>
                                <Button type="button" variant="secondary" onClick={handleSaveDraft} disabled={isSubmitting || isSavingDraft || totalIndividualBags === 0}>
                                    <Save className="w-4 h-4 mr-2" />
                                    {isSavingDraft ? "Saving..." : "Save as Draft"}
                                </Button>
                                <Button type="submit" className="bg-accent text-accent-foreground hover:bg-accent/90" disabled={isSubmitting || isSavingDraft || totalIndividualBags === 0}>
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    {isSubmitting ? "Submitting..." : "Submit Order for Approval"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
