"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/cn";

/**
 * StatusBadge (interior.dev-style animated state pill): the pill swaps its
 * tone with a 180 ms cross-fade + subtle width glide, so EC3 compliance
 * (`Conforme EC3` / `Dépassement EC3`), kinematic degree (`Isostatique` /
 * `Hypostatique`) and the license edition read as one living instrument.
 * Daylight tokens: pass/fail/warn/accent tint backgrounds, 2px radius.
 */

export type StatusTone = "pass" | "fail" | "warn" | "accent" | "neutral";

const TONES: Record<StatusTone, string> = {
  pass: "border-pass-border bg-pass-bg text-pass-text",
  fail: "border-fail-border bg-fail-bg text-fail-text",
  warn: "border-fea-warn/50 bg-fea-warn/10 text-ink-secondary",
  accent: "border-accent bg-accent-tint text-accent",
  neutral: "border-hairline bg-panel-subtle text-ink-secondary",
};

export type StatusBadgeProps = {
  tone: StatusTone;
  children: React.ReactNode;
  className?: string;
  testId?: string;
  /** JetBrains Mono readout (η values, λcr, degrees). */
  mono?: boolean;
};

export function StatusBadge({
  tone,
  children,
  className,
  testId,
  mono = false,
}: StatusBadgeProps): React.ReactElement {
  const reduced = useReducedMotion();
  return (
    // The contract test id lives on a STABLE outer span — the animated
    // inner pill cross-fades between tones without ever duplicating the
    // testid (the `519229b` E2E strict-mode guard).
    <span data-testid={testId} className={cn("inline-flex", className)}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={tone}
          initial={reduced ? false : { opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-[2px] border px-1.5 py-0.5 text-[11px] font-medium leading-none",
            mono && "font-data [font-variant-numeric:tabular-nums]",
            TONES[tone],
          )}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
