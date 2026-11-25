import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/**
 * shadcn/ui Button (DESIGN.md tokens: cobalt accent, 4px control radius,
 * 1px hairline borders, no drop shadows on docked panels).
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[4px] text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-ring disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-accent text-white hover:bg-accent-strong",
        outline:
          "border border-hairline bg-panel text-ink-secondary hover:border-border-subtle hover:text-ink-primary",
        ghost: "text-ink-secondary hover:bg-panel-subtle hover:text-ink-primary",
        destructive: "bg-fea-max text-white hover:opacity-90",
      },
      size: {
        sm: "h-7 px-2",
        md: "h-8 px-2.5",
        lg: "h-9 px-3",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends ComponentProps<"button">, VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  const Component = "button";
  return (
    <Component
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { buttonVariants };
