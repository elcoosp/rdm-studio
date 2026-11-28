import { cn } from "../lib/cn.js";
import { jsx, jsxs } from "react/jsx-runtime";
import { Slot } from "@radix-ui/react-slot";
import { Checkbox as Checkbox$1 } from "@base-ui/react/checkbox";
import { Check, ChevronDown } from "lucide-react";
import { Combobox } from "@base-ui/react/combobox";
import { Dialog } from "@base-ui/react/dialog";
import { NumberField } from "@base-ui/react/number-field";
import { Popover } from "@base-ui/react/popover";
import { Progress } from "@base-ui/react/progress";
import { Select } from "@base-ui/react/select";
import { Separator as Separator$1 } from "@base-ui/react/separator";
import { Switch as Switch$1 } from "@base-ui/react/switch";
import { Tabs } from "@base-ui/react/tabs";
import { Tooltip } from "@base-ui/react/tooltip";
// src/primitives/Alert.tsx
/**
* Status alert (DESIGN.md §6 badges at surface scale): `pass` uses the
* emerald pair, `fail` the crimson pair, `info` the cobalt tint.
*/
const TONES = {
	pass: "border-pass-border bg-pass-bg text-pass-text",
	fail: "border-fail-border bg-fail-bg text-fail-text",
	info: "border-accent-ring bg-accent-tint text-accent"
};
function Alert({ tone = "info", className, ...props }) {
	return /* @__PURE__ */ jsx("div", {
		role: "status",
		className: cn("rounded-[4px] border px-2.5 py-2 text-[12px] leading-4", TONES[tone], className),
		...props
	});
}
// src/primitives/Badge.tsx
const badgeVariants = {
	pass: "bg-pass-bg border-pass-border text-pass-text",
	fail: "bg-fail-bg border-fail-border text-fail-text",
	warn: "bg-warn-bg border-warn-border text-warn-text",
	neutral: "bg-panel-subtle border-hairline text-ink-secondary"
};
const badgeSizes = {
	sm: "px-1.5 py-0 text-[10px]",
	md: "px-2 py-0.5 text-[11px]"
};
const Badge = Object.assign((({ className, variant = "neutral", mono = false, size = "md", children, ...props }) => /* @__PURE__ */ jsx("span", {
	className: cn("inline-flex items-center gap-1 rounded-[2px] border font-medium", "font-variant-numeric:tabular-nums", badgeVariants[variant], badgeSizes[size], mono && "font-mono", className),
	...props,
	children
})), { displayName: "Badge" });
// src/primitives/BrandMark.tsx
/**
* BrandMark — the official RDM Studio lockup using `/logo-rdm-studio.png`.
*/
function BrandMark({ size = "sm", showTagline = false, className, wordmarkClassName }) {
	const dim = size === "sm" ? "h-7 w-7" : "h-8 w-8";
	return /* @__PURE__ */ jsxs("span", {
		className: cn("inline-flex shrink-0 items-center gap-2", className),
		children: [/* @__PURE__ */ jsx("img", {
			src: "/logo-rdm-studio.png",
			width: size === "sm" ? 24 : 32,
			height: size === "sm" ? 24 : 32,
			style: {
				width: size === "sm" ? 24 : 32,
				height: size === "sm" ? 24 : 32
			},
			alt: "RDM Studio",
			className: cn(dim, "shrink-0 object-contain")
		}), /* @__PURE__ */ jsxs("span", {
			className: "flex min-w-0 flex-col leading-none",
			children: [/* @__PURE__ */ jsx("span", {
				className: cn("font-semibold tracking-tight text-ink-primary", size === "sm" ? "text-[15px]" : "text-base", wordmarkClassName),
				children: "RDM Studio"
			}), showTagline ? /* @__PURE__ */ jsx("span", {
				className: "mt-1 text-[12px] leading-4 text-ink-secondary",
				children: "Atelier de calcul de structures 3D"
			}) : null]
		})]
	});
}
// src/primitives/Button.tsx
const buttonVariants = {
	primary: "bg-accent text-white hover:bg-accent-hover active:bg-accent-strong focus:ring-2 focus:ring-accent-ring focus:ring-offset-2",
	outline: "border border-hairline bg-transparent hover:bg-panel-subtle hover:text-accent focus:ring-2 focus:ring-accent-ring focus:ring-offset-2",
	ghost: "bg-transparent hover:bg-panel-subtle focus:ring-2 focus:ring-accent-ring focus:ring-offset-2",
	destructive: "bg-fail-bg text-fail-text border border-fail-border hover:bg-fail-border focus:ring-2 focus:ring-fail-border focus:ring-offset-2"
};
const buttonSizes = {
	sm: "h-7 px-2.5 text-[12px]",
	md: "h-8 px-3 text-[13px]",
	lg: "h-9 px-4 text-[13px] font-semibold"
};
const Button = Object.assign((({ className, variant = "primary", size = "md", asChild = false, loading = false, disabled, children, ...props }) => {
	const cls = cn("inline-flex items-center justify-center gap-1.5 rounded-[4px] font-semibold transition-colors duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]", "disabled:opacity-40 disabled:pointer-events-none", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-offset-2", buttonVariants[variant], buttonSizes[size], className);
	if (asChild) return /* @__PURE__ */ jsx(Slot, {
		className: cls,
		"aria-disabled": disabled || loading,
		"aria-busy": loading,
		...props,
		children
	});
	return /* @__PURE__ */ jsxs("button", {
		className: cls,
		disabled: disabled || loading,
		"aria-busy": loading,
		...props,
		children: [loading && /* @__PURE__ */ jsxs("svg", {
			className: "animate-spin h-4 w-4",
			xmlns: "http://www.w3.org/2000/svg",
			fill: "none",
			viewBox: "0 0 24 24",
			strokeWidth: 2,
			stroke: "currentColor",
			"aria-hidden": "true",
			children: [/* @__PURE__ */ jsx("circle", {
				className: "opacity-25",
				cx: "12",
				cy: "12",
				r: "10",
				stroke: "currentColor"
			}), /* @__PURE__ */ jsx("path", {
				className: "opacity-75",
				fill: "currentColor",
				d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
			})]
		}), children]
	});
}), { displayName: "Button" });
// src/primitives/Card.tsx
const cardVariants = {
	default: "rounded-[8px] border border-hairline bg-panel",
	panel: "rounded-[6px] border border-hairline bg-panel",
	overlay: "rounded-[8px] border border-hairline bg-panel shadow-floating"
};
const cardPaddings = {
	none: "",
	sm: "p-2",
	md: "p-3",
	lg: "p-4"
};
const Card = Object.assign((({ className, variant = "default", padding = "md", children, ...props }) => /* @__PURE__ */ jsx("div", {
	className: cn(cardVariants[variant], cardPaddings[padding], className),
	...props,
	children
})), { displayName: "Card" });
// src/primitives/Checkbox.tsx
/** DOF-matrix checkbox: 16px box, cobalt check on press. */
function Checkbox({ className, ...props }) {
	return /* @__PURE__ */ jsx(Checkbox$1.Root, {
		className: cn("flex size-4 items-center justify-center rounded-[3px] border border-hairline bg-panel transition-colors data-[checked]:border-accent data-[checked]:bg-accent", className),
		...props,
		children: /* @__PURE__ */ jsx(Checkbox$1.Indicator, {
			className: "leading-none text-white",
			children: /* @__PURE__ */ jsx(Check, {
				size: 10,
				strokeWidth: 2,
				"aria-hidden": true
			})
		})
	});
}
// src/primitives/Combobox.tsx
/**
* Searchable picker (Base UI Combobox) for the EN 10365/10210/10056
* catalog with live SVG cross-section icons and mono designations.
*/
function ComboboxRoot(props) {
	return /* @__PURE__ */ jsx(Combobox.Root, { ...props });
}
function ComboboxInput({ className, placeholder, ...props }) {
	return /* @__PURE__ */ jsx(Combobox.Input, {
		placeholder: placeholder ?? "Rechercher un profilé…",
		className: cn("font-data h-[30px] w-full rounded-[4px] border border-hairline bg-panel px-2 text-[12px] text-ink-primary placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-ring", className),
		...props
	});
}
function ComboboxTrigger({ className, ...props }) {
	return /* @__PURE__ */ jsx(Combobox.Trigger, {
		className: cn("flex h-[30px] w-full items-center justify-between gap-1 rounded-[4px] border border-hairline bg-panel px-2 text-left text-[13px] text-ink-primary", className),
		...props
	});
}
function ComboboxContent({ className, children, renderItem, ...props }) {
	return /* @__PURE__ */ jsx(Combobox.Portal, { children: /* @__PURE__ */ jsx(Combobox.Positioner, {
		sideOffset: 4,
		className: "z-50",
		children: /* @__PURE__ */ jsx(Combobox.Popup, {
			className: cn("max-h-80 w-[var(--anchor-width)] overflow-auto rounded-[8px] border border-hairline bg-panel shadow-[0_8px_24px_rgba(15,23,42,0.08)]", className),
			...props,
			children: /* @__PURE__ */ jsx(Combobox.List, {
				className: "py-1",
				children: renderItem !== void 0 ? renderItem : children
			})
		})
	}) });
}
function ComboboxItem({ className, children, ...props }) {
	return /* @__PURE__ */ jsx(Combobox.Item, {
		className: cn("flex min-h-8 cursor-default items-center gap-2 px-2 text-[12px] text-ink-primary data-[highlighted]:bg-accent-tint", className),
		...props,
		children
	});
}
function ComboboxEmpty({ className, ...props }) {
	return /* @__PURE__ */ jsx(Combobox.Empty, {
		className: cn("px-2 py-3 text-center text-[12px] text-ink-muted", className),
		...props
	});
}
// src/primitives/Dialog.tsx
/** Centered modal (Base UI): 8px radius, soft overlay shadow. */
const DialogRoot = Dialog.Root;
const DialogTrigger = Dialog.Trigger;
const DialogClose = Dialog.Close;
function DialogContent({ className, children, ...props }) {
	return /* @__PURE__ */ jsxs(Dialog.Portal, { children: [/* @__PURE__ */ jsx(Dialog.Backdrop, { className: "fixed inset-0 z-50 bg-ink-primary/25" }), /* @__PURE__ */ jsx(Dialog.Popup, {
		className: cn("fixed top-1/2 left-1/2 z-50 w-[min(92vw,560px)] -translate-x-1/2 -translate-y-1/2 rounded-[8px] border border-hairline bg-panel p-4 shadow-[0_8px_24px_rgba(15,23,42,0.08)]", "data-[open]:animate-in data-[open]:fade-in-0 data-[open]:zoom-in-95", "data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95", className),
		...props,
		children
	})] });
}
function DialogHeader({ className, ...props }) {
	return /* @__PURE__ */ jsx("div", {
		className: cn("mb-2", className),
		...props
	});
}
function DialogTitle({ className, ...props }) {
	return /* @__PURE__ */ jsx(Dialog.Title, {
		className: cn("text-[15px] font-semibold text-ink-primary", className),
		...props
	});
}
function DialogDescription({ className, ...props }) {
	return /* @__PURE__ */ jsx(Dialog.Description, {
		className: cn("mt-0.5 text-[12px] text-ink-secondary", className),
		...props
	});
}
// src/primitives/Input.tsx
/** Text input (DESIGN.md §6): 4px radius, hairline border, mono data font. */
function Input({ className, ...props }) {
	return /* @__PURE__ */ jsx("input", {
		className: cn("font-data h-8 w-full rounded-[4px] border border-hairline bg-panel px-2 text-[12px] text-ink-primary placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-ring disabled:opacity-40", className),
		...props
	});
}
// src/primitives/Kbd.tsx
/** JetBrains Mono keycap chip (`⌘K`, `Shift+Click`) with hairline border. */
function Kbd({ className, ...props }) {
	return /* @__PURE__ */ jsx("kbd", {
		className: cn("font-data inline-flex h-5 min-w-5 items-center justify-center rounded-[2px] border border-hairline bg-panel px-1 text-[11px] text-ink-secondary", className),
		...props
	});
}
// src/primitives/Label.tsx
/** Property-row label (Inter 12px, `#475569`). */
function Label({ className, ...props }) {
	return /* @__PURE__ */ jsx("label", {
		className: cn("text-[12px] font-normal text-ink-secondary", className),
		...props
	});
}
// src/primitives/NumberField.tsx
/**
* Stepped numeric input (Base UI NumberField) for `X/Y/Z`, `θx`, `ky/kz`
* and load magnitudes: mono data font, hairline chrome, −/+ steppers.
*/
function NumberFieldRoot(props) {
	return /* @__PURE__ */ jsx(NumberField.Root, { ...props });
}
function NumberFieldInput({ className, ...props }) {
	return /* @__PURE__ */ jsx(NumberField.Input, {
		className: cn("font-data h-8 w-full rounded-[4px] border border-hairline bg-panel px-2 text-[12px] text-ink-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-ring", className),
		...props
	});
}
function NumberFieldGroup({ className, ...props }) {
	return /* @__PURE__ */ jsx(NumberField.Group, {
		className: cn("flex items-center gap-1", className),
		...props
	});
}
function StepperButton({ className, ...props }) {
	return /* @__PURE__ */ jsx("button", {
		type: "button",
		className: cn("flex size-6 items-center justify-center rounded-[3px] border border-hairline text-[12px] text-ink-secondary hover:border-border-subtle hover:text-ink-primary", className),
		...props
	});
}
function NumberFieldDecrement({ className, ...props }) {
	return /* @__PURE__ */ jsx(NumberField.Decrement, {
		render: /* @__PURE__ */ jsx(StepperButton, {}),
		className,
		...props
	});
}
function NumberFieldIncrement({ className, ...props }) {
	return /* @__PURE__ */ jsx(NumberField.Increment, {
		render: /* @__PURE__ */ jsx(StepperButton, {}),
		className,
		...props
	});
}
// src/primitives/Popover.tsx
/** Non-trapping popover (Base UI) for legend/help readouts and the
* normative `Réglages` settings — portal-rendered so it can NEVER be
* clipped by the `<header>` (v2.1.2 audit fix). */
const PopoverRoot = Popover.Root;
const PopoverTrigger = Popover.Trigger;
const PopoverClose = Popover.Close;
function PopoverContent({ className, children, sideOffset = 6, align = "start", ...props }) {
	return /* @__PURE__ */ jsx(Popover.Portal, { children: /* @__PURE__ */ jsx(Popover.Positioner, {
		sideOffset,
		align,
		className: "z-50",
		children: /* @__PURE__ */ jsx(Popover.Popup, {
			className: cn("w-72 rounded-[8px] border border-hairline bg-panel p-3 shadow-[0_8px_24px_rgba(15,23,42,0.08)]", "data-[open]:animate-in data-[open]:fade-in-0 data-[open]:zoom-in-95", "data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95", className),
			...props,
			children
		})
	}) });
}
// src/primitives/Progress.tsx
/**
* EC3 utilization track (DESIGN.md §6): 4px height, `#F1F5F9` track and a
* tiered fill — emerald ≤ 0,80, amber ≤ 1,00, crimson above.
*/
function UtilizationProgress({ value, className }) {
	const clamped = Math.min(1, Math.max(0, value));
	const fill = value <= .8 ? "bg-fea-mid" : value <= 1 ? "bg-fea-warn" : "bg-fea-max";
	return /* @__PURE__ */ jsx(Progress.Root, {
		value: clamped * 100,
		className: cn("h-1 w-full overflow-hidden rounded-[2px] bg-panel-subtle", className),
		children: /* @__PURE__ */ jsx(Progress.Track, {
			className: "h-1 w-full",
			children: /* @__PURE__ */ jsx(Progress.Indicator, { className: cn("h-1 rounded-[2px]", fill) })
		})
	});
}
// src/primitives/Select.tsx
/** Closed single-line select (Base UI, DESIGN.md §4): 30px trigger. */
const SelectRoot = Select.Root;
const SelectValue = Select.Value;
function SelectTrigger({ className, children, ...props }) {
	return /* @__PURE__ */ jsxs(Select.Trigger, {
		className: cn("flex h-[30px] w-full items-center justify-between gap-1 rounded-[4px] border border-hairline bg-panel px-2 text-[13px] text-ink-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-ring", className),
		...props,
		children: [children, /* @__PURE__ */ jsx(Select.Icon, {
			className: "text-ink-muted",
			children: /* @__PURE__ */ jsx(ChevronDown, {
				size: 12,
				strokeWidth: 1.5,
				"aria-hidden": true
			})
		})]
	});
}
function SelectContent({ className, children, ...props }) {
	return /* @__PURE__ */ jsx(Select.Portal, { children: /* @__PURE__ */ jsx(Select.Positioner, {
		sideOffset: 4,
		className: "z-50",
		children: /* @__PURE__ */ jsx(Select.Popup, {
			className: cn("max-h-72 min-w-[var(--positioner-width)] overflow-auto rounded-[8px] border border-hairline bg-panel py-1 shadow-[0_8px_24px_rgba(15,23,42,0.08)]", className),
			...props,
			children
		})
	}) });
}
function SelectItem({ className, children, ...props }) {
	return /* @__PURE__ */ jsxs(Select.Item, {
		className: cn("flex min-h-8 cursor-default items-center gap-2 px-2 text-[13px] text-ink-primary data-[highlighted]:bg-accent-tint data-[highlighted]:text-accent", className),
		...props,
		children: [/* @__PURE__ */ jsx(Select.ItemText, {
			className: "flex-1",
			children
		}), /* @__PURE__ */ jsx(Select.ItemIndicator, {
			className: "text-[11px] text-accent",
			children: /* @__PURE__ */ jsx(Check, {
				size: 12,
				strokeWidth: 1.5,
				"aria-hidden": true
			})
		})]
	});
}
// src/primitives/Separator.tsx
/** Hairline separator (`#E2E8F0`), horizontal by default (DESIGN.md §2). */
function Separator({ className, orientation = "horizontal", ...props }) {
	return /* @__PURE__ */ jsx(Separator$1, {
		orientation,
		className: cn("shrink-0 border-hairline bg-hairline", orientation === "horizontal" ? "h-px w-full" : "h-full w-px", className),
		...props
	});
}
// src/primitives/Switch.tsx
/** Settings switch (Base UI): hairline track, cobalt when on. */
function Switch({ className, ...props }) {
	return /* @__PURE__ */ jsx(Switch$1.Root, {
		className: cn("flex h-4.5 w-8 items-center rounded-full border border-hairline bg-panel-subtle p-0.5 transition-colors data-[checked]:border-accent data-[checked]:bg-accent", className),
		...props,
		children: /* @__PURE__ */ jsx(Switch$1.Thumb, { className: "size-3 rounded-full border-hairline bg-panel shadow-none transition-transform data-[checked]:translate-x-3.5" })
	});
}
// src/primitives/Tabs.tsx
/** Nav tabs with the 2px cobalt active underline (DESIGN.md §6). */
function TabsRoot({ className, ...props }) {
	return /* @__PURE__ */ jsx(Tabs.Root, {
		className: cn("flex flex-col", className),
		...props
	});
}
function TabsList({ className, ...props }) {
	return /* @__PURE__ */ jsx(Tabs.List, {
		className: cn("flex items-center gap-1 border-b border-hairline", className),
		...props
	});
}
function Tab({ className, ...props }) {
	return /* @__PURE__ */ jsx(Tabs.Tab, {
		className: cn("relative flex min-h-8 items-center rounded px-2.5 text-[13px] text-ink-secondary data-[selected]:text-accent", className),
		...props
	});
}
function TabIndicator({ className, ...props }) {
	return /* @__PURE__ */ jsx(Tabs.Indicator, {
		className: cn("absolute inset-x-1 bottom-0 h-[2px] bg-accent", className),
		...props
	});
}
function TabPanel({ className, ...props }) {
	return /* @__PURE__ */ jsx(Tabs.Panel, {
		className: cn("pt-2", className),
		...props
	});
}
// src/primitives/Textarea.tsx
/** Multiline input sharing the control chrome of `Input`. */
function Textarea({ className, ...props }) {
	return /* @__PURE__ */ jsx("textarea", {
		className: cn("font-data min-h-16 w-full rounded-[4px] border border-hairline bg-panel px-2 py-1.5 text-[12px] text-ink-primary placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-ring", className),
		...props
	});
}
// src/primitives/Tooltip.tsx
/** Overlay tooltip: 8px radius, soft shadow reserved for overlays. */
function TooltipProvider(props) {
	return /* @__PURE__ */ jsx(Tooltip.Provider, {
		delay: 250,
		...props
	});
}
function TooltipRoot(props) {
	return /* @__PURE__ */ jsx(Tooltip.Root, { ...props });
}
const TooltipTrigger = Tooltip.Trigger;
function TooltipContent({ className, children, sideOffset = 6 }) {
	return /* @__PURE__ */ jsx(Tooltip.Portal, { children: /* @__PURE__ */ jsx(Tooltip.Positioner, {
		sideOffset,
		children: /* @__PURE__ */ jsx(Tooltip.Popup, {
			className: cn("rounded-[8px] border border-hairline bg-panel px-2 py-1 text-[11px] text-ink-primary shadow-[0_8px_24px_rgba(15,23,42,0.08)]", "data-[open]:animate-in data-[open]:fade-in-0 data-[open]:zoom-in-95", "data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95", className),
			children
		})
	}) });
}
export { Alert, Badge, BrandMark, Button, Card, Checkbox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxRoot, ComboboxTrigger, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogRoot, DialogTitle, DialogTrigger, Input, Kbd, Label, NumberFieldDecrement, NumberFieldGroup, NumberFieldIncrement, NumberFieldInput, NumberFieldRoot, PopoverClose, PopoverContent, PopoverRoot, PopoverTrigger, SelectContent, SelectItem, SelectRoot, SelectTrigger, SelectValue, Separator, Switch, Tab, TabIndicator, TabPanel, TabsList, TabsRoot, Textarea, TooltipContent, TooltipProvider, TooltipRoot, TooltipTrigger, UtilizationProgress };
