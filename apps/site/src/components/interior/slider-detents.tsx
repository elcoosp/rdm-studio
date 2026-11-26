"use client";

import { useId, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { Slider as SliderPrimitive } from "@base-ui/react/slider";

import { cn } from "../../lib/cn";

/**
 * SliderDetents (interior.dev, "Stops you can feel."): a precision slider
 * with MAGNETIC detents — while dragging, the value snaps to any detent
 * inside the magnetic radius (fraction of the track) with a tactile
 * haptic tick, and the active detent pip pops. Used for the Step 4
 * cutting-plane scrubber `x ∈ [0, L]` with detents at
 * `0 · 0,25 L · 0,50 L · 0,75 L · 1,00 L`.
 */

export type SliderDetentsProps = {
  value: number;
  onValueChange: (value: number) => void;
  /** Normalised (0..1) detent stops. */
  detents?: number[];
  /** Fraction of the track inside which a detent attracts the thumb. */
  magnetRadius?: number;
  min?: number;
  max?: number;
  step?: number;
  /** Accessible name for the slider control. */
  label?: string;
  className?: string;
  formatValue?: (value: number) => string;
};

export function SliderDetents({
  value,
  onValueChange,
  detents = [0, 0.25, 0.5, 0.75, 1],
  magnetRadius = 0.018,
  min = 0,
  max = 1,
  step = 0.01,
  label,
  className,
  formatValue,
}: SliderDetentsProps): React.ReactElement {
  const id = useId();
  const trackRef = useRef<HTMLSpanElement>(null);
  const [activeDetent, setActiveDetent] = useState<number | null>(null);
  const lastHaptic = useRef(0);

  const snaps = useMemo(() => detents.filter((d) => d >= min && d <= max), [detents, min, max]);

  // Magnetic pull: while the pointer rides the track, a detent inside the
  // radius wins over the raw value (magnetism, not coercion — the moment
  // the pointer leaves the radius the raw value flows again).
  const magnetize = (raw: number): number => {
    let best: number | null = null;
    for (const detent of snaps) {
      if (Math.abs(raw - detent) <= magnetRadius) {
        best = detent;
        break;
      }
    }
    setActiveDetent(best);
    if (best !== null) {
      const now = performance.now();
      if (now - lastHaptic.current > 60) {
        lastHaptic.current = now;
        navigator.vibrate?.(8);
      }
      return best;
    }
    return raw;
  };

  const emit = (raw: number) => {
    onValueChange(magnetize(raw));
  };

  // Keyboard: arrow keys hop detent to detent directly (a crisp, felt stop).
  const nearestDetent = (v: number): number => {
    let best = v;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const detent of snaps) {
      const dist = Math.abs(detent - v);
      if (dist < bestDist) {
        bestDist = dist;
        best = detent;
      }
    }
    return best;
  };

  const percent = ((value - min) / (max - min)) * 100;

  return (
    <div className={cn("flex w-full items-center gap-2", className)}>
      <SliderPrimitive.Root
        value={value}
        min={min}
        max={max}
        step={step}
        aria-label={label}
        onValueChange={(next) => {
          if (typeof next === "number") emit(next);
        }}
        className="flex min-w-0 flex-1 items-center"
      >
        <SliderPrimitive.Control
          className="flex h-5 w-full touch-none items-center"
          aria-labelledby={id}
        >
          <span ref={trackRef} className="relative h-1 w-full rounded-full bg-panel-subtle">
            <SliderPrimitive.Indicator className="h-1 rounded-full bg-accent" />
            {/* Detent pips: felt stops rendered as metric ticks. */}
            {snaps.map((detent) => {
              const left = ((detent - min) / (max - min)) * 100;
              const active = activeDetent === detent || Math.abs(value - detent) < 1e-9;
              return (
                <motion.span
                  key={detent}
                  aria-hidden
                  className={cn(
                    "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full",
                    active ? "bg-accent" : "bg-border-subtle",
                  )}
                  style={{ left: `${left}%` }}
                  animate={{ height: active ? 10 : 6, width: active ? 10 : 6 }}
                  transition={{ type: "spring", stiffness: 520, damping: 34, mass: 0.45 }}
                />
              );
            })}
            <SliderPrimitive.Thumb
              className="size-3.5 rounded-full border border-accent bg-panel shadow-[0_0_0_1px_var(--color-hairline)]"
              onKeyDown={(event) => {
                const detent = nearestDetent(value);
                const index = snaps.indexOf(detent);
                if (event.key === "ArrowRight" && index >= 0 && index < snaps.length - 1) {
                  event.preventDefault();
                  onValueChange(snaps[index + 1] ?? value);
                }
                if (event.key === "ArrowLeft" && index > 0) {
                  event.preventDefault();
                  onValueChange(snaps[index - 1] ?? value);
                }
              }}
            />
          </span>
        </SliderPrimitive.Control>
      </SliderPrimitive.Root>
      <span id={id} className="font-data w-14 shrink-0 text-right text-[11px] text-ink-secondary">
        {formatValue !== undefined ? formatValue(value) : `${percent.toFixed(0)} %`}
      </span>
    </div>
  );
}
