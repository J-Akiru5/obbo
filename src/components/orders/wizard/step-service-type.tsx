"use client";

import { Car, Truck } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface StepServiceTypeProps {
    value: string;
    onChange: (value: "pickup" | "deliver") => void;
    driverName: string;
    plateNumber: string;
    pickupDate: string;
    onFieldChange: (field: string, value: string) => void;
    errors: Record<string, string>;
}

export function StepServiceType({
    value,
    onChange,
    driverName,
    plateNumber,
    pickupDate,
    onFieldChange,
    errors,
}: StepServiceTypeProps) {
    return (
        <div className="space-y-5">
            <div className="space-y-1">
                <h2 className="text-xl font-semibold tracking-tight text-foreground">
                    Service type
                </h2>
                <p className="text-sm text-muted-foreground">
                    Choose how you want to receive your order.
                </p>
            </div>

            <RadioGroup
                value={value}
                onValueChange={(v) => onChange(v as "pickup" | "deliver")}
                className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            >
                {[
                    {
                        key: "pickup" as const,
                        icon: Car,
                        title: "Pick up",
                        description: "Pick up from warehouse/port with your own vehicle",
                    },
                    {
                        key: "deliver" as const,
                        icon: Truck,
                        title: "Deliver",
                        description: "Delivered to your specified location",
                    },
                ].map((opt) => (
                    <Label
                        key={opt.key}
                        htmlFor={`service-${opt.key}`}
                        className={`
                            flex items-start gap-3 rounded-lg border-2 p-4 cursor-pointer transition-all
                            ${value === opt.key
                                ? "border-primary bg-primary/5 shadow-sm"
                                : "border-border hover:border-primary/40 hover:bg-muted/30"}
                        `}
                    >
                        <RadioGroupItem value={opt.key} id={`service-${opt.key}`} className="mt-0.5" />
                        <div className="flex items-start gap-3">
                            <div
                                className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                    value === opt.key ? "bg-primary/10" : "bg-muted"
                                }`}
                            >
                                <opt.icon
                                    className={`w-5 h-5 ${value === opt.key ? "text-primary" : "text-muted-foreground"}`}
                                />
                            </div>
                            <div>
                                <p className="font-semibold text-foreground">{opt.title}</p>
                                <p className="text-sm text-muted-foreground leading-snug">
                                    {opt.description}
                                </p>
                            </div>
                        </div>
                    </Label>
                ))}
            </RadioGroup>

            {/* Pick-up fields */}
            {value === "pickup" && (
                <div className="p-4 border border-amber-500/20 bg-amber-500/5 rounded-lg space-y-4">
                    <h4 className="text-sm font-bold text-amber-600 uppercase tracking-tight flex items-center gap-2">
                        <Car className="w-4 h-4" />
                        Pick-up details
                    </h4>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <Label htmlFor="driver_name" className="text-sm font-medium text-amber-700">
                                Driver name <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="driver_name"
                                value={driverName}
                                onChange={(e) => onFieldChange("driver_name", e.target.value)}
                                placeholder="Name of driver"
                                className="h-11 mt-1.5 border-amber-500/20"
                            />
                            {errors.driver_name && (
                                <p className="text-sm text-destructive mt-1">{errors.driver_name}</p>
                            )}
                        </div>
                        <div>
                            <Label htmlFor="plate_number" className="text-sm font-medium text-amber-700">
                                Plate number <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="plate_number"
                                value={plateNumber}
                                onChange={(e) => onFieldChange("plate_number", e.target.value)}
                                placeholder="Vehicle plate"
                                className="h-11 mt-1.5 border-amber-500/20"
                            />
                            {errors.plate_number && (
                                <p className="text-sm text-destructive mt-1">{errors.plate_number}</p>
                            )}
                        </div>
                        <div className="sm:col-span-2">
                            <Label htmlFor="pickup_date" className="text-sm font-medium text-amber-700">
                                Preferred pick-up date
                            </Label>
                            <Input
                                id="pickup_date"
                                type="date"
                                value={pickupDate}
                                onChange={(e) => onFieldChange("preferred_pickup_date", e.target.value)}
                                className="h-11 mt-1.5 border-amber-500/20"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Deliver note */}
            {value === "deliver" && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                    <p className="font-semibold">Delivery orders</p>
                    <p className="mt-1">
                        The shipping fee will be calculated and added by the warehouse manager after your order is approved.
                    </p>
                </div>
            )}

            {errors.service_type && <p className="text-sm text-destructive">{errors.service_type}</p>}
        </div>
    );
}
