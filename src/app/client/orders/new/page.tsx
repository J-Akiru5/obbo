"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Package, CreditCard, CheckCircle2, ChevronRight, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Product } from "@/lib/types/database";

type CartItem = { product: Product; qty: number };
const STEPS = ["Select Products", "Payment", "Review & Confirm"];

export default function NewOrderPage() {
    const router = useRouter();
    const [step, setStep] = useState(0);
    const [products, setProducts] = useState<Product[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [paymentMethod, setPaymentMethod] = useState<"cash" | "check">("cash");
    const [checkFile, setCheckFile] = useState<File | null>(null);
    const [notes, setNotes] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [loadingProducts, setLoadingProducts] = useState(true);

    useEffect(() => {
        createClient().from("products").select("*").eq("is_active", true).order("name")
            .then(({ data }) => { setProducts(data ?? []); setLoadingProducts(false); });
    }, []);

    function setQty(product: Product, qty: number) {
        if (qty <= 0) {
            setCart((p) => p.filter((c) => c.product.id !== product.id));
        } else {
            setCart((p) => {
                const ex = p.find((c) => c.product.id === product.id);
                if (ex) return p.map((c) => c.product.id === product.id ? { ...c, qty } : c);
                return [...p, { product, qty }];
            });
        }
    }

    const getQty = (id: string) => cart.find((c) => c.product.id === id)?.qty ?? 0;
    const totalAmount = cart.reduce((s, c) => s + Number(c.product.price_per_bag) * c.qty, 0);

    async function handleSubmit() {
        if (cart.length === 0) { toast.error("Please add at least one product."); return; }
        if (paymentMethod === "check" && !checkFile) { toast.error("Please upload a check image."); return; }
        setSubmitting(true);
        try {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");
            let checkImageUrl: string | null = null;
            if (paymentMethod === "check" && checkFile) {
                const ext = checkFile.name.split(".").pop();
                const path = `${user.id}/check-${Date.now()}.${ext}`;
                const { error } = await supabase.storage.from("order-attachments").upload(path, checkFile);
                if (error) throw error;
                checkImageUrl = path;
            }
            const { data: order, error: oErr } = await supabase.from("orders")
                .insert({ client_id: user.id, status: "pending", total_amount: totalAmount, payment_method: paymentMethod, check_image_url: checkImageUrl, notes: notes || null })
                .select().single();
            if (oErr) throw oErr;
            const { error: iErr } = await supabase.from("order_items").insert(
                cart.map((c) => ({ order_id: order.id, product_id: c.product.id, bag_type: c.product.bag_type, requested_qty: c.qty, approved_qty: 0, dispatched_qty: 0 }))
            );
            if (iErr) throw iErr;
            await supabase.from("activity_log").insert({ actor_id: user.id, action: "order_placed", entity_type: "order", entity_id: order.id, metadata: { total: totalAmount } });
            toast.success("Order placed successfully!");
            router.push(`/client/orders/${order.id}`);
        } catch (err) {
            console.error(err);
            toast.error("Failed to place order. Please try again.");
        } finally { setSubmitting(false); }
    }

    return (
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
            <div>
                <h2 className="text-2xl font-bold">Place New Order</h2>
                <p className="text-muted-foreground mt-1">Complete the steps below to submit your cement order.</p>
            </div>

            {/* Step Indicator */}
            <div className="flex items-center gap-2">
                {STEPS.map((label, idx) => {
                    const done = idx < step; const active = idx === step;
                    return (
                        <div key={idx} className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${done ? "bg-emerald-500 border-emerald-500 text-white" : active ? "bg-[var(--color-industrial-blue)] border-[var(--color-industrial-blue)] text-white" : "bg-white border-border text-muted-foreground"}`}>
                                {done ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                            </div>
                            <span className={`text-sm font-medium hidden sm:block ${active ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
                            {idx < STEPS.length - 1 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                        </div>
                    );
                })}
            </div>

            {/* Step 0: Products */}
            {step === 0 && (
                <div className="space-y-4">
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Package className="w-4 h-4 text-[var(--color-industrial-blue)]" />Select Products & Quantities</CardTitle></CardHeader>
                        <CardContent className="space-y-3">
                            {loadingProducts ? <p className="text-sm text-center py-4 text-muted-foreground">Loading products...</p>
                                : products.length === 0 ? <p className="text-sm text-center py-4 text-muted-foreground">No products available.</p>
                                : products.map((p) => {
                                    const qty = getQty(p.id);
                                    return (
                                        <div key={p.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                                            <div className="w-10 h-10 rounded-lg bg-[var(--color-industrial-blue)]/10 flex items-center justify-center flex-shrink-0">
                                                <Package className="w-5 h-5 text-[var(--color-industrial-blue)]" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold">{p.name}</p>
                                                <p className="text-xs text-muted-foreground">{p.bag_type === "JB" ? "Jumbo Bag" : "Sling Bag"} · <span className="font-semibold text-[var(--color-industrial-blue)]">₱{Number(p.price_per_bag).toLocaleString()}</span>/bag</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => setQty(p, Math.max(0, qty - 1))}>−</Button>
                                                <Input type="number" min={0} value={qty || ""} placeholder="0" onChange={(e) => setQty(p, Math.max(0, parseInt(e.target.value) || 0))} className="h-8 w-20 text-center text-sm font-semibold" />
                                                <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => setQty(p, qty + 1)}>+</Button>
                                            </div>
                                            {qty > 0 && <Badge className="bg-[var(--color-industrial-blue)]/10 text-[var(--color-industrial-blue)]">₱{(Number(p.price_per_bag) * qty).toLocaleString()}</Badge>}
                                        </div>
                                    );
                                })}
                        </CardContent>
                    </Card>
                    {cart.length > 0 && (
                        <Card className="border-[var(--color-industrial-blue)]/30 bg-[var(--color-industrial-blue)]/5">
                            <CardContent className="pt-4 pb-4">
                                <p className="text-sm font-semibold text-[var(--color-industrial-blue)] mb-2">Cart Summary</p>
                                {cart.map((c) => (<div key={c.product.id} className="flex justify-between text-sm py-1"><span>{c.product.name} × {c.qty.toLocaleString()}</span><span className="font-semibold">₱{(Number(c.product.price_per_bag) * c.qty).toLocaleString()}</span></div>))}
                                <Separator className="my-2" />
                                <div className="flex justify-between font-bold"><span>Total</span><span className="text-[var(--color-industrial-blue)]">₱{totalAmount.toLocaleString()}</span></div>
                            </CardContent>
                        </Card>
                    )}
                    <div className="flex justify-end">
                        <Button className="bg-[var(--color-industrial-blue)] hover:bg-[var(--color-industrial-blue)]/90 gap-2" onClick={() => { if (!cart.length) { toast.error("Add at least one product."); return; } setStep(1); }}>
                            Continue <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Step 1: Payment */}
            {step === 1 && (
                <div className="space-y-4">
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><CreditCard className="w-4 h-4 text-[var(--color-industrial-blue)]" />Payment Method</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as "cash" | "check")} className="space-y-3">
                                {(["cash", "check"] as const).map((method) => (
                                    <div key={method} className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer ${paymentMethod === method ? "border-[var(--color-industrial-blue)] bg-[var(--color-industrial-blue)]/5" : "hover:bg-muted/30"}`} onClick={() => setPaymentMethod(method)}>
                                        <RadioGroupItem value={method} id={method} />
                                        <Label htmlFor={method} className="cursor-pointer">
                                            <p className="font-semibold capitalize">{method}</p>
                                            <p className="text-sm text-muted-foreground">{method === "cash" ? "Payment via cash upon delivery." : "Upload a photo of your check for verification."}</p>
                                        </Label>
                                    </div>
                                ))}
                            </RadioGroup>
                            {paymentMethod === "check" && (
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold">Upload Check Image <span className="text-destructive">*</span></Label>
                                    {checkFile ? (
                                        <div className="flex items-center gap-3 p-3 border border-emerald-200 bg-emerald-50 rounded-lg">
                                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                            <span className="text-sm text-emerald-800 flex-1 truncate">{checkFile.name}</span>
                                            <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setCheckFile(null)}><X className="w-4 h-4" /></Button>
                                        </div>
                                    ) : (
                                        <div className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-[var(--color-industrial-blue)]/50 hover:bg-muted/30 transition-colors" onClick={() => document.getElementById("check-upload")?.click()}>
                                            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                                            <p className="text-sm text-muted-foreground">Click to upload check image</p>
                                            <p className="text-xs text-muted-foreground/60 mt-1">JPG, PNG, PDF · max 10MB</p>
                                            <input id="check-upload" type="file" className="hidden" accept="image/*,.pdf" onChange={(e) => setCheckFile(e.target.files?.[0] || null)} />
                                        </div>
                                    )}
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold">Notes (optional)</Label>
                                <Input placeholder="Delivery instructions, preferred schedule..." value={notes} onChange={(e) => setNotes(e.target.value)} className="h-11" />
                            </div>
                        </CardContent>
                    </Card>
                    <div className="flex justify-between">
                        <Button variant="outline" onClick={() => setStep(0)}>Back</Button>
                        <Button className="bg-[var(--color-industrial-blue)] hover:bg-[var(--color-industrial-blue)]/90 gap-2" onClick={() => { if (paymentMethod === "check" && !checkFile) { toast.error("Upload a check image."); return; } setStep(2); }}>
                            Review Order <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Step 2: Review */}
            {step === 2 && (
                <div className="space-y-4">
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" />Order Summary</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                {cart.map((c) => (
                                    <div key={c.product.id} className="flex justify-between items-center p-3 border rounded-lg">
                                        <div><p className="text-sm font-semibold">{c.product.name}</p><p className="text-xs text-muted-foreground">{c.qty.toLocaleString()} bags × ₱{Number(c.product.price_per_bag).toLocaleString()}</p></div>
                                        <p className="text-sm font-bold text-[var(--color-industrial-blue)]">₱{(Number(c.product.price_per_bag) * c.qty).toLocaleString()}</p>
                                    </div>
                                ))}
                            </div>
                            <Separator />
                            <div className="flex justify-between font-bold text-lg"><span>Total</span><span className="text-[var(--color-industrial-blue)]">₱{totalAmount.toLocaleString()}</span></div>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="p-3 bg-muted/50 rounded-lg"><p className="text-xs text-muted-foreground">Payment</p><p className="font-semibold capitalize mt-0.5">{paymentMethod}</p></div>
                                {checkFile && <div className="p-3 bg-muted/50 rounded-lg"><p className="text-xs text-muted-foreground">Check File</p><p className="font-semibold mt-0.5 truncate">{checkFile.name}</p></div>}
                                {notes && <div className="p-3 bg-muted/50 rounded-lg col-span-2"><p className="text-xs text-muted-foreground">Notes</p><p className="font-semibold mt-0.5">{notes}</p></div>}
                            </div>
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                                <p className="font-semibold">What happens next?</p>
                                <p className="mt-0.5">Your order will be reviewed by our team. You&apos;ll receive a status update once approved.</p>
                            </div>
                        </CardContent>
                    </Card>
                    <div className="flex justify-between">
                        <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                        <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2 min-w-36" onClick={handleSubmit} disabled={submitting}>
                            {submitting ? <><Loader2 className="w-4 h-4 animate-spin" />Placing...</> : <><CheckCircle2 className="w-4 h-4" />Confirm Order</>}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
