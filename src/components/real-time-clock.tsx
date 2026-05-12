"use client";

import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

export function RealTimeClock() {
    const [time, setTime] = useState<Date | null>(null);

    useEffect(() => {
        setTime(new Date());
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    if (!time) return null;

    return (
        <div className="px-4 py-3 bg-sidebar-accent/30 rounded-lg border border-sidebar-border/50">
            <div className="flex items-center gap-2 text-[var(--color-industrial-blue)] mb-1">
                <Clock className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-wider">System Time</span>
            </div>
            <div className="space-y-0.5">
                <p className="text-sm font-semibold text-sidebar-foreground tabular-nums">
                    {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </p>
                <p className="text-[10px] text-sidebar-foreground/60 font-medium">
                    {time.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
            </div>
        </div>
    );
}
