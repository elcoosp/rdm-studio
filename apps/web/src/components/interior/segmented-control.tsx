"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";

/**
 * SegmentedControl (interior.dev, "The selection travels. Nothing jumps."):
 * one shared spring pill glides between options (`layoutId`-free transform
 * track, zero layout jump), the label inverts through it via a masked
 * counter-scroll, and the whole control is a roving `radiogroup`.
 * Themed strictly with the Swiss Metrology daylight tokens: white active
 * card, cobalt active text, hairline borders — zero dark classes.
 */

const CELL = { type: "spring", stiffness: 520, damping: 34, mass: 0.45 } as const;

const SEG =
  "px-3 py-[7px] text-center text-[13px] font-medium leading-[18px] tracking-[-0.01em] whitespace-nowrap";

export type SegmentedOption = {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
  /** Optional per-option contract test id (E2E data-testid). */
  testId?: string;
};

export type SegmentedControlProps = {
  options: SegmentedOption[];
  label: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  /** `sm` fits the 28px studio header rows (h-7). */
  size?: "sm" | "md";
};

export function SegmentedControl({
  options,
  label,
  value,
  defaultValue,
  onValueChange,
  className = "",
  size = "md",
}: SegmentedControlProps): React.ReactElement {
  const count = Math.max(1, options.length);
  const template = `repeat(${count}, minmax(auto, 1fr))`;
  const segClass =
    size === "sm"
      ? "px-1.5 py-[3px] text-center text-[11.5px] font-medium leading-[18px] tracking-[-0.01em] whitespace-nowrap"
      : SEG;

  const [internal, setInternal] = useState(() => defaultValue ?? options[0]?.value ?? "");
  const [hovered, setHovered] = useState(-1);

  const controlled = value !== undefined;
  const current = controlled ? value : internal;
  const found = options.findIndex((o) => o.value === current);
  const index = found < 0 ? 0 : found;

  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const emit = useRef(onValueChange);
  emit.current = onValueChange;

  const reduced = useReducedMotion();
  const pos = useMotionValue(index);
  const thumbX = useTransform(pos, (v) => `${v * 100}%`);
  const maskX = useTransform(pos, (v) => `${v * -100}%`);

  useEffect(() => {
    if (reduced) {
      pos.set(index);
      return;
    }
    const controls = animate(pos, index, CELL);
    return () => controls.stop();
  }, [index, reduced, pos]);

  const select = useCallback(
    (next: string) => {
      if (!controlled) setInternal(next);
      if (next !== current) emit.current?.(next);
    },
    [controlled, current],
  );

  const seek = useCallback(
    (from: number, dir: number) => {
      let i = from;
      for (let k = 0; k < count; k++) {
        i = (i + dir + count) % count;
        if (!options[i]?.disabled) return i;
      }
      return from;
    },
    [count, options],
  );

  const go = useCallback(
    (i: number) => {
      const option = options[i];
      if (!option || option.disabled) return;
      buttons.current[i]?.focus();
      select(option.value);
    },
    [options, select],
  );

  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      go(seek(i, 1));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      go(seek(i, -1));
    } else if (e.key === "Home") {
      e.preventDefault();
      go(seek(count - 1, 1));
    } else if (e.key === "End") {
      e.preventDefault();
      go(seek(0, -1));
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`relative inline-block select-none rounded-[6px] border border-hairline bg-panel-subtle/70 p-0.5 ${className}`}
    >
      <div
        className="relative grid"
        style={{ gridTemplateColumns: template, touchAction: "manipulation" }}
      >
        {options.map((option, i) => (
          <span
            key={option.value}
            aria-hidden
            className={`${segClass} pointer-events-none ${
              option.disabled
                ? "text-ink-muted/60"
                : hovered === i && i !== index
                  ? "text-ink-primary"
                  : "text-ink-secondary"
            }`}
          >
            {option.label}
          </span>
        ))}

        {/* The shared spring pill: a white card with a crisp hairline ring
            that glides under the active option — nothing else moves. */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 overflow-hidden rounded-[4px] bg-panel shadow-[0_0_0_1px_var(--color-hairline)]"
          style={{ width: `${100 / count}%`, x: thumbX }}
          initial={false}
        >
          <motion.div className="absolute inset-0" style={{ x: maskX }} initial={false}>
            <div
              className="absolute inset-y-0 left-0 grid"
              style={{ width: `${count * 100}%`, gridTemplateColumns: template }}
            >
              {options.map((option) => (
                <span key={option.value} className={`${segClass} font-semibold text-accent`}>
                  {option.label}
                </span>
              ))}
            </div>
          </motion.div>
        </motion.div>
        <div
          className="absolute inset-0 grid"
          style={{ gridTemplateColumns: template }}
          onPointerLeave={() => setHovered(-1)}
        >
          {options.map((option, i) => (
            <button
              key={option.value}
              ref={(node) => {
                buttons.current[i] = node;
              }}
              type="button"
              role="radio"
              aria-checked={i === index}
              aria-disabled={option.disabled || undefined}
              tabIndex={i === index ? 0 : -1}
              data-testid={option.testId}
              onClick={() => !option.disabled && select(option.value)}
              onKeyDown={(e) => onKeyDown(e, i)}
              onPointerEnter={() => !option.disabled && setHovered(i)}
              className="cursor-default rounded-[4px] outline-none focus-visible:shadow-[inset_0_0_0_1px_var(--color-accent-ring)]"
            >
              <span className="sr-only">{option.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
