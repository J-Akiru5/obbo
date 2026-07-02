import { useState } from 'react';
import { Order } from '@/lib/types/database';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, MapPin, Truck, CheckCircle2, XCircle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export function OrderHistoryTab({ orders, loading }: { orders: Order[]; loading: boolean }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  if (loading)
    return (
      <div className="text-muted-foreground animate-pulse py-8 text-center">
        Loading order history...
      </div>
    );

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
      } catch (_e) {
        matchesDate = true;
      }
    }

    return matchesSearch && matchesDate;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <div className="relative w-full max-w-sm">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
          <Input
            type="search"
            placeholder="Search by ID, client, DR, or PO..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="text-sm"
          />
          {dateFilter && (
            <button
              onClick={() => setDateFilter('')}
              className="text-muted-foreground hover:text-foreground text-xs whitespace-nowrap underline"
            >
              Clear Date
            </button>
          )}
        </div>
      </div>

      <div className="bg-card border-border overflow-x-auto rounded-xl border shadow-sm">
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
                <TableCell colSpan={5} className="text-muted-foreground py-8 text-center">
                  No matching history records found.
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((order) => {
                const jbQty = order.items
                  .filter((i) => i.bag_type === 'JB')
                  .reduce(
                    (s, i) =>
                      s + (order.status === 'rejected' ? i.requested_qty : i.dispatched_qty),
                    0,
                  );
                const sbQty = order.items
                  .filter((i) => i.bag_type === 'SB')
                  .reduce(
                    (s, i) =>
                      s + (order.status === 'rejected' ? i.requested_qty : i.dispatched_qty),
                    0,
                  );
                const jbReq = order.items
                  .filter((i) => i.bag_type === 'JB')
                  .reduce((s, i) => s + i.requested_qty, 0);
                const sbReq = order.items
                  .filter((i) => i.bag_type === 'SB')
                  .reduce((s, i) => s + i.requested_qty, 0);
                const isSplit =
                  order.is_split_delivery ||
                  (order.status !== 'rejected' &&
                    order.items.some((i) => i.dispatched_qty < i.requested_qty));

                return (
                  <TableRow key={order.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-xs font-medium">{order.id.slice(0, 8)}</p>
                        {isSplit && (
                          <Badge
                            variant="outline"
                            className="border-amber-500 bg-amber-50 px-1 py-0 text-[9px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          >
                            SPLIT
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {new Date(order.updated_at).toLocaleDateString()}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="border-border/50 h-7 w-7 shrink-0 border">
                          {order.client?.avatar_url ? (
                            <AvatarImage
                              src={order.client.avatar_url}
                              alt="Client"
                              className="object-cover"
                            />
                          ) : (
                            <AvatarFallback className="bg-muted text-muted-foreground text-[9px] font-bold">
                              {(order.client?.full_name || 'CL')
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                                .toUpperCase()
                                .slice(0, 2)}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <div>
                          <p className="text-sm font-semibold">
                            {order.client?.company_name || order.client?.full_name}
                          </p>
                          <div className="text-muted-foreground mt-0.5 flex items-center gap-1 text-[10px] font-bold uppercase">
                            {order.service_type === 'deliver' ? (
                              <Truck className="h-3 w-3" />
                            ) : (
                              <MapPin className="h-3 w-3" />
                            )}
                            {order.service_type}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="mb-1 flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold">{jbQty} JB</span>
                          {isSplit && jbReq > 0 && (
                            <span className="text-muted-foreground text-[10px] font-normal">
                              / {jbReq}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold">{sbQty} SB</span>
                          {isSplit && sbReq > 0 && (
                            <span className="text-muted-foreground text-[10px] font-normal">
                              / {sbReq}
                            </span>
                          )}
                        </div>
                      </div>
                      {order.status === 'completed' && order.dr_number && (
                        <p className="text-muted-foreground text-xs">DR: {order.dr_number}</p>
                      )}
                      {order.status === 'completed' &&
                        order.tracking_status === 'bags_returned' && (
                          <p className="text-xs font-medium text-purple-600">
                            Returned: {order.bags_returned_jb} JB, {order.bags_returned_sb} SB
                          </p>
                        )}
                      {order.status === 'rejected' && (
                        <p
                          className="max-w-[200px] truncate text-xs text-red-600"
                          title={order.rejection_reason || ''}
                        >
                          Reason: {order.rejection_reason}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-semibold">
                        ₱
                        {order.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                      <Badge variant="outline" className="mt-1 text-[10px] uppercase">
                        {order.payment_method}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {order.status === 'completed' ? (
                        <div className="flex items-center justify-end gap-1.5 text-sm font-medium text-emerald-600">
                          <CheckCircle2 className="h-4 w-4" /> Completed
                        </div>
                      ) : order.status === 'rejected' ? (
                        <div className="flex items-center justify-end gap-1.5 text-sm font-medium text-red-600">
                          <XCircle className="h-4 w-4" /> Rejected
                        </div>
                      ) : (
                        <div className="text-muted-foreground flex items-center justify-end gap-1.5 text-sm font-medium">
                          <span className="capitalize">{order.status.replace(/_/g, ' ')}</span>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
