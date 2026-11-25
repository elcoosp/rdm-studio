import type { JSX } from "react";

import { cn } from "@/lib/cn";

/**
 * Status alert (DESIGN.md §6 badges at surface scale): `pass` uses the
 * emerald pair, `fail` the crimson pair, `info` the cobalt tint.
 */
const TONES = {
  pass: "border-pass-border bg-pass-bg text-pass-text",
  fail: "border-fail-border bg-fail-bg text-fail-text",
  info: "border-accent-ring bg-accent-tint text-accent",
} as const;

export function Alert({
  tone = "info",
  className,
  ...props
}: JSX.IntrinsicElements["div"] & { tone?: keyof typeof TONES }) {
  return (
    <div
      role="status"
      className={cn(
        "rounded-[4px] border px-2.5 py-2 text-[12px] leading-4",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
