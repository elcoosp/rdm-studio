import { get as idbGet, set as idbSet } from "idb-keyval";
import { temporal } from "zundo";
import { create } from "zustand";
import { trackProductEvent } from "@/lib/productTelemetry";
import {
  ENGINEERING_TEMPLATES,
  canonicalSupports,
  type TemplateSeed,
} from "@/lib/engineeringTemplates";

/**
 * Model store (ARCHITECTURE.md section 5, `store.ts`): Zustand + Zundo
 * history + idb-keyval persistence. The stored shape mirrors the canonical
 * `.rdm` JSON exactly (snake_case, SI units) so the worker receives the
 * project file verbatim.
 */
export interface NodeData {
  id: number;
  x: number;
  y: number;
  z: number;
}

export interface BeamData {
  id: number;
  n1: number;
  n2: number;
  section_id: string;
  material_id: string;
  roll_angle_rad: number;
  releases_start: boolean[];
  releases_end: boolean[];
  k_buckling_y: number;
  k_buckling_z: number;
  /** v1.7.0: linear depth taper (scale at n2). */
  taper_end_scale?: number;
  /** v1.7.0: rigid end offsets along the axis (m). */
  end_offsets?: [number, number];
  /** v1.7.0: Standard | TensionOnly | CompressionOnly. */
  behavior?: "Standard" | "TensionOnly" | "CompressionOnly";
}

export interface SupportData {
  node_id: number;
  locked_dofs: boolean[];
  spring_stiffness: number[];
  /** v1.7.0: inclined support direction (global unit vector). */
  incline?: { x: number; y: number; z: number };
  /** v1.7.0: prescribed support settlement (m / rad). */
  settlement?: number[];
}

export interface GlobalForcesData {
  fx: number;
  fy: number;
  fz: number;
  mx: number;
  my: number;
  mz: number;
}

export type LoadData =
  | { case: LoadCaseId; kind: "Nodal"; node_id: number; forces: GlobalForcesData }
  | {
      case: LoadCaseId;
      kind: "PointOnSpan";
      beam_id: number;
      position_ratio: number;
      forces: GlobalForcesData;
    }
  | {
      case: LoadCaseId;
      kind: "Trapezoid";
      beam_id: number;
      q_start: number;
      q_end: number;
      direction: { x: number; y: number; z: number };
      a_start?: number | null;
      a_end?: number | null;
      local_axes?: {
        x: { x: number; y: number; z: number };
        y: { x: number; y: number; z: number };
        z: { x: number; y: number; z: number };
      } | null;
    }
  | {
      // v2.0.2: EN 1991 generators emit Uniform beam loads (snow / wind /
      // imposed) with q_start = q_end and a declared direction.
      case: LoadCaseId;
      kind: "Uniform";
      beam_id: number;
      q_start: number;
      q_end: number;
      direction: { x: number; y: number; z: number };
    }
  | {
      // v2.0.0 schema v2: thermal action (uniform ΔT + gradients, K).
      case: LoadCaseId;
      kind: "Thermal";
      beam_id: number;
      dt: number;
      dt_y?: number;
      dt_z?: number;
    }
  | {
      case: LoadCaseId;
      kind: "AccelerationField";
      ax_g: number;
      ay_g: number;
      az_g: number;
    };

export type LoadCaseId = "Permanent" | "Variable" | "Wind" | "Snow" | "Acceleration";

/** v1.7.0 schema-v2 solver / standard settings. */
export interface ModelSettingsData {
  national_annex: "FR" | "BE" | "DE" | "UK" | "EN";
  combination_method: "Eq610" | "Eq610ab";
  shear_deformation: boolean;
  plane_frame_2d: boolean;
  p_delta?: boolean;
}

export interface ProjectData {
  version: number;
  name: string;
  structure: {
    nodes: NodeData[];
    beams: BeamData[];
    supports: SupportData[];
    loads: LoadData[];
    sections: Record<string, unknown>;
    materials: Record<string, unknown>;
    self_weight_enabled: boolean;
    /** v1.7.0 schema v2: settings / load cases / groups / levels. */
    settings?: ModelSettingsData;
    load_cases?: {
      id: number;
      code: string;
      category: string;
      psi0: number;
      psi1: number;
      psi2: number;
      include_self_weight: boolean;
    }[];
    groups?: { id: number; name: string; beam_ids: number[] }[];
    levels?: { id: number; elevation: number; name?: string }[];
  };
}

/**
 * v2.1.0 URL-first refactor: the SINGLE selection (`nodeId` / `beamId`)
 * lives in the URL (`?node=` / `?beam=`, read through `useSelectedIds()`)
 * and is NOT mirrored here. This store keeps only the multi-beam batch
 * selection (shift-click) which is a transient editing affordance.
 */
export interface BatchSelection {
  /** Multi-beam selection (v1.4.0 batch inspector). */
  selectedBeamIds: number[];
}

interface ProjectState {
  project: ProjectData;
  batch: BatchSelection;
  setName: (name: string) => void;
  /** v1.7.0: updates the solver/standard settings (schema v2). */
  updateSettings: (patch: Partial<ModelSettingsData>) => void;
  addNode: (x: number, y: number, z: number) => number;
  moveNode: (id: number, x: number, y: number, z: number) => void;
  removeNode: (id: number) => void;
  addBeam: (n1: number, n2: number, sectionId: string, materialId: string) => number;
  removeBeam: (id: number) => void;
  /** Patches one member (section, releases, roll angle, buckling lengths). */
  updateBeam: (id: number, patch: Partial<BeamData>) => void;
  /**
   * Batch member patch (v1.1.0 bug 9: multi-select editor) — every id in
   * `ids` receives the same partial patch.
   */
  batchUpdateBeams: (ids: number[], patch: Partial<BeamData>) => void;
  /**
   * Distributed / span load on one member (v1.1.0 bug 9). `Trapezoid`
   * covers uniform (`qStart === qEnd`) and linearly varying loads in N/m
   * along `direction`; `PointOnSpan` places a concentrated load
   * (`GlobalForcesData`) at `positionRatio` in [0, 1].
   */
  /**
   * Global acceleration field (v1.3.0): dimensionless g multiples solved
   * analytically as `q = ρ·A·g·(ax, ay, az)` body force in Rust.
   */
  addAccelerationField: (input: {
    loadCase: LoadCaseId;
    axG: number;
    ayG: number;
    azG: number;
  }) => void;
  addBeamSpanLoad: (input: {
    beamId: number;
    loadCase: LoadCaseId;
    kind: "Trapezoid" | "PointOnSpan";
    qStart?: number;
    qEnd?: number;
    direction?: { x: number; y: number; z: number };
    forces?: GlobalForcesData;
    positionRatio?: number;
  }) => void;
  toggleBeamSelection: (id: number) => void;
  selectAllBeams: () => void;
  invertBeamSelection: () => void;
  clearBeamSelection: () => void;
  setSupport: (nodeId: number, lockedDofs: boolean[]) => void;
  /**
   * v1.6.0: elastic spring stiffnesses `[kx..krz]` (N/m, N·m/rad) of one
   * support — wired to `Support.spring_stiffness` in Step 2.
   */
  setSupportSprings: (nodeId: number, springs: number[]) => void;
  /** v1.6.0: removes the support on one node (Step 2 `×` button). */
  removeSupport: (nodeId: number) => void;
  /** Removes every support (v1.3.0 "Tout supprimer", undoable upstream). */
  clearSupports: () => void;
  addNodalLoad: (
    nodeId: number,
    fz: number,
    loadCase: LoadCaseId,
    fx?: number,
    fy?: number,
    moments?: { mx: number; my: number; mz: number },
  ) => void;
  /**
   * v1.6.0: splits one member into `N` equal collinear segments with
   * intermediate nodes, preserving section, material, roll angle and
   * `k_buckling` (Step 1 `Subdiviser en N tronçons`); undoable via zundo.
   */
  subdivideBeam: (beamId: number, segments: number) => void;
  /** Replaces the whole load list (v1.3.0: "Vider les charges" undo). */
  replaceLoads: (loads: LoadData[]) => void;
  removeLoad: (index: number) => void;
  toggleSelfWeight: () => void;
  loadProject: (project: ProjectData) => void;
  resetDemo: () => void;
}

/** Beam member factory (dense 1-based ids, full releases off). */
function member(
  id: number,
  n1: number,
  n2: number,
  sectionId = "IPE 200",
  materialId = "S235JR",
): BeamData {
  return {
    id,
    n1,
    n2,
    section_id: sectionId,
    material_id: materialId,
    roll_angle_rad: 0,
    releases_start: [false, false, false, false, false, false],
    releases_end: [false, false, false, false, false, false],
    k_buckling_y: 1,
    k_buckling_z: 1,
  };
}

function point(id: number, x: number, y: number, z: number): NodeData {
  return { id, x, y, z };
}

/**
 * Converts an `ENGINEERING_TEMPLATES` seed into a loadable project —
 * the same mapping the gallery uses (v2.3.0): explicit seed supports
 * win over the canonical ground restraints (naval cradle, lifting
 * beam), the `AccelerationField` load rides through verbatim, and
 * nodal loads keep their horizontal (fx / fy) components.
 */
function projectFromTemplateSeed(seed: TemplateSeed): ProjectData {
  return {
    version: 2,
    name: seed.name,
    structure: {
      nodes: seed.nodes,
      beams: seed.beams.map((beam) => ({
        ...beam,
        roll_angle_rad: 0,
        releases_start: [false, false, false, false, false, false],
        releases_end: [false, false, false, false, false, false],
        k_buckling_y: 1,
        k_buckling_z: 1,
      })),
      supports: (seed.supports ?? canonicalSupports(seed)).map((sup) => ({
        ...sup,
        spring_stiffness: [0, 0, 0, 0, 0, 0] as number[],
      })),
      loads: seed.loads.map((load) =>
        load.kind === "AccelerationField"
          ? {
              case: load.case,
              kind: "AccelerationField" as const,
              ax_g: load.ax_g,
              ay_g: load.ay_g,
              az_g: load.az_g,
            }
          : {
              case: load.case,
              kind: load.kind,
              beam_id: load.beam_id ?? 0,
              node_id: load.node_id ?? 0,
              position_ratio: load.position_ratio ?? 0.5,
              q_start: load.q_start ?? 0,
              q_end: load.q_end ?? 0,
              forces: {
                fx: load.fx ?? 0,
                fy: load.fy ?? 0,
                fz: load.fz ?? 0,
                mx: 0,
                my: 0,
                mz: 0,
              },
              direction: load.direction ?? { x: 0, y: 0, z: -1 },
            },
      ),
      sections: {},
      materials: {},
      self_weight_enabled: false,
    },
  };
}

/**
 * Canonical English `?template=` slugs → legacy quick-start kind
 * (`portal-frame` is the 18 m portal, `warren-truss` the 24 m Warren,
 * `continuous-beam` the 3-span beam, `cantilever` the jib).
 */
const CANONICAL_QUICK_START: Record<string, "warren" | "portique" | "potence" | "travees"> = {
  "portal-frame": "portique",
  "warren-truss": "warren",
  "continuous-beam": "travees",
  cantilever: "potence",
};

/**
 * English `?template=` slugs for the gallery engineering templates
 * (the `TemplateSlug` picklist values with no French id of their own).
 */
const ENGLISH_TEMPLATE_SLUGS: Record<string, string> = {
  "pitched-portal": "portique-2-versants",
  "pratt-truss": "treillis-pratt",
  "howe-truss": "treillis-howe",
  "braced-frame": "ossature-r2",
  "cantilever-canopy": "auvent-porte-a-faux",
  "pedestrian-bridge": "passerelle-pietonne",
  "glulam-beam": "poutre-gl24h",
  "offshore-skid": "naval-cradle",
};

/**
 * The one-click quick-start templates of the Step 1 empty state
 * (mockups tape_1): Warren truss, portal frame, cantilever and a
 * 3-span continuous beam — plus the naval & lifting flagships
 * (v2.3.0) and every `ENGINEERING_TEMPLATES` id, all reachable from
 * `?template=<slug>`.
 */
export function quickStartProject(kind: QuickStartKind): ProjectData {
  const normalized = CANONICAL_QUICK_START[kind] ?? kind;
  if (normalized === "warren") {
    // Treillis Warren 24 m: 4 bays × 6 m, bottom chord z = 0, top chord
    // z = 3 m — the same geometry as the gallery parametric Warren
    // (`buildTemplate("warren")`). v2.3.0: the old layout spanned 12 m
    // (4 m bays) despite the "24 m" title. Supports mirror the
    // parametric Warren (encastre + Tz roller) so the Rx rigid mode is
    // restrained and the model solves out of the box.
    const nodes = [
      point(1, 0, 0, 0),
      point(2, 6, 0, 0),
      point(3, 12, 0, 0),
      point(4, 18, 0, 0),
      point(5, 24, 0, 0),
      point(6, 3, 0, 3),
      point(7, 9, 0, 3),
      point(8, 15, 0, 3),
      point(9, 21, 0, 3),
    ];
    const beams = [
      member(1, 1, 6),
      member(2, 6, 2),
      member(3, 2, 7),
      member(4, 7, 3),
      member(5, 3, 8),
      member(6, 8, 4),
      member(7, 4, 9),
      member(8, 9, 5),
      member(9, 6, 7),
      member(10, 7, 8),
      member(11, 8, 9),
    ];
    return {
      version: 1,
      name: "Treillis Warren 24 m",
      structure: {
        nodes,
        beams,
        supports: [
          {
            node_id: 1,
            locked_dofs: [true, true, true, true, true, true],
            spring_stiffness: [0, 0, 0, 0, 0, 0],
          },
          {
            node_id: 5,
            locked_dofs: [false, false, true, false, false, false],
            spring_stiffness: [0, 0, 0, 0, 0, 0],
          },
        ],
        loads: [],
        sections: {},
        materials: {},
        self_weight_enabled: false,
      },
    };
  }
  if (normalized === "portique") {
    // Portique 18 m: two 5 m columns + an 18 m? -> standard 18 m portal.
    const nodes = [point(1, 0, 0, 0), point(2, 0, 0, 5), point(3, 18, 0, 5), point(4, 18, 0, 0)];
    return {
      version: 1,
      name: "Portique 18 m",
      structure: {
        nodes,
        beams: [member(1, 1, 2, "HEA 200"), member(2, 2, 3, "IPE 300"), member(3, 3, 4, "HEA 200")],
        supports: [
          {
            node_id: 1,
            locked_dofs: [true, true, true, true, false, false],
            spring_stiffness: [0, 0, 0, 0, 0, 0],
          },
          {
            node_id: 4,
            locked_dofs: [false, true, true, false, false, false],
            spring_stiffness: [0, 0, 0, 0, 0, 0],
          },
        ],
        // v2.3.0: realistic roof load (-12 kN/m on the IPE 300 rafter)
        // so Step 4 shows non-zero moments, deflections and EC3 rates
        // with zero manual setup.
        loads: [
          {
            case: "Permanent",
            kind: "Trapezoid",
            beam_id: 2,
            q_start: -12000,
            q_end: -12000,
            direction: { x: 0, y: 0, z: -1 },
          },
        ],
        sections: {},
        materials: {},
        self_weight_enabled: false,
      },
    };
  }
  if (normalized === "potence") {
    // Potence HEA 200: 6 m cantilever + tie.
    const nodes = [point(1, 0, 0, 0), point(2, 6, 0, 0), point(3, 0, 0, 4)];
    return {
      version: 1,
      name: "Potence HEA 200",
      structure: {
        nodes,
        beams: [member(1, 1, 2, "HEA 200"), member(2, 2, 3, "IPE 140")],
        supports: [
          {
            node_id: 1,
            locked_dofs: [true, true, true, true, true, true],
            spring_stiffness: [0, 0, 0, 0, 0, 0],
          },
          {
            node_id: 3,
            locked_dofs: [false, true, true, false, false, false],
            spring_stiffness: [0, 0, 0, 0, 0, 0],
          },
        ],
        loads: [],
        sections: {},
        materials: {},
        self_weight_enabled: false,
      },
    };
  }
  // v2.3.0: naval & lifting flagships + every ENGINEERING_TEMPLATES id
  // (plus the English template slugs) resolve through the seed table —
  // anything else falls through to the 3-span beam below.
  const templateId = ENGLISH_TEMPLATE_SLUGS[normalized] ?? normalized;
  const seed = ENGINEERING_TEMPLATES.find((t) => t.id === templateId);
  if (seed !== undefined) {
    return projectFromTemplateSeed(seed);
  }
  // Poutre 3 travées: 12 m, 3 × 4 m spans, continuous.
  // v2.1.1: node 1 also locks Rx (torsion) — a 3D 6-DOF model without ANY
  // Rx restraint can rotate about the global X axis and the solver
  // (rightly) rejects it as a mechanism.
  const nodes = [0, 4, 8, 12].map((x, i) => point(i + 1, x, 0, 0));
  return {
    version: 1,
    name: "Poutre 3 travées",
    structure: {
      nodes,
      beams: [member(1, 1, 2), member(2, 2, 3), member(3, 3, 4)],
      supports: [
        {
          node_id: 1,
          locked_dofs: [true, true, true, true, false, false],
          spring_stiffness: [0, 0, 0, 0, 0, 0],
        },
        {
          node_id: 2,
          locked_dofs: [false, true, true, false, false, false],
          spring_stiffness: [0, 0, 0, 0, 0, 0],
        },
        {
          node_id: 3,
          locked_dofs: [false, true, true, false, false, false],
          spring_stiffness: [0, 0, 0, 0, 0, 0],
        },
        {
          node_id: 4,
          locked_dofs: [false, true, true, false, false, false],
          spring_stiffness: [0, 0, 0, 0, 0, 0],
        },
      ],
      loads: [],
      sections: {},
      materials: {},
      self_weight_enabled: false,
    },
  };
}

/**
 * v2.3.0: every `?template=` slug the studio resolves — the 4 legacy
 * French kinds, the canonical English slugs, the naval & lifting
 * flagships, the English gallery slugs and every
 * `ENGINEERING_TEMPLATES` id.
 */
export type QuickStartKind =
  | "warren"
  | "portique"
  | "potence"
  | "travees"
  | "portal-frame"
  | "warren-truss"
  | "continuous-beam"
  | "cantilever"
  | "naval-cradle"
  | "lifting-beam"
  | "workshop-jib"
  | "pitched-portal"
  | "pratt-truss"
  | "howe-truss"
  | "braced-frame"
  | "cantilever-canopy"
  | "pedestrian-bridge"
  | "glulam-beam"
  | "offshore-skid"
  | "composite-beam"
  | "poutre-isostatique"
  | "poutre-continue-3-travees"
  | "portique-simple"
  | "portique-2-versants"
  | "treillis-warren-24"
  | "treillis-pratt"
  | "treillis-howe"
  | "potence-encastree"
  | "ossature-r2"
  | "auvent-porte-a-faux"
  | "passerelle-pietonne"
  | "poutre-gl24h";

/** Canonical demo model: simply supported IPE 200 beam, 4 m, 10 kN midspan. */
export function demoProject(): ProjectData {
  return {
    version: 1,
    name: "Poutre démo",
    structure: {
      nodes: [
        { id: 1, x: 0, y: 0, z: 0 },
        { id: 2, x: 2, y: 0, z: 0 },
        { id: 3, x: 4, y: 0, z: 0 },
      ],
      beams: [
        {
          id: 1,
          n1: 1,
          n2: 2,
          section_id: "IPE 200",
          material_id: "S235JR",
          roll_angle_rad: 0,
          releases_start: [false, false, false, false, false, false],
          releases_end: [false, false, false, false, false, false],
          k_buckling_y: 1,
          k_buckling_z: 1,
        },
        {
          id: 2,
          n1: 2,
          n2: 3,
          section_id: "IPE 200",
          material_id: "S235JR",
          roll_angle_rad: 0,
          releases_start: [false, false, false, false, false, false],
          releases_end: [false, false, false, false, false, false],
          k_buckling_y: 1,
          k_buckling_z: 1,
        },
      ],
      supports: [
        {
          node_id: 1,
          locked_dofs: [true, true, true, true, false, false],
          spring_stiffness: [0, 0, 0, 0, 0, 0],
        },
        {
          node_id: 3,
          locked_dofs: [false, true, true, false, false, false],
          spring_stiffness: [0, 0, 0, 0, 0, 0],
        },
      ],
      loads: [
        {
          case: "Variable",
          kind: "PointOnSpan",
          beam_id: 1,
          position_ratio: 0.5,
          forces: { fx: 0, fy: 0, fz: -10000, mx: 0, my: 0, mz: 0 },
        },
      ],
      sections: {},
      materials: {},
      self_weight_enabled: true,
    },
  };
}

const IDB_KEY = "rdm-studio-project";

export const useProjectStore = create<ProjectState>()(
  temporal(
    (set, get) => ({
      project: demoProject(),
      batch: { selectedBeamIds: [] },
      setName: (name) => set((st) => ({ project: { ...st.project, name } })),
      updateSettings: (patch) =>
        set((st) => ({
          project: {
            ...st.project,
            structure: {
              ...st.project.structure,
              settings: {
                national_annex: "FR",
                combination_method: "Eq610",
                shear_deformation: true,
                plane_frame_2d: false,
                ...st.project.structure.settings,
                ...patch,
              } as ModelSettingsData,
            },
          },
        })),
      addNode: (x, y, z) => {
        const id = get().project.structure.nodes.reduce((m, n) => Math.max(m, n.id), 0) + 1;
        set((st) => ({
          project: {
            ...st.project,
            structure: {
              ...st.project.structure,
              nodes: [...st.project.structure.nodes, { id, x, y, z }],
            },
          },
        }));
        return id;
      },
      moveNode: (id, x, y, z) =>
        set((st) => ({
          project: {
            ...st.project,
            structure: {
              ...st.project.structure,
              nodes: st.project.structure.nodes.map((n) => (n.id === id ? { ...n, x, y, z } : n)),
            },
          },
        })),
      removeNode: (id) =>
        set((st) => ({
          project: {
            ...st.project,
            structure: {
              ...st.project.structure,
              nodes: st.project.structure.nodes.filter((n) => n.id !== id),
              beams: st.project.structure.beams.filter((b) => b.n1 !== id && b.n2 !== id),
              supports: st.project.structure.supports.filter((s) => s.node_id !== id),
              loads: st.project.structure.loads.filter(
                (l) => l.kind !== "Nodal" || l.node_id !== id,
              ),
            },
          },
        })),
      addBeam: (n1, n2, sectionId, materialId) => {
        const id = get().project.structure.beams.reduce((m, b) => Math.max(m, b.id), 0) + 1;
        set((st) => ({
          project: {
            ...st.project,
            structure: {
              ...st.project.structure,
              beams: [
                ...st.project.structure.beams,
                {
                  id,
                  n1,
                  n2,
                  section_id: sectionId,
                  material_id: materialId,
                  roll_angle_rad: 0,
                  releases_start: [false, false, false, false, false, false],
                  releases_end: [false, false, false, false, false, false],
                  k_buckling_y: 1,
                  k_buckling_z: 1,
                },
              ],
            },
          },
        }));
        return id;
      },
      updateBeam: (id, patch) =>
        set((st) => ({
          project: {
            ...st.project,
            structure: {
              ...st.project.structure,
              beams: st.project.structure.beams.map((b) => (b.id === id ? { ...b, ...patch } : b)),
            },
          },
        })),
      batchUpdateBeams: (ids, patch) =>
        set((st) => {
          const selected = new Set(ids);
          return {
            project: {
              ...st.project,
              structure: {
                ...st.project.structure,
                beams: st.project.structure.beams.map((b) =>
                  selected.has(b.id) ? { ...b, ...patch } : b,
                ),
              },
            },
          };
        }),
      addAccelerationField: (input) =>
        set((st) => {
          // Replace any existing field: one acceleration state per project.
          const loads = st.project.structure.loads.filter((l) => l.kind !== "AccelerationField");
          return {
            project: {
              ...st.project,
              structure: {
                ...st.project.structure,
                loads: [
                  ...loads,
                  {
                    case: input.loadCase,
                    kind: "AccelerationField",
                    ax_g: input.axG,
                    ay_g: input.ayG,
                    az_g: input.azG,
                  },
                ],
              },
            },
          };
        }),
      addBeamSpanLoad: (input) =>
        set((st) => {
          const load: LoadData =
            input.kind === "Trapezoid"
              ? {
                  case: input.loadCase,
                  kind: "Trapezoid",
                  beam_id: input.beamId,
                  q_start: input.qStart ?? 0,
                  q_end: input.qEnd ?? input.qStart ?? 0,
                  direction: input.direction ?? { x: 0, y: 0, z: -1 },
                }
              : {
                  case: input.loadCase,
                  kind: "PointOnSpan",
                  beam_id: input.beamId,
                  position_ratio: input.positionRatio ?? 0.5,
                  forces: input.forces ?? { fx: 0, fy: 0, fz: 0, mx: 0, my: 0, mz: 0 },
                };
          return {
            project: {
              ...st.project,
              structure: {
                ...st.project.structure,
                loads: [...st.project.structure.loads, load],
              },
            },
          };
        }),
      removeBeam: (id) =>
        set((st) => ({
          project: {
            ...st.project,
            structure: {
              ...st.project.structure,
              beams: st.project.structure.beams.filter((b) => b.id !== id),
            },
          },
        })),
      /** Shift+Click / batch inspector multi-select (v1.4.0). */
      toggleBeamSelection: (id) =>
        set((st) => {
          const ids = st.batch.selectedBeamIds.includes(id)
            ? st.batch.selectedBeamIds.filter((b) => b !== id)
            : [...st.batch.selectedBeamIds, id];
          return { batch: { selectedBeamIds: ids } };
        }),
      selectAllBeams: () =>
        set((st) => ({
          batch: { selectedBeamIds: st.project.structure.beams.map((b) => b.id) },
        })),
      invertBeamSelection: () =>
        set((st) => ({
          batch: {
            selectedBeamIds: st.project.structure.beams
              .map((b) => b.id)
              .filter((id) => !st.batch.selectedBeamIds.includes(id)),
          },
        })),
      clearBeamSelection: () => set((st) => ({ batch: { ...st.batch, selectedBeamIds: [] } })),
      clearSupports: () =>
        set((st) => ({
          project: {
            ...st.project,
            structure: { ...st.project.structure, supports: [] },
          },
        })),
      setSupport: (nodeId, lockedDofs) =>
        set((st) => {
          const others = st.project.structure.supports.filter((s) => s.node_id !== nodeId);
          const existing = st.project.structure.supports.find((s) => s.node_id === nodeId);
          return {
            project: {
              ...st.project,
              structure: {
                ...st.project.structure,
                supports: [
                  ...others,
                  {
                    node_id: nodeId,
                    locked_dofs: lockedDofs,
                    spring_stiffness: existing?.spring_stiffness ?? [0, 0, 0, 0, 0, 0],
                  },
                ],
              },
            },
          };
        }),
      setSupportSprings: (nodeId, springs) =>
        set((st) => {
          const others = st.project.structure.supports.filter((s) => s.node_id !== nodeId);
          const existing = st.project.structure.supports.find((s) => s.node_id === nodeId);
          const normalized = [0, 0, 0, 0, 0, 0].map(
            (fallback, i) => springs[i] ?? existing?.spring_stiffness[i] ?? fallback,
          );
          return {
            project: {
              ...st.project,
              structure: {
                ...st.project.structure,
                supports: [
                  ...others,
                  {
                    node_id: nodeId,
                    locked_dofs: existing?.locked_dofs ?? [
                      false,
                      false,
                      false,
                      false,
                      false,
                      false,
                    ],
                    spring_stiffness: normalized,
                  },
                ],
              },
            },
          };
        }),
      removeSupport: (nodeId) =>
        set((st) => ({
          project: {
            ...st.project,
            structure: {
              ...st.project.structure,
              supports: st.project.structure.supports.filter((s) => s.node_id !== nodeId),
            },
          },
        })),
      replaceLoads: (loads) =>
        set((st) => ({
          project: {
            ...st.project,
            structure: { ...st.project.structure, loads },
          },
        })),
      addNodalLoad: (nodeId, fz, loadCase, fx = 0, fy = 0, moments) =>
        set((st) => ({
          project: {
            ...st.project,
            structure: {
              ...st.project.structure,
              loads: [
                ...st.project.structure.loads,
                {
                  case: loadCase,
                  kind: "Nodal",
                  node_id: nodeId,
                  forces: {
                    fx,
                    fy,
                    fz,
                    mx: moments?.mx ?? 0,
                    my: moments?.my ?? 0,
                    mz: moments?.mz ?? 0,
                  },
                },
              ],
            },
          },
        })),
      subdivideBeam: (beamId, segments) =>
        set((st) => {
          // v1.6.0: N equal collinear segments; intermediate nodes inherit
          // nothing, members keep section / material / roll / k_buckling.
          const n = Math.min(24, Math.max(2, Math.round(segments)));
          const beam = st.project.structure.beams.find((b) => b.id === beamId);
          if (beam === undefined) {
            return st;
          }
          const n1 = st.project.structure.nodes.find((p) => p.id === beam.n1);
          const n2 = st.project.structure.nodes.find((p) => p.id === beam.n2);
          if (n1 === undefined || n2 === undefined) {
            return st;
          }
          let nextId = st.project.structure.nodes.reduce((m, p) => Math.max(m, p.id), 0) + 1;
          const innerNodes: NodeData[] = [];
          for (let i = 1; i < n; i++) {
            const t = i / n;
            innerNodes.push({
              id: nextId,
              x: n1.x + (n2.x - n1.x) * t,
              y: n1.y + (n2.y - n1.y) * t,
              z: n1.z + (n2.z - n1.z) * t,
            });
            nextId += 1;
          }
          const chain = [n1.id, ...innerNodes.map((p) => p.id), n2.id];
          let nextBeamId = st.project.structure.beams.reduce((m, b) => Math.max(m, b.id), 0) + 1;
          const segments2: BeamData[] = [];
          for (let i = 0; i < chain.length - 1; i++) {
            const start = chain[i];
            const end = chain[i + 1];
            if (start === undefined || end === undefined) {
              continue;
            }
            segments2.push({
              ...beam,
              id: nextBeamId,
              n1: start,
              n2: end,
              // Outer ends keep the original releases; interior joints are
              // rigid so the subdivided member behaves as one continuous bar.
              releases_start:
                i === 0 ? [...beam.releases_start] : [false, false, false, false, false, false],
              releases_end:
                i === chain.length - 2
                  ? [...beam.releases_end]
                  : [false, false, false, false, false, false],
            });
            nextBeamId += 1;
          }
          // v1.6.0: span loads follow the subdivided member — a trapezoid
          // is re-sampled per segment (exact for the linear variation), a
          // point-on-span is re-targeted onto its host segment.
          const remappedLoads: LoadData[] = [];
          for (const load of st.project.structure.loads) {
            if (load.kind === "Trapezoid" && load.beam_id === beamId) {
              for (let i = 0; i < n; i++) {
                const host = segments2[i];
                if (host === undefined) {
                  continue;
                }
                const q1 = load.q_start + (load.q_end - load.q_start) * (i / n);
                const q2 = load.q_start + (load.q_end - load.q_start) * ((i + 1) / n);
                remappedLoads.push({
                  case: load.case,
                  kind: "Trapezoid",
                  beam_id: host.id,
                  q_start: q1,
                  q_end: q2,
                  direction: { ...load.direction },
                });
              }
              continue;
            }
            if (load.kind === "PointOnSpan" && load.beam_id === beamId && n > 1) {
              const globalT = load.position_ratio * n;
              const segmentIndex = Math.min(n - 1, Math.floor(globalT));
              const host = segments2[segmentIndex];
              if (host === undefined) {
                remappedLoads.push(load);
                continue;
              }
              remappedLoads.push({
                ...load,
                beam_id: host.id,
                position_ratio: globalT - segmentIndex,
              });
              continue;
            }
            remappedLoads.push(load);
          }
          return {
            project: {
              ...st.project,
              structure: {
                ...st.project.structure,
                nodes: [...st.project.structure.nodes, ...innerNodes],
                beams: [...st.project.structure.beams.filter((b) => b.id !== beamId), ...segments2],
                loads: remappedLoads,
              },
            },
          };
        }),
      removeLoad: (index) =>
        set((st) => ({
          project: {
            ...st.project,
            structure: {
              ...st.project.structure,
              loads: st.project.structure.loads.filter((_, i) => i !== index),
            },
          },
        })),
      toggleSelfWeight: () =>
        set((st) => ({
          project: {
            ...st.project,
            structure: {
              ...st.project.structure,
              self_weight_enabled: !st.project.structure.self_weight_enabled,
            },
          },
        })),
      loadProject: (project) => set({ project }),
      resetDemo: () => set({ project: demoProject() }),
    }),
    {
      limit: 50,
      partialize: (st) => ({ project: st.project }),
    },
  ),
);

export function nextNodeId(project: ProjectData): number {
  return project.structure.nodes.reduce((m, n) => Math.max(m, n.id), 0) + 1;
}

// --- idb-keyval persistence (debounced) --------------------------------
let persistTimer: ReturnType<typeof setTimeout> | undefined;
useProjectStore.subscribe((state) => {
  if (persistTimer !== undefined) {
    clearTimeout(persistTimer);
  }
  persistTimer = setTimeout(() => {
    void idbSet(IDB_KEY, state.project);
  }, 300);
});

/** Undo/Redo over the model history (zundo temporal). */
export function undoModel(): void {
  useProjectStore.temporal.getState().undo();
  const count = useProjectStore.getState().batch.selectedBeamIds.length;
  void trackProductEvent("undo_burst", { count });
}

export function redoModel(): void {
  useProjectStore.temporal.getState().redo();
}

/** Rehydrates the last persisted project, if any. */
export async function rehydrateProject(): Promise<boolean> {
  const stored = (await idbGet(IDB_KEY)) as ProjectData | undefined;
  if (stored === undefined) {
    return false;
  }
  useProjectStore.getState().loadProject(stored);
  return true;
}
