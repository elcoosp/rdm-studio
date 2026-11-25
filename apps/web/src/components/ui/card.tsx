import type { JSX } from "react";

import { cn } from "@/lib/cn";

/** Flat hairline card (zero drop shadows, DESIGN.md §5). */
export function Card({ className, ...props }: JSX.IntrinsicElements["div"]) {
  return <div className={cn("rounded-panel border-hairline bg-panel p-3", className)} {...props} />;
}

export function CardTitle({ className, ...props }: JSX.IntrinsicElements["h3"]) {
  return <h3 className={cn("text-[13px] font-semibold text-ink-primary", className)} {...props} />;
}

export function CardBody({ className, ...props }: JSX.IntrinsicElements["div"]) {
  return <div className={cn("mt-1.5 text-[12px] text-ink-secondary", className)} {...props} />;
}
