// src/viewport/spectrum.ts
/** Tier stops at ratios: 0.0, 0.2, 0.5, 0.8, 1.0, 1.25 */
const TIER_STOPS = [
	{
		ratio: 0,
		color: {
			r: 29,
			g: 78,
			b: 216,
			hex: "#1D4ED8",
			css: "rgb(29,78,216)"
		}
	},
	{
		ratio: .2,
		color: {
			r: 6,
			g: 182,
			b: 212,
			hex: "#06B6D4",
			css: "rgb(6,182,212)"
		}
	},
	{
		ratio: .5,
		color: {
			r: 16,
			g: 185,
			b: 129,
			hex: "#10B981",
			css: "rgb(16,185,129)"
		}
	},
	{
		ratio: .8,
		color: {
			r: 245,
			g: 158,
			b: 11,
			hex: "#F59E0B",
			css: "rgb(245,158,11)"
		}
	},
	{
		ratio: 1,
		color: {
			r: 220,
			g: 38,
			b: 38,
			hex: "#DC2626",
			css: "rgb(220,38,38)"
		}
	},
	{
		ratio: 1.25,
		color: {
			r: 180,
			g: 0,
			b: 0,
			hex: "#B40000",
			css: "rgb(180,0,0)"
		}
	}
];
/**
* Interpolate a color from the 5-tier thermal spectrum.
* @param ratio Utilization ratio (0..1.25+), clamped internally
* @returns Tuple [r, g, b] with normalized values (0..1) for Three.js compatibility
*/
function spectrumColor(ratio) {
	const clamped = Math.max(0, Math.min(1.25, ratio));
	for (let i = 0; i < TIER_STOPS.length - 1; i++) {
		const a = TIER_STOPS[i];
		const b = TIER_STOPS[i + 1];
		if (clamped >= a.ratio && clamped <= b.ratio) {
			const t = (clamped - a.ratio) / (b.ratio - a.ratio);
			return [
				(a.color.r + t * (b.color.r - a.color.r)) / 255,
				(a.color.g + t * (b.color.g - a.color.g)) / 255,
				(a.color.b + t * (b.color.b - a.color.b)) / 255
			];
		}
	}
	const last = TIER_STOPS[TIER_STOPS.length - 1].color;
	return [
		last.r / 255,
		last.g / 255,
		last.b / 255
	];
}
/**
* Interpolate a color from the 5-tier thermal spectrum (object form).
* @param ratio Utilization ratio (0..1.25+), clamped internally
* @returns SpectrumColor with r/g/b (0-255), hex, and css rgb()
*/
function spectrumColorObj(ratio) {
	const clamped = Math.max(0, Math.min(1.25, ratio));
	for (let i = 0; i < TIER_STOPS.length - 1; i++) {
		const a = TIER_STOPS[i];
		const b = TIER_STOPS[i + 1];
		if (clamped >= a.ratio && clamped <= b.ratio) {
			const t = (clamped - a.ratio) / (b.ratio - a.ratio);
			const r = Math.round(a.color.r + t * (b.color.r - a.color.r));
			const g = Math.round(a.color.g + t * (b.color.g - a.color.g));
			const b_ = Math.round(a.color.b + t * (b.color.b - a.color.b));
			return {
				r,
				g,
				b: b_,
				hex: `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b_.toString(16).padStart(2, "0")}`,
				css: `rgb(${r},${g},${b_})`
			};
		}
	}
	return TIER_STOPS[TIER_STOPS.length - 1].color;
}
/**
* Generate a CSS linear-gradient string for the thermal legend.
* Used in results.tsx and DockedInspector.
*/
function spectrumGradient() {
	return `linear-gradient(to right, ${TIER_STOPS.slice(0, 5).map((stop) => `${stop.color.css} ${stop.ratio / 1.25 * 100}%`).join(", ")})`;
}
/**
* Get the tier index (1-5) for a given ratio.
* Used for discrete badge coloring.
*/
function spectrumTier(ratio) {
	const clamped = Math.max(0, Math.min(1.25, ratio));
	if (clamped < .2) return 1;
	if (clamped < .5) return 2;
	if (clamped < .8) return 3;
	if (clamped <= 1) return 4;
	return 5;
}
/**
* Get tier label for accessibility/tooltips.
*/
function spectrumTierLabel(tier) {
	return {
		1: "Nominal (0–20 %)",
		2: "Low (20–50 %)",
		3: "Elastic (50–80 %)",
		4: "Plastic limit approach (80–100 %)",
		5: "Yield / Buckling failure (>100 %)"
	}[tier];
}
export { spectrumColor, spectrumColorObj, spectrumGradient, spectrumTier, spectrumTierLabel };
