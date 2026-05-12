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
        <div className="px-4 py-4 bg-sidebar-accent/40 rounded-xl border border-sidebar-border shadow-sm">
            <div className="space-y-1">
                <p className="text-2xl font-bold text-white tabular-nums tracking-tight">
                    {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </p>
                <p className="text-xs text-sidebar-foreground font-semibold opacity-90">
                    {time.toLocaleDateString([], { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
            </div>
        </div>
    );
}
