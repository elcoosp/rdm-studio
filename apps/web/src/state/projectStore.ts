import { get as idbGet, set as idbSet } from "idb-keyval";
import { temporal } from "zundo";
import { create } from "zustand";

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
}

export interface SupportData {
  node_id: number;
  locked_dofs: boolean[];
  spring_stiffness: number[];
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
    }
  | {
      case: LoadCaseId;
      kind: "AccelerationField";
      ax_g: number;
      ay_g: number;
      az_g: number;
    };

export type LoadCaseId = "Permanent" | "Variable" | "Wind" | "Snow" | "Acceleration";

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
  };
}

export interface Selection {
  /** Multi-beam selection (v1.4.0 batch inspector); synced with beamId. */
  selectedBeamIds: number[];
  nodeId: number | null;
  beamId: number | null;
  sectionId: string | null;
}

interface ProjectState {
  project: ProjectData;
  selection: Selection;
  setName: (name: string) => void;
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
  selectBeam: (id: number | null) => void;
  toggleBeamSelection: (id: number) => void;
  selectAllBeams: () => void;
  invertBeamSelection: () => void;
  clearBeamSelection: () => void;
  selectNode: (id: number | null) => void;
  setSupport: (nodeId: number, lockedDofs: boolean[]) => void;
  /** Removes every support (v1.3.0 "Tout supprimer", undoable upstream). */
  clearSupports: () => void;
  addNodalLoad: (
    nodeId: number,
    fz: number,
    loadCase: LoadCaseId,
    fx?: number,
    fy?: number,
  ) => void;
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
 * The 4 one-click quick-start templates of the Step 1 empty state
 * (mockups tape_1): Warren truss, portal frame, cantilever and a
 * 3-span continuous beam.
 */
export function quickStartProject(kind: QuickStartKind): ProjectData {
  if (kind === "warren") {
    // Treillis Warren 24 m: 4 top chords, 4 bottom chords, 4 diagonals.
    const top = [0, 4, 8, 12].map((x, i) => point(i + 1, x, 0, 2.5));
    const bottom = [2, 6, 10].map((x, i) => point(i + 5, x, 0, 0));
    const nodes = [...top, ...bottom];
    const beams = [
      member(1, 1, 2),
      member(2, 2, 3),
      member(3, 3, 4),
      member(4, 5, 6, "IPE 200"),
      member(5, 6, 7, "IPE 200"),
      member(6, 1, 5),
      member(7, 2, 5),
      member(8, 2, 6),
      member(9, 3, 6),
      member(10, 3, 7),
      member(11, 4, 7),
    ].map((b, i) => ({ ...b, id: i + 1 }));
    return {
      version: 1,
      name: "Treillis Warren 24 m",
      structure: {
        nodes,
        beams: beams.map((b, i) => ({ ...b, id: i + 1 })),
        supports: [
          {
            node_id: 1,
            locked_dofs: [true, true, true, false, false, false],
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
  if (kind === "portique") {
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
        loads: [],
        sections: {},
        materials: {},
        self_weight_enabled: false,
      },
    };
  }
  if (kind === "potence") {
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
  // Poutre 3 travées: 12 m, 3 × 4 m spans, continuous.
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
          locked_dofs: [true, true, true, false, false, false],
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

export type QuickStartKind = "warren" | "portique" | "potence" | "travees";

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
      selection: { nodeId: null, beamId: null, sectionId: null, selectedBeamIds: [] },
      setName: (name) => set((st) => ({ project: { ...st.project, name } })),
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
          selection: { ...st.selection, nodeId: id },
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
          selection: { ...st.selection, beamId: id },
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
      selectBeam: (id) =>
        set((st) => ({
          selection: {
            ...st.selection,
            beamId: id,
            // Single pick syncs the batch set to just that member.
            selectedBeamIds: id === null ? [] : [id],
          },
        })),
      /** Shift+Click / batch inspector multi-select (v1.4.0). */
      toggleBeamSelection: (id) =>
        set((st) => {
          const ids = st.selection.selectedBeamIds.includes(id)
            ? st.selection.selectedBeamIds.filter((b) => b !== id)
            : [...st.selection.selectedBeamIds, id];
          return {
            selection: {
              ...st.selection,
              selectedBeamIds: ids,
              beamId: ids[ids.length - 1] ?? st.selection.beamId,
            },
          };
        }),
      selectAllBeams: () =>
        set((st) => ({
          selection: {
            ...st.selection,
            selectedBeamIds: st.project.structure.beams.map((b) => b.id),
          },
        })),
      invertBeamSelection: () =>
        set((st) => ({
          selection: {
            ...st.selection,
            selectedBeamIds: st.project.structure.beams
              .map((b) => b.id)
              .filter((id) => !st.selection.selectedBeamIds.includes(id)),
          },
        })),
      clearBeamSelection: () =>
        set((st) => ({
          selection: { ...st.selection, selectedBeamIds: [], beamId: null },
        })),
      selectNode: (id) => set((st) => ({ selection: { ...st.selection, nodeId: id } })),
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
                    spring_stiffness: [0, 0, 0, 0, 0, 0],
                  },
                ],
              },
            },
          };
        }),
      replaceLoads: (loads) =>
        set((st) => ({
          project: {
            ...st.project,
            structure: { ...st.project.structure, loads },
          },
        })),
      addNodalLoad: (nodeId, fz, loadCase, fx = 0, fy = 0) =>
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
                  forces: { fx, fy, fz, mx: 0, my: 0, mz: 0 },
                },
              ],
            },
          },
        })),
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
