"use client";

import { useEffect, useRef, useState } from "react";
import { STATS } from "@/lib/constants";

interface StatsBarProps {
  compact?: boolean;
}

export function StatsBar({ compact = false }: StatsBarProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`grid grid-cols-2 ${compact ? "lg:grid-cols-4 gap-3 lg:gap-0 lg:divide-x lg:divide-border/60" : "lg:grid-cols-4 gap-4 lg:gap-0 lg:divide-x lg:divide-border/60"}`}
    >
      {STATS.map((stat, i) => (
        <div
          key={stat.label}
          className={`flex flex-col items-center ${compact ? "py-3 px-2" : "py-6 px-4"} rounded-2xl lg:rounded-none transition-all duration-700 ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
          style={{ transitionDelay: `${i * 120}ms` }}
        >
          <span className={`font-heading font-extrabold gradient-text leading-none ${compact ? "text-2xl lg:text-3xl" : "text-4xl lg:text-5xl"}`}>
            {stat.value}
          </span>
          <span className={`font-medium text-text-muted text-center ${compact ? "mt-1 text-xs" : "mt-2 text-sm"}`}>
            {stat.label}
          </span>
        </div>
      ))}
    </div>
  );
}
