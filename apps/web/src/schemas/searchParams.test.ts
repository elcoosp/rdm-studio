import { describe, expect, it } from "vitest";
import * as v from "valibot";
import { SearchParamsSchema } from "./searchParams.schema";

describe("router search params (valibot)", () => {
  it("parses a full valid set", () => {
    const parsed = v.parse(SearchParamsSchema, {
      step: "results",
      beamId: 12,
      sectionId: "IPE200",
    });
    expect(parsed.beamId).toBe(12);
  });
  it("accepts empty search (all optional)", () => {
    expect(v.parse(SearchParamsSchema, {})).toEqual({});
  });
  it("rejects an unknown step", () => {
    expect(() => v.parse(SearchParamsSchema, { step: "hacker" })).toThrow();
  });
  it("rejects a negative beamId", () => {
    expect(() => v.parse(SearchParamsSchema, { beamId: -1 })).toThrow();
  });
});
