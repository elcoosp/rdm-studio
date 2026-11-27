import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";

import { cn } from "../lib/cn";

/** Hairline separator (`#E2E8F0`), horizontal by default (DESIGN.md §2). */
export function Separator({
  className,
  orientation = "horizontal",
  ...props
}: SeparatorPrimitive.Props) {
  return (
    <SeparatorPrimitive
      orientation={orientation}
      className={cn(
        "shrink-0 border-hairline bg-hairline",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className,
      )}
      {...props}
    />
  );
}
