/**
 * interior.dev micro-interactions (v2.1.2) — the 8 flagship primitives
 * ported/adapted from the `interior.dev` registry (React + Motion +
 * Tailwind + Base UI), re-themed strictly with the Swiss Metrology
 * daylight tokens (#1D4ED8 Cobalt, 1px #E2E8F0 hairlines, 4px radius,
 * zero dark classes) and the critically damped precision curve
 * `cubic-bezier(0.22, 1, 0.36, 1)`.
 */
export {
  SegmentedControl,
  type SegmentedControlProps,
  type SegmentedOption,
} from "./segmented-control";
export {
  LoadingButton,
  useAsyncAction,
  type LoadingButtonProps,
  type AsyncActionStatus,
} from "./loading-button";
export {
  CopyButton,
  useCopyToClipboard,
  type CopyButtonProps,
  type CopyStatus,
} from "./copy-button";
export {
  HoldToConfirm,
  useHoldToConfirm,
  type HoldToConfirmProps,
  type HoldPhase,
} from "./hold-to-confirm";
export {
  TooltipGroup,
  Tooltip,
  useTooltip,
  type TooltipGroupProps,
  type TooltipProps,
  type UseTooltipReturn,
} from "./tooltip-group";
export { SliderDetents, type SliderDetentsProps } from "./slider-detents";
export { StatusBadge, type StatusBadgeProps, type StatusTone } from "./status-badge";
export { ExpandablePanel, type ExpandablePanelProps } from "./expandable-panel";
