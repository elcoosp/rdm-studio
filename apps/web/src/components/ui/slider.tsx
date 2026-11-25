import { Slider as SliderPrimitive } from "@base-ui/react/slider";

import { cn } from "@/lib/cn";

/** Numeric slider (amplification, snap tolerance): cobalt thumb. */
export function Slider({ className, ...props }: SliderPrimitive.Root.Props) {
  return (
    <SliderPrimitive.Root className={cn("flex w-full items-center", className)} {...props}>
      <SliderPrimitive.Control className="flex h-4 w-full items-center">
        <span className="h-1 w-full rounded-full border-hairline bg-panel-subtle">
          <SliderPrimitive.Indicator className="h-1 rounded-full bg-accent" />
        </span>
        <SliderPrimitive.Thumb className="size-3.5 rounded-full border border-accent bg-panel" />
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}
