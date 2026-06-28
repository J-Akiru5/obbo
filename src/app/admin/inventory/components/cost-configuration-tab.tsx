'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, Info } from 'lucide-react';
import { toast } from 'sonner';
import { getCostConfig, saveCostConfiguration } from '@/lib/actions/admin-actions';

export function CostConfigurationTab() {
  const [landedCost, setLandedCost] = useState<number>(147.64);
  const [localExpenses, setLocalExpenses] = useState<number>(20.0);
  const [isSaving, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await getCostConfig();
        setLandedCost(config.landed_cost_per_bag);
        setLocalExpenses(config.local_expenses_per_bag);
      } catch {
        // Silently fall back to defaults
      } finally {
        setIsLoading(false);
      }
    };
    loadConfig();
  }, []);

  // Standard wholesale baseline parameter values for visual previews
  const standardWarehousePrice = 185.0;
  const totalCost = landedCost + localExpenses;
  const grossProfitBag = standardWarehousePrice - landedCost;
  const netProfitBag = standardWarehousePrice - totalCost;

  const handleSaveConfig = async () => {
    if (landedCost <= 0 || localExpenses <= 0) {
      toast.error('Please enter valid cost parameters greater than 0.');
      return;
    }

    setIsSubmitting(true);
    try {
      await saveCostConfiguration(landedCost, localExpenses);
      toast.success('Cost configuration snapshots successfully stored in database.');
    } catch (error) {
      console.error('Failed to save cost configuration:', error);
      toast.error('An error occurred while saving parameters.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading)
    return (
      <div className="text-muted-foreground animate-pulse py-8 text-center">
        Loading cost configuration...
      </div>
    );

  return (
    <div className="space-y-6">
      <Card className="border-border bg-card relative overflow-hidden rounded-2xl border">
        <CardHeader>
          <CardTitle className="text-xl font-bold tracking-tight">
            Cost Configuration (per 40 kg bag)
          </CardTitle>
          <CardDescription className="text-muted-foreground mt-1 text-xs">
            These configuration values drive Sales, Gross Profit, and Net Profit across the ledger,
            dashboards, and reports. Changes only affect new dispatches/orders — past records keep
            their snapshoted historic values.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Landed Cost Parameter Input */}
            <div className="space-y-2">
              <Label htmlFor="landed-cost" className="text-sm font-semibold">
                Landed Cost (₱/bag)
              </Label>
              <Input
                id="landed-cost"
                type="number"
                step="0.01"
                min="0"
                value={landedCost}
                onChange={(e) => setLandedCost(parseFloat(e.target.value) || 0)}
                className="h-11 font-mono font-bold"
              />
              <p className="text-muted-foreground text-[11px]">
                Base Cost (85.80) + Freight (27.84) + Duties (22.00) + Port Handling (12.00) =
                147.64
              </p>
            </div>

            {/* Local Expenses Parameter Input */}
            <div className="space-y-2">
              <Label htmlFor="local-expenses" className="text-sm font-semibold">
                Local Expenses (₱/bag)
              </Label>
              <Input
                id="local-expenses"
                type="number"
                step="0.01"
                min="0"
                value={localExpenses}
                onChange={(e) => setLocalExpenses(parseFloat(e.target.value) || 0)}
                className="h-11 font-mono font-bold"
              />
              <p className="text-muted-foreground text-[11px]">
                Local delivery/fuel, warehouse rent, labor, forklift operators, local taxes, etc.
              </p>
            </div>
          </div>

          {/* Live Computation Indicators Panel Breakdown */}
          <div className="border-border/60 grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-3">
            <div className="bg-muted/40 flex flex-col justify-between space-y-2 rounded-xl border p-4">
              <span className="text-muted-foreground block text-[11px] font-bold tracking-wider uppercase">
                Gross Profit / bag
              </span>
              <div className="text-foreground font-mono text-xl font-extrabold">
                ₱{grossProfitBag.toFixed(2)}
              </div>
              <span className="text-muted-foreground block text-[10px]">
                Based on ₱{standardWarehousePrice.toFixed(2)} selling price
              </span>
            </div>

            <div className="flex flex-col justify-between space-y-2 rounded-xl border border-amber-500/10 bg-amber-500/5 p-4">
              <span className="block text-[11px] font-bold tracking-wider text-amber-500 uppercase">
                Net Profit / bag
              </span>
              <div className="font-mono text-xl font-extrabold text-amber-500">
                ₱{netProfitBag.toFixed(2)}
              </div>
              <span className="text-muted-foreground block text-[10px]">
                Actual owner pocket margin conversion
              </span>
            </div>

            <div className="bg-muted/40 flex flex-col justify-between space-y-2 rounded-xl border p-4">
              <span className="text-muted-foreground block text-[11px] font-bold tracking-wider uppercase">
                Total Cost / bag
              </span>
              <div className="text-foreground font-mono text-xl font-extrabold">
                ₱{totalCost.toFixed(2)}
              </div>
              <span className="text-muted-foreground block text-[10px]">
                Combined Landed + Local operational values
              </span>
            </div>
          </div>

          {/* Mathematical Formula Sheet Summary Card */}
          <div className="flex items-start gap-3 rounded-xl border border-blue-500/10 bg-blue-500/5 p-4">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" />
            <div className="space-y-1 text-xs leading-relaxed text-slate-400">
              <span className="text-foreground mb-1 block font-bold tracking-wide uppercase">
                Formulas Sheet Summary:
              </span>
              <p>• **Total Sales** = quantity × selling_price_at_order</p>
              <p>• **Gross Profit** = Total Sales − (quantity × landed_cost_at_dispatch)</p>
              <p>
                • **Net Profit** = Total Sales − (quantity × (landed_cost +
                local_expenses)_at_dispatch)
              </p>
            </div>
          </div>

          {/* Interactive Operational Submit Trigger Button */}
          <div className="flex justify-end pt-2">
            <Button
              onClick={handleSaveConfig}
              disabled={isSaving}
              className="bg-primary h-11 rounded-xl px-6 text-sm font-bold shadow-md"
            >
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? 'Saving Configuration...' : 'Save Cost Configuration'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
