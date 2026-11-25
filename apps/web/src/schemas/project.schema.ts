import * as v from "valibot";

/**
 * Valibot mirror of the canonical `.rdm` model (SI units) — used to
 * validate every external payload (.rdm import, URL share) before it
 * reaches the solver, per ARCHITECTURE.md section 12.
 */
const NodeSchema = v.object({
  id: v.pipe(v.number(), v.integer()),
  x: v.number(),
  y: v.number(),
  z: v.number(),
});

const BeamSchema = v.object({
  id: v.pipe(v.number(), v.integer()),
  n1: v.pipe(v.number(), v.integer()),
  n2: v.pipe(v.number(), v.integer()),
  section_id: v.string(),
  material_id: v.string(),
  roll_angle_rad: v.optional(v.number(), 0),
  releases_start: v.optional(v.array(v.boolean()), [false, false, false, false, false, false]),
  releases_end: v.optional(v.array(v.boolean()), [false, false, false, false, false, false]),
  k_buckling_y: v.optional(v.number(), 1),
  k_buckling_z: v.optional(v.number(), 1),
});

const SupportSchema = v.object({
  node_id: v.pipe(v.number(), v.integer()),
  locked_dofs: v.array(v.boolean()),
  spring_stiffness: v.optional(v.array(v.number()), [0, 0, 0, 0, 0, 0]),
});

const LoadCase = v.picklist(["Permanent", "Variable", "Wind", "Snow", "Acceleration"]);

const Forces = v.object({
  fx: v.number(),
  fy: v.number(),
  fz: v.number(),
  mx: v.number(),
  my: v.number(),
  mz: v.number(),
});

// The variant discriminates the WHOLE load on "kind"; `case` is a sibling
// field repeated in each option.
const LoadSchema = v.variant("kind", [
  v.object({
    case: LoadCase,
    kind: v.literal("Nodal"),
    node_id: v.pipe(v.number(), v.integer()),
    forces: Forces,
  }),
  v.object({
    case: LoadCase,
    kind: v.literal("PointOnSpan"),
    beam_id: v.pipe(v.number(), v.integer()),
    position_ratio: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
    forces: Forces,
  }),
  v.object({
    case: LoadCase,
    kind: v.literal("Trapezoid"),
    beam_id: v.pipe(v.number(), v.integer()),
    q_start: v.number(),
    q_end: v.number(),
    direction: v.object({ x: v.number(), y: v.number(), z: v.number() }),
  }),
  v.object({
    case: LoadCase,
    // v1.3.0: global acceleration field in dimensionless g multiples;
    // the solver integrates q = ρ·A·g·(ax, ay, az) exactly.
    kind: v.literal("AccelerationField"),
    ax_g: v.number(),
    ay_g: v.number(),
    az_g: v.number(),
  }),
]);

export const StructureSchema = v.object({
  nodes: v.array(NodeSchema),
  beams: v.array(BeamSchema),
  supports: v.array(SupportSchema),
  loads: v.array(LoadSchema),
  sections: v.record(v.string(), v.any()),
  materials: v.record(v.string(), v.any()),
  self_weight_enabled: v.optional(v.boolean(), true),
});

export const ProjectFileSchema = v.object({
  version: v.pipe(v.number(), v.integer()),
  name: v.string(),
  structure: StructureSchema,
});

export type ProjectFileInput = v.InferInput<typeof ProjectFileSchema>;
