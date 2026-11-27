import type { HTMLAttributes, ForwardRefExoticComponent, RefAttributes } from "react";
import { cn } from "../lib/cn";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "pass" | "fail" | "warn" | "neutral";
  mono?: boolean;
  size?: "sm" | "md";
}

const badgeVariants = {
  pass: "bg-pass-bg border-pass-border text-pass-text",
  fail: "bg-fail-bg border-fail-border text-fail-text",
  warn: "bg-warn-bg border-warn-border text-warn-text",
  neutral: "bg-panel-subtle border-hairline text-ink-secondary",
};

const badgeSizes = {
  sm: "px-1.5 py-0 text-[10px]",
  md: "px-2 py-0.5 text-[11px]",
};

export const Badge = Object.assign(
  (({
    className,
    variant = "neutral",
    mono = false,
    size = "md",
    children,
    ...props
  }: BadgeProps) => (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[2px] border font-medium",
        "font-variant-numeric:tabular-nums",
        badgeVariants[variant],
        badgeSizes[size],
        mono && "font-mono",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )) as ForwardRefExoticComponent<BadgeProps & RefAttributes<HTMLSpanElement>>,
  { displayName: "Badge" },
);