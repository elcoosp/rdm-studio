/**
 * 5-tier FEA thermal spectrum (DESIGN.md §2) — extracted verbatim from
 * `apps/web/src/viewport3d/BeamMeshes.tsx` so the hero renders the exact
 * same thermal colors as the studio.
 */
export const SPECTRUM_STOPS: [number, [number, number, number]][] = [
  [0.0, hexToRgb("#1D4ED8")],
  [0.25, hexToRgb("#06B6D4")],
  [0.5, hexToRgb("#10b981")],
  [0.75, hexToRgb("#F59E0B")],
  [1.0, hexToRgb("#DC2626")],
];

const LAST_STOP = SPECTRUM_STOPS[SPECTRUM_STOPS.length - 1] ?? [1, [1, 0, 0]];

export function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [((value >> 16) & 0xff) / 255, ((value >> 8) & 0xff) / 255, (value & 0xff) / 255];
}

export function spectrumColor(ratio: number): [number, number, number] {
  const t = Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 0));
  for (let i = 1; i < SPECTRUM_STOPS.length; i++) {
    const upper = SPECTRUM_STOPS[i];
    const lower = SPECTRUM_STOPS[i - 1];
    if (upper !== undefined && lower !== undefined && t <= upper[0]) {
      const [t1, c1] = upper;
      const [t0, c0] = lower;
      // Exact stop endpoints return the stop color bit-for-bit (a k = 1
      // lerp can drift by one ulp on the round trip).
      if (t === t1) {
        return c1;
      }
      if (t === t0) {
        return c0;
      }
      const k = (t - t0) / (t1 - t0);
      return [
        c0[0] + (c1[0] - c0[0]) * k,
        c0[1] + (c1[1] - c0[1]) * k,
        c0[2] + (c1[2] - c0[2]) * k,
      ];
    }
  }
  return LAST_STOP[1];
}
