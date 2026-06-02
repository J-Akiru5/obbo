"use client";

import { CheckCircle2, ChevronRight } from "lucide-react";

interface StepIndicatorProps {
    steps: string[];
    currentStep: number;
    completedSteps: Set<number>;
    onStepClick?: (step: number) => void;
}

export function StepIndicator({ steps, currentStep, completedSteps, onStepClick }: StepIndicatorProps) {
    return (
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-2">
            {steps.map((label, idx) => {
                    const done = completedSteps.has(idx);
                    const active = idx === currentStep;
                    const canClick = done && onStepClick;

                    return (
                        <div key={idx} className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                            <button
                                type="button"
                                disabled={!canClick}
                                onClick={() => canClick && onStepClick(idx)}
                                className={`
                                    w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
                                    ${done ? "bg-emerald-500 border-emerald-500 text-white" : ""}
                                    ${active ? "bg-primary border-primary text-primary-foreground" : ""}
                                    ${!done && !active ? "bg-background border-border text-muted-foreground" : ""}
                                    ${canClick ? "cursor-pointer hover:scale-110" : "cursor-default"}
                                `}
                        >
                            {done ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                        </button>
                        <span
                            className={`text-xs sm:text-sm font-medium hidden sm:block transition-colors ${
                                active ? "text-foreground" : "text-muted-foreground"
                            }`}
                        >
                            {label}
                        </span>
                        {idx < steps.length - 1 && (
                            <ChevronRight className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
                        )}
                    </div>
                );
            })}
        </div>
    );
}
