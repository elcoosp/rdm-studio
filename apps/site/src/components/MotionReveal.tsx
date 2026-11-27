"use client";

import { motion, useReducedMotion } from "motion/react";
import type { JSX } from "react";

/**
 * MotionReveal (v2.3.0) — Swiss Metrology scroll-reveal choreography.
 *
 * A lightweight client wrapper around `motion/react` that reveals Bento
 * cards, proof-strip metrics and section entrances smoothly. The `initial`
 * state is deliberately near-final (`opacity: 0.96, y: 12`) so static
 * crawlers and non-JS screenshots see 100 % legible content immediately;
 * `useReducedMotion()` is honored and collapses the animation to identity.
 */

interface MotionRevealProps {
  children: React.ReactNode;
  className?: string;
  /** Reveal once when entering the viewport (default true). */
  once?: boolean;
  /** Intersection margin for the reveal trigger. */
  margin?: string;
}

export function MotionReveal({
  children,
  className,
  once = true,
  margin = "-40px",
}: MotionRevealProps): JSX.Element {
  const reduced = useReducedMotion();
  const still = { opacity: 1, y: 0 };
  const reveal = {
    initial: { opacity: 0.96, y: 12 },
    whileInView: { opacity: 1, y: 0 },
  } as const;

  return (
    <motion.div
      className={className}
      initial={reduced ? still : reveal.initial}
      whileInView={reduced ? still : reveal.whileInView}
      viewport={reduced ? undefined : { once, margin }}
    >
      {children}
    </motion.div>
  );
}
