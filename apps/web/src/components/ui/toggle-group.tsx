import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";

import { cn } from "@/lib/cn";

/**
 * Segmented exclusive selector (Base UI ToggleGroup): view presets
 * (`3D Iso | Dessus XY | Face XZ | Côté YZ`) and tool modes.
 */
export function ToggleGroupRoot({ className, ...props }: ToggleGroup.Props) {
  return (
    <ToggleGroup
      className={cn(
        "flex items-center gap-0.5 rounded-[4px] border border-hairline p-0.5",
        className,
      )}
      {...props}
    />
  );
}

export function ToggleGroupItem({
  className,
  value,
  children,
  ...props
}: Toggle.Props & { children?: React.ReactNode }) {
  return (
    <Toggle
      value={value}
      className={cn(
        "flex min-h-7 items-center justify-center rounded-[3px] px-2 text-[12px] text-ink-secondary transition-colors hover:text-ink-primary data-[pressed]:bg-accent-tint data-[pressed]:text-accent",
        className,
      )}
      {...props}
    >
      {children}
    </Toggle>
  );
}
