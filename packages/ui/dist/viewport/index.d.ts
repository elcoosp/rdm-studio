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
  css: string;
}
/**
 * Interpolate a color from the 5-tier thermal spectrum.
 * @param ratio Utilization ratio (0..1.25+), clamped internally
 * @returns Tuple [r, g, b] with normalized values (0..1) for Three.js compatibility
 */
export declare function spectrumColor(ratio: number): [number, number, number];
/**
 * Interpolate a color from the 5-tier thermal spectrum (object form).
 * @param ratio Utilization ratio (0..1.25+), clamped internally
 * @returns SpectrumColor with r/g/b (0-255), hex, and css rgb()
 */
export declare function spectrumColorObj(ratio: number): SpectrumColor;
/**
 * Generate a CSS linear-gradient string for the thermal legend.
 * Used in results.tsx and DockedInspector.
 */
export declare function spectrumGradient(): string;
/**
 * Get the tier index (1-5) for a given ratio.
 * Used for discrete badge coloring.
 */
export declare function spectrumTier(ratio: number): 1 | 2 | 3 | 4 | 5;
/**
 * Get tier label for accessibility/tooltips.
 */
export declare function spectrumTierLabel(tier: 1 | 2 | 3 | 4 | 5): string;