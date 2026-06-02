"use client";

import { Building2, User } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface StepAccountTypeProps {
    value: string;
    onChange: (value: "individual" | "company") => void;
    error?: string;
}

export function StepAccountType({ value, onChange, error }: StepAccountTypeProps) {
    return (
        <div className="space-y-4">
            <div className="space-y-1">
                <h2 className="text-xl font-semibold tracking-tight text-foreground">
                    Choose account type
                </h2>
                <p className="text-sm text-muted-foreground">
                    Select how you want to register. This determines the fields and documents required.
                </p>
            </div>

            <RadioGroup
                value={value}
                onValueChange={(v) => onChange(v as "individual" | "company")}
                className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            >
                {[
                    {
                        key: "individual" as const,
                        icon: User,
                        title: "Individual",
                        description: "Personal account for individual clients",
                    },
                    {
                        key: "company" as const,
                        icon: Building2,
                        title: "Company",
                        description: "Business account for corporate clients",
                    },
                ].map((opt) => (
                    <Label
                        key={opt.key}
                        htmlFor={opt.key}
                        className={`
                            flex items-start gap-3 rounded-lg border-2 p-4 cursor-pointer transition-all
                            ${value === opt.key ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/40 hover:bg-muted/30"}
                        `}
                    >
                        <RadioGroupItem value={opt.key} id={opt.key} className="mt-0.5" />
                        <div className="flex items-start gap-3">
                            <div
                                className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                    value === opt.key ? "bg-primary/10" : "bg-muted"
                                }`}
                            >
                                <opt.icon
                                    className={`w-5 h-5 ${value === opt.key ? "text-primary" : "text-muted-foreground"}`}
                                />
                            </div>
                            <div>
                                <p className="font-semibold text-foreground">{opt.title}</p>
                                <p className="text-sm text-muted-foreground leading-snug mt-0.5">
                                    {opt.description}
                                </p>
                            </div>
                        </div>
                    </Label>
                ))}
            </RadioGroup>

            {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
    );
}
