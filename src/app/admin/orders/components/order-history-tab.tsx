import { useState } from "react";
import { Order } from "@/lib/types/database";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, MapPin, Truck, CheckCircle2, XCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function OrderHistoryTab({ orders, loading }: { orders: Order[], loading: boolean }) {
    const [searchQuery, setSearchQuery] = useState("");
    const [dateFilter, setDateFilter] = useState("");

    if (loading) return <div className="py-8 text-center text-muted-foreground animate-pulse">Loading order history...</div>;

    const filteredOrders = orders.filter(o => {
        const matchesSearch = o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            o.client?.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            o.client?.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            o.dr_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            o.po_number?.toLowerCase().includes(searchQuery.toLowerCase());
            
        let matchesDate = true;
        if (dateFilter) {
            try {
                // Parse date regardless of time zone anomalies
                const orderDateObj = new Date(o.updated_at);
                const localDateStr = `${orderDateObj.getFullYear()}-${String(orderDateObj.getMonth() + 1).padStart(2, '0')}-${String(orderDateObj.getDate()).padStart(2, '0')}`;
                matchesDate = localDateStr === dateFilter;
            } catch (e) {
                matchesDate = true;
            }
        }

        return matchesSearch && matchesDate;
    });

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 items-center">
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search by ID, client, DR, or PO..."
                        className="pl-8"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="w-full sm:w-auto flex items-center gap-2">
                    <Input 
                        type="date" 
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="text-sm"
                    />
                    {dateFilter && (
                        <button 
                            onClick={() => setDateFilter("")}
                            className="text-xs text-muted-foreground hover:text-foreground underline whitespace-nowrap"
                        >
                            Clear Date
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-card rounded-xl border border-border shadow-sm overflow-x-auto">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead>Order Info</TableHead>
                            <TableHead>Client</TableHead>
                            <TableHead>Fulfillment</TableHead>
                            <TableHead>Financials</TableHead>
                            <TableHead className="text-right">Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredOrders.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No matching history records found.</TableCell>
                            </TableRow>
                        ) : filteredOrders.map(order => {
                            const jbQty = order.items.filter(i => i.bag_type === "JB").reduce((s, i) => s + (order.status === "rejected" ? i.requested_qty : i.dispatched_qty), 0);
                            const sbQty = order.items.filter(i => i.bag_type === "SB").reduce((s, i) => s + (order.status === "rejected" ? i.requested_qty : i.dispatched_qty), 0);

                            return (
                                <TableRow key={order.id}>
                                    <TableCell>
                                        <p className="font-mono text-xs font-medium">{order.id.slice(0, 8)}</p>
                                        <p className="text-xs text-muted-foreground mt-1">{new Date(order.updated_at).toLocaleDateString()}</p>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Avatar className="w-7 h-7 border border-border/50 shrink-0">
                                                {order.client?.avatar_url ? (
                                                    <AvatarImage src={order.client.avatar_url} alt="Client" className="object-cover" />
                                                ) : (
                                                    <AvatarFallback className="bg-muted text-muted-foreground text-[9px] font-bold">
                                                        {(order.client?.full_name || "CL").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                                                    </AvatarFallback>
                                                )}
                                            </Avatar>
                                            <div>
                                                <p className="font-semibold text-sm">{order.client?.company_name || order.client?.full_name}</p>
                                                <div className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground uppercase font-bold">
                                                    {order.service_type === 'deliver' ? <Truck className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
                                                    {order.service_type}
                                                </div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex gap-2 mb-1">
                                            <span className="text-xs font-medium">{jbQty} JB</span>
                                            <span className="text-xs font-medium text-muted-foreground">·</span>
                                            <span className="text-xs font-medium">{sbQty} SB</span>
                                        </div>
                                        {order.status === "completed" && order.dr_number && (
                                            <p className="text-xs text-muted-foreground">DR: {order.dr_number}</p>
                                        )}
                                        {order.status === "completed" && order.tracking_status === "bags_returned" && (
                                            <p className="text-xs text-purple-600 font-medium">
                                                Returned: {order.bags_returned_jb} JB, {order.bags_returned_sb} SB
                                            </p>
                                        )}
                                        {order.status === "rejected" && (
                                            <p className="text-xs text-red-600 max-w-[200px] truncate" title={order.rejection_reason || ""}>
                                                Reason: {order.rejection_reason}
                                            </p>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <p className="font-semibold text-sm">₱{order.total_amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                                        <Badge variant="outline" className="text-[10px] mt-1 uppercase">{order.payment_method}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {order.status === "completed" ? (
                                            <div className="flex items-center justify-end gap-1.5 text-emerald-600 font-medium text-sm">
                                                <CheckCircle2 className="w-4 h-4" /> Completed
                                            </div>
                                        ) : order.status === "rejected" ? (
                                            <div className="flex items-center justify-end gap-1.5 text-red-600 font-medium text-sm">
                                                <XCircle className="w-4 h-4" /> Rejected
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-end gap-1.5 text-muted-foreground font-medium text-sm">
                                                <span className="capitalize">{order.status.replace(/_/g, ' ')}</span>
                                            </div>
                                        )}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
