import { Format } from "@number-flow/react";
export type SegmentedOption = {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
  /** Optional per-option contract test id (E2E data-testid). */
  testId?: string;
};
export type SegmentedControlProps = {
  options: SegmentedOption[];
  label?: string;
  testId?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  /** `sm` fits the 28px studio header rows (h-7). */
  size?: "sm" | "md";
};
export declare function SegmentedControl({ options, label, value, defaultValue, onValueChange, className, size, testId }: SegmentedControlProps): React.ReactElement;
export type LikeCommit = (liked: boolean, signal: AbortSignal) => Promise<unknown>;
export type LikeBurstHandle = {
  toggle: () => void;
};
export type UseOptimisticLikeOptions = {
  initialLiked?: boolean;
  initialCount?: number;
  onCommit?: LikeCommit;
  onError?: (error: unknown) => void;
  settle?: number;
};
export type OptimisticLike = {
  liked: boolean;
  count: number;
  base: number;
  pending: boolean;
  burst: number;
  settled: {
    liked: boolean;
    count: number;
  };
  toggle: () => void;
};
export declare function useOptimisticLike({ initialLiked, initialCount, onCommit, onError, settle }?: UseOptimisticLikeOptions): OptimisticLike;
export type LikeBurstProps = {
  initialLiked?: boolean;
  initialCount?: number;
  onCommit?: LikeCommit;
  onError?: (error: unknown) => void;
  onToggle?: (liked: boolean) => void;
  settle?: number;
  label?: string;
  activeLabel?: string;
  format?: (value: number) => string;
  disabled?: boolean;
  className?: string;
  /** Extra classes for the inner <button> (e.g. "flex-1 justify-center" to stretch it). */
  buttonClassName?: string;
  testId?: string;
};
export declare function LikeBurst({ initialLiked, initialCount, onCommit, onError, onToggle, settle, label, activeLabel, format, disabled, className, buttonClassName, testId }: LikeBurstProps): import("react").JSX.Element;
export type AsyncActionStatus = "idle" | "pending" | "success" | "error";
export type UseAsyncActionOptions = {
  action: () => unknown;
  resetAfter?: number;
  onError?: (error: unknown) => void;
};
export declare function useAsyncAction({ action, resetAfter, onError }: UseAsyncActionOptions): {
  status: AsyncActionStatus;
  run: () => void;
  reset: () => void;
  pending: boolean;
};
export type LoadingButtonProps = {
  onAction: () => unknown;
  children: string;
  pendingLabel?: string;
  successLabel?: string;
  errorLabel?: string;
  resetAfter?: number;
  disabled?: boolean;
  onError?: (error: unknown) => void;
  className?: string;
  testId?: string;
};
export declare function LoadingButton({ onAction, children, pendingLabel, successLabel, errorLabel, resetAfter, disabled, onError, className, testId }: LoadingButtonProps): React.ReactElement;
export type CopyStatus = "idle" | "copied" | "error";
export type UseCopyToClipboardOptions = {
  timeout?: number;
  onCopy?: (value: string) => void;
  onError?: (reason: unknown) => void;
};
export declare function useCopyToClipboard({ timeout, onCopy, onError }?: UseCopyToClipboardOptions): {
  copy: (text: string) => Promise<boolean>;
  reset: () => void;
  status: CopyStatus;
  copied: boolean;
};
export type CopyButtonProps = {
  value: string;
  label?: string;
  copiedLabel?: string;
  errorLabel?: string;
  timeout?: number;
  onCopy?: (value: string) => void;
  onError?: (reason: unknown) => void;
  disabled?: boolean;
  className?: string;
  testId?: string;
  /** Icon-only pill (no label) for tight rows like the TSV table headers. */
  iconOnly?: boolean;
};
export declare function CopyButton({ value, label, copiedLabel, errorLabel, timeout, onCopy, onError, disabled, className, testId, iconOnly }: CopyButtonProps): React.ReactElement;
export type HoldPhase = "idle" | "holding" | "releasing" | "committed";
export type UseHoldToConfirmOptions = {
  onConfirm: () => void;
  onAbort?: () => void;
  duration?: number;
  steps?: number;
  releaseRate?: number;
  moveTolerance?: number;
  haptic?: boolean;
  disabled?: boolean;
};
export declare function useHoldToConfirm({ onConfirm, onAbort, duration, steps, releaseRate, moveTolerance, haptic, disabled }: UseHoldToConfirmOptions): {
  bind: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerCancel: () => void;
    onPointerLeave: () => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    onBlur: () => void;
    onClick: (e: React.MouseEvent) => void;
    onContextMenu: (e: React.MouseEvent) => void;
  };
  step: number;
  steps: number;
  phase: HoldPhase;
  progress: number;
  reset: () => void;
};
export type HoldToConfirmProps = {
  onConfirm: () => void;
  children: React.ReactNode;
  onAbort?: () => void;
  confirmLabel?: string;
  duration?: number;
  resetAfter?: number;
  steps?: number;
  releaseRate?: number;
  disabled?: boolean;
  className?: string;
  testId?: string;
  title?: string;
};
export declare function HoldToConfirm({ onConfirm, children, onAbort, confirmLabel, duration, resetAfter, steps, releaseRate, disabled, className, testId, title }: HoldToConfirmProps): React.ReactElement;
export type TooltipTiming = {
  openDelay: number;
  closeDelay: number;
  skipDelay: number;
};
export type TooltipGroupProps = {
  children: React.ReactNode;
  /** Initial hover delay before the first tooltip of the group. */
  openDelay?: number;
  closeDelay?: number;
  /** Cool-down after the pointer leaves before the group goes cold. */
  skipDelay?: number;
  className?: string;
};
export declare function TooltipGroup({ children, openDelay, closeDelay, skipDelay, className }: TooltipGroupProps): React.ReactElement;
export type UseTooltipOptions = {
  disabled?: boolean;
  openDelay?: number;
  closeDelay?: number;
  skipDelay?: number;
};
export type TooltipTriggerProps = {
  onPointerEnter: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerLeave: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: React.PointerEvent<HTMLElement>) => void;
  onFocus: (event: React.FocusEvent<HTMLElement>) => void;
  onBlur: (event: React.FocusEvent<HTMLElement>) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
};
export type UseTooltipReturn = {
  open: boolean;
  warm: boolean;
  skipped: boolean;
  travel: number;
  tooltipId: string;
  seat: string;
  triggerProps: TooltipTriggerProps;
};
export declare function useTooltip({ disabled, openDelay, closeDelay, skipDelay }?: UseTooltipOptions): UseTooltipReturn;
type TriggerChild = React.ReactElement<React.HTMLAttributes<HTMLElement> & {
  "aria-describedby"?: string;
}>;
export type TooltipProps = UseTooltipOptions & {
  label: React.ReactNode;
  children: TriggerChild;
  side?: "top" | "bottom";
  className?: string;
  contentClassName?: string;
};
/** Daylight tooltip popup (white panel, hairline border, ink text). */
export declare function Tooltip({ label, children, side, disabled, openDelay, closeDelay, skipDelay, className, contentClassName }: TooltipProps): React.ReactElement;
/**
 * SliderDetents (interior.dev, "Stops you can feel."): a precision slider
 * with MAGNETIC detents — while dragging, the value snaps to any detent
 * inside the magnetic radius (fraction of the track) with a tactile
 * haptic tick, and the active detent pip pops. Used for the Step 4
 * cutting-plane scrubber `x ∈ [0, L]` with detents at
 * `0 · 0,25 L · 0,50 L · 0,75 L · 1,00 L`.
 */
export type SliderDetentsProps = {
  value: number;
  onValueChange: (value: number) => void;
  /** Normalised (0..1) detent stops. */
  detents?: number[];
  /** Fraction of the track inside which a detent attracts the thumb. */
  magnetRadius?: number;
  min?: number;
  max?: number;
  step?: number;
  /** Accessible name for the slider control. */
  label?: string;
  className?: string;
  formatValue?: (value: number) => string;
};
export declare function SliderDetents({ value, onValueChange, detents, magnetRadius, min, max, step, label, className, formatValue }: SliderDetentsProps): React.ReactElement;
/**
 * StatusBadge (interior.dev-style animated state pill): the pill swaps its
 * tone with a 180 ms cross-fade + subtle width glide, so EC3 compliance
 * (`Conforme EC3` / `Dépassement EC3`), kinematic degree (`Isostatique` /
 * `Hypostatique`) and the license edition read as one living instrument.
 * Daylight tokens: pass/fail/warn/accent tint backgrounds, 2px radius.
 */
export type StatusTone = "pass" | "fail" | "warn" | "accent" | "neutral";
export type StatusBadgeProps = {
  tone: StatusTone;
  children: React.ReactNode;
  className?: string;
  testId?: string;
  /** JetBrains Mono readout (η values, λcr, degrees). */
  mono?: boolean;
};
export declare function StatusBadge({ tone, children, className, testId, mono }: StatusBadgeProps): React.ReactElement;
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
export declare function ExpandablePanel({ title, children, defaultOpen, open: controlledOpen, onOpenChange, className, icon, testId }: ExpandablePanelProps): React.ReactElement;
export interface NumberFlowValueProps {
  value: number;
  /** number-flow format, e.g. `{ maximumFractionDigits: 2 }`. */
  format?: Format;
  className?: string;
  testId?: string;
}
export declare function NumberFlowValue({ value, format, className, testId }: NumberFlowValueProps): import("react").JSX.Element;
export {};