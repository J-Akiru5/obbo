'use client';

import { useState } from 'react';
import { OrderReturn } from '@/lib/types/database';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { CornerDownLeft, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { approveOrderReturn, rejectOrderReturn } from '@/lib/actions/admin-actions';
import { toast } from 'sonner';

const APPROVE_REASON_OPTIONS = [
  { value: 'return', label: 'Return — Restock (recovers cost)' },
  { value: 'waste', label: 'Waste (write-off, no cost recovery)' },
  { value: 'damage', label: 'Damage (write-off, no cost recovery)' },
];

export function ReturnsTab({
  returns,
  loading,
  onReload,
}: {
  returns: OrderReturn[];
  loading: boolean;
  onReload: () => void;
}) {
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approveReason, setApproveReason] = useState<'return' | 'waste' | 'damage'>('return');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleApprove = async () => {
    if (!approvingId) return;
    setIsSubmitting(true);
    try {
      const result = await approveOrderReturn(approvingId, approveReason);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success('Return approved — ledger and stock updated.');
      setApprovingId(null);
      onReload();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectingId) return;
    setIsSubmitting(true);
    try {
      const result = await rejectOrderReturn(rejectingId, rejectNote.trim() || undefined);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success('Return request rejected.');
      setRejectingId(null);
      setRejectNote('');
      onReload();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading)
    return (
      <div className="text-muted-foreground animate-pulse py-8 text-center">
        Loading return requests...
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="bg-card border-border rounded-xl border p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Customer Return Requests</h3>
            <p className="text-muted-foreground text-sm">
              Review and approve or reject return requests submitted by clients.
            </p>
          </div>
          <Badge variant="outline" className="text-sm">
            {returns.length} pending
          </Badge>
        </div>
      </div>

      {returns.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-12 text-center">
            <CornerDownLeft className="mx-auto mb-3 h-10 w-10 opacity-30" />
            <p className="text-sm font-medium">No pending return requests.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {returns.map((ret) => {
            const order = (ret as unknown as { order?: Record<string, any> }).order;
            return (
              <Card
                key={ret.id}
                className="border-amber-200 bg-amber-50/40 shadow-sm dark:border-amber-800 dark:bg-amber-950/20"
              >
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-foreground font-mono text-sm font-bold">
                          PO: {order?.po_number || '—'}
                        </span>
                        <Badge className="border-0 bg-amber-100 text-[10px] text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                          Pending
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-sm">
                        Client:{' '}
                        {order?.client?.company_name || order?.client?.full_name || 'Unknown'}
                      </p>
                      {order?.dr_number && (
                        <p className="text-muted-foreground text-xs">DR: {order.dr_number}</p>
                      )}
                      <div className="flex gap-4 text-sm">
                        {/* jb_qty/sb_qty are INDIVIDUAL BAG counts, matching
                            the client's bag-first Request Return input — see
                            client-actions.ts's _submitOrderReturn. */}
                        {ret.jb_qty > 0 && (
                          <span className="text-foreground font-semibold">
                            {ret.jb_qty} JB bags
                          </span>
                        )}
                        {ret.sb_qty > 0 && (
                          <span className="text-foreground font-semibold">
                            {ret.sb_qty} SB bags
                          </span>
                        )}
                      </div>
                      {ret.reason && (
                        <div className="border-border bg-background rounded-lg border p-3">
                          <p className="text-muted-foreground mb-1 text-xs font-semibold tracking-wider uppercase">
                            Client Reason
                          </p>
                          <p className="text-foreground text-sm">{ret.reason}</p>
                        </div>
                      )}
                      <p className="text-muted-foreground text-xs">
                        Submitted: {new Date(ret.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setRejectingId(ret.id)}
                        className="gap-2"
                      >
                        <XCircle className="h-4 w-4" /> Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setApprovingId(ret.id);
                          setApproveReason('return');
                        }}
                        className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                      >
                        <CheckCircle2 className="h-4 w-4" /> Approve
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Approve dialog — admin picks restockable vs waste vs damage */}
      <Dialog open={!!approvingId} onOpenChange={(open) => !open && setApprovingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Return</DialogTitle>
            <DialogDescription>
              Choose how this return affects stock and profit. This creates a shipment ledger entry
              immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Category</Label>
            <Select
              items={APPROVE_REASON_OPTIONS}
              value={approveReason}
              onValueChange={(v) =>
                setApproveReason((v as 'return' | 'waste' | 'damage') || 'return')
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {APPROVE_REASON_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApprovingId(null)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={isSubmitting} className="bg-primary">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Approve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog — optional note */}
      <Dialog
        open={!!rejectingId}
        onOpenChange={(open) => {
          if (!open) {
            setRejectingId(null);
            setRejectNote('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Return</DialogTitle>
            <DialogDescription>
              This does not affect stock or profit. Optionally tell the client why.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="reject-note">Note (optional)</Label>
            <Textarea
              id="reject-note"
              placeholder="e.g. Return window has expired..."
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectingId(null);
                setRejectNote('');
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              disabled={isSubmitting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
