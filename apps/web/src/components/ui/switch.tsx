import * as SwitchPrimitive from "@radix-ui/react-switch";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** shadcn/ui Switch over Radix (cobalt when on, hairline track when off). */
export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "inline-flex h-4.5 w-8 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-ring disabled:opacity-40 data-[state=on]:border-accent data-[state=on]:bg-accent data-[state=off]:border-hairline data-[state=off]:bg-panel-subtle",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block h-3 w-3 rounded-full bg-white shadow-sm transition-transform data-[state=on]:translate-x-[calc(100%+2px)] data-[state=off]:translate-x-0.5" />
    </SwitchPrimitive.Root>
  );
}
