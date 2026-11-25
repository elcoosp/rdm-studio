import { useEffect, useState } from "react";
import { get, set } from "idb-keyval";
import { useProjectStore, type ProjectData } from "@/state/projectStore";

/**
 * Project gallery modal (mockups cran_7): saved models from IndexedDB
 * (idb-keyval) plus four parametric templates — Treillis Warren 24 m,
 * Portique industriel, Potence encastrée, Poutre continue.
 */
const GALLERY_KEY = "rdm-projects";

export interface GalleryEntry {
  id: string;
  name: string;
  savedAt: string;
  project: ProjectData;
}

export async function saveToGallery(project: ProjectData): Promise<void> {
  const list = (await get<GalleryEntry[]>(GALLERY_KEY)) ?? [];
  const entry: GalleryEntry = {
    id: `${Date.now()}`,
    name: project.name,
    savedAt: new Date().toISOString(),
    project,
  };
  await set(GALLERY_KEY, [entry, ...list].slice(0, 12));
}

/** Parametric template builders (SI units, simply supported layouts). */
export function buildTemplate(kind: string): ProjectData {
  const node = (id: number, x: number, y: number, z: number) => ({ id, x, y, z });
  const beam = (id: number, n1: number, n2: number) => ({
    id,
    n1,
    n2,
    section_id: "IPE 200",
    material_id: "S235JR",
    roll_angle_rad: 0,
    releases_start: [false, false, false, false, false, false],
    releases_end: [false, false, false, false, false, false],
    k_buckling_y: 1,
    k_buckling_z: 1,
  });
  const support = (nodeId: number, locked: boolean[]) => ({
    node_id: nodeId,
    locked_dofs: locked,
    spring_stiffness: [0, 0, 0, 0, 0, 0],
  });
  const load = (nodeId: number, fz: number) => ({
    case: "Permanent" as const,
    kind: "Nodal" as const,
    node_id: nodeId,
    forces: { fx: 0, fy: 0, fz, mx: 0, my: 0, mz: 0 },
  });
  const base = {
    version: 1,
    structure: {
      supports: [] as ReturnType<typeof support>[],
      loads: [] as ReturnType<typeof load>[],
      self_weight_enabled: true,
      sections: {},
      materials: {},
    },
    selection: { nodeId: null, beamId: null },
  };
  switch (kind) {
    case "warren": {
      // Treillis Warren 24 m — 4 panneaux de 6 m, h = 3 m.
      const nodes = [
        node(1, 0, 0, 0),
        node(2, 6, 0, 0),
        node(3, 12, 0, 0),
        node(4, 18, 0, 0),
        node(5, 24, 0, 0),
        node(6, 3, 0, 3),
        node(7, 9, 0, 3),
        node(8, 15, 0, 3),
        node(9, 21, 0, 3),
      ];
      const beams = [
        beam(1, 1, 6),
        beam(2, 6, 2),
        beam(3, 2, 7),
        beam(4, 7, 3),
        beam(5, 3, 8),
        beam(6, 8, 4),
        beam(7, 4, 9),
        beam(8, 9, 5),
        beam(9, 6, 7),
        beam(10, 7, 8),
        beam(11, 8, 9),
      ];
      return {
        ...base,
        name: "Treillis Warren 24 m",
        structure: {
          ...base.structure,
          nodes,
          beams,
          supports: [
            support(1, [true, true, true, true, true, true]),
            support(5, [false, false, true, false, false, false]),
          ],
          loads: [load(7, -30000), load(8, -30000)],
        },
      };
    }
    case "portique": {
      // Portique industriel — travée 12 m, hauteur 5 m.
      return {
        ...base,
        name: "Portique industriel",
        structure: {
          ...base.structure,
          nodes: [node(1, 0, 0, 0), node(2, 12, 0, 0), node(3, 12, 0, 5), node(4, 0, 0, 5)],
          beams: [beam(1, 1, 4), beam(2, 4, 3), beam(3, 3, 2)],
          supports: [
            support(1, [true, true, true, true, true, true]),
            support(2, [false, false, true, false, false, false]),
          ],
          loads: [load(3, -40000)],
        },
      };
    }
    case "potence": {
      // Potence encastrée — 3 m.
      return {
        ...base,
        name: "Potence encastrée",
        structure: {
          ...base.structure,
          nodes: [node(1, 0, 0, 0), node(2, 3, 0, 0)],
          beams: [beam(1, 1, 2)],
          supports: [support(1, [true, true, true, true, true, true])],
          loads: [load(2, -15000)],
        },
      };
    }
    default: {
      // Poutre continue — 3 travées de 6 m.
      return {
        ...base,
        name: "Poutre continue 3×6 m",
        structure: {
          ...base.structure,
          nodes: [node(1, 0, 0, 0), node(2, 6, 0, 0), node(3, 12, 0, 0), node(4, 18, 0, 0)],
          beams: [beam(1, 1, 2), beam(2, 2, 3), beam(3, 3, 4)],
          supports: [
            support(1, [true, true, true, true, true, true]),
            support(2, [false, false, true, false, false, false]),
            support(3, [false, false, true, false, false, false]),
            support(4, [false, false, true, false, false, false]),
          ],
          loads: [load(2, -20000), load(3, -20000)],
        },
      };
    }
  }
}

const TEMPLATES = [
  { kind: "warren", label: "Treillis Warren 24 m" },
  { kind: "portique", label: "Portique industriel" },
  { kind: "potence", label: "Potence encastrée" },
  { kind: "continue", label: "Poutre continue" },
];

export function ProjectGalleryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const loadProject = useProjectStore((s) => s.loadProject);
  const [entries, setEntries] = useState<GalleryEntry[]>([]);
  useEffect(() => {
    if (!open) return;
    void get<GalleryEntry[]>(GALLERY_KEY).then((list) => setEntries(list ?? []));
  }, [open]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-primary/20 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-lg border border-hairline bg-panel shadow-[0_8px_24px_rgba(15,23,42,0.08)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-hairline p-3">
          <h2 className="text-[15px] font-semibold">Projets</h2>
        </div>
        <div className="p-3">
          <h3 className="text-[12px] text-ink-secondary">Modèles types</h3>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.kind}
                type="button"
                className="rounded border border-hairline p-2 text-left text-[12px] hover:border-accent hover:bg-accent-tint"
                onClick={() => {
                  loadProject(buildTemplate(t.kind));
                  onClose();
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <h3 className="mt-4 text-[12px] text-ink-secondary">Enregistrés en local</h3>
          {entries.length === 0 ? (
            <p className="mt-1 text-[12px] text-ink-muted">Aucun projet enregistré.</p>
          ) : (
            <ul className="mt-1 max-h-40 overflow-auto">
              {entries.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    className="w-full rounded px-2 py-1.5 text-left text-[13px] hover:bg-accent-tint"
                    onClick={() => {
                      loadProject(e.project);
                      onClose();
                    }}
                  >
                    <span className="font-data">{e.name}</span>
                    <span className="ml-2 text-[11px] text-ink-muted">
                      {new Date(e.savedAt).toLocaleString("fr-FR")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t border-hairline p-3">
          <button
            type="button"
            className="w-full rounded border border-hairline px-2 py-1.5 text-[13px] text-ink-secondary"
            onClick={() => {
              void saveToGallery(useProjectStore.getState().project);
              onClose();
            }}
          >
            Enregistrer le projet courant
          </button>
        </div>
      </div>
    </div>
  );
}
