"use client";

import { Users, Truck, TrendingUp, Boxes } from "lucide-react";
import { ScrollReveal } from "@/components/scroll-reveal";
import { CountUp } from "@/components/count-up";

const stats = [
  { icon: Users, value: 150, suffix: "+", label: "Active Distributors" },
  { icon: Boxes, value: 50000, suffix: "+", label: "Bags Tracked Monthly" },
  { icon: Truck, value: 1200, suffix: "+", label: "Deliveries Completed" },
  { icon: TrendingUp, value: 99, suffix: "%", label: "Order Accuracy" },
];

export function Stats() {
  return (
    <section className="relative -mt-10 z-10 pb-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {stats.map((s, i) => (
              <div
                key={s.label}
                className="group bg-card rounded-xl border border-border p-6 text-center shadow-lg shadow-black/5 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <s.icon className="w-6 h-6 mx-auto mb-3 text-primary group-hover:scale-110 transition-transform duration-300" />
                <div className="text-2xl sm:text-3xl font-bold text-primary">
                  <CountUp end={s.value} suffix={s.suffix} />
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
