/**
 * Shared 5-tier FEA thermal spectrum color function
 * Matches DESIGN.md exactly: #1D4ED8 → #06B6D4 → #10B981 → #F59E0B → #DC2626
 * Input ratio is clamped to [0, 1.25] where 1.0 = yield, 1.25 = max display
 */

export interface SpectrumColor {
  r: number;
  g: number;
  b: number;
  hex: string;
  css: string; // rgb(r,g,b) for CSS gradients
}

/** Tier stops at ratios: 0.0, 0.2, 0.5, 0.8, 1.0, 1.25 */
const TIER_STOPS: Array<{ ratio: number; color: SpectrumColor }> = [
  { ratio: 0.0, color: { r: 29, g: 78, b: 216, hex: "#1D4ED8", css: "rgb(29,78,216)" } },    // Tier 1: Cobalt
  { ratio: 0.2, color: { r: 6, g: 182, b: 212, hex: "#06B6D4", css: "rgb(6,182,212)" } },   // Tier 2: Cyan
  { ratio: 0.5, color: { r: 16, g: 185, b: 129, hex: "#10B981", css: "rgb(16,185,129)" } }, // Tier 3: Emerald
  { ratio: 0.8, color: { r: 245, g: 158, b: 11, hex: "#F59E0B", css: "rgb(245,158,11)" } }, // Tier 4: Amber
  { ratio: 1.0, color: { r: 220, g: 38, b: 38, hex: "#DC2626", css: "rgb(220,38,38)" } },   // Tier 5: Crimson
  { ratio: 1.25, color: { r: 180, g: 0, b: 0, hex: "#B40000", css: "rgb(180,0,0)" } },      // Beyond yield
];

/**
 * Interpolate a color from the 5-tier thermal spectrum.
 * @param ratio Utilization ratio (0..1.25+), clamped internally
 * @returns Tuple [r, g, b] with normalized values (0..1) for Three.js compatibility
 */
export function spectrumColor(ratio: number): [number, number, number] {
  const clamped = Math.max(0, Math.min(1.25, ratio));

  // Find the two stops to interpolate between
  for (let i = 0; i < TIER_STOPS.length - 1; i++) {
    const a = TIER_STOPS[i]!;
    const b = TIER_STOPS[i + 1]!;
    if (clamped >= a.ratio && clamped <= b.ratio) {
      const t = (clamped - a.ratio) / (b.ratio - a.ratio);
      const r = (a.color.r + t * (b.color.r - a.color.r)) / 255;
      const g = (a.color.g + t * (b.color.g - a.color.g)) / 255;
      const b_ = (a.color.b + t * (b.color.b - a.color.b)) / 255;
      return [r, g, b_];
    }
  }

  // Beyond last stop (shouldn't happen with clamping, but safe fallback)
  const last = TIER_STOPS[TIER_STOPS.length - 1]!.color;
  return [last.r / 255, last.g / 255, last.b / 255];
}

/**
 * Interpolate a color from the 5-tier thermal spectrum (object form).
 * @param ratio Utilization ratio (0..1.25+), clamped internally
 * @returns SpectrumColor with r/g/b (0-255), hex, and css rgb()
 */
export function spectrumColorObj(ratio: number): SpectrumColor {
  const clamped = Math.max(0, Math.min(1.25, ratio));

  for (let i = 0; i < TIER_STOPS.length - 1; i++) {
    const a = TIER_STOPS[i]!;
    const b = TIER_STOPS[i + 1]!;
    if (clamped >= a.ratio && clamped <= b.ratio) {
      const t = (clamped - a.ratio) / (b.ratio - a.ratio);
      const r = Math.round(a.color.r + t * (b.color.r - a.color.r));
      const g = Math.round(a.color.g + t * (b.color.g - a.color.g));
      const b_ = Math.round(a.color.b + t * (b.color.b - a.color.b));
      const hex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b_.toString(16).padStart(2, "0")}`;
      return { r, g, b: b_, hex, css: `rgb(${r},${g},${b_})` };
    }
  }

  return TIER_STOPS[TIER_STOPS.length - 1]!.color;
}

/**
 * Generate a CSS linear-gradient string for the thermal legend.
 * Used in results.tsx and DockedInspector.
 */
export function spectrumGradient(): string {
  return `linear-gradient(to right, ${TIER_STOPS.slice(0, 5)
    .map((stop) => `${stop.color.css} ${(stop.ratio / 1.25) * 100}%`)
    .join(", ")})`;
}

/**
 * Get the tier index (1-5) for a given ratio.
 * Used for discrete badge coloring.
 */
export function spectrumTier(ratio: number): 1 | 2 | 3 | 4 | 5 {
  const clamped = Math.max(0, Math.min(1.25, ratio));
  if (clamped < 0.2) return 1;
  if (clamped < 0.5) return 2;
  if (clamped < 0.8) return 3;
  if (clamped <= 1.0) return 4;
  return 5;
}

/**
 * Get tier label for accessibility/tooltips.
 */
export function spectrumTierLabel(tier: 1 | 2 | 3 | 4 | 5): string {
  const labels = {
    1: "Nominal (0–20 %)",
    2: "Low (20–50 %)",
    3: "Elastic (50–80 %)",
    4: "Plastic limit approach (80–100 %)",
    5: "Yield / Buckling failure (>100 %)",
  };
  return labels[tier];
}