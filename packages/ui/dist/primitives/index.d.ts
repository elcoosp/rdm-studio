import { ButtonHTMLAttributes, ForwardRefExoticComponent, HTMLAttributes, JSX, ReactNode, RefAttributes } from "react";
import { Checkbox as Checkbox$1 } from "@base-ui/react/checkbox";
import { Combobox } from "@base-ui/react/combobox";
import { Dialog } from "@base-ui/react/dialog";
import { NumberField } from "@base-ui/react/number-field";
import { Popover } from "@base-ui/react/popover";
import { Select } from "@base-ui/react/select";
import { Separator as Separator$1 } from "@base-ui/react/separator";
import { Switch as Switch$1 } from "@base-ui/react/switch";
import { Tabs } from "@base-ui/react/tabs";
import { Tooltip } from "@base-ui/react/tooltip";
/**
 * Status alert (DESIGN.md §6 badges at surface scale): `pass` uses the
 * emerald pair, `fail` the crimson pair, `info` the cobalt tint.
 */
declare const TONES: {
  readonly pass: "border-pass-border bg-pass-bg text-pass-text";
  readonly fail: "border-fail-border bg-fail-bg text-fail-text";
  readonly info: "border-accent-ring bg-accent-tint text-accent";
};
export declare function Alert({ tone, className, ...props }: JSX.IntrinsicElements["div"] & {
  tone?: keyof typeof TONES;
}): JSX.Element;
export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "pass" | "fail" | "warn" | "neutral";
  mono?: boolean;
  size?: "sm" | "md";
}
export declare const Badge: ForwardRefExoticComponent<BadgeProps & RefAttributes<HTMLSpanElement>> & {
  displayName: string;
};
/**
 * BrandMark — the official RDM Studio lockup using `/logo-rdm-studio.png`.
 */
export declare function BrandMark({ size, showTagline, className, wordmarkClassName }: {
  size?: "sm" | "md";
  showTagline?: boolean;
  className?: string;
  wordmarkClassName?: string;
}): import("react").JSX.Element;
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
  asChild?: boolean;
  loading?: boolean;
}
export declare const Button: ForwardRefExoticComponent<ButtonProps & RefAttributes<HTMLButtonElement>> & {
  displayName: string;
};
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "panel" | "overlay";
  padding?: "none" | "sm" | "md" | "lg";
}
export declare const Card: ForwardRefExoticComponent<CardProps & RefAttributes<HTMLDivElement>> & {
  displayName: string;
};
/** DOF-matrix checkbox: 16px box, cobalt check on press. */
export declare function Checkbox({ className, ...props }: Checkbox$1.Root.Props): import("react").JSX.Element;
/**
 * Searchable picker (Base UI Combobox) for the EN 10365/10210/10056
 * catalog with live SVG cross-section icons and mono designations.
 */
export declare function ComboboxRoot<T>(props: Combobox.Root.Props<T>): import("react").JSX.Element;
export declare function ComboboxInput({ className, placeholder, ...props }: Combobox.Input.Props): import("react").JSX.Element;
export declare function ComboboxTrigger({ className, ...props }: Combobox.Trigger.Props): import("react").JSX.Element;
export declare function ComboboxContent<T>({ className, children, renderItem, ...props }: Omit<Combobox.Popup.Props, "children"> & {
  /** Static nodes OR the items render function (Root needs `items`). */
  children?: ReactNode;
  renderItem?: (item: T) => ReactNode;
}): import("react").JSX.Element;
export declare function ComboboxItem({ className, children, ...props }: Combobox.Item.Props): import("react").JSX.Element;
export declare function ComboboxEmpty({ className, ...props }: Combobox.Empty.Props): import("react").JSX.Element;
/** Centered modal (Base UI): 8px radius, soft overlay shadow. */
export declare const DialogRoot: <Payload>(props: Dialog.Root.Props<Payload>) => React.JSX.Element;
export declare const DialogTrigger: Dialog.Trigger;
export declare const DialogClose: import("react").ForwardRefExoticComponent<Omit<import("@base-ui/react").AlertDialogCloseProps, "ref"> & import("react").RefAttributes<HTMLButtonElement>>;
export declare function DialogContent({ className, children, ...props }: Dialog.Popup.Props): import("react").JSX.Element;
export declare function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): import("react").JSX.Element;
export declare function DialogTitle({ className, ...props }: Dialog.Title.Props): import("react").JSX.Element;
export declare function DialogDescription({ className, ...props }: Dialog.Description.Props): import("react").JSX.Element;
/** Text input (DESIGN.md §6): 4px radius, hairline border, mono data font. */
export declare function Input({ className, ...props }: JSX.IntrinsicElements["input"]): JSX.Element;
/** JetBrains Mono keycap chip (`⌘K`, `Shift+Click`) with hairline border. */
export declare function Kbd({ className, ...props }: JSX.IntrinsicElements["kbd"]): JSX.Element;
/** Property-row label (Inter 12px, `#475569`). */
export declare function Label({ className, ...props }: JSX.IntrinsicElements["label"]): JSX.Element;
/**
 * Stepped numeric input (Base UI NumberField) for `X/Y/Z`, `θx`, `ky/kz`
 * and load magnitudes: mono data font, hairline chrome, −/+ steppers.
 */
export declare function NumberFieldRoot(props: NumberField.Root.Props): import("react").JSX.Element;
export declare function NumberFieldInput({ className, ...props }: NumberField.Input.Props): import("react").JSX.Element;
export declare function NumberFieldGroup({ className, ...props }: NumberField.Group.Props): import("react").JSX.Element;
export declare function NumberFieldDecrement({ className, ...props }: NumberField.Decrement.Props): import("react").JSX.Element;
export declare function NumberFieldIncrement({ className, ...props }: NumberField.Increment.Props): import("react").JSX.Element;
/** Non-trapping popover (Base UI) for legend/help readouts and the
 * normative `Réglages` settings — portal-rendered so it can NEVER be
 * clipped by the `<header>` (v2.1.2 audit fix). */
export declare const PopoverRoot: typeof Popover.Root;
export declare const PopoverTrigger: Popover.Trigger;
export declare const PopoverClose: import("react").ForwardRefExoticComponent<Omit<import("@base-ui/react").PopoverCloseProps, "ref"> & import("react").RefAttributes<HTMLButtonElement>>;
export declare function PopoverContent({ className, children, sideOffset, align, ...props }: Popover.Popup.Props & {
  sideOffset?: number;
  align?: "start" | "center" | "end";
}): import("react").JSX.Element;
/**
 * EC3 utilization track (DESIGN.md §6): 4px height, `#F1F5F9` track and a
 * tiered fill — emerald ≤ 0,80, amber ≤ 1,00, crimson above.
 */
export declare function UtilizationProgress({ value, className }: {
  /** Utilization ratio η in [0, 1+] — clamped visually to [0, 1]. */
  value: number;
  className?: string;
}): import("react").JSX.Element;
/** Closed single-line select (Base UI, DESIGN.md §4): 30px trigger. */
export declare const SelectRoot: typeof Select.Root;
export declare const SelectValue: import("react").ForwardRefExoticComponent<Omit<import("@base-ui/react").SelectValueProps, "ref"> & import("react").RefAttributes<HTMLSpanElement>>;
export declare function SelectTrigger({ className, children, ...props }: Select.Trigger.Props): import("react").JSX.Element;
export declare function SelectContent({ className, children, ...props }: Select.Popup.Props): import("react").JSX.Element;
export declare function SelectItem({ className, children, ...props }: Select.Item.Props): import("react").JSX.Element;
/** Hairline separator (`#E2E8F0`), horizontal by default (DESIGN.md §2). */
export declare function Separator({ className, orientation, ...props }: Separator$1.Props): import("react").JSX.Element;
/** Settings switch (Base UI): hairline track, cobalt when on. */
export declare function Switch({ className, ...props }: Switch$1.Root.Props): import("react").JSX.Element;
/** Nav tabs with the 2px cobalt active underline (DESIGN.md §6). */
export declare function TabsRoot({ className, ...props }: Tabs.Root.Props): import("react").JSX.Element;
export declare function TabsList({ className, ...props }: Tabs.List.Props): import("react").JSX.Element;
export declare function Tab({ className, ...props }: Tabs.Tab.Props): import("react").JSX.Element;
export declare function TabIndicator({ className, ...props }: Tabs.Indicator.Props): import("react").JSX.Element;
export declare function TabPanel({ className, ...props }: Tabs.Panel.Props): import("react").JSX.Element;
/** Multiline input sharing the control chrome of `Input`. */
export declare function Textarea({ className, ...props }: JSX.IntrinsicElements["textarea"]): JSX.Element;
/** Overlay tooltip: 8px radius, soft shadow reserved for overlays. */
export declare function TooltipProvider(props: Tooltip.Provider.Props): import("react").JSX.Element;
export declare function TooltipRoot(props: Tooltip.Root.Props): import("react").JSX.Element;
export declare const TooltipTrigger: Tooltip.Trigger;
export declare function TooltipContent({ className, children, sideOffset }: {
  className?: string;
  children?: React.ReactNode;
  sideOffset?: number;
}): import("react").JSX.Element;
export {};