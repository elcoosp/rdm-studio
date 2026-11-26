import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { Check } from "lucide-react";

import { cn } from "@/lib/cn";

/** Project switcher menu (Base UI Menu, DESIGN.md §4 header). */
export const DropdownMenuRoot = MenuPrimitive.Root;
export const DropdownMenuTrigger = MenuPrimitive.Trigger;

export function DropdownMenuContent({ className, children, ...props }: MenuPrimitive.Popup.Props) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner sideOffset={4} className="z-50">
        <MenuPrimitive.Popup
          className={cn(
            "min-w-52 rounded-[8px] border border-hairline bg-panel py-1 shadow-[0_8px_24px_rgba(15,23,42,0.08)]",
            "data-[open]:animate-in data-[open]:fade-in-0 data-[open]:zoom-in-95",
            "data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95",
            className,
          )}
          {...props}
        >
          {children}
        </MenuPrimitive.Popup>
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({ className, children, ...props }: MenuPrimitive.Item.Props) {
  return (
    <MenuPrimitive.Item
      className={cn(
        "flex min-h-8 cursor-default items-center gap-2 px-2 text-[13px] text-ink-primary data-[highlighted]:bg-accent-tint data-[highlighted]:text-accent",
        className,
      )}
      {...props}
    >
      {children}
    </MenuPrimitive.Item>
  );
}

export function DropdownMenuCheckboxItem({
  className,
  children,
  ...props
}: MenuPrimitive.CheckboxItem.Props) {
  return (
    <MenuPrimitive.CheckboxItem
      className={cn(
        "flex min-h-8 cursor-default items-center gap-2 px-2 text-[13px] text-ink-primary data-[highlighted]:bg-accent-tint",
        className,
      )}
      {...props}
    >
      <MenuPrimitive.CheckboxItemIndicator className="text-[11px] text-accent">
        <Check size={12} strokeWidth={1.5} aria-hidden />
      </MenuPrimitive.CheckboxItemIndicator>
      {children}
    </MenuPrimitive.CheckboxItem>
  );
}

export function DropdownMenuLabel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-2 py-1 text-[11px] text-ink-muted", className)} {...props} />;
}

export function DropdownMenuSeparator({ className, ...props }: MenuPrimitive.Separator.Props) {
  return <MenuPrimitive.Separator className={cn("my-1 h-px bg-hairline", className)} {...props} />;
}
