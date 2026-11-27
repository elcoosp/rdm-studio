import type { HTMLAttributes, ForwardRefExoticComponent, RefAttributes } from "react";
import { cn } from "../lib/cn";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "panel" | "overlay";
  padding?: "none" | "sm" | "md" | "lg";
}

const cardVariants = {
  default: "rounded-[8px] border border-hairline bg-panel",
  panel: "rounded-[6px] border border-hairline bg-panel",
  overlay: "rounded-[8px] border border-hairline bg-panel shadow-floating",
};

const cardPaddings = {
  none: "",
  sm: "p-2",
  md: "p-3",
  lg: "p-4",
};

export const Card = Object.assign(
  (({
    className,
    variant = "default",
    padding = "md",
    children,
    ...props
  }: CardProps) => (
    <div
      className={cn(
        cardVariants[variant],
        cardPaddings[padding],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )) as ForwardRefExoticComponent<CardProps & RefAttributes<HTMLDivElement>>,
  { displayName: "Card" },
);