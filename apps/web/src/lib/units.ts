/**
 * Display unit conversions (SI -> engineering display units).
 *
 * The entire Rust/WASM core is strict SI (m, N, Pa); conversions live
 * EXCLUSIVELY in this module per ARCHITECTURE.md section 2 pillar rules.
 */

export const MM_PER_M = 1000;
export const KN_PER_N = 1 / 1000;
export const MPA_PER_PA = 1e-6;

export function mToMm(m: number): number {
  return m * MM_PER_M;
}

export function nToKn(n: number): number {
  return n * KN_PER_N;
}

export function paToMpa(pa: number): number {
  return pa * MPA_PER_PA;
}

/** Formats a displacement (m) as millimetres with a fixed precision. */
export function formatMm(m: number, digits = 2): string {
  return `${mToMm(m).toFixed(digits)} mm`;
}

/** Formats a force (N) as kilonewtons. */
export function formatKn(n: number, digits = 1): string {
  return `${nToKn(n).toFixed(digits)} kN`;
}

/** Formats a bending moment (N.m) as kilonewton-metres. */
export function formatKnm(nm: number, digits = 1): string {
  return `${nToKn(nm).toFixed(digits)} kN·m`;
}

/** Formats a stress (Pa) as megapascals. */
export function formatMpa(pa: number, digits = 1): string {
  return `${paToMpa(pa).toFixed(digits)} MPa`;
}

/** Formats a dimensionless utilisation ratio. */
export function formatRatio(ratio: number): string {
  return ratio.toFixed(2);
}
