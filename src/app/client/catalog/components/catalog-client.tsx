"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { submitOrder, saveOrderDraft } from "@/lib/actions/client-actions";
import { createClient } from "@/lib/supabase/client";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { PackageSearch, ShoppingCart, Building2, Anchor, Save, CheckCircle2, Split } from "lucide-react";

export default function CatalogClient({ products }: { products: any[] }) {
    const router = useRouter();
    const [isOrderOpen, setIsOrderOpen] = useState(false);
    const [clientName, setClientName] = useState<string>("");
    
    // Form state
    const [source, setSource] = useState<string>("warehouse");
    const [serviceType, setServiceType] = useState<string>("pickup");
    const [qtyJB, setQtyJB] = useState<number>(0);
    const [qtySB, setQtySB] = useState<number>(0);
    const [poNumber, setPoNumber] = useState("");
    const [poFile, setPoFile] = useState<File | null>(null);
    const [supplierName, setSupplierName] = useState("");
    const [paymentMethod, setPaymentMethod] = useState<string>("cash");
    
    // Split delivery (now available for BOTH pickup and deliver)
    const [wantsSplit, setWantsSplit] = useState(false);
    const [deliverNowQty, setDeliverNowQty] = useState<number>(0);
    
    // Driver (if pickup)
    const [driverName, setDriverName] = useState("");
    const [plateNumber, setPlateNumber] = useState("");
    const [pickupDate, setPickupDate] = useState("");
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSavingDraft, setIsSavingDraft] = useState(false);

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

    // Identify JB and SB products
    const jbProduct = products.find(p => p.bag_type === "JB");
    const sbProduct = products.find(p => p.bag_type === "SB");

    const jbPrice = source === "port" ? (jbProduct?.price_port || 0) : (jbProduct?.price_warehouse || 0);
    const sbPrice = source === "port" ? (sbProduct?.price_port || 0) : (sbProduct?.price_warehouse || 0);

    const totalIndividualBags = (qtyJB * 25) + (qtySB * 50);
    const subtotal = (qtyJB * 25 * jbPrice) + (qtySB * 50 * sbPrice);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setPoFile(e.target.files[0]);
        }
    };

    const resetForm = () => {
        setQtyJB(0);
        setQtySB(0);
        setPoNumber("");
        setPoFile(null);
        setSupplierName("");
        setWantsSplit(false);
        setDeliverNowQty(0);
        setDriverName("");
        setPlateNumber("");
        setPickupDate("");
        setPaymentMethod("cash");
        setSource("warehouse");
        setServiceType("pickup");
    };

    const buildOrderData = async (poImageUrl: string) => {
        const items = [];
        if (qtyJB > 0 && jbProduct) {
            items.push({ product_id: jbProduct.id, bag_type: "JB", requested_qty: qtyJB * 25 });
        }
        if (qtySB > 0 && sbProduct) {
            items.push({ product_id: sbProduct.id, bag_type: "SB", requested_qty: qtySB * 50 });
        }

        return {
            source,
            service_type: serviceType,
            payment_method: paymentMethod,
            po_number: poNumber,
            po_image_url: poImageUrl,
            supplier_name: supplierName,
            driver_name: serviceType === "pickup" ? driverName : null,
            plate_number: serviceType === "pickup" ? plateNumber : null,
            total_amount: subtotal,
            items,
            notes: serviceType === "pickup" && pickupDate ? `Preferred Pick-up Date: ${pickupDate}` : "",
            preferred_pickup_date: serviceType === "pickup" ? pickupDate : undefined,
        };
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (qtyJB === 0 && qtySB === 0) {
            toast.error("Please specify at least one quantity (JB or SB).");
            return;
        }

        if (wantsSplit) {
            if (deliverNowQty <= 0 || deliverNowQty > totalIndividualBags) {
                toast.error("Invalid split delivery quantity. Must be between 1 and Total Individual Bags.");
                return;
            }
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
            const fileExt = poFile.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const { error: uploadError } = await supabase.storage
                .from('order-attachments')
                .upload(fileName, poFile);

            if (uploadError) throw new Error("Failed to upload PO image.");
            
            const { data: { publicUrl } } = supabase.storage.from('order-attachments').getPublicUrl(fileName);

            const orderData = await buildOrderData(publicUrl);

            const splitDetails = wantsSplit ? {
                wantsSplit: true,
                deliverNowQty,
                splitNote: `Client split: ${deliverNowQty} indiv bags now out of ${totalIndividualBags} total. Service: ${serviceType}.`
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
        if (qtyJB === 0 && qtySB === 0) {
            toast.error("Please specify at least one quantity to save a draft.");
            return;
        }

        setIsSavingDraft(true);
        try {
            let poImageUrl = "";
            if (poFile) {
                const supabase = createClient();
                const fileExt = poFile.name.split('.').pop();
                const fileName = `draft_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
                const { error: uploadError } = await supabase.storage.from('order-attachments').upload(fileName, poFile);
                if (!uploadError) {
                    const { data: { publicUrl } } = supabase.storage.from('order-attachments').getPublicUrl(fileName);
                    poImageUrl = publicUrl;
                }
            }

            const items = [];
            if (qtyJB > 0 && jbProduct) {
                items.push({ product_id: jbProduct.id, bag_type: "JB", requested_qty: qtyJB * 25 });
            }
            if (qtySB > 0 && sbProduct) {
                items.push({ product_id: sbProduct.id, bag_type: "SB", requested_qty: qtySB * 50 });
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
            }, wantsSplit ? { wantsSplit: true, deliverNowQty } : undefined);

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
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Product Catalog</h2>
                <p className="text-sm text-gray-500">Browse our available Portland Cement configurations and place your orders.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {products.map(product => (
                    <Card key={product.id} className="overflow-hidden border-blue-100 shadow-sm flex flex-col">
                        <div className="aspect-video w-full bg-slate-100 flex items-center justify-center border-b">
                            {product.image_url ? (
                                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                                <PackageSearch className="w-16 h-16 text-slate-300" />
                            )}
                        </div>
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-lg">{product.name}</CardTitle>
                                    <CardDescription className="mt-1">{product.bag_type === "JB" ? "Jumbo Bag" : "Sling Bag"}</CardDescription>
                                </div>
                                <div className="bg-[var(--color-industrial-blue)] text-white text-xs px-2 py-1 rounded font-semibold tracking-wider">
                                    {product.bag_type}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1">
                            <p className="text-sm text-gray-600 mb-4">{product.description}</p>
                            
                            <div className="space-y-3">
                                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                        <Anchor className="w-4 h-4 text-slate-400" />
                                        PORT Price
                                    </div>
                                    <div className="font-bold text-slate-900">
                                        ₱{(product.price_port || product.price_per_bag).toLocaleString()}<span className="text-xs font-normal text-slate-500"> / indiv. bag</span>
                                    </div>
                                </div>
                                
                                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                        <Building2 className="w-4 h-4 text-slate-400" />
                                        WAREHOUSE Price
                                    </div>
                                    <div className="font-bold text-slate-900">
                                        ₱{(product.price_warehouse || product.price_per_bag).toLocaleString()}<span className="text-xs font-normal text-slate-500"> / indiv. bag</span>
                                    </div>
                                </div>
                            </div>
                            {product.bag_type === "JB" && <p className="text-xs text-center text-muted-foreground mt-3">* 1 JB contains 25 individual bags</p>}
                            {product.bag_type === "SB" && <p className="text-xs text-center text-muted-foreground mt-3">* 1 SB contains 50 individual bags</p>}
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="bg-white border p-6 rounded-xl shadow-sm text-center">
                <h3 className="text-lg font-bold mb-2">Ready to place an order?</h3>
                <p className="text-sm text-gray-500 mb-6 max-w-lg mx-auto">Select your desired quantities and source to generate your PO. You can split your delivery if you don&apos;t need the entire stock immediately.</p>
                <Dialog open={isOrderOpen} onOpenChange={setIsOrderOpen}>
                    <DialogTrigger render={<Button className="bg-[var(--color-industrial-blue)] hover:bg-[var(--color-industrial-blue)]/90" size="lg" />}>
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        Create New Order
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>New Order Placement</DialogTitle>
                            <DialogDescription>Fill out the details below to submit a new PO.</DialogDescription>
                        </DialogHeader>

                        <form onSubmit={handleSubmit} className="space-y-6 py-4">
                            {/* Source & Service */}
                            <div className="grid grid-cols-2 gap-4">
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
                            <div className="p-4 bg-slate-50 border rounded-lg space-y-4">
                                <h4 className="text-sm font-semibold text-slate-800">Quantity Selection</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Number of JB (Optional)</Label>
                                        <Input type="number" min="0" value={qtyJB} onChange={(e) => setQtyJB(parseInt(e.target.value) || 0)} />
                                        <p className="text-[10px] text-muted-foreground">= {qtyJB * 25} individual bags</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Number of SB (Optional)</Label>
                                        <Input type="number" min="0" value={qtySB} onChange={(e) => setQtySB(parseInt(e.target.value) || 0)} />
                                        <p className="text-[10px] text-muted-foreground">= {qtySB * 50} individual bags</p>
                                    </div>
                                </div>
                                <div className="pt-2 flex justify-between items-center border-t border-slate-200">
                                    <span className="text-sm font-semibold text-slate-700">Total Individual Bags:</span>
                                    <span className="text-lg font-bold text-[var(--color-industrial-blue)]">{totalIndividualBags.toLocaleString()} bags</span>
                                </div>
                            </div>

                            {/* Order Details */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>PO Number <span className="text-red-500">*</span></Label>
                                    <Input required value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="e.g. PO-2026-001" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Supplier Name (Optional)</Label>
                                    <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Enter supplier name" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Client Name</Label>
                                    <Input value={clientName} readOnly className="bg-slate-50 cursor-not-allowed" />
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
                                <div className="space-y-2 col-span-2">
                                    <Label>PO Picture Upload <span className="text-red-500">*</span></Label>
                                    <Input type="file" accept="image/*,.pdf" onChange={handleFileChange} required className="cursor-pointer" />
                                </div>
                            </div>

                            {/* Conditional Pickup fields */}
                            {serviceType === "pickup" && (
                                <div className="p-4 border border-amber-200 bg-amber-50 rounded-lg space-y-4">
                                    <h4 className="text-sm font-semibold text-amber-900">Pick-up Details</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Driver Name <span className="text-red-500">*</span></Label>
                                            <Input required value={driverName} onChange={(e) => setDriverName(e.target.value)} placeholder="Name of driver" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Plate Number <span className="text-red-500">*</span></Label>
                                            <Input required value={plateNumber} onChange={(e) => setPlateNumber(e.target.value)} placeholder="Vehicle plate" />
                                        </div>
                                        <div className="space-y-2 col-span-2">
                                            <Label>Preferred Date of Pick-up</Label>
                                            <Input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Split Delivery — available for BOTH pickup and deliver */}
                            <div className="p-4 border border-blue-200 bg-blue-50 rounded-lg space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Split className="w-4 h-4 text-blue-600" />
                                        <div>
                                            <h4 className="text-sm font-semibold text-blue-900">Split Delivery Option</h4>
                                            <p className="text-xs text-blue-700">
                                                {serviceType === "deliver"
                                                    ? "Save your remaining balance for later re-delivery."
                                                    : "Only pick up part of your order now; the rest stays at the warehouse."}
                                            </p>
                                        </div>
                                    </div>
                                    <input type="checkbox" checked={wantsSplit} onChange={e => setWantsSplit(e.target.checked)} className="w-5 h-5 text-[var(--color-industrial-blue)] rounded border-blue-300 focus:ring-[var(--color-industrial-blue)]" />
                                </div>
                                {wantsSplit && (
                                    <div className="pt-2 space-y-2 border-t border-blue-100">
                                        <Label className="text-blue-900">How many individual bags do you want to receive now?</Label>
                                        <Input 
                                            type="number" 
                                            min="1" 
                                            max={totalIndividualBags} 
                                            value={deliverNowQty} 
                                            onChange={(e) => setDeliverNowQty(parseInt(e.target.value) || 0)} 
                                        />
                                        <p className="text-[10px] text-blue-600">
                                            {totalIndividualBags - deliverNowQty} bags will be saved to your balance for later.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Live Price Calculation */}
                            <div className="p-4 bg-[var(--color-industrial-blue)] text-white rounded-lg shadow-inner space-y-2">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <div className="text-sm text-blue-200">Subtotal</div>
                                        {serviceType === "deliver" && <div className="text-[10px] text-blue-300">+ Shipping Fee (to be added upon approval)</div>}
                                    </div>
                                    <div className="text-2xl font-bold">₱{subtotal.toLocaleString()}</div>
                                </div>
                                {qtyJB > 0 && (
                                    <div className="flex justify-between text-xs text-blue-200">
                                        <span>{qtyJB} JB × 25 bags × ₱{jbPrice.toLocaleString()}</span>
                                        <span>₱{(qtyJB * 25 * jbPrice).toLocaleString()}</span>
                                    </div>
                                )}
                                {qtySB > 0 && (
                                    <div className="flex justify-between text-xs text-blue-200">
                                        <span>{qtySB} SB × 50 bags × ₱{sbPrice.toLocaleString()}</span>
                                        <span>₱{(qtySB * 50 * sbPrice).toLocaleString()}</span>
                                    </div>
                                )}
                            </div>

                            <DialogFooter className="gap-2 sm:gap-0">
                                <Button type="button" variant="outline" onClick={() => { setIsOrderOpen(false); resetForm(); }} disabled={isSubmitting || isSavingDraft}>Cancel</Button>
                                <Button type="button" variant="secondary" onClick={handleSaveDraft} disabled={isSubmitting || isSavingDraft || totalIndividualBags === 0}>
                                    <Save className="w-4 h-4 mr-2" />
                                    {isSavingDraft ? "Saving..." : "Save as Draft"}
                                </Button>
                                <Button type="submit" className="bg-[var(--color-industrial-yellow)] text-[var(--color-industrial-blue)] hover:bg-amber-400" disabled={isSubmitting || isSavingDraft || totalIndividualBags === 0}>
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    {isSubmitting ? "Submitting..." : "Submit Order for Approval"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
