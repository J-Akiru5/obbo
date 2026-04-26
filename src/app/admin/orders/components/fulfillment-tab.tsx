import { useState } from "react";
import { Order, Shipment } from "@/lib/types/database";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, CheckCircle2, Truck, UploadCloud, User } from "lucide-react";

export function FulfillmentTab({ orders, shipments, onDispatch, onConfirmCheck, loading }: { 
    orders: Order[]; 
    shipments: Shipment[];
    onDispatch: (id: string, shipmentId: string, drNumber: string, drImageUrl: string | null, driverName: string | null, plateNumber: string | null) => Promise<void>; 
    onConfirmCheck: (id: string) => Promise<void>;
    loading: boolean;
}) {
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [actionType, setActionType] = useState<"dispatch" | "check" | null>(null);
    
    // Dispatch form state
    const [shipmentId, setShipmentId] = useState("");
    const [drNumber, setDrNumber] = useState("");
    const [driverName, setDriverName] = useState("");
    const [plateNumber, setPlateNumber] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const openAction = (order: Order, type: "dispatch" | "check") => {
        setSelectedOrder(order);
        setActionType(type);
        setShipmentId("");
        setDrNumber("");
        setDriverName("");
        setPlateNumber("");
    };

    const handleSubmit = async () => {
        if (!selectedOrder || !actionType) return;
        setIsSubmitting(true);
        try {
            if (actionType === "dispatch") {
                if (!shipmentId || !drNumber) {
                    alert("Please select a shipment batch and provide a DR number.");
                    setIsSubmitting(false);
                    return;
                }
                if (selectedOrder.service_type === 'deliver' && (!driverName || !plateNumber)) {
                    alert("Please provide driver name and plate number for delivery orders.");
                    setIsSubmitting(false);
                    return;
                }
                
                // For a real app, you'd upload the DR image to Supabase Storage first here.
                // We'll pass null for the image URL for now to focus on the logic.
                await onDispatch(selectedOrder.id, shipmentId, drNumber, null, driverName, plateNumber);
            } else {
                await onConfirmCheck(selectedOrder.id);
            }
            setSelectedOrder(null);
            setActionType(null);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return <div className="py-8 text-center text-muted-foreground animate-pulse">Loading fulfillment queue...</div>;
    if (orders.length === 0) return <div className="py-12 text-center text-muted-foreground border-2 border-dashed rounded-xl">No orders ready for fulfillment.</div>;

    const awaitingChecks = orders.filter(o => o.status === "awaiting_check");
    const readyForDispatch = orders.filter(o => o.status === "approved" || o.status === "partially_approved");

    return (
        <div className="space-y-8">
            {awaitingChecks.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2 text-amber-600">
                        <AlertCircle className="w-5 h-5" /> Awaiting Check Confirmation
                    </h3>
                    {awaitingChecks.map(order => (
                        <Card key={order.id} className="border-l-4 border-l-amber-500">
                            <CardContent className="p-4 flex items-center justify-between">
                                <div>
                                    <h4 className="font-bold flex items-center gap-2">
                                        <User className="w-4 h-4 text-muted-foreground" />
                                        {order.client?.company_name || order.client?.full_name}
                                    </h4>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Check Number: <span className="font-mono font-medium text-foreground">{order.check_number || "Not uploaded yet"}</span>
                                    </p>
                                </div>
                                <div className="flex items-center gap-4">
                                    {order.check_image_url ? (
                                        <a href={order.check_image_url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                                            View Image
                                        </a>
                                    ) : (
                                        <span className="text-sm text-amber-600 italic">Waiting for client upload...</span>
                                    )}
                                    <Button 
                                        onClick={() => openAction(order, "check")} 
                                        disabled={!order.check_number}
                                        className="bg-emerald-600 hover:bg-emerald-700"
                                    >
                                        <CheckCircle2 className="w-4 h-4 mr-2" /> Confirm Payment
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2 text-[var(--color-industrial-blue)]">
                    <Truck className="w-5 h-5" /> Ready for Dispatch
                </h3>
                {readyForDispatch.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No approved orders waiting to be dispatched.</p>
                ) : (
                    readyForDispatch.map(order => {
                        const jbQty = order.items.filter(i => i.bag_type === "JB").reduce((s, i) => s + i.approved_qty, 0);
                        const sbQty = order.items.filter(i => i.bag_type === "SB").reduce((s, i) => s + i.approved_qty, 0);

                        return (
                            <Card key={order.id} className="border-l-4 border-l-[var(--color-industrial-blue)]">
                                <CardContent className="p-5 flex flex-col md:flex-row gap-6">
                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Badge variant={order.status === "partially_approved" ? "secondary" : "default"} className={order.status === "approved" ? "bg-[var(--color-industrial-blue)]" : ""}>
                                                {order.status === "partially_approved" ? "Partial Approval" : "Approved"}
                                            </Badge>
                                            <span className="text-xs text-muted-foreground">ID: {order.id.slice(0,8)}</span>
                                        </div>
                                        <h4 className="text-lg font-bold flex items-center gap-2">
                                            <User className="w-4 h-4 text-muted-foreground" />
                                            {order.client?.company_name || order.client?.full_name}
                                        </h4>
                                        <div className="flex gap-4 text-sm mt-2">
                                            <div className="bg-muted px-3 py-1.5 rounded-md">
                                                <span className="text-muted-foreground text-xs uppercase tracking-wider block mb-0.5">Approved JB</span>
                                                <span className="font-bold">{jbQty}</span>
                                            </div>
                                            <div className="bg-muted px-3 py-1.5 rounded-md">
                                                <span className="text-muted-foreground text-xs uppercase tracking-wider block mb-0.5">Approved SB</span>
                                                <span className="font-bold">{sbQty}</span>
                                            </div>
                                            <div className="bg-muted px-3 py-1.5 rounded-md">
                                                <span className="text-muted-foreground text-xs uppercase tracking-wider block mb-0.5">Service</span>
                                                <span className="font-bold uppercase text-[var(--color-industrial-slate)]">{order.service_type}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center">
                                        <Button onClick={() => openAction(order, "dispatch")} className="bg-[var(--color-industrial-blue)] hover:bg-[var(--color-industrial-blue-light)] w-full md:w-auto h-12 px-8">
                                            <Truck className="w-4 h-4 mr-2" /> Dispatch Now
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
                        <DialogTitle>{actionType === "check" ? "Confirm Check Payment" : "Dispatch Order"}</DialogTitle>
                        <DialogDescription>
                            {actionType === "check" 
                                ? "Confirm that the check has been cleared. This will move the order to Ready for Dispatch."
                                : "Fill in dispatch details and select the shipment batch to deduct stock from."}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedOrder && actionType === "dispatch" && (
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4 mb-2 p-3 bg-muted rounded-lg text-sm">
                                <div>
                                    <p className="text-muted-foreground text-xs mb-1">Items to Deduct</p>
                                    <p className="font-bold">
                                        {selectedOrder.items.find(i => i.bag_type === "JB")?.approved_qty || 0} JB
                                        {" · "}
                                        {selectedOrder.items.find(i => i.bag_type === "SB")?.approved_qty || 0} SB
                                    </p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-xs mb-1">Service Type</p>
                                    <p className="font-bold uppercase text-[var(--color-industrial-blue)]">{selectedOrder.service_type}</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Select Shipment Batch (Source of Truth) <span className="text-red-500">*</span></Label>
                                <Select value={shipmentId} onValueChange={setShipmentId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a shipment batch" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {shipments.map(s => {
                                            const jbNeed = selectedOrder.items.find(i => i.bag_type === "JB")?.approved_qty || 0;
                                            const sbNeed = selectedOrder.items.find(i => i.bag_type === "SB")?.approved_qty || 0;
                                            const hasEnough = s.remaining_jb >= jbNeed && s.remaining_sb >= sbNeed;
                                            return (
                                                <SelectItem key={s.id} value={s.id} disabled={!hasEnough}>
                                                    {s.batch_name} (Avail: {s.remaining_jb} JB, {s.remaining_sb} SB) {!hasEnough && "- Insufficient"}
                                                </SelectItem>
                                            );
                                        })}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>DR Number <span className="text-red-500">*</span></Label>
                                <Input value={drNumber} onChange={(e) => setDrNumber(e.target.value)} />
                            </div>

                            {selectedOrder.service_type === 'deliver' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Driver Name <span className="text-red-500">*</span></Label>
                                        <Input value={driverName} onChange={(e) => setDriverName(e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Plate Number <span className="text-red-500">*</span></Label>
                                        <Input value={plateNumber} onChange={(e) => setPlateNumber(e.target.value)} />
                                    </div>
                                </div>
                            )}

                            <div className="pt-2 border-t mt-4 flex items-center justify-between">
                                <span className="text-sm font-medium">Upload DR Picture</span>
                                <Button variant="outline" size="sm" type="button" onClick={() => alert("Upload logic placeholder")} className="text-xs">
                                    <UploadCloud className="w-3.5 h-3.5 mr-1.5" /> Upload File
                                </Button>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSelectedOrder(null)} disabled={isSubmitting}>Cancel</Button>
                        <Button 
                            onClick={handleSubmit} 
                            disabled={isSubmitting}
                            className="bg-[var(--color-industrial-blue)]"
                        >
                            {isSubmitting ? "Processing..." : actionType === "check" ? "Confirm Payment" : "Dispatch & Deduct Stock"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
