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
    // v2.0.0 schema v2: optional partial-span extents + local axes.
    a_start: v.optional(v.nullable(v.number())),
    a_end: v.optional(v.nullable(v.number())),
    local_axes: v.optional(
      v.nullable(
        v.object({
          x: v.object({ x: v.number(), y: v.number(), z: v.number() }),
          y: v.object({ x: v.number(), y: v.number(), z: v.number() }),
          z: v.object({ x: v.number(), y: v.number(), z: v.number() }),
        }),
      ),
    ),
  }),
  v.object({
    case: LoadCase,
    // v2.0.0 schema v2: thermal action — uniform ΔT plus the linear
    // gradients (K); the solver builds the axial + fixed-end moment pairs.
    kind: v.literal("Thermal"),
    beam_id: v.pipe(v.number(), v.integer()),
    dt: v.number(),
    dt_y: v.optional(v.number(), 0),
    dt_z: v.optional(v.number(), 0),
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

/** v2.0.0 schema v2: solver / standard settings block. */
export const SettingsSchema = v.object({
  national_annex: v.optional(v.picklist(["FR", "BE", "DE", "UK", "EN"]), "FR"),
  combination_method: v.optional(v.picklist(["Eq610", "Eq610ab"]), "Eq610"),
  p_delta: v.optional(v.boolean(), false),
  shear_deformation: v.optional(v.boolean(), true),
  plane_frame_2d: v.optional(v.boolean(), false),
});

/** v2.0.0 schema v2: elementary load-case definitions with ψ families. */
export const LoadCaseDefSchema = v.object({
  id: v.pipe(v.number(), v.integer()),
  code: v.string(),
  category: v.picklist([
    "Permanent",
    "Variable",
    "Wind",
    "Snow",
    "Temperature",
    "Accidental",
    "Acceleration",
  ]),
  psi0: v.optional(v.number(), 1.0),
  psi1: v.optional(v.number(), 0.0),
  psi2: v.optional(v.number(), 0.0),
  include_self_weight: v.optional(v.boolean(), false),
});

/** v2.0.0 schema v2: member groups + storey levels. */
export const GroupSchema = v.object({
  id: v.pipe(v.number(), v.integer()),
  name: v.string(),
  beam_ids: v.array(v.pipe(v.number(), v.integer())),
});

export const LevelSchema = v.object({
  id: v.pipe(v.number(), v.integer()),
  elevation: v.number(),
  name: v.optional(v.string()),
});

export const StructureSchema = v.object({
  nodes: v.array(NodeSchema),
  beams: v.array(BeamSchema),
  supports: v.array(SupportSchema),
  loads: v.array(LoadSchema),
  sections: v.record(v.string(), v.any()),
  materials: v.record(v.string(), v.any()),
  self_weight_enabled: v.optional(v.boolean(), true),
  settings: v.optional(SettingsSchema),
  load_cases: v.optional(v.array(LoadCaseDefSchema)),
  groups: v.optional(v.array(GroupSchema)),
  levels: v.optional(v.array(LevelSchema)),
});

export const ProjectFileSchema = v.object({
  version: v.pipe(v.number(), v.integer()),
  name: v.string(),
  structure: StructureSchema,
});

export type ProjectFileInput = v.InferInput<typeof ProjectFileSchema>;
