'use client';

import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StepProductsProps {
  jbQty: number;
  sbQty: number;
  onJbChange: (value: number) => void;
  onSbChange: (value: number) => void;
  error?: string;
}

function BagCounter({
  label,
  type,
  qty,
  onChange,
  bagsPerUnit,
  description,
}: {
  label: string;
  type: string;
  qty: number;
  onChange: (v: number) => void;
  bagsPerUnit: number;
  description: string;
}) {
  return (
    <div className="bg-card flex flex-col gap-4 rounded-lg border p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-primary text-primary-foreground rounded px-2 py-0.5 text-xs font-bold tracking-wider">
              {type}
            </span>
            <p className="text-foreground text-sm font-semibold">{label}</p>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">{description}</p>
        </div>
        {qty > 0 && (
          <p className="text-primary shrink-0 text-xs font-medium">
            = {qty * bagsPerUnit} indiv. bags
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-4">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-11 w-11 shrink-0"
          onClick={() => onChange(Math.max(0, qty - 1))}
          disabled={qty <= 0}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <div className="flex-1 text-center">
          <span className="text-foreground text-3xl font-bold tabular-nums">{qty}</span>
          <p className="text-muted-foreground mt-0.5 text-xs">units</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-11 w-11 shrink-0"
          onClick={() => onChange(qty + 1)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function StepProducts({ jbQty, sbQty, onJbChange, onSbChange, error }: StepProductsProps) {
  const totalIndivBags = jbQty * 25 + sbQty * 50;

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-foreground text-xl font-semibold tracking-tight">Select products</h2>
        <p className="text-muted-foreground text-sm">
          Choose how many JB and/or SB units you want to order.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <BagCounter
          label="Jumbo Bag"
          type="JB"
          qty={jbQty}
          onChange={onJbChange}
          bagsPerUnit={25}
          description="1 JB = 25 individual bags"
        />
        <BagCounter
          label="Sling Bag"
          type="SB"
          qty={sbQty}
          onChange={onSbChange}
          bagsPerUnit={50}
          description="1 SB = 50 individual bags"
        />
      </div>

      {totalIndivBags > 0 && (
        <div className="border-border bg-muted/40 flex items-center justify-between rounded-lg border px-4 py-3">
          <span className="text-muted-foreground text-sm">Total individual bags</span>
          <span className="text-foreground text-sm font-bold">
            {totalIndivBags.toLocaleString()}
          </span>
        </div>
      )}

      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
