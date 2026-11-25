import * as SelectPrimitive from "@radix-ui/react-select";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/**
 * shadcn/ui Select over Radix (DESIGN.md: closed single-line control,
 * 4px radius, 1px hairline, cobalt focus ring).
 */
export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export function SelectTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        "flex h-8 w-full items-center justify-between gap-1 rounded-[4px] border border-hairline bg-panel px-2 text-[13px] text-ink-primary data-[placeholder]:text-ink-muted focus:outline-2 focus:outline-offset-1 focus:outline-accent-ring disabled:opacity-40 [&>span]:truncate",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-ink-muted" aria-hidden>
          <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({
  className,
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position="popper"
        sideOffset={4}
        className={cn(
          "z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[4px] border border-hairline bg-panel text-[13px] shadow-[0_8px_24px_rgba(15,23,42,0.08)]",
          className,
        )}
        {...props}
      >
        <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "flex cursor-pointer select-none items-center gap-2 rounded-[4px] px-2 py-1.5 outline-none data-[highlighted]:bg-accent-tint data-[state=checked]:text-accent",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="ml-auto">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden>
          <path d="M20 6 9 17l-5-5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}
