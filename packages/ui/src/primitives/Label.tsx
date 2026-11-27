import type { JSX } from "react";

import { cn } from "../lib/cn";

/** Property-row label (Inter 12px, `#475569`). */
export function Label({ className, ...props }: JSX.IntrinsicElements["label"]) {
  return (
    <label className={cn("text-[12px] font-normal text-ink-secondary", className)} {...props} />
  );
}
