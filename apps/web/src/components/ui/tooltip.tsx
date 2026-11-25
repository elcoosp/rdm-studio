import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";

import { cn } from "@/lib/cn";

/** Overlay tooltip: 8px radius, soft shadow reserved for overlays. */
export function TooltipProvider(props: TooltipPrimitive.Provider.Props) {
  return <TooltipPrimitive.Provider delay={250} {...props} />;
}

export function TooltipRoot(props: TooltipPrimitive.Root.Props) {
  return <TooltipPrimitive.Root {...props} />;
}

export const TooltipTrigger = TooltipPrimitive.Trigger;

export function TooltipContent({
  className,
  children,
  sideOffset = 6,
}: {
  className?: string;
  children?: React.ReactNode;
  sideOffset?: number;
}) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner sideOffset={sideOffset}>
        <TooltipPrimitive.Popup
          className={cn(
            "rounded-[8px] border border-hairline bg-panel px-2 py-1 text-[11px] text-ink-primary shadow-[0_8px_24px_rgba(15,23,42,0.08)]",
            className,
          )}
        >
          {children}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}
