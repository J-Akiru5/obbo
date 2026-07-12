'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface StepProductsProps {
  jbQty: number;
  sbQty: number;
  onJbChange: (value: number) => void;
  onSbChange: (value: number) => void;
  bagType: 'JB' | 'SB' | null;
  error?: string;
}

export function StepProducts({
  jbQty,
  sbQty,
  onJbChange,
  onSbChange,
  bagType,
  error,
}: StepProductsProps) {
  const isPrimarySB = bagType === 'SB';
  const isPrimaryJB = bagType === 'JB';
  const hasType = isPrimarySB || isPrimaryJB;
  const primaryLabel = isPrimarySB ? 'SB' : 'JB';
  const total = jbQty + sbQty;

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-foreground text-xl font-semibold tracking-tight">Select products</h2>
        <p className="text-muted-foreground text-sm">
          {hasType
            ? `Enter the total number of ${primaryLabel} bags you want to order.`
            : 'Enter how many JB and/or SB bags you want to order.'}
        </p>
      </div>

      {hasType ? (
        <div className="space-y-2">
          <Label htmlFor="indiv-bags">{primaryLabel} bags</Label>
          <Input
            id="indiv-bags"
            type="number"
            min="0"
            value={jbQty || sbQty || ''}
            placeholder="Enter number of bags"
            onChange={(e) => {
              const v = Math.max(0, parseInt(e.target.value) || 0);
              if (isPrimarySB) onSbChange(v);
              else onJbChange(v);
            }}
            className="text-lg font-bold"
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="jb-bags">JB bags</Label>
            <Input
              id="jb-bags"
              type="number"
              min="0"
              value={jbQty || ''}
              placeholder="0"
              onChange={(e) => onJbChange(Math.max(0, parseInt(e.target.value) || 0))}
              className="text-lg font-bold"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sb-bags">SB bags</Label>
            <Input
              id="sb-bags"
              type="number"
              min="0"
              value={sbQty || ''}
              placeholder="0"
              onChange={(e) => onSbChange(Math.max(0, parseInt(e.target.value) || 0))}
              className="text-lg font-bold"
            />
          </div>
        </div>
      )}

      {total > 0 && (
        <div className="border-border bg-muted/40 flex items-center justify-between rounded-lg border px-4 py-3">
          <span className="text-muted-foreground text-sm">Total bags</span>
          <span className="text-foreground text-sm font-bold">{total.toLocaleString()}</span>
        </div>
      )}

      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
