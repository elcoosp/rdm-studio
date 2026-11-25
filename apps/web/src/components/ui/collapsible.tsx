import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";

import { cn } from "@/lib/cn";

/** Disclosure built on Base UI Collapsible (hairline frame). */
export function Collapsible({ className, ...props }: CollapsiblePrimitive.Root.Props) {
  return <CollapsiblePrimitive.Root className={cn("border-hairline", className)} {...props} />;
}

export const CollapsibleTrigger = CollapsiblePrimitive.Trigger;

export function CollapsibleContent({ className, ...props }: CollapsiblePrimitive.Panel.Props) {
  return (
    <CollapsiblePrimitive.Panel
      className={cn("overflow-hidden data-[open]:animate-in data-[closed]:animate-out", className)}
      {...props}
    />
  );
}
