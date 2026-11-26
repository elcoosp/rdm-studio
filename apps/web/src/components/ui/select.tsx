import { Select as SelectPrimitive } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/cn";

/** Closed single-line select (Base UI, DESIGN.md §4): 30px trigger. */
export const SelectRoot = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;

export function SelectTrigger({ className, children, ...props }: SelectPrimitive.Trigger.Props) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        "flex h-[30px] w-full items-center justify-between gap-1 rounded-[4px] border border-hairline bg-panel px-2 text-[13px] text-ink-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-ring",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon className="text-ink-muted">
        <ChevronDown size={12} strokeWidth={1.5} aria-hidden />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({ className, children, ...props }: SelectPrimitive.Popup.Props) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner sideOffset={4} className="z-50">
        <SelectPrimitive.Popup
          className={cn(
            "max-h-72 min-w-[var(--positioner-width)] overflow-auto rounded-[8px] border border-hairline bg-panel py-1 shadow-[0_8px_24px_rgba(15,23,42,0.08)]",
            className,
          )}
          {...props}
        >
          {children}
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

export function SelectItem({ className, children, ...props }: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "flex min-h-8 cursor-default items-center gap-2 px-2 text-[13px] text-ink-primary data-[highlighted]:bg-accent-tint data-[highlighted]:text-accent",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="flex-1">{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="text-[11px] text-accent">
        <Check size={12} strokeWidth={1.5} aria-hidden />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}
