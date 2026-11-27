import { jsx, jsxs } from "react/jsx-runtime";
// src/icons/EngineeringIcons.tsx
function Svg({ size = 22, className, children, ...props }) {
	return /* @__PURE__ */ jsx("svg", {
		width: size,
		height: size,
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: 1.5,
		strokeLinecap: "round",
		strokeLinejoin: "round",
		"aria-hidden": "true",
		className,
		...props,
		children
	});
}
function ProfileIpe({ size = 22, ...props }) {
	return /* @__PURE__ */ jsx(Svg, {
		size,
		...props,
		children: /* @__PURE__ */ jsx("path", { d: "M6 4h12v2.5h-4.75v11H18V20H6v-2.5h4.75v-11H6V4Z" })
	});
}
function ProfileHea({ size = 22, ...props }) {
	return /* @__PURE__ */ jsx(Svg, {
		size,
		...props,
		children: /* @__PURE__ */ jsx("path", { d: "M4 4h16v3h-6.5v10H20v3H4v-3h6.5V7H4V4Z" })
	});
}
function ProfileUpn({ size = 22, ...props }) {
	return /* @__PURE__ */ jsx(Svg, {
		size,
		...props,
		children: /* @__PURE__ */ jsx("path", { d: "M7 4h10v2.75H9.75v10.5H17V20H7V4Z" })
	});
}
function ProfileChs({ size = 22, ...props }) {
	return /* @__PURE__ */ jsxs(Svg, {
		size,
		...props,
		children: [/* @__PURE__ */ jsx("circle", {
			cx: "12",
			cy: "12",
			r: "8"
		}), /* @__PURE__ */ jsx("circle", {
			cx: "12",
			cy: "12",
			r: "5"
		})]
	});
}
function ProfileRhs({ size = 22, ...props }) {
	return /* @__PURE__ */ jsxs(Svg, {
		size,
		...props,
		children: [/* @__PURE__ */ jsx("rect", {
			x: "4",
			y: "5",
			width: "16",
			height: "14",
			rx: "1"
		}), /* @__PURE__ */ jsx("rect", {
			x: "7",
			y: "8",
			width: "10",
			height: "8"
		})]
	});
}
function ProfileAngle({ size = 22, ...props }) {
	return /* @__PURE__ */ jsx(Svg, {
		size,
		...props,
		children: /* @__PURE__ */ jsx("path", { d: "M6 4h3v13h11v3H6V4Z" })
	});
}
function SupportFixed({ size = 22, ...props }) {
	return /* @__PURE__ */ jsxs(Svg, {
		size,
		...props,
		children: [
			/* @__PURE__ */ jsx("line", {
				x1: "7",
				y1: "5",
				x2: "7",
				y2: "19"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "7",
				y1: "12",
				x2: "19",
				y2: "12"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "4",
				y1: "7",
				x2: "7",
				y2: "5"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "4",
				y1: "11",
				x2: "7",
				y2: "9"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "4",
				y1: "15",
				x2: "7",
				y2: "13"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "4",
				y1: "19",
				x2: "7",
				y2: "17"
			})
		]
	});
}
function SupportPinned({ size = 22, ...props }) {
	return /* @__PURE__ */ jsxs(Svg, {
		size,
		...props,
		children: [
			/* @__PURE__ */ jsx("circle", {
				cx: "12",
				cy: "7",
				r: "1.75"
			}),
			/* @__PURE__ */ jsx("polygon", { points: "12,8.75 7,17 17,17" }),
			/* @__PURE__ */ jsx("line", {
				x1: "4",
				y1: "17",
				x2: "20",
				y2: "17"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "6",
				y1: "20",
				x2: "8.5",
				y2: "17"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "10.5",
				y1: "20",
				x2: "13",
				y2: "17"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "15",
				y1: "20",
				x2: "17.5",
				y2: "17"
			})
		]
	});
}
function SupportRoller({ size = 22, ...props }) {
	return /* @__PURE__ */ jsxs(Svg, {
		size,
		...props,
		children: [
			/* @__PURE__ */ jsx("circle", {
				cx: "12",
				cy: "6.5",
				r: "1.75"
			}),
			/* @__PURE__ */ jsx("polygon", { points: "12,8.25 7.5,15 16.5,15" }),
			/* @__PURE__ */ jsx("circle", {
				cx: "9.25",
				cy: "17.25",
				r: "1.75"
			}),
			/* @__PURE__ */ jsx("circle", {
				cx: "14.75",
				cy: "17.25",
				r: "1.75"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "4",
				y1: "19.5",
				x2: "20",
				y2: "19.5"
			})
		]
	});
}
function SupportSlider({ size = 22, ...props }) {
	return /* @__PURE__ */ jsxs(Svg, {
		size,
		...props,
		children: [
			/* @__PURE__ */ jsx("line", {
				x1: "4",
				y1: "7",
				x2: "20",
				y2: "7"
			}),
			/* @__PURE__ */ jsx("rect", {
				x: "7.5",
				y: "9.5",
				width: "9",
				height: "5",
				rx: "0.75"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "4",
				y1: "17",
				x2: "20",
				y2: "17"
			})
		]
	});
}
function SupportSpring({ size = 22, ...props }) {
	return /* @__PURE__ */ jsxs(Svg, {
		size,
		...props,
		children: [
			/* @__PURE__ */ jsx("line", {
				x1: "7",
				y1: "4",
				x2: "17",
				y2: "4"
			}),
			/* @__PURE__ */ jsx("polyline", {
				points: "12,4 12,6.5 9,8 15,10.5 9,13 15,15.5 12,17 12,19.5",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "5",
				y1: "19.5",
				x2: "19",
				y2: "19.5"
			})
		]
	});
}
function ReleaseHinge({ size = 22, ...props }) {
	return /* @__PURE__ */ jsxs(Svg, {
		size,
		...props,
		children: [
			/* @__PURE__ */ jsx("line", {
				x1: "4",
				y1: "12",
				x2: "13.5",
				y2: "12"
			}),
			/* @__PURE__ */ jsx("circle", {
				cx: "15.75",
				cy: "12",
				r: "2.25"
			}),
			/* @__PURE__ */ jsx("circle", {
				cx: "20",
				cy: "12",
				r: "1.25",
				fill: "currentColor"
			})
		]
	});
}
function SupportReaction({ size = 22, ...props }) {
	return /* @__PURE__ */ jsxs(Svg, {
		size,
		...props,
		children: [
			/* @__PURE__ */ jsx("line", {
				x1: "4",
				y1: "8",
				x2: "20",
				y2: "8"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "8.5",
				y1: "19",
				x2: "8.5",
				y2: "11",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("polyline", {
				points: "6.25,13.25 8.5,11 10.75,13.25",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "15.5",
				y1: "19",
				x2: "15.5",
				y2: "11",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("polyline", {
				points: "13.25,13.25 15.5,11 17.75,13.25",
				stroke: "var(--color-accent)"
			})
		]
	});
}
function NodalPointLoad({ size = 22, ...props }) {
	return /* @__PURE__ */ jsxs(Svg, {
		size,
		...props,
		children: [
			/* @__PURE__ */ jsx("line", {
				x1: "12",
				y1: "4",
				x2: "12",
				y2: "14.5",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("polyline", {
				points: "9,11.5 12,14.5 15,11.5",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("circle", {
				cx: "12",
				cy: "18.25",
				r: "2.25"
			})
		]
	});
}
function UniformBeamLoad({ size = 22, ...props }) {
	return /* @__PURE__ */ jsxs(Svg, {
		size,
		...props,
		children: [
			/* @__PURE__ */ jsx("line", {
				x1: "4",
				y1: "6",
				x2: "20",
				y2: "6",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "6",
				y1: "6",
				x2: "6",
				y2: "15",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("polyline", {
				points: "4.5,13.25 6,15 7.5,13.25",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "10",
				y1: "6",
				x2: "10",
				y2: "15",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("polyline", {
				points: "8.5,13.25 10,15 11.5,13.25",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "14",
				y1: "6",
				x2: "14",
				y2: "15",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("polyline", {
				points: "12.5,13.25 14,15 15.5,13.25",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "18",
				y1: "6",
				x2: "18",
				y2: "15",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("polyline", {
				points: "16.5,14 18,15.5 19.5,14",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "4",
				y1: "18",
				x2: "20",
				y2: "18"
			})
		]
	});
}
function TrapezoidalLoad({ size = 22, ...props }) {
	return /* @__PURE__ */ jsxs(Svg, {
		size,
		...props,
		children: [
			/* @__PURE__ */ jsx("line", {
				x1: "4",
				y1: "11",
				x2: "20",
				y2: "5",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "6",
				y1: "10.25",
				x2: "6",
				y2: "15.5",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "10",
				y1: "8.75",
				x2: "10",
				y2: "15.5",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "14",
				y1: "7.25",
				x2: "14",
				y2: "15.5",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "18",
				y1: "5.75",
				x2: "18",
				y2: "15.5",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("polyline", {
				points: "16.5,14 18,15.5 19.5,14",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "4",
				y1: "18.5",
				x2: "20",
				y2: "18.5"
			})
		]
	});
}
function SpanPointLoad({ size = 22, ...props }) {
	return /* @__PURE__ */ jsxs(Svg, {
		size,
		...props,
		children: [
			/* @__PURE__ */ jsx("line", {
				x1: "12",
				y1: "4.5",
				x2: "12",
				y2: "14.5",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("polyline", {
				points: "9.25,11.75 12,14.5 14.75,11.75",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("circle", {
				cx: "4.5",
				cy: "18",
				r: "1.75"
			}),
			/* @__PURE__ */ jsx("circle", {
				cx: "19.5",
				cy: "18",
				r: "1.75"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "6.25",
				y1: "18",
				x2: "17.75",
				y2: "18"
			})
		]
	});
}
function TorqueMoment({ size = 22, ...props }) {
	return /* @__PURE__ */ jsxs(Svg, {
		size,
		...props,
		children: [
			/* @__PURE__ */ jsx("line", {
				x1: "4",
				y1: "12",
				x2: "14",
				y2: "12"
			}),
			/* @__PURE__ */ jsx("path", {
				d: "M10.5 6.5A6.5 6.5 0 1 1 8.5 17",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("polyline", {
				points: "8.5,5 10.5,6.5 9,8.5",
				stroke: "var(--color-accent)"
			})
		]
	});
}
function SelfWeightGravity({ size = 22, ...props }) {
	return /* @__PURE__ */ jsxs(Svg, {
		size,
		...props,
		children: [
			/* @__PURE__ */ jsx("rect", {
				x: "6",
				y: "4.5",
				width: "12",
				height: "9",
				rx: "1"
			}),
			/* @__PURE__ */ jsx("circle", {
				cx: "12",
				cy: "9",
				r: "1.25",
				fill: "var(--color-accent)",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "12",
				y1: "10.25",
				x2: "12",
				y2: "19.5",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("polyline", {
				points: "9.5,17 12,19.5 14.5,17",
				stroke: "var(--color-accent)"
			})
		]
	});
}
function DynamicAcceleration({ size = 22, ...props }) {
	return /* @__PURE__ */ jsxs(Svg, {
		size,
		...props,
		children: [
			/* @__PURE__ */ jsx("line", {
				x1: "4",
				y1: "8.5",
				x2: "9",
				y2: "8.5"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "3",
				y1: "12",
				x2: "8",
				y2: "12"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "4",
				y1: "15.5",
				x2: "9",
				y2: "15.5"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "10.5",
				y1: "12",
				x2: "20",
				y2: "12",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("polyline", {
				points: "16.5,8.5 20,12 16.5,15.5",
				stroke: "var(--color-accent)"
			})
		]
	});
}
function ThermalLoadIcon({ size = 22, ...props }) {
	return /* @__PURE__ */ jsxs(Svg, {
		size,
		...props,
		children: [
			/* @__PURE__ */ jsx("path", { d: "M8.5 13.2V6a1.75 1.75 0 1 1 3.5 0v7.2a3 3 0 1 1-3.5 0Z" }),
			/* @__PURE__ */ jsx("circle", {
				cx: "10.25",
				cy: "15.5",
				r: "1.25",
				fill: "var(--color-accent)",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "10.25",
				y1: "8.5",
				x2: "10.25",
				y2: "14.25",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "15",
				y1: "8.5",
				x2: "19.5",
				y2: "8.5",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("polyline", {
				points: "17.5,6.5 19.5,8.5 17.5,10.5",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "15",
				y1: "14.5",
				x2: "19.5",
				y2: "14.5",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("polyline", {
				points: "17.5,12.5 19.5,14.5 17.5,16.5",
				stroke: "var(--color-accent)"
			})
		]
	});
}
function LocalAxes({ size = 22, ...props }) {
	return /* @__PURE__ */ jsxs(Svg, {
		size,
		...props,
		children: [
			/* @__PURE__ */ jsx("line", {
				x1: "9",
				y1: "15",
				x2: "9",
				y2: "4.5"
			}),
			/* @__PURE__ */ jsx("polyline", { points: "6.75,6.75 9,4.5 11.25,6.75" }),
			/* @__PURE__ */ jsx("line", {
				x1: "9",
				y1: "15",
				x2: "19.5",
				y2: "15"
			}),
			/* @__PURE__ */ jsx("polyline", { points: "17.25,12.75 19.5,15 17.25,17.25" }),
			/* @__PURE__ */ jsx("line", {
				x1: "9",
				y1: "15",
				x2: "4.5",
				y2: "19.5"
			}),
			/* @__PURE__ */ jsx("polyline", { points: "4.5,16.5 4.5,19.5 7.5,19.5" }),
			/* @__PURE__ */ jsx("circle", {
				cx: "9",
				cy: "15",
				r: "1.5",
				fill: "var(--color-accent)",
				stroke: "var(--color-accent)"
			})
		]
	});
}
function MagneticSnap({ size = 22, ...props }) {
	return /* @__PURE__ */ jsxs(Svg, {
		size,
		...props,
		children: [
			/* @__PURE__ */ jsx("path", { d: "M7.5 4.5v5a4.5 4.5 0 0 0 9 0v-5" }),
			/* @__PURE__ */ jsx("line", {
				x1: "6.5",
				y1: "7",
				x2: "8.5",
				y2: "7",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "15.5",
				y1: "7",
				x2: "17.5",
				y2: "7",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "12",
				y1: "16.5",
				x2: "12",
				y2: "20.5",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "10",
				y1: "18.5",
				x2: "14",
				y2: "18.5",
				stroke: "var(--color-accent)"
			})
		]
	});
}
function MergeNodes({ size = 22, ...props }) {
	return /* @__PURE__ */ jsxs(Svg, {
		size,
		...props,
		children: [
			/* @__PURE__ */ jsx("circle", {
				cx: "4.5",
				cy: "12",
				r: "2"
			}),
			/* @__PURE__ */ jsx("circle", {
				cx: "19.5",
				cy: "12",
				r: "2"
			}),
			/* @__PURE__ */ jsx("circle", {
				cx: "12",
				cy: "12",
				r: "1.75",
				fill: "var(--color-accent)",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("polyline", {
				points: "8,10 10,12 8,14",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("polyline", {
				points: "16,10 14,12 16,14",
				stroke: "var(--color-accent)"
			})
		]
	});
}
function SectionCut({ size = 22, ...props }) {
	return /* @__PURE__ */ jsxs(Svg, {
		size,
		...props,
		children: [/* @__PURE__ */ jsx("rect", {
			x: "4",
			y: "9",
			width: "16",
			height: "6",
			rx: "0.75"
		}), /* @__PURE__ */ jsx("line", {
			x1: "12",
			y1: "4.5",
			x2: "12",
			y2: "19.5",
			stroke: "var(--color-accent)",
			strokeDasharray: "2.5 2.5"
		})]
	});
}
function FlexuralBuckling({ size = 22, ...props }) {
	return /* @__PURE__ */ jsxs(Svg, {
		size,
		...props,
		children: [
			/* @__PURE__ */ jsx("line", {
				x1: "9",
				y1: "4.5",
				x2: "9",
				y2: "19.5",
				stroke: "var(--color-ink-muted)",
				strokeDasharray: "2 2"
			}),
			/* @__PURE__ */ jsx("path", {
				d: "M9 4.5C15.5 8.5 15.5 15.5 9 19.5",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "7",
				y1: "19.5",
				x2: "11",
				y2: "19.5"
			})
		]
	});
}
function LateralTorsionalBuckling({ size = 22, ...props }) {
	return /* @__PURE__ */ jsxs(Svg, {
		size,
		...props,
		children: [
			/* @__PURE__ */ jsx("line", {
				x1: "6",
				y1: "19",
				x2: "16",
				y2: "19"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "11",
				y1: "19",
				x2: "14.5",
				y2: "6.5",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "9.5",
				y1: "5.25",
				x2: "19.5",
				y2: "7.75",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("polyline", {
				points: "17.5,4.25 19.75,5.75 17.75,7.25",
				stroke: "var(--color-accent)"
			})
		]
	});
}
function DeflectionLimit({ size = 22, ...props }) {
	return /* @__PURE__ */ jsxs(Svg, {
		size,
		...props,
		children: [
			/* @__PURE__ */ jsx("line", {
				x1: "4.5",
				y1: "8",
				x2: "19.5",
				y2: "8",
				stroke: "var(--color-ink-muted)",
				strokeDasharray: "2 2"
			}),
			/* @__PURE__ */ jsx("path", {
				d: "M4.5 8Q12 18.5 19.5 8",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("circle", {
				cx: "4.5",
				cy: "8",
				r: "1.5",
				fill: "currentColor"
			}),
			/* @__PURE__ */ jsx("circle", {
				cx: "19.5",
				cy: "8",
				r: "1.5",
				fill: "currentColor"
			})
		]
	});
}
function ModalVibration({ size = 22, ...props }) {
	return /* @__PURE__ */ jsxs(Svg, {
		size,
		...props,
		children: [/* @__PURE__ */ jsx("line", {
			x1: "4",
			y1: "12",
			x2: "20",
			y2: "12",
			stroke: "var(--color-ink-muted)",
			strokeDasharray: "2 2"
		}), /* @__PURE__ */ jsx("path", {
			d: "M4 12C6.5 5 9.5 5 12 12C14.5 19 17.5 19 20 12",
			stroke: "var(--color-accent)"
		})]
	});
}
function LoadCombination({ size = 22, ...props }) {
	return /* @__PURE__ */ jsxs(Svg, {
		size,
		...props,
		children: [
			/* @__PURE__ */ jsx("polyline", { points: "12,6 5.5,6 10,12 5.5,18 12,18" }),
			/* @__PURE__ */ jsx("line", {
				x1: "17",
				y1: "6",
				x2: "17",
				y2: "18",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("polyline", {
				points: "14.5,15.5 17,18 19.5,15.5",
				stroke: "var(--color-accent)"
			})
		]
	});
}
function RollAngle({ size = 22, ...props }) {
	return /* @__PURE__ */ jsxs(Svg, {
		size,
		...props,
		children: [
			/* @__PURE__ */ jsx("path", { d: "M5 6h6v1.5H8.75v9H11V18H5v-1.5h2.25v-9H5V6Z" }),
			/* @__PURE__ */ jsx("path", {
				d: "M15.5 7.5A6.5 6.5 0 0 1 15.5 16.5",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("polyline", {
				points: "14,6 15.5,7.5 13.75,8.75",
				stroke: "var(--color-accent)"
			})
		]
	});
}
function BeamSegment({ size = 22, ...props }) {
	return /* @__PURE__ */ jsxs(Svg, {
		size,
		...props,
		children: [
			/* @__PURE__ */ jsx("circle", {
				cx: "5.5",
				cy: "17.5",
				r: "2.25"
			}),
			/* @__PURE__ */ jsx("circle", {
				cx: "18.5",
				cy: "6.5",
				r: "2.25"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "7.2",
				y1: "16.05",
				x2: "16.8",
				y2: "7.95",
				stroke: "var(--color-accent)"
			})
		]
	});
}
function NodePin({ size = 22, ...props }) {
	return /* @__PURE__ */ jsxs(Svg, {
		size,
		...props,
		children: [
			/* @__PURE__ */ jsx("line", {
				x1: "12",
				y1: "4.5",
				x2: "12",
				y2: "7.5",
				stroke: "var(--color-ink-muted)"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "12",
				y1: "16.5",
				x2: "12",
				y2: "19.5",
				stroke: "var(--color-ink-muted)"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "4.5",
				y1: "12",
				x2: "7.5",
				y2: "12",
				stroke: "var(--color-ink-muted)"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "16.5",
				y1: "12",
				x2: "19.5",
				y2: "12",
				stroke: "var(--color-ink-muted)"
			}),
			/* @__PURE__ */ jsx("circle", {
				cx: "12",
				cy: "12",
				r: "2.25",
				fill: "var(--color-accent)",
				stroke: "var(--color-accent)"
			})
		]
	});
}
function PortalFrameIcon({ size = 22, ...props }) {
	return /* @__PURE__ */ jsxs(Svg, {
		size,
		...props,
		children: [
			/* @__PURE__ */ jsx("polyline", {
				points: "5.5,17 5.5,6.5 18.5,6.5 18.5,17",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("circle", {
				cx: "5.5",
				cy: "6.5",
				r: "1.5",
				fill: "currentColor"
			}),
			/* @__PURE__ */ jsx("circle", {
				cx: "18.5",
				cy: "6.5",
				r: "1.5",
				fill: "currentColor"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "3",
				y1: "17",
				x2: "8",
				y2: "17"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "4",
				y1: "19.5",
				x2: "6",
				y2: "17"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "6.5",
				y1: "19.5",
				x2: "8.5",
				y2: "17"
			}),
			/* @__PURE__ */ jsx("polygon", { points: "18.5,17 16,20.5 21,20.5" })
		]
	});
}
function WarrenTrussIcon({ size = 22, ...props }) {
	return /* @__PURE__ */ jsxs(Svg, {
		size,
		...props,
		children: [
			/* @__PURE__ */ jsx("line", {
				x1: "4",
				y1: "7.5",
				x2: "20",
				y2: "7.5"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "6",
				y1: "16.5",
				x2: "18",
				y2: "16.5"
			}),
			/* @__PURE__ */ jsx("polyline", {
				points: "4,7.5 7.2,16.5 10.4,7.5 13.6,16.5 16.8,7.5 20,16.5",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("circle", {
				cx: "4",
				cy: "7.5",
				r: "1.25",
				fill: "currentColor"
			}),
			/* @__PURE__ */ jsx("circle", {
				cx: "20",
				cy: "7.5",
				r: "1.25",
				fill: "currentColor"
			})
		]
	});
}
function ContinuousBeamIcon({ size = 22, ...props }) {
	return /* @__PURE__ */ jsxs(Svg, {
		size,
		...props,
		children: [
			/* @__PURE__ */ jsx("line", {
				x1: "4",
				y1: "10",
				x2: "20",
				y2: "10",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("polygon", { points: "5.5,10 3.5,14.5 7.5,14.5" }),
			/* @__PURE__ */ jsx("polygon", { points: "12,10 10,14.5 14,14.5" }),
			/* @__PURE__ */ jsx("polygon", { points: "18.5,10 16.5,14.5 20.5,14.5" }),
			/* @__PURE__ */ jsx("line", {
				x1: "3",
				y1: "17",
				x2: "21",
				y2: "17"
			})
		]
	});
}
function WindLoadIcon({ size = 22, ...props }) {
	return /* @__PURE__ */ jsxs(Svg, {
		size,
		...props,
		children: [
			/* @__PURE__ */ jsx("line", {
				x1: "18.5",
				y1: "4.5",
				x2: "18.5",
				y2: "19.5"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "4.5",
				y1: "7.5",
				x2: "15",
				y2: "7.5",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("polyline", {
				points: "12.75,5.25 15,7.5 12.75,9.75",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "6",
				y1: "12",
				x2: "15",
				y2: "12",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("polyline", {
				points: "12.75,9.75 15,12 12.75,14.25",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "4.5",
				y1: "16.5",
				x2: "15",
				y2: "16.5",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("polyline", {
				points: "12.75,14.25 15,16.5 12.75,18.75",
				stroke: "var(--color-accent)"
			})
		]
	});
}
function SnowLoadIcon({ size = 22, ...props }) {
	return /* @__PURE__ */ jsxs(Svg, {
		size,
		...props,
		children: [
			/* @__PURE__ */ jsx("line", {
				x1: "12",
				y1: "4",
				x2: "12",
				y2: "15.5",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "7",
				y1: "6.85",
				x2: "17",
				y2: "12.65",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "17",
				y1: "6.85",
				x2: "7",
				y2: "12.65",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("polyline", {
				points: "10.25,5.5 12,7 13.75,5.5",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("polyline", {
				points: "10.25,14 12,12.5 13.75,14",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "4",
				y1: "18.5",
				x2: "20",
				y2: "18.5"
			})
		]
	});
}
function MassWeightIcon({ size = 22, ...props }) {
	return /* @__PURE__ */ jsxs(Svg, {
		size,
		...props,
		children: [
			/* @__PURE__ */ jsx("circle", {
				cx: "12",
				cy: "5.75",
				r: "1.75",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("path", { d: "M6.5 8.5h11l1.25 10.5H5.25L6.5 8.5Z" }),
			/* @__PURE__ */ jsx("line", {
				x1: "9",
				y1: "14",
				x2: "15",
				y2: "14",
				stroke: "var(--color-accent)"
			})
		]
	});
}
function ConcreteBeamIcon({ size = 22, ...props }) {
	return /* @__PURE__ */ jsxs(Svg, {
		size,
		...props,
		children: [
			/* @__PURE__ */ jsx("rect", {
				x: "6",
				y: "4.5",
				width: "12",
				height: "15",
				rx: "0.75"
			}),
			/* @__PURE__ */ jsx("rect", {
				x: "8.25",
				y: "6.75",
				width: "7.5",
				height: "10.5",
				stroke: "var(--color-accent)",
				strokeDasharray: "2 2"
			}),
			/* @__PURE__ */ jsx("circle", {
				cx: "9",
				cy: "16.75",
				r: "1.25",
				fill: "var(--color-accent)",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("circle", {
				cx: "12",
				cy: "16.75",
				r: "1.25",
				fill: "var(--color-accent)",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("circle", {
				cx: "15",
				cy: "16.75",
				r: "1.25",
				fill: "var(--color-accent)",
				stroke: "var(--color-accent)"
			})
		]
	});
}
function TimberBeamIcon({ size = 22, ...props }) {
	return /* @__PURE__ */ jsxs(Svg, {
		size,
		...props,
		children: [
			/* @__PURE__ */ jsx("rect", {
				x: "6",
				y: "4.5",
				width: "12",
				height: "15",
				rx: "0.75"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "6",
				y1: "8.25",
				x2: "18",
				y2: "8.25",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "6",
				y1: "12",
				x2: "18",
				y2: "12",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "6",
				y1: "15.75",
				x2: "18",
				y2: "15.75",
				stroke: "var(--color-accent)"
			})
		]
	});
}
function SteelJointIcon({ size = 22, ...props }) {
	return /* @__PURE__ */ jsxs(Svg, {
		size,
		...props,
		children: [
			/* @__PURE__ */ jsx("line", {
				x1: "7.5",
				y1: "4.5",
				x2: "7.5",
				y2: "19.5"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "10.5",
				y1: "6",
				x2: "10.5",
				y2: "18",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "10.5",
				y1: "9",
				x2: "19.5",
				y2: "9"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "10.5",
				y1: "15",
				x2: "19.5",
				y2: "15"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "5.5",
				y1: "8",
				x2: "12.5",
				y2: "8",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "5.5",
				y1: "16",
				x2: "12.5",
				y2: "16",
				stroke: "var(--color-accent)"
			})
		]
	});
}
function VolumetricMesh({ size = 22, ...props }) {
	return /* @__PURE__ */ jsxs(Svg, {
		size,
		...props,
		children: [
			/* @__PURE__ */ jsx("polygon", { points: "4,10 13,5 20,8 20,15 11,20 4,17" }),
			/* @__PURE__ */ jsx("polyline", { points: "4,10 11,13 20,8" }),
			/* @__PURE__ */ jsx("line", {
				x1: "11",
				y1: "13",
				x2: "11",
				y2: "20"
			})
		]
	});
}
function WireframeMesh({ size = 22, ...props }) {
	return /* @__PURE__ */ jsxs(Svg, {
		size,
		...props,
		children: [
			/* @__PURE__ */ jsx("circle", {
				cx: "5",
				cy: "12",
				r: "2.25"
			}),
			/* @__PURE__ */ jsx("circle", {
				cx: "19",
				cy: "12",
				r: "2.25"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "7.25",
				y1: "12",
				x2: "16.75",
				y2: "12"
			})
		]
	});
}
function IconPlus({ size = 22, ...props }) {
	return /* @__PURE__ */ jsx(Svg, {
		size,
		...props,
		children: /* @__PURE__ */ jsx("path", { d: "M12 5v14M5 12h14" })
	});
}
function IconTrash({ size = 22, ...props }) {
	return /* @__PURE__ */ jsx(Svg, {
		size,
		...props,
		children: /* @__PURE__ */ jsx("path", { d: "M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14" })
	});
}
function IconFrame({ size = 22, ...props }) {
	return /* @__PURE__ */ jsx(VolumetricMesh, {
		size,
		...props
	});
}
function IconSupport({ size = 22, ...props }) {
	return /* @__PURE__ */ jsx(SupportFixed, {
		size,
		...props
	});
}
function IconLoad({ size = 22, ...props }) {
	return /* @__PURE__ */ jsx(NodalPointLoad, {
		size,
		...props
	});
}
function IconResults({ size = 22, ...props }) {
	return /* @__PURE__ */ jsx(SectionCut, {
		size,
		...props
	});
}
function IconReport({ size = 22, ...props }) {
	return /* @__PURE__ */ jsxs(Svg, {
		size,
		...props,
		children: [
			/* @__PURE__ */ jsx("rect", {
				x: "4",
				y: "4",
				width: "16",
				height: "16",
				rx: "2"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "8",
				y1: "10",
				x2: "16",
				y2: "10",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "8",
				y1: "14",
				x2: "14",
				y2: "14",
				stroke: "var(--color-accent)"
			}),
			/* @__PURE__ */ jsx("line", {
				x1: "8",
				y1: "18",
				x2: "12",
				y2: "18",
				stroke: "var(--color-accent)"
			})
		]
	});
}
function BrandEmblem({ size = 32, ...props }) {
	return /* @__PURE__ */ jsxs(Svg, {
		size,
		...props,
		children: [/* @__PURE__ */ jsx("defs", { children: /* @__PURE__ */ jsxs("linearGradient", {
			id: "emblemGradient",
			x1: "0%",
			y1: "0%",
			x2: "100%",
			y2: "100%",
			children: [
				/* @__PURE__ */ jsx("stop", {
					offset: "0%",
					stopColor: "#1D4ED8"
				}),
				/* @__PURE__ */ jsx("stop", {
					offset: "50%",
					stopColor: "#06B6D4"
				}),
				/* @__PURE__ */ jsx("stop", {
					offset: "100%",
					stopColor: "#10B981"
				})
			]
		}) }), /* @__PURE__ */ jsx("path", {
			d: "M6 4h12v2.5h-4.75v11H18V20H6v-2.5h4.75v-11H6V4Z",
			fill: "url(#emblemGradient)",
			stroke: "var(--color-accent)",
			strokeWidth: "0.75"
		})]
	});
}
const engineeringIcons = {
	ProfileIpe,
	ProfileHea,
	ProfileUpn,
	ProfileChs,
	ProfileRhs,
	ProfileAngle,
	SupportFixed,
	SupportPinned,
	SupportRoller,
	SupportSlider,
	SupportSpring,
	ReleaseHinge,
	SupportReaction,
	NodalPointLoad,
	UniformBeamLoad,
	TrapezoidalLoad,
	SpanPointLoad,
	TorqueMoment,
	SelfWeightGravity,
	DynamicAcceleration,
	ThermalLoadIcon,
	LocalAxes,
	MagneticSnap,
	MergeNodes,
	SectionCut,
	FlexuralBuckling,
	LateralTorsionalBuckling,
	DeflectionLimit,
	ModalVibration,
	LoadCombination,
	RollAngle,
	BeamSegment,
	NodePin,
	PortalFrameIcon,
	WarrenTrussIcon,
	ContinuousBeamIcon,
	WindLoadIcon,
	SnowLoadIcon,
	MassWeightIcon,
	ConcreteBeamIcon,
	TimberBeamIcon,
	SteelJointIcon,
	VolumetricMesh,
	WireframeMesh,
	IconPlus,
	IconTrash,
	IconFrame,
	IconSupport,
	IconLoad,
	IconResults,
	IconReport,
	BrandEmblem
};
export { BeamSegment, BrandEmblem, ConcreteBeamIcon, ContinuousBeamIcon, DeflectionLimit, DynamicAcceleration, FlexuralBuckling, IconFrame, IconLoad, IconPlus, IconReport, IconResults, IconSupport, IconTrash, LateralTorsionalBuckling, LoadCombination, LocalAxes, MagneticSnap, MassWeightIcon, MergeNodes, ModalVibration, NodalPointLoad, NodePin, PortalFrameIcon, ProfileAngle, ProfileChs, ProfileHea, ProfileIpe, ProfileRhs, ProfileUpn, ReleaseHinge, RollAngle, SectionCut, SelfWeightGravity, SnowLoadIcon, SpanPointLoad, SteelJointIcon, SupportFixed, SupportPinned, SupportReaction, SupportRoller, SupportSlider, SupportSpring, ThermalLoadIcon, TimberBeamIcon, TorqueMoment, TrapezoidalLoad, UniformBeamLoad, VolumetricMesh, WarrenTrussIcon, WindLoadIcon, WireframeMesh, engineeringIcons };
