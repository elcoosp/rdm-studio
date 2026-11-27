import type { ButtonHTMLAttributes, ForwardRefExoticComponent, RefAttributes } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "../lib/cn";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
  asChild?: boolean;
  loading?: boolean;
}

const buttonVariants = {
  primary: "bg-accent text-white hover:bg-accent-hover active:bg-accent-strong focus:ring-2 focus:ring-accent-ring focus:ring-offset-2",
  outline: "border border-hairline bg-transparent hover:bg-panel-subtle hover:text-accent focus:ring-2 focus:ring-accent-ring focus:ring-offset-2",
  ghost: "bg-transparent hover:bg-panel-subtle focus:ring-2 focus:ring-accent-ring focus:ring-offset-2",
  destructive: "bg-fail-bg text-fail-text border border-fail-border hover:bg-fail-border focus:ring-2 focus:ring-fail-border focus:ring-offset-2",
};

const buttonSizes = {
  sm: "h-7 px-2.5 text-[12px]", // toolbar buttons
  md: "h-8 px-3 text-[13px]", // inspector buttons
  lg: "h-9 px-4 text-[13px] font-semibold", // primary CTAs
};

export const Button = Object.assign(
  (({
    className,
    variant = "primary",
    size = "md",
    asChild = false,
    loading = false,
    disabled,
    children,
    ...props
  }: ButtonProps) => {
    const cls = cn(
      "inline-flex items-center justify-center gap-1.5 rounded-[4px] font-semibold transition-colors duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]",
      "disabled:opacity-40 disabled:pointer-events-none",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-offset-2",
      buttonVariants[variant],
      buttonSizes[size],
      className,
    );
    if (asChild) {
      // Radix Slot accepts EXACTLY ONE element child: rendering the loading
      // spinner as a sibling (`{loading && <svg />}{children}`) makes
      // Children.count() === 2 and Slot throws ("Slot failed to slot onto
      // its children"). asChild + loading therefore omits the spinner —
      // the single child keeps full control of its content.
      return (
        <Slot
          className={cls}
          aria-disabled={disabled || loading}
          aria-busy={loading}
          {...props}
        >
          {children}
        </Slot>
      );
    }
    return (
      <button
        className={cls}
        disabled={disabled || loading}
        aria-busy={loading}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden="true"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }) as ForwardRefExoticComponent<ButtonProps & RefAttributes<HTMLButtonElement>>,
  {
    displayName: "Button",
  },
);
