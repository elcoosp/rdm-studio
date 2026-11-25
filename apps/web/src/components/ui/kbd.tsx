import type { JSX } from "react";

import { cn } from "@/lib/cn";

/** JetBrains Mono keycap chip (`⌘K`, `Shift+Click`) with hairline border. */
export function Kbd({ className, ...props }: JSX.IntrinsicElements["kbd"]) {
  return (
    <kbd
      className={cn(
        "font-data inline-flex h-5 min-w-5 items-center justify-center rounded-[2px] border border-hairline bg-panel px-1 text-[11px] text-ink-secondary",
        className,
      )}
      {...props}
    />
  );
}
