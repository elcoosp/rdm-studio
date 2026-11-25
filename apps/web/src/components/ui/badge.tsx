import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/**
 * shadcn/ui Badge (DESIGN.md §2: 2px radius; EC3 pass/fail variants use
 * the mint/crimson status tokens).
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-[2px] border px-1.5 py-0.5 font-data text-[11px]",
  {
    variants: {
      variant: {
        neutral: "border-hairline bg-panel-subtle text-ink-secondary",
        accent: "border-accent bg-accent-tint text-accent",
        pass: "border-pass-border bg-pass-bg text-pass-text",
        fail: "border-fail-border bg-fail-bg text-fail-text",
        warn: "border-fea-warn/50 bg-fea-warn/10 text-ink-secondary",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export interface BadgeProps extends ComponentProps<"span">, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}

export { badgeVariants };
