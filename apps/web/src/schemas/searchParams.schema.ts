import * as v from "valibot";

/**
 * URL search schemas (v2.1.0 URL-first refactor): the URL is the SINGLE
 * SOURCE OF TRUTH for every studio UI selection — nothing is mirrored in
 * Zustand or component useState. Each key is wrapped in `v.fallback(...,
 * undefined)` so a malformed query value gracefully falls back instead of
 * throwing a router-level validation error.
 */

/** Compressed `.rdm` payload (`?p=lz-string…`, stripped after hydration). */
const CompressedPayload = v.pipe(v.string(), v.maxLength(120_000));

/**
 * Quick-start template slug (`?template=warren`), stripped after load.
 * v2.3.0: the full resolution set — canonical English slugs, the naval
 * & lifting flagships, every `ENGINEERING_TEMPLATES` id and the legacy
 * French aliases (`warren`, `portique`, `potence`, `travees`).
 */
export const TemplateSlug = v.picklist([
  "portal-frame",
  "warren-truss",
  "continuous-beam",
  "cantilever",
  "pitched-portal",
  "pratt-truss",
  "howe-truss",
  "braced-frame",
  "cantilever-canopy",
  "pedestrian-bridge",
  "naval-cradle",
  "lifting-beam",
  "workshop-jib",
  "offshore-skid",
  "glulam-beam",
  "composite-beam",
  "poutre-isostatique",
  "poutre-continue-3-travees",
  "portique-simple",
  "portique-2-versants",
  "treillis-warren-24",
  "treillis-pratt",
  "treillis-howe",
  "potence-encastree",
  "ossature-r2",
  "auvent-porte-a-faux",
  "passerelle-pietonne",
  "poutre-gl24h",
  "warren",
  "portique",
  "potence",
  "travees",
]);

export type TemplateSlug = v.InferOutput<typeof TemplateSlug>;

/** Selected member / node ids (geometry picker, docked inspector). */
const SelectedId = v.pipe(v.number(), v.integer(), v.minValue(0));

/** Camera preset of the persistent stage (`?view=face-xz`). */
const ViewPreset = v.picklist(["iso", "top-xy", "face-xz", "side-yz"]);

/** Rendering mode of the beam meshes (`?render=wireframe`). */
const RenderModeChoice = v.picklist(["volumetric", "wireframe"]);

/** UI language (`?lang=fr|en`), persists across navigation. */
const LangChoice = v.picklist(["fr", "en"]);

/** Magnetic snap grid in mm (`?snap=50` → 0.05 m). */
const SnapStepMm = v.union([v.literal(10), v.literal(50), v.literal(100)]);

/**
 * Compact active-layer flags (`?layers=nblsL`): presence of a letter = the
 * layer is visible. `n` nodes · `b` beams · `l` loads · `s` supports ·
 * `L` labels · `d` deformed · `m` dims · `r` reactions.
 */
const LayerFlags = v.pipe(
  v.string(),
  v.maxLength(8),
  v.regex(/^[nblsLdmr]{0,8}$/u, "invalid layer flags"),
);

/** Cutting-plane station (`?cutBeam=3&cut=0.5`). */
const Station = v.pipe(v.number(), v.minValue(0), v.maxValue(1));

/**
 * StudioBaseSearchSchema — shared by every `_studio` route (and the
 * pathless `_studio` layout). URL-backed state lives ONLY here.
 */
export const StudioBaseSearchSchema = v.object({
  p: v.fallback(v.optional(CompressedPayload), undefined),
  template: v.fallback(v.optional(TemplateSlug), undefined),
  beam: v.fallback(v.optional(SelectedId), undefined),
  node: v.fallback(v.optional(SelectedId), undefined),
  view: v.fallback(v.optional(ViewPreset), undefined),
  render: v.fallback(v.optional(RenderModeChoice), undefined),
  snap: v.fallback(v.optional(SnapStepMm), undefined),
  layers: v.fallback(v.optional(LayerFlags), undefined),
  cutBeam: v.fallback(v.optional(SelectedId), undefined),
  cut: v.fallback(v.optional(Station), undefined),
  lang: v.fallback(v.optional(LangChoice), undefined),
});

export type StudioBaseSearch = v.InferOutput<typeof StudioBaseSearchSchema>;

/** Step 1 route-specific keys: family filter, dock tab, dock visibility. */
export const GeometrySearchSchema = v.object({
  family: v.fallback(
    v.optional(v.picklist(["Tous", "IPE", "HEA", "UPN", "CHS", "RHS", "L", "Perso"])),
    undefined,
  ),
  tab: v.fallback(v.optional(v.picklist(["nodes", "beams"])), undefined),
  dock: v.fallback(v.optional(v.union([v.literal(0), v.literal(1)])), undefined),
});

export type GeometrySearch = v.InferOutput<typeof GeometrySearchSchema>;

/** Step 3 route-specific keys: EN 1990 case + load-form tab. */
export const LoadsSearchSchema = v.object({
  case: v.fallback(
    v.optional(v.picklist(["Permanent", "Variable", "Wind", "Snow", "Acceleration"])),
    undefined,
  ),
  loadTab: v.fallback(
    v.optional(v.picklist(["nodal", "uniform", "trapezoid", "point"])),
    undefined,
  ),
});

export type LoadsSearch = v.InferOutput<typeof LoadsSearchSchema>;

/** Step 4 route-specific keys: combination, scale, SLS, diagrams, modals. */
export const ResultsSearchSchema = v.object({
  combo: v.fallback(v.optional(v.pipe(v.string(), v.maxLength(40))), undefined),
  scale: v.fallback(v.optional(v.picklist(["ec3", "svm", "auto"])), undefined),
  sls: v.fallback(v.optional(v.union([v.literal(200), v.literal(250), v.literal(300)])), undefined),
  diagrams: v.fallback(v.optional(v.union([v.literal(0), v.literal(1)])), undefined),
  modal: v.fallback(v.optional(v.picklist(["optim", "compare", "connection"])), undefined),
});

export type ResultsSearch = v.InferOutput<typeof ResultsSearchSchema>;

/**
 * The layers compact string ⇆ flags map. Default `nblsL` reproduces the
 * historical store defaults (nodes, beams, loads, supports, labels on;
 * deformed, dims, reactions off).
 */
export const DEFAULT_LAYERS = "nblsL";

export type LayerKey =
  | "nodes"
  | "beams"
  | "loads"
  | "supports"
  | "deformed"
  | "labels"
  | "dims"
  | "reactions";

const LAYER_ALPHABET: Record<LayerKey, string> = {
  nodes: "n",
  beams: "b",
  loads: "l",
  supports: "s",
  deformed: "d",
  labels: "L",
  dims: "m",
  reactions: "r",
};

export function parseLayers(encoded: string | undefined): Record<LayerKey, boolean> {
  const flags = encoded ?? DEFAULT_LAYERS;
  return {
    nodes: flags.includes(LAYER_ALPHABET.nodes),
    beams: flags.includes(LAYER_ALPHABET.beams),
    loads: flags.includes(LAYER_ALPHABET.loads),
    supports: flags.includes(LAYER_ALPHABET.supports),
    deformed: flags.includes(LAYER_ALPHABET.deformed),
    labels: flags.includes(LAYER_ALPHABET.labels),
    dims: flags.includes(LAYER_ALPHABET.dims),
    reactions: flags.includes(LAYER_ALPHABET.reactions),
  };
}

export function serializeLayers(flags: Record<LayerKey, boolean>): string {
  return (Object.keys(LAYER_ALPHABET) as LayerKey[])
    .filter((key) => flags[key])
    .map((key) => LAYER_ALPHABET[key])
    .join("");
}

/** Snap step URL (mm) ⇆ store value (m) conversion. */
export function snapStepFromUrl(mm: number | undefined): 0.01 | 0.05 | 0.1 {
  if (mm === 10) return 0.01;
  if (mm === 100) return 0.1;
  return 0.05;
}

export function snapStepToUrl(step: 0.01 | 0.05 | 0.1): 10 | 50 | 100 {
  if (step === 0.01) return 10;
  if (step === 0.1) return 100;
  return 50;
}

/**
 * Combined per-route schemas: each `_studio` child validates the base
 * schema plus its own keys, so `Route.useSearch()` is fully typed
 * everywhere while the layout keeps its own `p`/`template` access.
 */
export const GeometryFullSearchSchema = v.intersect([StudioBaseSearchSchema, GeometrySearchSchema]);
export const LoadsFullSearchSchema = v.intersect([StudioBaseSearchSchema, LoadsSearchSchema]);
export const ResultsFullSearchSchema = v.intersect([StudioBaseSearchSchema, ResultsSearchSchema]);
