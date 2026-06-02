"use client";

import { Anchor, Building2 } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import type { Product } from "@/lib/types/database";
import { getPrice, getSubtotal } from "./order-schema";

interface StepSourceProps {
    value: string;
    onChange: (value: "port" | "warehouse") => void;
    products: Product[];
    jbQty: number;
    sbQty: number;
    error?: string;
}

export function StepSource({ value, onChange, products, jbQty, sbQty, error }: StepSourceProps) {
    const jbProduct = products.find((p) => p.bag_type === "JB");
    const sbProduct = products.find((p) => p.bag_type === "SB");

    const sources = [
        {
            key: "port" as const,
            icon: Anchor,
            title: "Port",
            description: "Pick up directly from the port",
            jbPrice: getPrice(jbProduct, "port"),
            sbPrice: getPrice(sbProduct, "port"),
        },
        {
            key: "warehouse" as const,
            icon: Building2,
            title: "Warehouse",
            description: "From warehouse inventory",
            jbPrice: getPrice(jbProduct, "warehouse"),
            sbPrice: getPrice(sbProduct, "warehouse"),
        },
    ];

    return (
        <div className="space-y-5">
            <div className="space-y-1">
                <h2 className="text-xl font-semibold tracking-tight text-foreground">
                    Choose source
                </h2>
                <p className="text-sm text-muted-foreground">
                    Select where the order will be sourced from. Prices differ by source.
                </p>
            </div>

            <RadioGroup
                value={value}
                onValueChange={(v) => onChange(v as "port" | "warehouse")}
                className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            >
                {sources.map((src) => {
                    const subtotal = getSubtotal(jbQty, sbQty, src.jbPrice, src.sbPrice);
                    return (
                        <Label
                            key={src.key}
                            htmlFor={`source-${src.key}`}
                            className={`
                                flex flex-col gap-3 rounded-lg border-2 p-4 cursor-pointer transition-all
                                ${value === src.key
                                    ? "border-primary bg-primary/5 shadow-sm"
                                    : "border-border hover:border-primary/40 hover:bg-muted/30"}
                            `}
                        >
                            <div className="flex items-start gap-3">
                                <RadioGroupItem value={src.key} id={`source-${src.key}`} className="mt-0.5" />
                                <div className="flex items-start gap-3">
                                    <div
                                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                            value === src.key ? "bg-primary/10" : "bg-muted"
                                        }`}
                                    >
                                        <src.icon
                                            className={`w-5 h-5 ${value === src.key ? "text-primary" : "text-muted-foreground"}`}
                                        />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-foreground">{src.title}</p>
                                        <p className="text-sm text-muted-foreground">{src.description}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Price breakdown */}
                            <div className="ml-7 space-y-1 text-xs">
                                {jbQty > 0 && (
                                    <div className="flex justify-between text-muted-foreground">
                                        <span>JB: ₱{src.jbPrice.toLocaleString()}/bag × {jbQty}</span>
                                        <span className="font-medium text-foreground">
                                            ₱{(src.jbPrice * jbQty).toLocaleString()}
                                        </span>
                                    </div>
                                )}
                                {sbQty > 0 && (
                                    <div className="flex justify-between text-muted-foreground">
                                        <span>SB: ₱{src.sbPrice.toLocaleString()}/bag × {sbQty}</span>
                                        <span className="font-medium text-foreground">
                                            ₱{(src.sbPrice * sbQty).toLocaleString()}
                                        </span>
                                    </div>
                                )}
                                <div className="flex justify-between font-semibold text-sm pt-1 border-t border-border">
                                    <span>Subtotal</span>
                                    <span className="text-primary">₱{subtotal.toLocaleString()}</span>
                                </div>
                            </div>
                        </Label>
                    );
                })}
            </RadioGroup>

            {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
    );
}
