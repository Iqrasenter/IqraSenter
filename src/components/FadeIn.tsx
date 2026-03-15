"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

interface FadeInProps {
  children: ReactNode;
  delay?: number;
  className?: string;
  direction?: "up" | "left" | "right";
}

export function FadeIn({
  children,
  delay = 0,
  className,
  direction = "up",
}: FadeInProps) {
  const prefersReducedMotion = useReducedMotion();
  const y = direction === "up" ? 20 : 0;
  const x = direction === "left" ? -20 : direction === "right" ? 20 : 0;

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y, x }}
      whileInView={{ opacity: 1, y: 0, x: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.6, ease: "easeOut", delay: prefersReducedMotion ? 0 : delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
