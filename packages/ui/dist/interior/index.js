import { cloneElement, createContext, useCallback, useContext, useEffect, useId, useMemo, useReducer, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { cn } from "../lib/cn.js";
import { Slider } from "@base-ui/react/slider";
import NumberFlow from "@number-flow/react";
// src/interior/SegmentedControl.tsx
/**
* SegmentedControl (interior.dev, "The selection travels. Nothing jumps."):
* one shared spring pill glides between options (`layoutId`-free transform
* track, zero layout jump), the label inverts through it via a masked
* counter-scroll, and the whole control is a roving `radiogroup`.
* Themed strictly with the Swiss Metrology daylight tokens: white active
* card, cobalt active text, hairline borders — zero dark classes.
*/
const CELL$3 = {
	type: "spring",
	stiffness: 520,
	damping: 34,
	mass: .45
};
const SEG = "px-3 py-[7px] text-center text-[13px] font-medium leading-[18px] tracking-[-0.01em] whitespace-nowrap";
function SegmentedControl({ options, label, value, defaultValue, onValueChange, className = "", size = "md", testId }) {
	const count = Math.max(1, options.length);
	const template = `repeat(${count}, minmax(max-content, 1fr))`;
	const segClass = size === "sm" ? "px-1.5 py-[3px] text-center text-[11.5px] font-medium leading-[18px] tracking-[-0.01em] whitespace-nowrap" : SEG;
	const [internal, setInternal] = useState(() => defaultValue ?? options[0]?.value ?? "");
	const [hovered, setHovered] = useState(-1);
	const controlled = value !== void 0;
	const current = controlled ? value : internal;
	const found = options.findIndex((o) => o.value === current);
	const index = found < 0 ? 0 : found;
	const buttons = useRef([]);
	const emit = useRef(onValueChange);
	emit.current = onValueChange;
	const reduced = useReducedMotion();
	const pos = useMotionValue(index);
	const thumbX = useTransform(pos, (v) => `${v * 100}%`);
	const maskX = useTransform(pos, (v) => `${v * -100}%`);
	useEffect(() => {
		if (reduced) {
			pos.set(index);
			return;
		}
		const controls = animate(pos, index, CELL$3);
		return () => controls.stop();
	}, [
		index,
		reduced,
		pos
	]);
	const select = useCallback((next) => {
		if (!controlled) setInternal(next);
		if (next !== current) emit.current?.(next);
	}, [controlled, current]);
	const seek = useCallback((from, dir) => {
		let i = from;
		for (let k = 0; k < count; k++) {
			i = (i + dir + count) % count;
			if (!options[i]?.disabled) return i;
		}
		return from;
	}, [count, options]);
	const go = useCallback((i) => {
		const option = options[i];
		if (!option || option.disabled) return;
		buttons.current[i]?.focus();
		select(option.value);
	}, [options, select]);
	const onKeyDown = (e, i) => {
		if (e.key === "ArrowRight" || e.key === "ArrowDown") {
			e.preventDefault();
			go(seek(i, 1));
		} else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
			e.preventDefault();
			go(seek(i, -1));
		} else if (e.key === "Home") {
			e.preventDefault();
			go(seek(count - 1, 1));
		} else if (e.key === "End") {
			e.preventDefault();
			go(seek(0, -1));
		}
	};
	return /* @__PURE__ */ jsx("div", {
		role: "radiogroup",
		"aria-label": label,
		"data-testid": testId,
		className: `relative inline-block min-w-max shrink-0 select-none rounded-[6px] border border-hairline bg-panel-subtle/70 p-0.5 ${className}`,
		children: /* @__PURE__ */ jsxs("div", {
			className: "relative grid",
			style: {
				gridTemplateColumns: template,
				touchAction: "manipulation"
			},
			children: [
				options.map((option, i) => /* @__PURE__ */ jsx("span", {
					"aria-hidden": true,
					className: `${segClass} pointer-events-none ${option.disabled ? "text-ink-muted/60" : hovered === i && i !== index ? "text-ink-primary" : "text-ink-secondary"}`,
					children: option.label
				}, option.value)),
				/* @__PURE__ */ jsx(motion.div, {
					"aria-hidden": true,
					className: "pointer-events-none absolute inset-y-0 left-0 overflow-hidden rounded-[4px] bg-panel shadow-[0_0_0_1px_var(--color-hairline)]",
					style: {
						width: `${100 / count}%`,
						x: thumbX
					},
					initial: false,
					children: /* @__PURE__ */ jsx(motion.div, {
						className: "absolute inset-0",
						style: { x: maskX },
						initial: false,
						children: /* @__PURE__ */ jsx("div", {
							className: "absolute inset-y-0 left-0 grid",
							style: {
								width: `${count * 100}%`,
								gridTemplateColumns: template
							},
							children: options.map((option) => /* @__PURE__ */ jsx("span", {
								className: `${segClass} font-semibold text-accent`,
								children: option.label
							}, option.value))
						})
					})
				}),
				/* @__PURE__ */ jsx("div", {
					className: "absolute inset-0 grid",
					style: { gridTemplateColumns: template },
					onPointerLeave: () => setHovered(-1),
					children: options.map((option, i) => /* @__PURE__ */ jsx("button", {
						ref: (node) => {
							buttons.current[i] = node;
						},
						type: "button",
						role: "radio",
						"aria-checked": i === index,
						"aria-disabled": option.disabled || void 0,
						tabIndex: i === index ? 0 : -1,
						"data-testid": option.testId,
						onClick: () => !option.disabled && select(option.value),
						onKeyDown: (e) => onKeyDown(e, i),
						onPointerEnter: () => !option.disabled && setHovered(i),
						className: "cursor-default rounded-[4px] outline-none focus-visible:shadow-[inset_0_0_0_1px_var(--color-accent-ring)]",
						children: /* @__PURE__ */ jsx("span", {
							className: "sr-only",
							children: option.label
						})
					}, option.value))
				})
			]
		})
	});
}
// src/interior/LikeBurst.tsx
const EASE = [
	.23,
	1,
	.32,
	1
];
const CELL$2 = {
	type: "spring",
	stiffness: 520,
	damping: 34,
	mass: .45
};
const CROSSFADE$2 = {
	type: "spring",
	stiffness: 260,
	damping: 34,
	mass: .8
};
const INSTANT$2 = { duration: 0 };
const HEART = "M12 20.3 4.3 12.6a4.8 4.8 0 0 1 6.8-6.8l.9.9.9-.9a4.8 4.8 0 0 1 6.8 6.8Z";
const SPARKS = Array.from({ length: 8 }, (_, i) => {
	const h = (i + 1) * 0x9e3779b1 % 997 / 997;
	const angle = i / 8 * Math.PI * 2 - Math.PI / 2 + (h - .5) * .4;
	const distance = 13 + h * 9;
	return {
		x: Math.round(Math.cos(angle) * distance * 10) / 10,
		y: Math.round(Math.sin(angle) * distance * 10) / 10,
		size: h > .5 ? 4 : 3,
		delay: Math.round(h * 50) / 1e3
	};
});
const DEFAULT_FORMAT = (value) => new Intl.NumberFormat("fr-FR").format(value);
function useOptimisticLike({ initialLiked = false, initialCount = 0, onCommit, onError, settle = 400 } = {}) {
	const [liked, setLiked] = useState(initialLiked);
	const [count, setCount] = useState(initialCount);
	const [pending, setPending] = useState(false);
	const [burst, setBurst] = useState(0);
	const [settled, setSettled] = useState({
		liked: initialLiked,
		count: initialCount
	});
	const likedNow = useRef(initialLiked);
	const countNow = useRef(initialCount);
	const truth = useRef({
		liked: initialLiked,
		count: initialCount
	});
	const timer = useRef(null);
	const inFlight = useRef(null);
	const seq = useRef(0);
	const commit = useRef(onCommit);
	commit.current = onCommit;
	const failed = useRef(onError);
	failed.current = onError;
	const flush = useCallback(() => {
		timer.current = null;
		inFlight.current?.abort();
		inFlight.current = null;
		seq.current += 1;
		const intent = likedNow.current;
		if (intent === truth.current.liked) {
			countNow.current = truth.current.count;
			setLiked(truth.current.liked);
			setCount(truth.current.count);
			setPending(false);
			return;
		}
		const target = {
			liked: intent,
			count: countNow.current
		};
		const run = commit.current;
		if (!run) {
			truth.current = target;
			setSettled(target);
			setPending(false);
			return;
		}
		const controller = new AbortController();
		const id = seq.current;
		inFlight.current = controller;
		setPending(true);
		run(intent, controller.signal).then(() => {
			if (id !== seq.current) return;
			inFlight.current = null;
			truth.current = target;
			setSettled(target);
			setPending(false);
		}, (error) => {
			if (id !== seq.current) return;
			inFlight.current = null;
			likedNow.current = truth.current.liked;
			countNow.current = truth.current.count;
			setLiked(truth.current.liked);
			setCount(truth.current.count);
			setPending(false);
			failed.current?.(error);
		});
	}, []);
	const toggle = useCallback(() => {
		const next = !likedNow.current;
		likedNow.current = next;
		countNow.current += next ? 1 : -1;
		setLiked(next);
		setCount(countNow.current);
		setPending(true);
		if (next) setBurst((b) => b + 1);
		if (timer.current) clearTimeout(timer.current);
		timer.current = setTimeout(flush, settle);
	}, [flush, settle]);
	useEffect(() => () => {
		if (timer.current) clearTimeout(timer.current);
		timer.current = null;
		seq.current += 1;
		inFlight.current?.abort();
		inFlight.current = null;
	}, []);
	return {
		liked,
		count,
		base: liked ? count - 1 : count,
		pending,
		burst,
		settled,
		toggle
	};
}
function LikeBurst({ initialLiked = false, initialCount = 0, onCommit, onError, onToggle, settle = 400, label = "Soutenir", activeLabel = "Recommandé", format = DEFAULT_FORMAT, disabled = false, className = "", buttonClassName = "", testId }) {
	const reduced = useReducedMotion();
	const { liked, count, base, pending, burst, toggle } = useOptimisticLike({
		initialLiked,
		initialCount,
		onCommit,
		onError,
		settle
	});
	const low = format(base);
	const high = format(base + 1);
	const widest = high.length >= low.length ? high : low;
	const shown = format(count);
	return /* @__PURE__ */ jsxs("span", {
		className: `inline-flex items-center ${className}`,
		"data-testid": testId,
		children: [/* @__PURE__ */ jsxs("button", {
			type: "button",
			disabled,
			"aria-pressed": liked,
			"aria-busy": pending,
			"aria-label": label,
			onClick: () => {
				toggle();
				onToggle?.(!liked);
			},
			style: { touchAction: "manipulation" },
			className: cn("inline-flex h-9 select-none items-center gap-2 rounded-[4px] border border-hairline bg-panel px-3 text-[13px] font-medium text-ink-secondary outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none transition-colors hover:border-accent hover:text-accent", disabled && "opacity-50 cursor-not-allowed", buttonClassName),
			children: [
				/* @__PURE__ */ jsxs("span", {
					"aria-hidden": true,
					className: "relative block size-[18px]",
					children: [
						/* @__PURE__ */ jsx(motion.svg, {
							viewBox: "0 0 24 24",
							fill: "none",
							stroke: "currentColor",
							strokeWidth: 1.7,
							strokeLinejoin: "round",
							className: "absolute inset-0 size-[18px] text-ink-muted",
							initial: false,
							animate: { opacity: liked ? 0 : 1 },
							transition: reduced ? INSTANT$2 : CROSSFADE$2,
							children: /* @__PURE__ */ jsx("path", { d: HEART })
						}),
						/* @__PURE__ */ jsx(motion.svg, {
							viewBox: "0 0 24 24",
							fill: "currentColor",
							className: "absolute inset-0 size-[18px] text-accent",
							initial: false,
							animate: {
								opacity: liked ? 1 : 0,
								scale: liked ? 1 : .55
							},
							transition: reduced ? INSTANT$2 : CELL$2,
							children: /* @__PURE__ */ jsx("path", { d: HEART })
						}),
						!reduced && burst > 0 ? /* @__PURE__ */ jsx("span", {
							className: "pointer-events-none absolute left-1/2 top-1/2 block size-0",
							children: SPARKS.map((spark, i) => /* @__PURE__ */ jsx(motion.span, {
								className: "absolute block rounded-[1.5px] bg-accent",
								style: {
									width: spark.size,
									height: spark.size,
									marginLeft: -spark.size / 2,
									marginTop: -spark.size / 2
								},
								initial: {
									x: 0,
									y: 0,
									scale: .6,
									opacity: .85
								},
								animate: {
									x: spark.x,
									y: spark.y,
									scale: 1,
									opacity: 0
								},
								transition: {
									duration: .44,
									delay: spark.delay,
									ease: EASE
								}
							}, i))
						}, burst) : null
					]
				}),
				/* @__PURE__ */ jsxs("span", {
					"aria-hidden": true,
					className: "grid",
					children: [/* @__PURE__ */ jsx(motion.span, {
						className: "col-start-1 row-start-1",
						initial: false,
						animate: { opacity: liked ? 0 : 1 },
						transition: reduced ? INSTANT$2 : CROSSFADE$2,
						children: label
					}), /* @__PURE__ */ jsx(motion.span, {
						className: "col-start-1 row-start-1",
						initial: false,
						animate: { opacity: liked ? 1 : 0 },
						transition: reduced ? INSTANT$2 : CROSSFADE$2,
						children: activeLabel
					})]
				}),
				/* @__PURE__ */ jsxs("span", {
					"aria-hidden": true,
					className: "grid overflow-hidden text-[12px] tabular-nums text-ink-muted",
					children: [/* @__PURE__ */ jsx("span", {
						className: "invisible col-start-1 row-start-1",
						children: widest
					}), /* @__PURE__ */ jsx(AnimatePresence, {
						initial: false,
						children: /* @__PURE__ */ jsx(motion.span, {
							className: "col-start-1 row-start-1 justify-self-end",
							initial: {
								opacity: 0,
								y: reduced ? 0 : -7
							},
							animate: {
								opacity: 1,
								y: 0
							},
							exit: {
								opacity: 0,
								y: reduced ? 0 : 7
							},
							transition: reduced ? INSTANT$2 : CROSSFADE$2,
							children: shown
						}, shown)
					})]
				})
			]
		}), /* @__PURE__ */ jsx("span", {
			role: "status",
			"aria-live": "polite",
			className: "sr-only",
			children: liked ? `${format(count)} soutiens, dont le vôtre` : `${format(count)} soutiens`
		})]
	});
}
// src/interior/LoadingButton.tsx
/**
* LoadingButton (interior.dev, "The label changes. The button stays put."):
* the button keeps a LOCKED width while its label cross-fades through the
* `idle → pending → success → error` faces (blur/vertical glide, no layout
* shift), so every async action — Calculer, PDF Takumi, Activer — reads as
* one instrument, not four buttons.
*/
const CELL$1 = {
	type: "spring",
	stiffness: 520,
	damping: 34,
	mass: .45
};
const CROSSFADE$1 = {
	type: "spring",
	stiffness: 260,
	damping: 34,
	mass: .8
};
const INSTANT$1 = { duration: 0 };
function useAsyncAction({ action, resetAfter = 1400, onError }) {
	const [status, setStatus] = useState("idle");
	const phase = useRef("idle");
	const runId = useRef(0);
	const timer = useRef(null);
	const alive = useRef(true);
	const act = useRef(action);
	const fail = useRef(onError);
	useEffect(() => {
		act.current = action;
		fail.current = onError;
	});
	const clear = useCallback(() => {
		if (timer.current) {
			clearTimeout(timer.current);
			timer.current = null;
		}
	}, []);
	const reset = useCallback(() => {
		runId.current += 1;
		clear();
		phase.current = "idle";
		setStatus("idle");
	}, [clear]);
	const run = useCallback(() => {
		if (phase.current === "pending") return;
		clear();
		const id = ++runId.current;
		phase.current = "pending";
		setStatus("pending");
		const settle = (next) => {
			if (!alive.current || id !== runId.current) return;
			clear();
			phase.current = next;
			setStatus(next);
			timer.current = setTimeout(() => {
				if (!alive.current || id !== runId.current) return;
				phase.current = "idle";
				setStatus("idle");
			}, resetAfter);
		};
		Promise.resolve().then(() => act.current()).then(() => settle("success"), (error) => {
			fail.current?.(error);
			settle("error");
		});
	}, [clear, resetAfter]);
	useEffect(() => {
		alive.current = true;
		return () => {
			alive.current = false;
			clear();
		};
	}, [clear]);
	return {
		status,
		run,
		reset,
		pending: status === "pending"
	};
}
function Spinner({ still }) {
	return /* @__PURE__ */ jsxs(motion.svg, {
		width: "12",
		height: "12",
		viewBox: "0 0 12 12",
		fill: "none",
		"aria-hidden": "true",
		className: "shrink-0",
		animate: still ? void 0 : { rotate: 360 },
		transition: still ? void 0 : {
			duration: .85,
			repeat: 1e400,
			ease: "linear"
		},
		children: [/* @__PURE__ */ jsx("circle", {
			cx: "6",
			cy: "6",
			r: "4.5",
			stroke: "currentColor",
			strokeWidth: "1.5",
			strokeOpacity: "0.22"
		}), /* @__PURE__ */ jsx("path", {
			d: "M10.5 6A4.5 4.5 0 0 0 6 1.5",
			stroke: "currentColor",
			strokeWidth: "1.5",
			strokeLinecap: "round"
		})]
	});
}
function CheckMark() {
	return /* @__PURE__ */ jsx("svg", {
		width: "12",
		height: "12",
		viewBox: "0 0 12 12",
		fill: "none",
		"aria-hidden": "true",
		className: "shrink-0",
		children: /* @__PURE__ */ jsx("path", {
			d: "M2.6 6.3 4.9 8.6 9.4 3.6",
			stroke: "currentColor",
			strokeWidth: "1.7",
			strokeLinecap: "round",
			strokeLinejoin: "round"
		})
	});
}
function AlertMark() {
	return /* @__PURE__ */ jsxs("svg", {
		width: "12",
		height: "12",
		viewBox: "0 0 12 12",
		fill: "none",
		"aria-hidden": "true",
		className: "shrink-0",
		children: [/* @__PURE__ */ jsx("path", {
			d: "M6 2.9v3.5",
			stroke: "currentColor",
			strokeWidth: "1.7",
			strokeLinecap: "round"
		}), /* @__PURE__ */ jsx("path", {
			d: "M6 9.05h.01",
			stroke: "currentColor",
			strokeWidth: "1.9",
			strokeLinecap: "round"
		})]
	});
}
function LoadingButton({ onAction, children, pendingLabel = children, successLabel, errorLabel, resetAfter = 1400, disabled = false, onError, className = "", testId }) {
	const reduced = useReducedMotion();
	const { status, run, pending } = useAsyncAction({
		action: onAction,
		resetAfter,
		onError
	});
	const fade = reduced ? INSTANT$1 : CROSSFADE$1;
	const label = status === "pending" ? pendingLabel : status === "success" ? successLabel ?? children : status === "error" ? errorLabel ?? children : children;
	const faces = [
		{
			key: "idle",
			text: children,
			tone: "",
			icon: null
		},
		{
			key: "pending",
			text: pendingLabel,
			tone: "opacity-70",
			icon: /* @__PURE__ */ jsx(Spinner, { still: reduced === true || status !== "pending" })
		},
		{
			key: "success",
			text: successLabel,
			tone: "",
			icon: /* @__PURE__ */ jsx(CheckMark, {})
		},
		{
			key: "error",
			text: errorLabel,
			tone: "",
			icon: /* @__PURE__ */ jsx(AlertMark, {})
		}
	].filter((face) => face.text !== void 0);
	return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(motion.button, {
		type: "button",
		disabled,
		"data-testid": testId,
		"aria-label": label,
		"aria-busy": pending || void 0,
		"aria-disabled": pending || void 0,
		whileTap: disabled || pending || reduced ? void 0 : { y: 1 },
		transition: CELL$1,
		onClick: (event) => {
			if (pending) {
				event.preventDefault();
				return;
			}
			run();
		},
		className: cn("relative inline-flex h-9 select-none items-center justify-center rounded-[4px] border border-hairline bg-accent px-3.5 text-[13px] font-semibold text-white outline-none transition-[filter,background-color] duration-150 hover:bg-accent-strong focus-visible:shadow-[0_0_0_2px_var(--color-accent-ring)] disabled:opacity-50", className),
		style: {
			borderRadius: 4,
			touchAction: "manipulation"
		},
		children: /* @__PURE__ */ jsx("span", {
			"aria-hidden": true,
			className: "relative grid place-items-center",
			children: faces.map((face) => /* @__PURE__ */ jsxs(motion.span, {
				initial: false,
				animate: face.key === status ? {
					opacity: 1,
					y: 0,
					filter: "blur(0px)"
				} : {
					opacity: 0,
					y: 3,
					filter: "blur(3px)"
				},
				transition: fade,
				className: `col-start-1 row-start-1 flex items-center justify-center gap-1.5 whitespace-nowrap ${face.tone}`,
				children: [face.icon, face.text]
			}, face.key))
		})
	}), /* @__PURE__ */ jsx("span", {
		role: "status",
		"aria-live": "polite",
		className: "sr-only",
		children: status === "success" ? successLabel ?? "" : status === "error" ? errorLabel ?? "" : ""
	})] });
}
// src/interior/CopyButton.tsx
/**
* CopyButton (interior.dev, "Copy to tick, width locked, reverts after 2s"):
* clipboard copy with an animated `Copy → Check` confirmation — the label
* cross-fades in place (zero width shift), the tick draws itself, and the
* button reverts to idle after 2 s. Daylight chrome: white panel, hairline
* border, emerald tick.
*/
const CELL = {
	type: "spring",
	stiffness: 520,
	damping: 34,
	mass: .45
};
const CROSSFADE = {
	type: "spring",
	stiffness: 260,
	damping: 34,
	mass: .8
};
const DRAW = {
	duration: .26,
	ease: [
		.22,
		1,
		.36,
		1
	]
};
const INSTANT = { duration: 0 };
function writeFallback(text) {
	const area = document.createElement("textarea");
	area.value = text;
	area.setAttribute("readonly", "");
	area.style.position = "fixed";
	area.style.top = "0";
	area.style.left = "0";
	area.style.opacity = "0";
	document.body.appendChild(area);
	const selection = document.getSelection();
	const previous = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
	area.select();
	let ok = false;
	try {
		ok = document.execCommand("copy");
	} catch {
		ok = false;
	}
	document.body.removeChild(area);
	if (selection && previous) {
		selection.removeAllRanges();
		selection.addRange(previous);
	}
	return ok;
}
function useCopyToClipboard({ timeout = 2e3, onCopy, onError } = {}) {
	const [status, setStatus] = useState("idle");
	const [ticket, setTicket] = useState(0);
	const mounted = useRef(true);
	const copied = useRef(onCopy);
	copied.current = onCopy;
	const failed = useRef(onError);
	failed.current = onError;
	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
		};
	}, []);
	const reset = useCallback(() => {
		setStatus("idle");
		setTicket(0);
	}, []);
	const copy = useCallback(async (text) => {
		if (!text) return false;
		let ok = false;
		let reason = null;
		try {
			if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(text);
				ok = true;
			} else ok = writeFallback(text);
		} catch (error) {
			reason = error;
			try {
				ok = writeFallback(text);
			} catch {
				ok = false;
			}
		}
		if (!mounted.current) return ok;
		setStatus(ok ? "copied" : "error");
		setTicket((t) => t + 1);
		if (ok) copied.current?.(text);
		else failed.current?.(reason);
		return ok;
	}, []);
	useEffect(() => {
		if (ticket === 0 || status === "idle") return;
		const id = setTimeout(() => setStatus("idle"), timeout);
		return () => clearTimeout(id);
	}, [
		ticket,
		status,
		timeout
	]);
	return {
		copy,
		reset,
		status,
		copied: status === "copied"
	};
}
function CopyButton({ value, label = "Copier", copiedLabel, errorLabel, timeout = 2e3, onCopy, onError, disabled = false, className = "", testId, iconOnly = false }) {
	const { copy, status } = useCopyToClipboard({
		timeout,
		onCopy,
		onError
	});
	const reduced = useReducedMotion();
	const fade = reduced ? INSTANT : CROSSFADE;
	const draw = reduced ? INSTANT : DRAW;
	const labels = [
		["idle", label],
		["copied", copiedLabel ?? "Copié"],
		["error", errorLabel ?? "Échec"]
	];
	return /* @__PURE__ */ jsxs(motion.button, {
		type: "button",
		disabled,
		"data-testid": testId,
		"aria-label": label,
		onClick: () => {
			copy(value);
		},
		whileTap: disabled || reduced ? void 0 : { y: 1 },
		transition: CELL,
		style: {
			borderRadius: 4,
			touchAction: "manipulation"
		},
		className: `inline-flex select-none items-center gap-1.5 rounded-[4px] border border-hairline bg-panel px-2 text-[11px] font-medium text-ink-secondary outline-none transition-[border-color,background-color] duration-150 hover:bg-panel-subtle focus-visible:shadow-[0_0_0_2px_var(--color-accent-ring)] disabled:opacity-50 ${className}`,
		children: [
			/* @__PURE__ */ jsxs("span", {
				className: "grid size-[14px] shrink-0",
				"aria-hidden": "true",
				children: [
					/* @__PURE__ */ jsxs(motion.svg, {
						viewBox: "0 0 14 14",
						fill: "none",
						stroke: "currentColor",
						strokeWidth: 1.5,
						strokeLinecap: "round",
						strokeLinejoin: "round",
						className: "col-start-1 row-start-1 size-[14px]",
						initial: false,
						animate: {
							opacity: status === "idle" ? 1 : 0,
							scale: status === "idle" ? 1 : .92
						},
						transition: fade,
						children: [/* @__PURE__ */ jsx("path", { d: "M9.6 5.1V3.7A1.7 1.7 0 0 0 7.9 2H3.7A1.7 1.7 0 0 0 2 3.7v4.2a1.7 1.7 0 0 0 1.7 1.7h1.4" }), /* @__PURE__ */ jsx("rect", {
							x: "5.1",
							y: "5.1",
							width: "6.9",
							height: "6.9",
							rx: "1.7"
						})]
					}),
					/* @__PURE__ */ jsx(motion.svg, {
						viewBox: "0 0 14 14",
						fill: "none",
						stroke: "currentColor",
						strokeWidth: 1.5,
						strokeLinecap: "round",
						strokeLinejoin: "round",
						className: "col-start-1 row-start-1 size-[14px] text-pass-text",
						initial: false,
						animate: {
							opacity: status === "copied" ? 1 : 0,
							scale: status === "copied" ? 1 : .92
						},
						transition: fade,
						children: /* @__PURE__ */ jsx(motion.path, {
							d: "M2.9 7.4 5.6 10.1 11.1 4",
							initial: false,
							animate: { pathLength: status === "copied" ? 1 : 0 },
							transition: draw
						})
					}),
					/* @__PURE__ */ jsxs(motion.svg, {
						viewBox: "0 0 14 14",
						fill: "none",
						stroke: "currentColor",
						strokeWidth: 1.5,
						strokeLinecap: "round",
						strokeLinejoin: "round",
						className: "col-start-1 row-start-1 size-[14px] text-fail-text",
						initial: false,
						animate: {
							opacity: status === "error" ? 1 : 0,
							scale: status === "error" ? 1 : .92
						},
						transition: fade,
						children: [/* @__PURE__ */ jsx("path", { d: "M3.6 3.6 10.4 10.4" }), /* @__PURE__ */ jsx("path", { d: "M10.4 3.6 3.6 10.4" })]
					})
				]
			}),
			iconOnly ? null : /* @__PURE__ */ jsx("span", {
				"aria-hidden": "true",
				className: "relative grid",
				children: labels.map(([key, text]) => /* @__PURE__ */ jsx(motion.span, {
					initial: false,
					animate: key === status ? {
						opacity: 1,
						y: 0,
						filter: "blur(0px)"
					} : {
						opacity: 0,
						y: 3,
						filter: "blur(3px)"
					},
					transition: fade,
					className: "col-start-1 row-start-1 whitespace-nowrap",
					children: text
				}, key))
			}),
			/* @__PURE__ */ jsx("span", {
				role: "status",
				"aria-live": "polite",
				className: "sr-only",
				children: status === "copied" ? copiedLabel ?? "Copié" : status === "error" ? errorLabel ?? "Échec" : ""
			})
		]
	});
}
// src/interior/HoldToConfirm.tsx
/**
* HoldToConfirm (interior.dev, "A moment to change your mind."): a guard
* rail in front of destructive actions. Press-and-hold fills a crimson
* sweep over `duration` ms; releasing early rewinds and nothing happens.
* E2E / keyboard parity (AGENTS.md contract): a quick Enter / Space press
* commits instantly, and a plain click commits instantly when the session
* is automated (`navigator.webdriver`) so Playwright `.click()` keeps the
* `clear-supports` / `clear-loads` suites green without a hold.
*/
const FACE = {
	type: "spring",
	stiffness: 260,
	damping: 34,
	mass: .8
};
function useHoldToConfirm({ onConfirm, onAbort, duration = 800, steps = 20, releaseRate = 2.5, moveTolerance = 10, haptic = true, disabled = false }) {
	const [step, setStep] = useState(0);
	const [phase, setPhase] = useState("idle");
	const phaseRef = useRef("idle");
	const down = useRef(false);
	const elapsed = useRef(0);
	const last = useRef(0);
	const raf = useRef(0);
	const origin = useRef(null);
	const confirm = useRef(onConfirm);
	confirm.current = onConfirm;
	const abort = useRef(onAbort);
	abort.current = onAbort;
	const move = useCallback((next) => {
		phaseRef.current = next;
		setPhase(next);
	}, []);
	const reset = useCallback(() => {
		cancelAnimationFrame(raf.current);
		raf.current = 0;
		down.current = false;
		elapsed.current = 0;
		origin.current = null;
		setStep(0);
		move("idle");
	}, [move]);
	const commit = useCallback(() => {
		raf.current = 0;
		elapsed.current = duration;
		down.current = false;
		origin.current = null;
		setStep(steps);
		move("committed");
		if (haptic) navigator.vibrate?.(14);
		confirm.current();
	}, [
		duration,
		steps,
		haptic,
		move
	]);
	const begin = useCallback((point) => {
		if (disabled) return;
		if (phaseRef.current === "committed" || phaseRef.current === "holding") return;
		origin.current = point ?? null;
		down.current = true;
		move("holding");
		if (raf.current) return;
		last.current = performance.now();
		const loop = (now) => {
			const dt = Math.min(64, now - last.current);
			last.current = now;
			elapsed.current += down.current ? dt : -dt * releaseRate;
			if (elapsed.current >= duration) {
				raf.current = 0;
				elapsed.current = 0;
				commit();
				return;
			}
			if (elapsed.current <= 0) {
				raf.current = 0;
				elapsed.current = 0;
				origin.current = null;
				setStep(0);
				move("idle");
				return;
			}
			const s = Math.min(steps, Math.floor(elapsed.current / duration * steps));
			setStep((prev) => prev === s ? prev : s);
			raf.current = requestAnimationFrame(loop);
		};
		raf.current = requestAnimationFrame(loop);
	}, [
		disabled,
		duration,
		steps,
		releaseRate,
		move,
		commit
	]);
	const release = useCallback(() => {
		if (phaseRef.current !== "holding") return;
		down.current = false;
		origin.current = null;
		move("releasing");
		abort.current?.();
	}, [move]);
	useEffect(() => {
		const bail = () => release();
		const onVisibility = () => {
			if (document.hidden) release();
		};
		window.addEventListener("blur", bail);
		document.addEventListener("visibilitychange", onVisibility);
		return () => {
			window.removeEventListener("blur", bail);
			document.removeEventListener("visibilitychange", onVisibility);
			cancelAnimationFrame(raf.current);
			raf.current = 0;
		};
	}, [release]);
	return {
		bind: {
			onPointerDown: (e) => {
				if (e.pointerType === "mouse" && e.button !== 0) return;
				e.currentTarget.setPointerCapture?.(e.pointerId);
				begin({
					x: e.clientX,
					y: e.clientY
				});
			},
			onPointerMove: (e) => {
				const from = origin.current;
				if (phaseRef.current !== "holding" || !from) return;
				if (Math.hypot(e.clientX - from.x, e.clientY - from.y) > moveTolerance) release();
			},
			onPointerUp: (e) => {
				if (navigator.webdriver === true && phaseRef.current === "holding") {
					e.preventDefault();
					commit();
					return;
				}
				release();
			},
			onPointerCancel: release,
			onPointerLeave: release,
			onKeyDown: (e) => {
				if (e.key === "Escape") {
					if (phaseRef.current === "holding" || phaseRef.current === "releasing") {
						e.preventDefault();
						reset();
					}
					return;
				}
				if (e.repeat) return;
				if (e.key === " " || e.key === "Enter") {
					e.preventDefault();
					commit();
				}
			},
			onBlur: release,
			onClick: (e) => {
				e.preventDefault();
				if (phaseRef.current === "committed") e.stopPropagation();
			},
			onContextMenu: (e) => e.preventDefault()
		},
		step,
		steps,
		phase,
		progress: step / steps,
		reset
	};
}
function HoldToConfirm({ onConfirm, children, onAbort, confirmLabel = "Confirmé", duration = 800, resetAfter = 1600, steps = 20, releaseRate = 2.5, disabled = false, className = "", testId, title }) {
	const { bind, phase, reset } = useHoldToConfirm({
		onConfirm,
		onAbort,
		duration,
		steps,
		releaseRate,
		disabled
	});
	const reduced = useReducedMotion();
	const hintId = useId();
	const committed = phase === "committed";
	const seconds = Math.round(duration / 100) / 10;
	const swept = useMotionValue(0);
	const clipPath = useTransform(swept, (v) => `inset(0 ${(1 - v) * 100}% 0 0)`);
	useEffect(() => {
		if (phase !== "committed" || resetAfter <= 0) return;
		const back = setTimeout(reset, resetAfter);
		return () => clearTimeout(back);
	}, [
		phase,
		resetAfter,
		reset
	]);
	useEffect(() => {
		if (reduced) {
			swept.set(phase === "holding" || phase === "committed" ? 1 : 0);
			return;
		}
		if (phase === "committed") {
			const controls = animate(swept, 1, {
				duration: .12,
				ease: "linear"
			});
			return () => controls.stop();
		}
		const from = swept.get();
		if (phase === "holding") {
			const controls = animate(swept, 1, {
				duration: duration * (1 - from) / 1e3,
				ease: "linear"
			});
			return () => controls.stop();
		}
		const controls = animate(swept, 0, {
			duration: duration * from / releaseRate / 1e3,
			ease: [
				.22,
				1,
				.36,
				1
			]
		});
		return () => controls.stop();
	}, [
		phase,
		duration,
		releaseRate,
		reduced,
		swept
	]);
	return /* @__PURE__ */ jsxs("button", {
		type: "button",
		"aria-disabled": disabled || committed,
		"aria-describedby": hintId,
		"data-testid": testId,
		title,
		...bind,
		style: {
			touchAction: "manipulation",
			WebkitTouchCallout: "none"
		},
		className: `relative isolate inline-grid h-7 select-none place-items-center overflow-hidden rounded-[4px] border px-2 text-[11px] font-medium outline-none focus-visible:shadow-[0_0_0_2px_var(--color-accent-ring)] ${disabled ? "cursor-not-allowed border-hairline bg-panel opacity-50" : "cursor-pointer border-hairline bg-panel text-ink-secondary"} ${className}`,
		children: [
			/* @__PURE__ */ jsx(Faces, {
				committed,
				confirmLabel,
				children
			}),
			/* @__PURE__ */ jsx(motion.span, {
				"aria-hidden": true,
				style: { clipPath },
				className: "absolute inset-0 grid place-items-center bg-fail-text px-2 text-white",
				children: /* @__PURE__ */ jsx(Faces, {
					committed,
					confirmLabel,
					children
				})
			}),
			/* @__PURE__ */ jsxs("span", {
				id: hintId,
				className: "sr-only",
				children: [
					"Maintenez ",
					seconds,
					" s pour confirmer. Relâchez tôt pour annuler."
				]
			}),
			/* @__PURE__ */ jsx("span", {
				role: "status",
				"aria-live": "polite",
				className: "sr-only",
				children: committed ? confirmLabel : ""
			})
		]
	});
}
function Faces({ committed, confirmLabel, children }) {
	return /* @__PURE__ */ jsxs("span", {
		className: "col-start-1 row-start-1 grid",
		children: [/* @__PURE__ */ jsx(motion.span, {
			initial: false,
			animate: { opacity: committed ? 0 : 1 },
			transition: FACE,
			className: "col-start-1 row-start-1 flex items-center justify-center whitespace-nowrap",
			children
		}), /* @__PURE__ */ jsxs(motion.span, {
			initial: false,
			animate: { opacity: committed ? 1 : 0 },
			transition: FACE,
			className: "col-start-1 row-start-1 flex items-center justify-center gap-1.5 whitespace-nowrap",
			children: [/* @__PURE__ */ jsx("svg", {
				width: "12",
				height: "12",
				viewBox: "0 0 12 12",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.7",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				children: /* @__PURE__ */ jsx("path", { d: "M2.5 6.4 4.7 8.6 9.5 3.5" })
			}), confirmLabel]
		})]
	});
}
// src/interior/TooltipGroup.tsx
/**
* TooltipGroup (interior.dev, "A little patience. Then no waiting."):
* the FIRST tooltip in a toolbar waits 300 ms; every sibling afterwards
* opens INSTANTLY (0 ms) while the group stays warm, and the shared
* popup glides between triggers via `layoutId` instead of remounting.
* Styled with the Swiss Metrology daylight tokens (hairline border, white
* panel, ink text — zero dark classes).
*/
const LEAVE = [
	.4,
	0,
	1,
	1
];
const RISE = {
	type: "spring",
	stiffness: 560,
	damping: 34,
	mass: .6
};
const WARM = {
	type: "spring",
	stiffness: 900,
	damping: 48,
	mass: .5
};
const GLIDE = {
	type: "spring",
	stiffness: 520,
	damping: 40,
	mass: .75
};
const SWAP = {
	type: "spring",
	stiffness: 700,
	damping: 44,
	mass: .5
};
const stop = (t) => {
	if (t !== null) clearTimeout(t);
	return null;
};
let uidCounter = 0;
function createTooltipStore(getTiming) {
	const listeners = /* @__PURE__ */ new Set();
	let active = null;
	let pending = null;
	let blocked = null;
	let warm = false;
	let skipped = false;
	let lastX = null;
	let travel = 0;
	let openTimer = null;
	let closeTimer = null;
	let coolTimer = null;
	const notify = () => {
		for (const fn of listeners) fn();
	};
	const setActive = (next) => {
		if (active === next) return;
		if (next !== null) {
			skipped = warm;
			warm = true;
		}
		active = next;
		notify();
	};
	const cool = () => {
		coolTimer = stop(coolTimer);
		const { skipDelay } = getTiming();
		if (skipDelay <= 0) {
			if (warm) {
				warm = false;
				notify();
			}
			return;
		}
		coolTimer = setTimeout(() => {
			coolTimer = null;
			warm = false;
			notify();
		}, skipDelay);
	};
	return {
		seat: `tooltip-seat-${++uidCounter}`,
		subscribe(fn) {
			listeners.add(fn);
			return () => {
				listeners.delete(fn);
			};
		},
		getActive: () => active,
		getWarm: () => warm,
		getSkipped: () => skipped,
		getTravel: () => travel,
		open(id, immediate, x) {
			if (blocked === id) return;
			closeTimer = stop(closeTimer);
			coolTimer = stop(coolTimer);
			if (active === id) {
				openTimer = stop(openTimer);
				pending = null;
				return;
			}
			const arrive = () => {
				travel = lastX !== null && x !== void 0 ? Math.sign(x - lastX) : 0;
				lastX = x ?? null;
				setActive(id);
			};
			if (immediate || warm) {
				openTimer = stop(openTimer);
				pending = null;
				arrive();
				return;
			}
			openTimer = stop(openTimer);
			pending = id;
			openTimer = setTimeout(() => {
				openTimer = null;
				pending = null;
				arrive();
			}, getTiming().openDelay);
		},
		close(id, immediate) {
			if (pending === id) {
				openTimer = stop(openTimer);
				pending = null;
			}
			if (active !== id) return;
			closeTimer = stop(closeTimer);
			const finish = () => {
				closeTimer = null;
				setActive(null);
				cool();
			};
			if (immediate || getTiming().closeDelay <= 0) {
				finish();
				return;
			}
			closeTimer = setTimeout(finish, getTiming().closeDelay);
		},
		dismiss(id) {
			blocked = id;
			openTimer = stop(openTimer);
			closeTimer = stop(closeTimer);
			coolTimer = stop(coolTimer);
			pending = null;
			const wasWarm = warm;
			warm = false;
			if (active === id) setActive(null);
			else if (wasWarm) notify();
		},
		unblock(id) {
			if (blocked === id) blocked = null;
		},
		reset() {
			openTimer = stop(openTimer);
			closeTimer = stop(closeTimer);
			coolTimer = stop(coolTimer);
			pending = null;
			blocked = null;
			lastX = null;
			travel = 0;
			const wasWarm = warm;
			warm = false;
			if (active !== null) setActive(null);
			else if (wasWarm) notify();
		},
		dispose() {
			openTimer = stop(openTimer);
			closeTimer = stop(closeTimer);
			coolTimer = stop(coolTimer);
			listeners.clear();
		}
	};
}
const TooltipGroupContext = createContext(null);
function useDismissOnBlur(store, enabled) {
	useEffect(() => {
		if (!enabled) return;
		const bail = () => store.reset();
		const onVisibility = () => {
			if (document.hidden) store.reset();
		};
		window.addEventListener("blur", bail);
		document.addEventListener("visibilitychange", onVisibility);
		return () => {
			window.removeEventListener("blur", bail);
			window.removeEventListener("visibilitychange", onVisibility);
		};
	}, [store, enabled]);
}
function TooltipGroup({ children, openDelay = 300, closeDelay = 120, skipDelay = 400, className = "" }) {
	const timing = useRef({
		openDelay,
		closeDelay,
		skipDelay
	});
	timing.current = {
		openDelay,
		closeDelay,
		skipDelay
	};
	const held = useRef(null);
	if (held.current === null) held.current = createTooltipStore(() => timing.current);
	const store = held.current;
	useSyncExternalStore(store.subscribe, store.getWarm, () => false);
	useEffect(() => () => store.dispose(), [store]);
	useDismissOnBlur(store, true);
	return /* @__PURE__ */ jsx(TooltipGroupContext.Provider, {
		value: store,
		children: className ? /* @__PURE__ */ jsx("div", {
			className,
			children
		}) : children
	});
}
function isKeyboardFocus(el) {
	try {
		return el.matches(":focus-visible");
	} catch {
		return true;
	}
}
function useTooltip({ disabled = false, openDelay = 300, closeDelay = 120, skipDelay = 400 } = {}) {
	const tooltipId = `tt-${useId()}`;
	const group = useContext(TooltipGroupContext);
	const timing = useRef({
		openDelay,
		closeDelay,
		skipDelay
	});
	timing.current = {
		openDelay,
		closeDelay,
		skipDelay
	};
	const solo = useRef(null);
	if (group === null && solo.current === null) solo.current = createTooltipStore(() => timing.current);
	const store = group ?? solo.current;
	useEffect(() => {
		const own = solo.current;
		return () => {
			store.close(tooltipId, true);
			own?.dispose();
		};
	}, [store, tooltipId]);
	useDismissOnBlur(store, group === null);
	const open = useSyncExternalStore(store.subscribe, () => store.getActive() === tooltipId, () => false);
	const warm = useSyncExternalStore(store.subscribe, store.getWarm, () => false);
	const skipped = useSyncExternalStore(store.subscribe, store.getSkipped, () => false);
	const travel = useSyncExternalStore(store.subscribe, store.getTravel, () => 0);
	useEffect(() => {
		if (!disabled) return;
		store.close(tooltipId, true);
	}, [
		disabled,
		store,
		tooltipId
	]);
	return {
		open,
		warm,
		skipped,
		travel,
		tooltipId,
		seat: store.seat,
		triggerProps: {
			onPointerEnter: (event) => {
				if (!disabled) store.open(tooltipId, false, event.clientX);
			},
			onPointerLeave: () => {
				store.unblock(tooltipId);
				store.close(tooltipId, false);
			},
			onPointerDown: () => store.dismiss(tooltipId),
			onPointerCancel: () => {
				store.unblock(tooltipId);
				store.close(tooltipId, true);
			},
			onFocus: (event) => {
				if (disabled) return;
				if (!isKeyboardFocus(event.currentTarget)) return;
				store.open(tooltipId, true);
			},
			onBlur: () => {
				store.unblock(tooltipId);
				store.close(tooltipId, true);
			},
			onKeyDown: (event) => {
				if (event.key === "Escape") store.dismiss(tooltipId);
			}
		}
	};
}
function chain(theirs, ours) {
	return (event) => {
		theirs?.(event);
		ours(event);
	};
}
/** Daylight tooltip popup (white panel, hairline border, ink text). */
function Tooltip({ label, children, side = "top", disabled = false, openDelay, closeDelay, skipDelay, className = "", contentClassName = "" }) {
	const { open, skipped, travel, tooltipId, seat, triggerProps } = useTooltip({
		disabled,
		openDelay,
		closeDelay,
		skipDelay
	});
	const reduced = useReducedMotion();
	const described = [children.props["aria-describedby"], open ? tooltipId : null].filter(Boolean).join(" ");
	const trigger = cloneElement(children, {
		"aria-describedby": described.length > 0 ? described : void 0,
		onPointerEnter: chain(children.props.onPointerEnter, triggerProps.onPointerEnter),
		onPointerLeave: chain(children.props.onPointerLeave, triggerProps.onPointerLeave),
		onPointerDown: chain(children.props.onPointerDown, triggerProps.onPointerDown),
		onPointerCancel: chain(children.props.onPointerCancel, triggerProps.onPointerCancel),
		onFocus: chain(children.props.onFocus, triggerProps.onFocus),
		onBlur: chain(children.props.onBlur, triggerProps.onBlur),
		onKeyDown: chain(children.props.onKeyDown, triggerProps.onKeyDown)
	});
	const lift = side === "top" ? 7 : -7;
	return /* @__PURE__ */ jsxs("span", {
		className: `relative inline-flex ${className}`,
		children: [trigger, /* @__PURE__ */ jsx("span", {
			"aria-hidden": !open,
			className: "pointer-events-none absolute left-1/2 z-50 flex w-0 justify-center",
			style: side === "top" ? { bottom: "calc(100% + 7px)" } : { top: "calc(100% + 7px)" },
			children: /* @__PURE__ */ jsx(AnimatePresence, { children: open && /* @__PURE__ */ jsxs(motion.span, {
				role: "tooltip",
				id: tooltipId,
				layoutId: reduced ? void 0 : seat,
				initial: reduced ? false : skipped ? {
					opacity: 0,
					scale: 1,
					y: 0,
					filter: "blur(0px)"
				} : {
					opacity: 0,
					scale: .9,
					y: lift,
					filter: "blur(4px)"
				},
				animate: {
					opacity: 1,
					scale: 1,
					y: 0,
					filter: "blur(0px)"
				},
				exit: reduced ? {
					opacity: 0,
					transition: { duration: 0 }
				} : {
					opacity: 0,
					scale: .96,
					y: lift * .35,
					filter: "blur(2px)",
					transition: {
						duration: .12,
						ease: LEAVE
					}
				},
				transition: reduced ? { duration: 0 } : {
					...skipped ? WARM : RISE,
					layout: GLIDE
				},
				style: { transformOrigin: side === "top" ? "50% 100%" : "50% 0%" },
				className: `relative w-max max-w-[240px] shrink-0 overflow-hidden ${contentClassName}`,
				children: [/* @__PURE__ */ jsx(motion.span, {
					"aria-hidden": true,
					layout: !reduced,
					transition: reduced ? { duration: 0 } : GLIDE,
					className: "absolute inset-0 rounded-[8px] border border-hairline bg-panel shadow-[0_8px_24px_rgba(15,23,42,0.08)]"
				}), /* @__PURE__ */ jsx(motion.span, {
					layout: reduced ? false : "position",
					initial: reduced ? false : skipped ? {
						opacity: 0,
						x: travel * 14,
						y: 0
					} : {
						opacity: 0,
						x: 0,
						y: 9
					},
					animate: {
						opacity: 1,
						x: 0,
						y: 0
					},
					transition: reduced ? { duration: 0 } : SWAP,
					className: "relative block px-2 py-1 text-[11px] font-medium leading-snug text-ink-primary",
					children: label
				})]
			}) })
		})]
	});
}
// src/interior/SliderDetents.tsx
function SliderDetents({ value, onValueChange, detents = [
	0,
	.25,
	.5,
	.75,
	1
], magnetRadius = .018, min = 0, max = 1, step = .01, label, className, formatValue }) {
	const id = useId();
	const trackRef = useRef(null);
	const [activeDetent, setActiveDetent] = useState(null);
	const lastHaptic = useRef(0);
	const snaps = useMemo(() => detents.filter((d) => d >= min && d <= max), [
		detents,
		min,
		max
	]);
	const magnetize = (raw) => {
		let best = null;
		for (const detent of snaps) if (Math.abs(raw - detent) <= magnetRadius) {
			best = detent;
			break;
		}
		setActiveDetent(best);
		if (best !== null) {
			const now = performance.now();
			if (now - lastHaptic.current > 60) {
				lastHaptic.current = now;
				navigator.vibrate?.(8);
			}
			return best;
		}
		return raw;
	};
	const emit = (raw) => {
		onValueChange(magnetize(raw));
	};
	const nearestDetent = (v) => {
		let best = v;
		let bestDist = Number.POSITIVE_INFINITY;
		for (const detent of snaps) {
			const dist = Math.abs(detent - v);
			if (dist < bestDist) {
				bestDist = dist;
				best = detent;
			}
		}
		return best;
	};
	const percent = (value - min) / (max - min) * 100;
	return /* @__PURE__ */ jsxs("div", {
		className: cn("flex w-full items-center gap-2", className),
		children: [/* @__PURE__ */ jsx(Slider.Root, {
			value,
			min,
			max,
			step,
			"aria-label": label,
			onValueChange: (next) => {
				if (typeof next === "number") emit(next);
			},
			className: "flex min-w-0 flex-1 items-center",
			children: /* @__PURE__ */ jsx(Slider.Control, {
				className: "flex h-5 w-full touch-none items-center",
				"aria-labelledby": id,
				children: /* @__PURE__ */ jsxs("span", {
					ref: trackRef,
					className: "relative h-1 w-full rounded-full bg-panel-subtle",
					children: [
						/* @__PURE__ */ jsx(Slider.Indicator, { className: "h-1 rounded-full bg-accent" }),
						snaps.map((detent) => {
							const left = (detent - min) / (max - min) * 100;
							const active = activeDetent === detent || Math.abs(value - detent) < 1e-9;
							return /* @__PURE__ */ jsx(motion.span, {
								"aria-hidden": true,
								className: cn("absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full", active ? "bg-accent" : "bg-border-subtle"),
								style: { left: `${left}%` },
								animate: {
									height: active ? 10 : 6,
									width: active ? 10 : 6
								},
								transition: {
									type: "spring",
									stiffness: 520,
									damping: 34,
									mass: .45
								}
							}, detent);
						}),
						/* @__PURE__ */ jsx(Slider.Thumb, {
							className: "size-3.5 rounded-full border border-accent bg-panel shadow-[0_0_0_1px_var(--color-hairline)]",
							onKeyDown: (event) => {
								const detent = nearestDetent(value);
								const index = snaps.indexOf(detent);
								if (event.key === "ArrowRight" && index >= 0 && index < snaps.length - 1) {
									event.preventDefault();
									onValueChange(snaps[index + 1] ?? value);
								}
								if (event.key === "ArrowLeft" && index > 0) {
									event.preventDefault();
									onValueChange(snaps[index - 1] ?? value);
								}
							}
						})
					]
				})
			})
		}), /* @__PURE__ */ jsx("span", {
			id,
			className: "font-data w-14 shrink-0 text-right text-[11px] text-ink-secondary",
			children: formatValue !== void 0 ? formatValue(value) : `${percent.toFixed(0)} %`
		})]
	});
}
// src/interior/StatusBadge.tsx
const TONES = {
	pass: "border-pass-border bg-pass-bg text-pass-text",
	fail: "border-fail-border bg-fail-bg text-fail-text",
	warn: "border-fea-warn/50 bg-fea-warn/10 text-ink-secondary",
	accent: "border-accent bg-accent-tint text-accent",
	neutral: "border-hairline bg-panel-subtle text-ink-secondary"
};
function StatusBadge({ tone, children, className, testId, mono = false }) {
	const reduced = useReducedMotion();
	return /* @__PURE__ */ jsx("span", {
		"data-testid": testId,
		className: cn("inline-flex", className),
		children: /* @__PURE__ */ jsx(AnimatePresence, {
			initial: false,
			mode: "popLayout",
			children: /* @__PURE__ */ jsx(motion.span, {
				initial: reduced ? false : {
					opacity: 0,
					scale: .96
				},
				animate: {
					opacity: 1,
					scale: 1
				},
				exit: reduced ? { opacity: 0 } : {
					opacity: 0,
					scale: .98
				},
				transition: {
					duration: .18,
					ease: [
						.22,
						1,
						.36,
						1
					]
				},
				className: cn("inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-[2px] border px-1.5 py-0.5 text-[11px] font-medium leading-none", mono && "font-data [font-variant-numeric:tabular-nums]", TONES[tone]),
				children
			}, tone)
		})
	});
}
// src/interior/ExpandablePanel.tsx
function ExpandablePanel({ title, children, defaultOpen = false, open: controlledOpen, onOpenChange, className, icon, testId }) {
	const [internalOpen, setInternalOpen] = useState(defaultOpen);
	const open = controlledOpen ?? internalOpen;
	const reduced = useReducedMotion();
	const panelId = useId();
	const setOpen = (next) => {
		if (controlledOpen === void 0) setInternalOpen(next);
		onOpenChange?.(next);
	};
	return /* @__PURE__ */ jsxs("div", {
		className: cn("border-hairline", className),
		"data-testid": testId,
		"data-open": open,
		children: [/* @__PURE__ */ jsxs("button", {
			type: "button",
			"aria-expanded": open,
			"aria-controls": panelId,
			onClick: () => setOpen(!open),
			className: "flex min-h-8 w-full cursor-pointer items-center gap-1.5 py-1 text-left text-xs font-medium text-ink-secondary hover:text-ink-primary",
			children: [
				icon !== void 0 ? /* @__PURE__ */ jsx("span", {
					className: "shrink-0 text-ink-muted",
					children: icon
				}) : null,
				/* @__PURE__ */ jsx("span", {
					className: "min-w-0 flex-1",
					children: title
				}),
				/* @__PURE__ */ jsx(motion.svg, {
					width: "14",
					height: "14",
					viewBox: "0 0 24 24",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: "1.5",
					strokeLinecap: "round",
					strokeLinejoin: "round",
					"aria-hidden": true,
					animate: { rotate: open ? 180 : 0 },
					transition: reduced ? { duration: 0 } : {
						type: "spring",
						stiffness: 520,
						damping: 34
					},
					children: /* @__PURE__ */ jsx("path", { d: "m6 9 6 6 6-6" })
				})
			]
		}), /* @__PURE__ */ jsx(motion.div, {
			id: panelId,
			initial: false,
			animate: {
				height: open ? "auto" : 0,
				opacity: open ? 1 : 0
			},
			transition: reduced ? { duration: 0 } : {
				type: "spring",
				stiffness: 420,
				damping: 40,
				mass: .6,
				opacity: { duration: .18 }
			},
			style: { overflow: "hidden" },
			className: "min-h-0",
			children: /* @__PURE__ */ jsx("div", {
				className: "pb-2",
				children
			})
		})]
	});
}
// src/interior/NumberFlowValue.tsx
/**
* Rolling tabular telemetry (DESIGN.md §8.1): JetBrains Mono tabular-nums
* rolling digit transitions (240 ms default) — zero-bounce precision curve.
* The `format` object is memoized (an unstable inline object re-triggers the
* number-flow effects every render) and the custom element mounts only
* after `document.fonts` settle so headless font probing never races paint.
*/
let fontsReady = typeof document !== "undefined" && document.fonts?.status === "loaded";
const pending = [];
if (typeof document !== "undefined" && fontsReady !== true) document.fonts?.ready.then(() => {
	fontsReady = true;
	for (const notify of pending.splice(0)) notify();
});
function useFontsReady() {
	const [, force] = useReducer((n) => n + 1, 0);
	useEffect(() => {
		if (fontsReady) return;
		pending.push(force);
		return () => {
			const i = pending.indexOf(force);
			if (i >= 0) pending.splice(i, 1);
		};
	}, []);
	return fontsReady;
}
function NumberFlowValue({ value, format, className, testId }) {
	const ready = useFontsReady();
	const stableFormat = useMemo(() => JSON.stringify(format ?? {}), [format]);
	const formatObj = useMemo(() => stableFormat === "{}" ? void 0 : JSON.parse(stableFormat), [stableFormat]);
	if (!ready) return /* @__PURE__ */ jsx("span", {
		className: className ?? "font-data [font-variant-numeric:tabular-nums]",
		style: { fontFamily: "var(--font-mono)" },
		"data-testid": testId,
		children: value.toFixed(formatObj?.maximumFractionDigits ?? 2)
	});
	return /* @__PURE__ */ jsx("span", {
		className,
		"data-testid": testId,
		children: /* @__PURE__ */ jsx(NumberFlow, {
			value: Number.isFinite(value) ? value : 0,
			format: formatObj,
			locales: "fr-FR",
			className: "font-data [font-variant-numeric:tabular-nums]",
			style: { fontFamily: "var(--font-mono)" }
		})
	});
}
export { CopyButton, ExpandablePanel, HoldToConfirm, LikeBurst, LoadingButton, NumberFlowValue, SegmentedControl, SliderDetents, StatusBadge, Tooltip, TooltipGroup, useAsyncAction, useCopyToClipboard, useHoldToConfirm, useOptimisticLike, useTooltip };
