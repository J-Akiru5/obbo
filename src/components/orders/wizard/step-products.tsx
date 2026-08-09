'use client';

import { Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { bgsToUnits, unitsToBags } from './order-schema';
import type { BagType } from '@/lib/types/database';

interface StepProductsProps {
  jbBags: number;
  sbBags: number;
  onJbChange: (value: number) => void;
  onSbChange: (value: number) => void;
  bagType: 'JB' | 'SB' | null;
  error?: string;
}

// Amber "here's what you're actually being billed" hint, shown whenever an
// entered bag count isn't an exact multiple of the unit size — the client
// types individual bags, but billing always rounds up to a whole JB/SB unit.
function RoundUpHint({ bags, type }: { bags: number; type: BagType }) {
  if (bags <= 0) return null;
  const units = bgsToUnits(bags, type);
  const actualBags = unitsToBags(units, type);
  if (actualBags === bags) return null;
  return (
    <div className="mt-1.5 flex items-start gap-2 rounded border border-amber-200 bg-amber-50 p-2 text-xs">
      <Info className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
      <span className="text-amber-700">
        {bags.toLocaleString()} individual bags → {units.toLocaleString()} {type} unit
        {units === 1 ? '' : 's'} ({actualBags.toLocaleString()} actual bags)
      </span>
    </div>
  );
}

export function StepProducts({
  jbBags,
  sbBags,
  onJbChange,
  onSbChange,
  bagType,
  error,
}: StepProductsProps) {
  const isPrimarySB = bagType === 'SB';
  const isPrimaryJB = bagType === 'JB';
  const hasType = isPrimarySB || isPrimaryJB;
  const primaryLabel = isPrimarySB ? 'SB' : 'JB';
  const primaryBags = isPrimarySB ? sbBags : jbBags;

  // Actual billed total (rounded up to whole units), not the raw bag sum —
  // this is what the client is really being charged for.
  const jbUnits = bgsToUnits(jbBags, 'JB');
  const sbUnits = bgsToUnits(sbBags, 'SB');
  const totalActualBags = unitsToBags(jbUnits, 'JB') + unitsToBags(sbUnits, 'SB');

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-foreground text-xl font-semibold tracking-tight">Select products</h2>
        <p className="text-muted-foreground text-sm">
          {hasType
            ? `Enter the number of individual ${primaryLabel} bags you want to order.`
            : 'Enter how many individual JB and/or SB bags you want to order.'}
        </p>
      </div>

      {hasType ? (
        <div className="space-y-2">
          <Label htmlFor="indiv-bags">Individual bags</Label>
          <Input
            id="indiv-bags"
            type="number"
            min="0"
            value={primaryBags || ''}
            placeholder="Enter number of bags"
            onChange={(e) => {
              const v = Math.max(0, parseInt(e.target.value) || 0);
              if (isPrimarySB) onSbChange(v);
              else onJbChange(v);
            }}
            className="text-lg font-bold"
          />
          <RoundUpHint bags={primaryBags} type={isPrimarySB ? 'SB' : 'JB'} />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="jb-bags">Individual bags (JB)</Label>
            <Input
              id="jb-bags"
              type="number"
              min="0"
              value={jbBags || ''}
              placeholder="0"
              onChange={(e) => onJbChange(Math.max(0, parseInt(e.target.value) || 0))}
              className="text-lg font-bold"
            />
            <RoundUpHint bags={jbBags} type="JB" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sb-bags">Individual bags (SB)</Label>
            <Input
              id="sb-bags"
              type="number"
              min="0"
              value={sbBags || ''}
              placeholder="0"
              onChange={(e) => onSbChange(Math.max(0, parseInt(e.target.value) || 0))}
              className="text-lg font-bold"
            />
            <RoundUpHint bags={sbBags} type="SB" />
          </div>
        </div>
      )}

      {totalActualBags > 0 && (
        <div className="border-border bg-muted/40 flex items-center justify-between rounded-lg border px-4 py-3">
          <span className="text-muted-foreground text-sm">Total bags</span>
          <span className="text-foreground text-sm font-bold">
            {totalActualBags.toLocaleString()}
          </span>
        </div>
      )}

      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
