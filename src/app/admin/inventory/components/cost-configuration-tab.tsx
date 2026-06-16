"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Info, TrendingUp, DollarSign, Wallet } from "lucide-react";
import { toast } from "sonner";

export function CostConfigurationTab() {
    const [landedCost, setLandedCost] = useState<number>(147.64);
    const [localExpenses, setLocalExpenses] = useState<number>(20.00);
    const [isSaving, setIsSubmitting] = useState(false);

    // Standard wholesale baseline parameter values for visual previews
    const standardWarehousePrice = 185.00;
    const totalCost = landedCost + localExpenses;
    const grossProfitBag = standardWarehousePrice - landedCost;
    const netProfitBag = standardWarehousePrice - totalCost;

    const handleSaveConfig = async () => {
        if (landedCost <= 0 || localExpenses <= 0) {
            toast.error("Please enter valid cost parameters greater than 0.");
            return;
        }

        setIsSubmitting(true);
        try {
            // TODO: Connect this to the Server Action (e.g., saveCostConfiguration) 
            // to store landed_cost and local_expenses with proper timestamp snapshots in the database.
            await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulated network lag
            toast.success("Cost configuration snapshots successfully stored in database.");
        } catch (error) {
            console.error("Failed to save cost configuration:", error);
            toast.error("An error occurred while saving parameters.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <Card className="border border-border bg-card rounded-2xl overflow-hidden relative">
                <CardHeader>
                    <CardTitle className="text-xl font-bold tracking-tight">Cost Configuration (per 40 kg bag)</CardTitle>
                    <CardDescription className="text-muted-foreground text-xs mt-1">
                        These configuration values drive Sales, Gross Profit, and Net Profit across the ledger, dashboards, and reports. 
                        Changes only affect new dispatches/orders — past records keep their snapshoted historic values.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Landed Cost Parameter Input */}
                        <div className="space-y-2">
                            <Label htmlFor="landed-cost" className="text-sm font-semibold">Landed Cost (₱/bag)</Label>
                            <Input
                                id="landed-cost"
                                type="number"
                                step="0.01"
                                min="0"
                                value={landedCost}
                                onChange={(e) => setLandedCost(parseFloat(e.target.value) || 0)}
                                className="font-bold font-mono h-11"
                            />
                            <p className="text-[11px] text-muted-foreground">
                                Base Cost (85.80) + Freight (27.84) + Duties (22.00) + Port Handling (12.00) = 147.64
                            </p>
                        </div>

                        {/* Local Expenses Parameter Input */}
                        <div className="space-y-2">
                            <Label htmlFor="local-expenses" className="text-sm font-semibold">Local Expenses (₱/bag)</Label>
                            <Input
                                id="local-expenses"
                                type="number"
                                step="0.01"
                                min="0"
                                value={localExpenses}
                                onChange={(e) => setLocalExpenses(parseFloat(e.target.value) || 0)}
                                className="font-bold font-mono h-11"
                            />
                            <p className="text-[11px] text-muted-foreground">
                                Local delivery/fuel, warehouse rent, labor, forklift operators, local taxes, etc.
                            </p>
                        </div>
                    </div>

                    {/* Live Computation Indicators Panel Breakdown */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-border/60">
                        <div className="p-4 rounded-xl bg-muted/40 border flex flex-col justify-between space-y-2">
                            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Gross Profit / bag</span>
                            <div className="text-xl font-extrabold text-foreground font-mono">
                                ₱{grossProfitBag.toFixed(2)}
                            </div>
                            <span className="text-[10px] text-muted-foreground block">Based on ₱{standardWarehousePrice.toFixed(2)} selling price</span>
                        </div>

                        <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 flex flex-col justify-between space-y-2">
                            <span className="text-[11px] font-bold text-amber-500 uppercase tracking-wider block">Net Profit / bag</span>
                            <div className="text-xl font-extrabold text-amber-500 font-mono">
                                ₱{netProfitBag.toFixed(2)}
                            </div>
                            <span className="text-[10px] text-muted-foreground block">Actual owner pocket margin conversion</span>
                        </div>

                        <div className="p-4 rounded-xl bg-muted/40 border flex flex-col justify-between space-y-2">
                            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Total Cost / bag</span>
                            <div className="text-xl font-extrabold text-foreground font-mono">
                                ₱{totalCost.toFixed(2)}
                            </div>
                            <span className="text-[10px] text-muted-foreground block">Combined Landed + Local operational values</span>
                        </div>
                    </div>

                    {/* Mathematical Formula Sheet Summary Card */}
                    <div className="p-4 rounded-xl border border-blue-500/10 bg-blue-500/5 flex items-start gap-3">
                        <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                        <div className="space-y-1 text-xs leading-relaxed text-slate-400">
                            <span className="font-bold text-foreground uppercase tracking-wide block mb-1">Formulas Sheet Summary:</span>
                            <p>• **Total Sales** = quantity × selling_price_at_order</p>
                            <p>• **Gross Profit** = Total Sales − (quantity × landed_cost_at_dispatch)</p>
                            <p>• **Net Profit** = Total Sales − (quantity × (landed_cost + local_expenses)_at_dispatch)</p>
                        </div>
                    </div>

                    {/* Interactive Operational Submit Trigger Button */}
                    <div className="flex justify-end pt-2">
                        <Button 
                            onClick={handleSaveConfig} 
                            disabled={isSaving} 
                            className="bg-primary px-6 h-11 rounded-xl text-sm font-bold shadow-md"
                        >
                            <Save className="w-4 h-4 mr-2" />
                            {isSaving ? "Saving Configuration..." : "Save Cost Configuration"}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}