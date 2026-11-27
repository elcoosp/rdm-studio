import { useId, useState } from "react";
import { motion } from "motion/react";
import { useReducedMotion } from "motion/react";

import { cn } from "../lib/cn";

/**
 * ExpandablePanel (interior.dev-style smooth disclosure): height + opacity
 * animate together over the critically damped precision curve — the panel
 * never jumps, the chevron rotates, and `prefers-reduced-motion` renders
 * instantly. Used for Step 3 `Moments concentrés`, Step 2 `Appuis
 * élastiques` and the marketing engineering FAQ.
 */

export type ExpandablePanelProps = {
  title: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  /** Leading 18–22px engineering icon. */
  icon?: React.ReactNode;
  testId?: string;
};

export function ExpandablePanel({
  title,
  children,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  className,
  icon,
  testId,
}: ExpandablePanelProps): React.ReactElement {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = controlledOpen ?? internalOpen;
  const reduced = useReducedMotion();
  const panelId = useId();
  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };

  return (
    <div className={cn("border-hairline", className)} data-testid={testId} data-open={open}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        className="flex min-h-8 w-full cursor-pointer items-center gap-1.5 py-1 text-left text-xs font-medium text-ink-secondary hover:text-ink-primary"
      >
        {icon !== undefined ? <span className="shrink-0 text-ink-muted">{icon}</span> : null}
        <span className="min-w-0 flex-1">{title}</span>
        <motion.svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          animate={{ rotate: open ? 180 : 0 }}
          transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 34 }}
        >
          <path d="m6 9 6 6 6-6" />
        </motion.svg>
      </button>
      <motion.div
        id={panelId}
        initial={false}
        animate={{
          height: open ? "auto" : 0,
          opacity: open ? 1 : 0,
        }}
        transition={
          reduced
            ? { duration: 0 }
            : {
                type: "spring",
                stiffness: 420,
                damping: 40,
                mass: 0.6,
                opacity: { duration: 0.18 },
              }
        }
        style={{ overflow: "hidden" }}
        className="min-h-0"
      >
        <div className="pb-2">{children}</div>
      </motion.div>
    </div>
  );
}
