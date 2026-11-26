import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Searchable picker (Base UI Combobox) for the EN 10365/10210/10056
 * catalog with live SVG cross-section icons and mono designations.
 */
export function ComboboxRoot<T>(props: ComboboxPrimitive.Root.Props<T>) {
  return <ComboboxPrimitive.Root {...props} />;
}

export function ComboboxInput({ className, placeholder, ...props }: ComboboxPrimitive.Input.Props) {
  return (
    <ComboboxPrimitive.Input
      placeholder={placeholder ?? "Rechercher un profilé…"}
      className={cn(
        "font-data h-[30px] w-full rounded-[4px] border border-hairline bg-panel px-2 text-[12px] text-ink-primary placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-ring",
        className,
      )}
      {...props}
    />
  );
}

export function ComboboxTrigger({ className, ...props }: ComboboxPrimitive.Trigger.Props) {
  return (
    <ComboboxPrimitive.Trigger
      className={cn(
        "flex h-[30px] w-full items-center justify-between gap-1 rounded-[4px] border border-hairline bg-panel px-2 text-left text-[13px] text-ink-primary",
        className,
      )}
      {...props}
    />
  );
}

export function ComboboxContent<T>({
  className,
  children,
  renderItem,
  ...props
}: Omit<ComboboxPrimitive.Popup.Props, "children"> & {
  /** Static nodes OR the items render function (Root needs `items`). */
  children?: ReactNode;
  renderItem?: (item: T) => ReactNode;
}) {
  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner sideOffset={4} className="z-50">
        <ComboboxPrimitive.Popup
          className={cn(
            "max-h-80 w-[var(--anchor-width)] overflow-auto rounded-[8px] border border-hairline bg-panel shadow-[0_8px_24px_rgba(15,23,42,0.08)]",
            className,
          )}
          {...props}
        >
          <ComboboxPrimitive.List className="py-1">
            {renderItem !== undefined ? renderItem : children}
          </ComboboxPrimitive.List>
        </ComboboxPrimitive.Popup>
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  );
}

export function ComboboxItem({ className, children, ...props }: ComboboxPrimitive.Item.Props) {
  return (
    <ComboboxPrimitive.Item
      className={cn(
        "flex min-h-8 cursor-default items-center gap-2 px-2 text-[12px] text-ink-primary data-[highlighted]:bg-accent-tint",
        className,
      )}
      {...props}
    >
      {children}
    </ComboboxPrimitive.Item>
  );
}

export function ComboboxEmpty({ className, ...props }: ComboboxPrimitive.Empty.Props) {
  return (
    <ComboboxPrimitive.Empty
      className={cn("px-2 py-3 text-center text-[12px] text-ink-muted", className)}
      {...props}
    />
  );
}
