import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/**
 * shadcn/ui Tabs over Radix — the Step 3 EN 1990 case tabs use the list
 * with a motion layoutId indicator (DESIGN.md §8.6).
 */
export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn("flex items-center gap-1 border-b border-hairline", className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "relative flex min-h-8 items-center gap-1 rounded px-2 py-1 text-[13px] text-ink-secondary data-[state=active]:text-accent",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn("mt-2 focus:outline-none", className)} {...props} />;
}
