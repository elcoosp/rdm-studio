import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";

import { cn } from "../lib/cn";

/** Nav tabs with the 2px cobalt active underline (DESIGN.md §6). */
export function TabsRoot({ className, ...props }: TabsPrimitive.Root.Props) {
  return <TabsPrimitive.Root className={cn("flex flex-col", className)} {...props} />;
}

export function TabsList({ className, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      className={cn("flex items-center gap-1 border-b border-hairline", className)}
      {...props}
    />
  );
}

export function Tab({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      className={cn(
        "relative flex min-h-8 items-center rounded px-2.5 text-[13px] text-ink-secondary data-[selected]:text-accent",
        className,
      )}
      {...props}
    />
  );
}

export function TabIndicator({ className, ...props }: TabsPrimitive.Indicator.Props) {
  return (
    <TabsPrimitive.Indicator
      className={cn("absolute inset-x-1 bottom-0 h-[2px] bg-accent", className)}
      {...props}
    />
  );
}

export function TabPanel({ className, ...props }: TabsPrimitive.Panel.Props) {
  return <TabsPrimitive.Panel className={cn("pt-2", className)} {...props} />;
}
