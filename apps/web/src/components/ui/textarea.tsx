import type { JSX } from "react";

import { cn } from "@/lib/cn";

/** Multiline input sharing the control chrome of `Input`. */
export function Textarea({ className, ...props }: JSX.IntrinsicElements["textarea"]) {
  return (
    <textarea
      className={cn(
        "font-data min-h-16 w-full rounded-[4px] border border-hairline bg-panel px-2 py-1.5 text-[12px] text-ink-primary placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-ring",
        className,
      )}
      {...props}
    />
  );
}
