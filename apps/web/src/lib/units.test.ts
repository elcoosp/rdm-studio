import { describe, expect, it } from "vitest";
import { formatKn, formatMm, formatMpa, mToMm, nToKn, paToMpa } from "./units";

describe("SI -> display conversions (UI-exclusive)", () => {
  it("converts metres to millimetres", () => {
    expect(mToMm(1.943)).toBeCloseTo(1943, 9);
  });
  it("converts newtons to kilonewtons", () => {
    expect(nToKn(10_000)).toBeCloseTo(10, 9);
  });
  it("converts pascals to megapascals", () => {
    expect(paToMpa(235e6)).toBeCloseTo(235, 6);
  });
  it("formats display strings", () => {
    expect(formatMm(-0.0032677)).toBe("-3.27 mm");
    expect(formatKn(-10_000)).toBe("-10.0 kN");
    expect(formatMpa(235e6)).toBe("235.0 MPa");
  });
});
