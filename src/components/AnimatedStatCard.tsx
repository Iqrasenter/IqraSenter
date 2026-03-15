"use client";

import { motion, useSpring, useMotionValue, useInView } from "framer-motion";
import { useRef, useEffect } from "react";

interface AnimatedStatCardProps {
  value: string;
  label: string;
}

export function AnimatedStatCard({ value, label }: AnimatedStatCardProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });
  const num = parseInt(value);
  const suffix = value.replace(/\d+/, "");
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { stiffness: 50, damping: 20 });

  useEffect(() => {
    if (isInView) motionVal.set(num);
  }, [isInView, motionVal, num]);

  useEffect(() => {
    const unsub = spring.on("change", (v) => {
      if (ref.current) ref.current.textContent = Math.round(v) + suffix;
    });
    return unsub;
  }, [spring, suffix]);

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <span
        ref={ref}
        className="font-heading text-4xl lg:text-6xl font-extrabold text-white"
      >
        0{suffix}
      </span>
      <span className="text-sm lg:text-base text-white/80 font-medium mt-1">
        {label}
      </span>
    </div>
  );
}
