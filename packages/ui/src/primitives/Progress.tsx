import { Progress as ProgressPrimitive } from "@base-ui/react/progress";

import { cn } from "../lib/cn";

/**
 * EC3 utilization track (DESIGN.md §6): 4px height, `#F1F5F9` track and a
 * tiered fill — emerald ≤ 0,80, amber ≤ 1,00, crimson above.
 */
export function UtilizationProgress({
  value,
  className,
}: {
  /** Utilization ratio η in [0, 1+] — clamped visually to [0, 1]. */
  value: number;
  className?: string;
}) {
  const clamped = Math.min(1, Math.max(0, value));
  const fill = value <= 0.8 ? "bg-fea-mid" : value <= 1.0 ? "bg-fea-warn" : "bg-fea-max";
  return (
    <ProgressPrimitive.Root
      value={clamped * 100}
      className={cn("h-1 w-full overflow-hidden rounded-[2px] bg-panel-subtle", className)}
    >
      <ProgressPrimitive.Track className="h-1 w-full">
        <ProgressPrimitive.Indicator className={cn("h-1 rounded-[2px]", fill)} />
      </ProgressPrimitive.Track>
    </ProgressPrimitive.Root>
  );
}
