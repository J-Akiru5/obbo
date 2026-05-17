import { useState } from "react";
import { Order } from "@/lib/types/database";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Truck, Check, CornerDownLeft, Edit2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function TrackingTab({ orders, onUpdateTracking, loading }: { 
    orders: Order[]; 
    onUpdateTracking: (id: string, status: string, jb?: number, sb?: number) => Promise<void>;
    loading: boolean;
}) {
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [status, setStatus] = useState<string>("");
    const [jbReturned, setJbReturned] = useState(0);
    const [sbReturned, setSbReturned] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const openUpdate = (order: Order) => {
        setSelectedOrder(order);
        setStatus(order.tracking_status || "pending_dispatch");
        setJbReturned(0);
        setSbReturned(0);
    };

    const handleSubmit = async () => {
        if (!selectedOrder) return;
        setIsSubmitting(true);
        try {
            await onUpdateTracking(
                selectedOrder.id, 
                status, 
                status === "bags_returned" ? jbReturned : undefined,
                status === "bags_returned" ? sbReturned : undefined
            );
            setSelectedOrder(null);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return <div className="py-8 text-center text-muted-foreground animate-pulse">Loading active deliveries...</div>;
    if (orders.length === 0) return <div className="py-12 text-center text-muted-foreground border-2 border-dashed rounded-xl">No active deliveries to track.</div>;

    const renderStatusBadge = (status: string) => {
        switch (status) {
            case "pending_dispatch": return <Badge className="bg-accent/10 text-accent hover:bg-accent/20 border-accent/20">Pending Dispatch</Badge>;
            case "in_transit": return <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/10">In Transit</Badge>;
            case "delivered": return <Badge className="bg-primary text-primary-foreground">Delivered</Badge>;
            case "bags_returned": return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-200">Bags Returned</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-x-auto">
            <Table>
                <TableHeader className="bg-muted/50">
                    <TableRow>
                        <TableHead>Order ID</TableHead>
                        <TableHead>Client & Service</TableHead>
                        <TableHead>DR & Driver</TableHead>
                        <TableHead>Quantities</TableHead>
                        <TableHead>Tracking Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {orders.map(order => {
                        const jbQty = order.items.filter(i => i.bag_type === "JB").reduce((s, i) => s + i.dispatched_qty, 0);
                        const sbQty = order.items.filter(i => i.bag_type === "SB").reduce((s, i) => s + i.dispatched_qty, 0);
                        const jbReq = order.items.filter(i => i.bag_type === "JB").reduce((s, i) => s + i.requested_qty, 0);
                        const sbReq = order.items.filter(i => i.bag_type === "SB").reduce((s, i) => s + i.requested_qty, 0);
                        const isSplit = order.is_split_delivery || order.items.some(i => i.dispatched_qty < i.requested_qty);

                        return (
                            <TableRow key={order.id}>
                                <TableCell className="font-mono text-xs">
                                    {order.id.slice(0, 8)}
                                    {isSplit && (
                                        <div className="mt-1">
                                            <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50 uppercase text-[9px] px-1 py-0 font-bold">SPLIT</Badge>
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <Avatar className="w-8 h-8 border border-border/50 shrink-0">
                                            {order.client?.avatar_url ? (
                                                <AvatarImage src={order.client.avatar_url} alt="Client" className="object-cover" />
                                            ) : (
                                                <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-bold">
                                                    {(order.client?.full_name || "CL").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                                                </AvatarFallback>
                                            )}
                                        </Avatar>
                                        <div>
                                            <p className="font-medium">{order.client?.company_name || order.client?.full_name}</p>
                                            <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground uppercase font-bold">
                                                {order.service_type === 'deliver' ? <Truck className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
                                                {order.service_type}
                                            </div>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {order.dr_number ? (
                                        <>
                                            <p className="text-sm font-semibold">{order.dr_number}</p>
                                            {order.service_type === 'deliver' && (
                                                <p className="text-xs text-muted-foreground mt-0.5">{order.driver_name} · {order.plate_number}</p>
                                            )}
                                        </>
                                    ) : (
                                        <span className="text-xs text-muted-foreground italic">No DR attached</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-xs font-bold">{jbQty} JB</Badge>
                                            {isSplit && jbReq > 0 && <span className="text-[10px] text-muted-foreground">/ {jbReq}</span>}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-xs font-bold">{sbQty} SB</Badge>
                                            {isSplit && sbReq > 0 && <span className="text-[10px] text-muted-foreground">/ {sbReq}</span>}
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {renderStatusBadge(order.tracking_status || 'pending_dispatch')}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="outline" size="sm" onClick={() => openUpdate(order)} className="text-xs">
                                        <Edit2 className="w-3.5 h-3.5 mr-1.5" /> Update
                                    </Button>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>

            <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Update Tracking Status</DialogTitle>
                        <DialogDescription>
                            Update the current location or status of this order. Marking it as Delivered or Returned will move it to History.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Tracking Status</Label>
                            <Select value={status} onValueChange={(v) => setStatus(v || "")}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pending_dispatch">Pending Dispatch (Loading)</SelectItem>
                                    <SelectItem value="in_transit">In Transit (On the road)</SelectItem>
                                    <SelectItem value="delivered">Delivered (No returns)</SelectItem>
                                    <SelectItem value="bags_returned">Delivered (With returned bags)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {status === "bags_returned" && (
                            <div className="bg-primary/5 p-4 rounded-lg border border-primary/10 space-y-4">
                                <p className="text-sm text-primary font-medium flex items-center gap-2">
                                    <CornerDownLeft className="w-4 h-4" /> Record Returned Bags
                                </p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>JB Returned</Label>
                                        <Input type="number" min="0" value={jbReturned || ""} placeholder="0" onChange={(e) => setJbReturned(parseInt(e.target.value) || 0)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>SB Returned</Label>
                                        <Input type="number" min="0" value={sbReturned || ""} placeholder="0" onChange={(e) => setSbReturned(parseInt(e.target.value) || 0)} />
                                    </div>
                                </div>
                                <p className="text-xs text-primary/70">Automatically creates a shipment ledger entry — bags will be added back to warehouse physical stock and reflected in reports.</p>
                            </div>
                        )}

                        {status === "delivered" && (
                            <div className="bg-primary/5 p-3 rounded-lg border border-primary/10 flex items-center gap-2 text-sm text-primary">
                                <Check className="w-4 h-4" />
                                This will mark the order as Completed.
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSelectedOrder(null)} disabled={isSubmitting}>Cancel</Button>
                        <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-primary">
                            {isSubmitting ? "Saving..." : "Save Status"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
