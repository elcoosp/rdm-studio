import * as SliderPrimitive from "@radix-ui/react-slider";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** shadcn/ui Slider over Radix (cobalt range, hairline rail). */
export function Slider({ className, ...props }: ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root
      className={cn("relative flex w-full touch-none select-none items-center", className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-panel-subtle">
        <SliderPrimitive.Range className="absolute h-full bg-accent" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block h-3.5 w-3.5 rounded-full border border-accent bg-panel transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-ring disabled:opacity-40" />
    </SliderPrimitive.Root>
  );
}
