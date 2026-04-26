"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { submitRedeliveryRequest } from "@/lib/actions/client-actions";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { Package, Truck, Info, History } from "lucide-react";

export default function LedgerClient({ balances }: { balances: any[] }) {
    const [selectedBalance, setSelectedBalance] = useState<any | null>(null);
    const [isRedeliveryOpen, setIsRedeliveryOpen] = useState(false);
    
    // Form state
    const [source, setSource] = useState<string>("warehouse");
    const [serviceType, setServiceType] = useState<string>("deliver"); // Default to deliver
    const [poNumber, setPoNumber] = useState("");
    const [poFile, setPoFile] = useState<File | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<string>("cash");
    
    // Split delivery
    const [wantsSplit, setWantsSplit] = useState(false);
    const [deliverNowQty, setDeliverNowQty] = useState<number>(0);
    
    // Driver (if pickup)
    const [driverName, setDriverName] = useState("");
    const [plateNumber, setPlateNumber] = useState("");
    const [pickupDate, setPickupDate] = useState("");
    
    const [isSubmitting, setIsSubmitting] = useState(false);

    const pendingBalances = balances.filter(b => b.status === "pending");
    const fulfilledBalances = balances.filter(b => b.status === "fulfilled");

    const handleOpenRedelivery = (balance: any) => {
        setSelectedBalance(balance);
        setPoNumber(balance.order?.po_number || ""); // Default to old PO
        setDeliverNowQty(balance.remaining_qty);
        setWantsSplit(false);
        setIsRedeliveryOpen(true);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setPoFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!selectedBalance) return;

        if (wantsSplit && serviceType === "deliver") {
            if (deliverNowQty <= 0 || deliverNowQty > selectedBalance.remaining_qty) {
                toast.error("Invalid split delivery quantity.");
                return;
            }
        }

        if (!poFile) {
            toast.error("Please upload a PO picture (even for redelivery).");
            return;
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

            const orderData = {
                source,
                service_type: serviceType,
                payment_method: paymentMethod, // e.g. for shipping fee if requested
                po_number: poNumber,
                po_image_url: publicUrl,
                driver_name: serviceType === "pickup" ? driverName : null,
                plate_number: serviceType === "pickup" ? plateNumber : null,
                notes: serviceType === "pickup" ? `Preferred Pick-up Date: ${pickupDate}` : ""
            };

            const splitDetails = (wantsSplit && serviceType === "deliver") ? {
                wantsSplit: true,
                deliverNowQty,
                splitNote: `Redelivery split: Client requested ${deliverNowQty} bags now.`
            } : undefined;

            await submitRedeliveryRequest(selectedBalance.id, orderData, splitDetails);
            
            toast.success("Re-delivery request submitted! It is now pending admin approval.");
            
            setIsRedeliveryOpen(false);
            setPoFile(null);
            
        } catch (error: any) {
            toast.error(error.message || "An error occurred while submitting.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Balance Ledger</h2>
                <p className="text-sm text-gray-500">Monitor your remaining cement balance and request re-delivery.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Active Balances */}
                <Card className="shadow-sm border-[var(--color-industrial-blue)]/20">
                    <CardHeader className="pb-3 border-b border-gray-100 bg-blue-50/30 rounded-t-xl">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Package className="w-5 h-5 text-[var(--color-industrial-blue)]" />
                            Outstanding Balances
                        </CardTitle>
                        <CardDescription>Bags that have been paid for but not yet delivered</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        {pendingBalances.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">
                                <Info className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                <p>You have no outstanding balances.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {pendingBalances.map(b => (
                                    <div key={b.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div>
                                            <div className="font-medium text-gray-900">{b.product?.name || "Unknown Product"}</div>
                                            <div className="text-sm text-gray-500">
                                                PO: <span className="font-mono text-xs">{b.order?.po_number || 'N/A'}</span> • {b.bag_type === "JB" ? "Jumbo Bag" : "Sling Bag"}
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            <div className="text-2xl font-bold text-[var(--color-industrial-blue)]">
                                                {b.remaining_qty} <span className="text-sm font-normal text-gray-500">bags</span>
                                            </div>
                                            <Button size="sm" className="bg-[var(--color-industrial-yellow)] text-[var(--color-industrial-blue)] hover:bg-amber-400" onClick={() => handleOpenRedelivery(b)}>
                                                <Truck className="w-4 h-4 mr-2" />
                                                Request Redelivery
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Fulfilled Balances */}
                <Card className="shadow-sm">
                    <CardHeader className="pb-3 border-b border-gray-100">
                        <CardTitle className="text-base flex items-center gap-2 text-gray-600">
                            <History className="w-5 h-5" />
                            Fulfilled Balances
                        </CardTitle>
                        <CardDescription>Historically completed balance records</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        {fulfilledBalances.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">
                                <p>No completed balances yet.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {fulfilledBalances.map(b => (
                                    <div key={b.id} className="p-4 flex justify-between items-center opacity-70 grayscale">
                                        <div>
                                            <div className="font-medium text-gray-600">{b.product?.name || "Unknown Product"}</div>
                                            <div className="text-xs text-gray-400">PO: {b.order?.po_number || 'N/A'}</div>
                                        </div>
                                        <div className="text-sm font-semibold text-emerald-600">
                                            Fulfilled
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Redelivery Dialog */}
            <Dialog open={isRedeliveryOpen} onOpenChange={setIsRedeliveryOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Request Re-delivery</DialogTitle>
                        <DialogDescription>Submit details to dispatch your remaining balance.</DialogDescription>
                    </DialogHeader>

                    {selectedBalance && (
                        <form onSubmit={handleSubmit} className="space-y-6 py-4">
                            <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
                                <div className="text-sm text-blue-800">You are requesting delivery from a balance of:</div>
                                <div className="text-lg font-bold text-blue-900">{selectedBalance.remaining_qty} individual bags of {selectedBalance.product?.name}</div>
                            </div>

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
                                    <Select value={serviceType} onValueChange={(v) => { setServiceType(v || "deliver"); setWantsSplit(false); }}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="pickup">Pick-up</SelectItem>
                                            <SelectItem value="deliver">Deliver</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Order Details */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>PO Number <span className="text-red-500">*</span></Label>
                                    <Input required value={poNumber} onChange={(e) => setPoNumber(e.target.value)} />
                                    <p className="text-[10px] text-muted-foreground">You can use your original PO or enter a new one.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label>Payment Method (For Shipping Fees) <span className="text-red-500">*</span></Label>
                                    <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v || "cash")}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="cash">Cash</SelectItem>
                                            <SelectItem value="check">Check</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2 col-span-2">
                                    <Label>PO / Redelivery Form Upload <span className="text-red-500">*</span></Label>
                                    <Input type="file" accept="image/*,.pdf" onChange={handleFileChange} required className="cursor-pointer" />
                                </div>
                            </div>

                            {/* Conditional Delivery / Pickup fields */}
                            {serviceType === "pickup" && (
                                <div className="p-4 border border-amber-200 bg-amber-50 rounded-lg space-y-4">
                                    <h4 className="text-sm font-semibold text-amber-900">Pick-up Details</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Driver Name</Label>
                                            <Input value={driverName} onChange={(e) => setDriverName(e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Plate Number</Label>
                                            <Input value={plateNumber} onChange={(e) => setPlateNumber(e.target.value)} />
                                        </div>
                                        <div className="space-y-2 col-span-2">
                                            <Label>Preferred Date of Pick-up</Label>
                                            <Input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {serviceType === "deliver" && (
                                <div className="p-4 border border-blue-200 bg-blue-50 rounded-lg space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="text-sm font-semibold text-blue-900">Split Redelivery Option</h4>
                                            <p className="text-xs text-blue-700">Don't need all {selectedBalance.remaining_qty} bags right now?</p>
                                        </div>
                                        <input type="checkbox" checked={wantsSplit} onChange={e => setWantsSplit(e.target.checked)} className="w-5 h-5 text-[var(--color-industrial-blue)] rounded border-blue-300 focus:ring-[var(--color-industrial-blue)]" />
                                    </div>
                                    {wantsSplit && (
                                        <div className="pt-2 space-y-2 border-t border-blue-100">
                                            <Label className="text-blue-900">How many individual bags do you want to receive now?</Label>
                                            <Input 
                                                type="number" 
                                                min="1" 
                                                max={selectedBalance.remaining_qty} 
                                                value={deliverNowQty} 
                                                onChange={(e) => setDeliverNowQty(parseInt(e.target.value) || 0)} 
                                            />
                                            <p className="text-[10px] text-blue-600">
                                                {selectedBalance.remaining_qty - deliverNowQty} bags will remain in your balance.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            <DialogFooter className="gap-2 sm:gap-0">
                                <Button type="button" variant="outline" onClick={() => setIsRedeliveryOpen(false)} disabled={isSubmitting}>Cancel</Button>
                                <Button type="submit" className="bg-[var(--color-industrial-blue)]" disabled={isSubmitting}>
                                    {isSubmitting ? "Submitting..." : "Submit Re-delivery Request"}
                                </Button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
