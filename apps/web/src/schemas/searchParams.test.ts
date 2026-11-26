import { describe, expect, it } from "vitest";
import * as v from "valibot";
import {
  DEFAULT_LAYERS,
  GeometryFullSearchSchema,
  LoadsFullSearchSchema,
  ResultsFullSearchSchema,
  StudioBaseSearchSchema,
  parseLayers,
  serializeLayers,
  snapStepFromUrl,
  snapStepToUrl,
} from "./searchParams.schema";

describe("studio search params (v2.1.0 URL-first)", () => {
  it("parses a full valid studio query", () => {
    const parsed = v.parse(StudioBaseSearchSchema, {
      beam: 12,
      node: 3,
      view: "face-xz",
      render: "wireframe",
      snap: 50,
      layers: "nblsL",
      cutBeam: 2,
      cut: 0.5,
      template: "warren",
    });
    expect(parsed.beam).toBe(12);
    expect(parsed.template).toBe("warren");
  });
  it("accepts an empty query (all optional)", () => {
    expect(v.parse(StudioBaseSearchSchema, {})).toEqual({});
  });
  it("falls back to undefined instead of throwing on invalid values", () => {
    const parsed = v.parse(StudioBaseSearchSchema, {
      beam: "hacker",
      view: "not-a-view",
      snap: 9999,
      layers: "xyz",
    });
    expect(parsed.beam).toBeUndefined();
    expect(parsed.view).toBeUndefined();
    expect(parsed.snap).toBeUndefined();
    expect(parsed.layers).toBeUndefined();
  });
  it("rejects a negative member id", () => {
    const parsed = v.parse(StudioBaseSearchSchema, { beam: -1 });
    expect(parsed.beam).toBeUndefined();
  });
  it("parses the route-specific geometry keys", () => {
    const parsed = v.parse(GeometryFullSearchSchema, { family: "IPE", tab: "beams", dock: 1 });
    expect(parsed.family).toBe("IPE");
    expect(parsed.tab).toBe("beams");
    expect(parsed.dock).toBe(1);
  });
  it("parses the route-specific loads keys", () => {
    const parsed = v.parse(LoadsFullSearchSchema, { case: "Snow", loadTab: "uniform" });
    expect(parsed.case).toBe("Snow");
    expect(parsed.loadTab).toBe("uniform");
  });
  it("parses the route-specific results keys", () => {
    const parsed = v.parse(ResultsFullSearchSchema, {
      combo: "ULS:0",
      scale: "svm",
      sls: 300,
      diagrams: 1,
      modal: "optim",
    });
    expect(parsed.combo).toBe("ULS:0");
    expect(parsed.sls).toBe(300);
    expect(parsed.diagrams).toBe(1);
  });
  it("round-trips the compact layer flags", () => {
    const flags = parseLayers("nbd");
    expect(flags.nodes).toBe(true);
    expect(flags.beams).toBe(true);
    expect(flags.loads).toBe(false);
    expect(flags.deformed).toBe(true);
    expect(flags.reactions).toBe(false);
    expect(serializeLayers(flags)).toBe("nbd");
  });
  it("defaults to the nblsL baseline", () => {
    const flags = parseLayers(undefined);
    expect(serializeLayers(flags)).toBe(DEFAULT_LAYERS);
  });
  it("converts the snap grid between mm and m", () => {
    expect(snapStepFromUrl(10)).toBe(0.01);
    expect(snapStepFromUrl(undefined)).toBe(0.05);
    expect(snapStepToUrl(0.1)).toBe(100);
  });
});
