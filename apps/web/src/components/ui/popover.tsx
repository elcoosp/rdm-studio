import { Popover as PopoverPrimitive } from "@base-ui/react/popover";

import { cn } from "@/lib/cn";

/** Non-trapping popover (Base UI) for legend/help readouts and the
 * normative `Réglages` settings — portal-rendered so it can NEVER be
 * clipped by the `<header>` (v2.1.2 audit fix). */
export const PopoverRoot = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverClose = PopoverPrimitive.Close;

export function PopoverContent({
  className,
  children,
  sideOffset = 6,
  align = "start",
  ...props
}: PopoverPrimitive.Popup.Props & { sideOffset?: number; align?: "start" | "center" | "end" }) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner sideOffset={sideOffset} align={align} className="z-50">
        <PopoverPrimitive.Popup
          className={cn(
            "w-72 rounded-[8px] border border-hairline bg-panel p-3 shadow-[0_8px_24px_rgba(15,23,42,0.08)]",
            "data-[open]:animate-in data-[open]:fade-in-0 data-[open]:zoom-in-95",
            "data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95",
            className,
          )}
          {...props}
        >
          {children}
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}
