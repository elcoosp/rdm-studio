import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "../lib/cn";

/** Settings switch (Base UI): hairline track, cobalt when on. */
export function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "flex h-4.5 w-8 items-center rounded-full border border-hairline bg-panel-subtle p-0.5 transition-colors data-[checked]:border-accent data-[checked]:bg-accent",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="size-3 rounded-full border-hairline bg-panel shadow-none transition-transform data-[checked]:translate-x-3.5" />
    </SwitchPrimitive.Root>
  );
}
