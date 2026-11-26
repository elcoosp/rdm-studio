import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu";

import { cn } from "@/lib/cn";

/**
 * Right-click context menu (Base UI) for the 3D stage — portal-rendered
 * at the pointer position, daylight chrome (white panel, hairline border,
 * 8px radius, soft overlay shadow).
 */
export const ContextMenuRoot = ContextMenuPrimitive.Root;
export const ContextMenuTrigger = ContextMenuPrimitive.Trigger;

export function ContextMenuContent({
  className,
  children,
  ...props
}: ContextMenuPrimitive.Popup.Props) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Positioner className="z-[70]">
        <ContextMenuPrimitive.Popup
          className={cn(
            "min-w-52 origin-[var(--transform-origin)] rounded-[8px] border border-hairline bg-panel py-1 text-[13px] shadow-[0_8px_24px_rgba(15,23,42,0.12)] outline-none",
            "data-[open]:animate-in data-[open]:fade-in-0 data-[open]:zoom-in-95",
            "data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95",
            className,
          )}
          {...props}
        >
          {children}
        </ContextMenuPrimitive.Popup>
      </ContextMenuPrimitive.Positioner>
    </ContextMenuPrimitive.Portal>
  );
}

export function ContextMenuItem({
  className,
  children,
  ...props
}: ContextMenuPrimitive.Item.Props) {
  return (
    <ContextMenuPrimitive.Item
      className={cn(
        "flex cursor-default list-none items-center gap-2 px-3 py-1.5 text-[12px] text-ink-primary outline-none data-[highlighted]:bg-accent-tint data-[highlighted]:text-accent data-[disabled]:opacity-40",
        className,
      )}
      {...props}
    >
      {children}
    </ContextMenuPrimitive.Item>
  );
}

export function ContextMenuSeparator({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <ContextMenuPrimitive.Separator className={cn("my-1 h-px bg-hairline", className)} {...props} />
  );
}

export function ContextMenuLabel({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("px-3 py-1 text-[11px] font-medium tracking-wide text-ink-muted", className)}
      {...props}
    >
      {children}
    </div>
  );
}
