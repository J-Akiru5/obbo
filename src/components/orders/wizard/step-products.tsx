"use client";

import { Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Product } from "@/lib/types/database";
import { getTotalIndividualBags } from "./order-schema";

interface StepProductsProps {
    products: Product[];
    jbQty: number;
    sbQty: number;
    onQtyChange: (field: "jb_qty" | "sb_qty", value: number) => void;
    error?: string;
}

export function StepProducts({ products, jbQty, sbQty, onQtyChange, error }: StepProductsProps) {
    const jbProduct = products.find((p) => p.bag_type === "JB");
    const sbProduct = products.find((p) => p.bag_type === "SB");
    const totalIndividual = getTotalIndividualBags(jbQty, sbQty);

    return (
        <div className="space-y-5">
            <div className="space-y-1">
                <h2 className="text-xl font-semibold tracking-tight text-foreground">
                    Select products
                </h2>
                <p className="text-sm text-muted-foreground">
                    Enter the quantity of Jumbo Bags (JB) and Sling Bags (SB) you want to order.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* JB */}
                <div className="rounded-lg border bg-card p-4 space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Package className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold">{jbProduct?.name ?? "Portland Cement Type 1"}</p>
                            <p className="text-xs text-muted-foreground">Jumbo Bag (JB) &middot; 25 bags per JB</p>
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="jb_qty" className="text-sm font-medium">
                            Quantity (JB)
                        </Label>
                        <Input
                            id="jb_qty"
                            type="number"
                            min={0}
                            step={1}
                            value={jbQty || ""}
                            placeholder="0"
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => onQtyChange("jb_qty", Math.max(0, parseInt(e.target.value) || 0))}
                            className="h-12 text-lg font-bold mt-1.5"
                        />
                        {jbQty > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                                = {jbQty * 25} individual bags
                            </p>
                        )}
                    </div>
                </div>

                {/* SB */}
                <div className="rounded-lg border bg-card p-4 space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                            <Package className="w-5 h-5 text-accent" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold">{sbProduct?.name ?? "Portland Cement Type 1"}</p>
                            <p className="text-xs text-muted-foreground">Sling Bag (SB) &middot; 50 bags per SB</p>
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="sb_qty" className="text-sm font-medium">
                            Quantity (SB)
                        </Label>
                        <Input
                            id="sb_qty"
                            type="number"
                            min={0}
                            step={1}
                            value={sbQty || ""}
                            placeholder="0"
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => onQtyChange("sb_qty", Math.max(0, parseInt(e.target.value) || 0))}
                            className="h-12 text-lg font-bold mt-1.5"
                        />
                        {sbQty > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                                = {sbQty * 50} individual bags
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Total individual bags */}
            {totalIndividual > 0 && (
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                    <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-foreground">Total Individual Bags</span>
                        <span className="text-2xl font-bold text-primary">{totalIndividual.toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        JB: {jbQty} × 25 = {(jbQty * 25).toLocaleString()} + SB: {sbQty} × 50 = {(sbQty * 50).toLocaleString()}
                    </p>
                </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
    );
}
