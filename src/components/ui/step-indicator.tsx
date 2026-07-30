'use client';

import { CheckCircle2, ChevronRight } from 'lucide-react';

interface StepIndicatorProps {
  steps: string[];
  currentStep: number;
  completedSteps: Set<number>;
  onStepClick?: (step: number) => void;
}

export function StepIndicator({
  steps,
  currentStep,
  completedSteps,
  onStepClick,
}: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2 sm:gap-2">
      {steps.map((label, idx) => {
        const done = completedSteps.has(idx);
        const active = idx === currentStep;
        const canClick = done && onStepClick;

        return (
          <div key={idx} className="flex flex-shrink-0 items-center gap-1 sm:gap-2">
            <button
              type="button"
              disabled={!canClick}
              onClick={() => canClick && onStepClick(idx)}
              className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold transition-all ${done ? 'bg-industrial-green border-industrial-green text-white' : ''} ${active ? 'bg-primary border-primary text-primary-foreground' : ''} ${!done && !active ? 'bg-background border-border text-muted-foreground' : ''} ${canClick ? 'cursor-pointer hover:scale-110' : 'cursor-default'} `}
            >
              {done ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
            </button>
            <span
              className={`hidden text-xs font-medium transition-colors sm:block sm:text-sm ${
                active ? 'text-foreground' : 'text-muted-foreground'
              }`}
            >
              {label}
            </span>
            {idx < steps.length - 1 && (
              <ChevronRight className="text-muted-foreground/40 h-4 w-4 flex-shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}
