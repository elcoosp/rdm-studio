import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";

import { cn } from "@/lib/cn";

/** Grouped disclosure panels (Base UI Accordion, hairline dividers). */
export function Accordion({ className, ...props }: AccordionPrimitive.Root.Props) {
  return <AccordionPrimitive.Root className={cn("divide-hairline", className)} {...props} />;
}

export const AccordionItem = AccordionPrimitive.Item;

export function AccordionTrigger({ className, ...props }: AccordionPrimitive.Trigger.Props) {
  return (
    <AccordionPrimitive.Trigger
      className={cn(
        "flex min-h-8 w-full items-center justify-between py-1.5 text-left text-[12px] font-medium text-ink-secondary hover:text-ink-primary",
        className,
      )}
      {...props}
    />
  );
}

export function AccordionPanel({ className, ...props }: AccordionPrimitive.Panel.Props) {
  return (
    <AccordionPrimitive.Panel
      className={cn("pb-2 text-[12px] text-ink-secondary", className)}
      {...props}
    />
  );
}
