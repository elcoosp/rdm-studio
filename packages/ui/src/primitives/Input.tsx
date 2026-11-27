import type { JSX } from "react";

import { cn } from "../lib/cn";

/** Text input (DESIGN.md §6): 4px radius, hairline border, mono data font. */
export function Input({ className, ...props }: JSX.IntrinsicElements["input"]) {
  return (
    <input
      className={cn(
        "font-data h-8 w-full rounded-[4px] border border-hairline bg-panel px-2 text-[12px] text-ink-primary placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-ring disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}
