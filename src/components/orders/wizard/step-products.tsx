'use client';

import { Package, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface StepProductsProps {
  totalBags: number;
  onQtyChange: (value: number) => void;
  error?: string;
}

export function StepProducts({ totalBags, onQtyChange, error }: StepProductsProps) {
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-foreground text-xl font-semibold tracking-tight">Select products</h2>
        <p className="text-muted-foreground text-sm">
          Enter the total number of individual cement bags you want to order.
        </p>
      </div>

      <div className="bg-card space-y-4 rounded-lg border p-6">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-lg">
            <Package className="text-primary h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold">Portland Cement Type 1</p>
            <p className="text-muted-foreground text-xs">Individual bags</p>
          </div>
        </div>
        <div>
          <Label htmlFor="total_bags" className="text-sm font-medium">
            Quantity (Individual Bags)
          </Label>
          <Input
            id="total_bags"
            type="number"
            min={1}
            step={1}
            value={totalBags || ''}
            placeholder="Enter total number of bags"
            onFocus={(e) => e.target.select()}
            onChange={(e) => onQtyChange(Math.max(1, parseInt(e.target.value) || 0))}
            className="mt-2 h-14 text-center text-2xl font-bold"
          />
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-amber-800">Quick Reference</p>
            <p className="text-xs text-amber-700">
              <span className="font-semibold">25 individual bags</span> = 1 JB (Jumbo Bag) unit
            </p>
            <p className="text-xs text-amber-700">
              <span className="font-semibold">50 individual bags</span> = 1 SB (Sling Bag) unit
            </p>
          </div>
        </div>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
