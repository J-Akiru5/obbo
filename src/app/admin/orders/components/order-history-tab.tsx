import { useState } from "react";
import { Order } from "@/lib/types/database";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, MapPin, Truck, CheckCircle2, XCircle } from "lucide-react";

export function OrderHistoryTab({ orders, loading }: { orders: Order[], loading: boolean }) {
    const [searchQuery, setSearchQuery] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    if (loading) return <div className="py-8 text-center text-muted-foreground animate-pulse">Loading order history...</div>;

    const filteredOrders = orders.filter(o => {
        const query = searchQuery.trim().toLowerCase();
        const matchesQuery = !query
            || o.po_number?.toLowerCase().includes(query)
            || o.dr_number?.toLowerCase().includes(query);

        const orderDate = new Date(o.updated_at);
        const fromDate = dateFrom ? new Date(dateFrom) : null;
        const toDate = dateTo ? new Date(`${dateTo}T23:59:59`) : null;

        const matchesFrom = !fromDate || orderDate >= fromDate;
        const matchesTo = !toDate || orderDate <= toDate;

        return matchesQuery && matchesFrom && matchesTo;
    });

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative w-full sm:max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search by DR # or PO #..."
                        className="pl-8"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="w-full sm:w-auto"
                    />
                    <span className="text-xs text-muted-foreground">to</span>
                    <Input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="w-full sm:w-auto"
                    />
                </div>
            </div>

            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
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
                                        <p className="font-semibold text-sm">{order.client?.company_name || order.client?.full_name}</p>
                                        <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground uppercase font-bold">
                                            {order.service_type === 'deliver' ? <Truck className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
                                            {order.service_type}
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
                                        ) : (
                                            <div className="flex items-center justify-end gap-1.5 text-red-600 font-medium text-sm">
                                                <XCircle className="w-4 h-4" /> Rejected
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
