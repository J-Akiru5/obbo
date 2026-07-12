'use client';

import { useState, useMemo } from 'react';
import { Minus, Plus, PackagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

export function StepProducts({
  jbQty,
  sbQty,
  onJbChange,
  onSbChange,
  bagType,
  error,
}: StepProductsProps) {
  const [individualBags, setIndividualBags] = useState(() => jbQty * 25 + sbQty * 50);

  const isPrimarySB = bagType === 'SB';
  const isPrimaryJB = bagType === 'JB';
  const hasType = isPrimarySB || isPrimaryJB;

  const primaryBagsPerUnit = isPrimarySB ? 50 : 25;
  const primaryLabel = isPrimarySB ? 'SB' : 'JB';
  const otherLabel = isPrimarySB ? 'JB' : 'SB';
  const otherBagsPerUnit = isPrimarySB ? 25 : 50;

  const primaryUnits = individualBags > 0 ? Math.floor(individualBags / primaryBagsPerUnit) : 0;
  const remainder = individualBags > 0 ? individualBags % primaryBagsPerUnit : 0;
  const otherUnitsFromRemainder = remainder > 0 ? Math.floor(remainder / otherBagsPerUnit) : 0;
  const hasOtherType = isPrimarySB ? jbQty > 0 : sbQty > 0;

  const totalCalculated = useMemo(() => {
    if (isPrimarySB) return primaryUnits * 50 + jbQty * 25;
    if (isPrimaryJB) return primaryUnits * 25 + sbQty * 50;
    return jbQty * 25 + sbQty * 50;
  }, [isPrimarySB, isPrimaryJB, primaryUnits, jbQty, sbQty]);

  function handleIndividualBagsChange(value: number) {
    const bags = Math.max(0, value);
    setIndividualBags(bags);
    if (bagType === 'SB') {
      onSbChange(Math.floor(bags / 50));
      if (jbQty > 0) onJbChange(0);
    } else if (bagType === 'JB') {
      onJbChange(Math.floor(bags / 25));
      if (sbQty > 0) onSbChange(0);
    }
  }

  function handleAddOtherType() {
    if (bagType === 'SB' && otherUnitsFromRemainder > 0) {
      onJbChange(otherUnitsFromRemainder);
    } else if (bagType === 'JB' && otherUnitsFromRemainder > 0) {
      onSbChange(otherUnitsFromRemainder);
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-foreground text-xl font-semibold tracking-tight">Select products</h2>
        <p className="text-muted-foreground text-sm">
          {hasType
            ? `Enter the total number of individual bags. We'll calculate the ${primaryLabel} units.`
            : 'Choose how many JB and/or SB units you want to order.'}
        </p>
      </div>

      {hasType ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="indiv-bags">Number of individual bags</Label>
            <Input
              id="indiv-bags"
              type="number"
              min="0"
              value={individualBags || ''}
              placeholder="Enter total number of bags"
              onChange={(e) => handleIndividualBagsChange(parseInt(e.target.value) || 0)}
              className="text-lg font-bold"
            />
          </div>

          {individualBags > 0 && (
            <>
              {primaryUnits > 0 && (
                <div className="bg-card rounded-lg border p-4">
                  <p className="text-sm font-semibold">
                    {individualBags.toLocaleString()} individual bags ={' '}
                    <span className="text-primary">
                      {primaryUnits} {primaryLabel} unit{primaryUnits > 1 ? 's' : ''}
                    </span>{' '}
                    ({primaryUnits * primaryBagsPerUnit} bags)
                  </p>
                </div>
              )}

              {remainder > 0 &&
                primaryUnits > 0 &&
                otherUnitsFromRemainder > 0 &&
                !hasOtherType && (
                  <div className="bg-card flex items-center justify-between rounded-lg border p-3">
                    <p className="text-muted-foreground text-sm">
                      {remainder.toLocaleString()} bag{remainder > 1 ? 's' : ''} remaining
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddOtherType}
                      className="gap-1"
                    >
                      <PackagePlus className="h-3.5 w-3.5" />
                      Add {otherUnitsFromRemainder} {otherLabel} unit
                      {otherUnitsFromRemainder > 1 ? 's' : ''}
                    </Button>
                  </div>
                )}

              {totalCalculated > 0 && (
                <div className="border-border bg-muted/40 flex items-center justify-between rounded-lg border px-4 py-3">
                  <span className="text-muted-foreground text-sm">Total individual bags</span>
                  <span className="text-foreground text-sm font-bold">
                    {totalCalculated.toLocaleString()}
                  </span>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <>
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

          {totalCalculated > 0 && (
            <div className="border-border bg-muted/40 flex items-center justify-between rounded-lg border px-4 py-3">
              <span className="text-muted-foreground text-sm">Total individual bags</span>
              <span className="text-foreground text-sm font-bold">
                {totalCalculated.toLocaleString()}
              </span>
            </div>
          )}
        </>
      )}

      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
