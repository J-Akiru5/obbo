'use client';

import { Anchor, Building2, Info } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import type { Product } from '@/lib/types/database';
import { getPrice, getSubtotal, deriveJBAndSB } from './order-schema';

interface StepSourceProps {
  value: string;
  onChange: (value: 'port' | 'warehouse') => void;
  products: Product[];
  totalBags: number;
  error?: string;
}

export function StepSource({ value, onChange, products, totalBags, error }: StepSourceProps) {
  const jbProduct = products.find((p) => p.bag_type === 'JB');

  const sources = [
    {
      key: 'port' as const,
      icon: Anchor,
      title: 'Port',
      description: 'Pick up directly from the port',
      pricePerBag: getPrice(jbProduct, 'port'),
    },
    {
      key: 'warehouse' as const,
      icon: Building2,
      title: 'Warehouse',
      description: 'From warehouse inventory',
      pricePerBag: getPrice(jbProduct, 'warehouse'),
    },
  ];

  const { jb, sb, remaining } = deriveJBAndSB(totalBags);

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-foreground text-xl font-semibold tracking-tight">Choose source</h2>
        <p className="text-muted-foreground text-sm">
          Select where the order will be sourced from. Prices differ by source.
        </p>
      </div>

      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as 'port' | 'warehouse')}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        {sources.map((src) => {
          const subtotal = getSubtotal(totalBags, src.pricePerBag);
          return (
            <Label
              key={src.key}
              htmlFor={`source-${src.key}`}
              className={`flex cursor-pointer flex-col gap-3 rounded-lg border-2 p-4 transition-all ${
                value === src.key
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border hover:border-primary/40 hover:bg-muted/30'
              } `}
            >
              <div className="flex items-start gap-3">
                <RadioGroupItem value={src.key} id={`source-${src.key}`} className="mt-0.5" />
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                      value === src.key ? 'bg-primary/10' : 'bg-muted'
                    }`}
                  >
                    <src.icon
                      className={`h-5 w-5 ${value === src.key ? 'text-primary' : 'text-muted-foreground'}`}
                    />
                  </div>
                  <div>
                    <p className="text-foreground font-semibold">{src.title}</p>
                    <p className="text-muted-foreground text-sm">{src.description}</p>
                  </div>
                </div>
              </div>

              {/* Price breakdown */}
              <div className="ml-7 space-y-1 text-xs">
                {totalBags > 0 && (
                  <div className="text-muted-foreground flex justify-between">
                    <span>
                      {totalBags} bags × ₱{src.pricePerBag.toLocaleString()}/bag
                    </span>
                    <span className="text-foreground font-medium">
                      ₱{subtotal.toLocaleString()}
                    </span>
                  </div>
                )}
                {totalBags > 0 && (
                  <div className="mt-2 flex items-start gap-2 rounded border border-amber-200 bg-amber-50 p-2">
                    <Info className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
                    <span className="text-amber-700">
                      = {jb > 0 ? `${jb} JB (${jb * 25} bags)` : ''}
                      {jb > 0 && sb > 0 ? ' + ' : ''}
                      {sb > 0 ? `${sb} SB (${sb * 50} bags)` : ''}
                      {remaining > 0 && (jb > 0 || sb > 0) ? ' + ' : ''}
                      {remaining > 0 ? `${remaining} loose` : ''}
                    </span>
                  </div>
                )}
                <div className="border-border flex justify-between border-t pt-1 text-sm font-semibold">
                  <span>Subtotal</span>
                  <span className="text-primary">₱{subtotal.toLocaleString()}</span>
                </div>
              </div>
            </Label>
          );
        })}
      </RadioGroup>

      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
