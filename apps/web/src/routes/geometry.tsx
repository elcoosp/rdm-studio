import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { Trans } from "@lingui/react/macro";
import { IconPlus, IconTrash } from "@/components/icons";
import { feaClient, type SectionSummary } from "@/wasmBridge/workerClient";
import { useProjectStore, type BeamData, type NodeData } from "@/state/projectStore";
import { useViewportStore } from "@/state/viewportStore";
import { ViewportCanvas } from "@/viewport3d/ViewportCanvas";
import { BeamMeshes, buildBeamGeometry, nodePositions } from "@/viewport3d/BeamMeshes";
import { SupportMarkers } from "@/viewport3d/SupportMarkers";
import { ForceVectors3D } from "@/viewport3d/ForceVectors3D";
import { useBeamBoundsTree, pickBeamAtRay } from "@/viewport3d/useBvhPicking";

export const Route = createFileRoute("/geometry")({
  component: GeometryPage,
});

/**
 * Step 1: 3D viewport + section inspector (DESIGN.md desktop layout:
 * side-by-side). Picking runs through the three-mesh-bvh accelerated path
 * and its latency is displayed live (M4 criterion).
 */
function GeometryPage() {
  const project = useProjectStore((s) => s.project);
  const selection = useProjectStore((s) => s.selection);
  const layers = useViewportStore((s) => s.layers);
  const renderMode = useViewportStore((s) => s.renderMode);
  const addNode = useProjectStore((s) => s.addNode);
  const addBeam = useProjectStore((s) => s.addBeam);
  const selectBeam = useProjectStore((s) => s.selectBeam);
  const [sections, setSections] = useState<SectionSummary[]>([]);
  const [pickMs, setPickMs] = useState<number | undefined>(undefined);
  const [newSection, setNewSection] = useState("IPE 200");

  useEffect(() => {
    void feaClient.fetchCatalog().then((c) => setSections(c.sections));
  }, []);

  const ipeSections = sections.filter((s) => s.family === "IPE");
  const material = project.structure.beams[0]?.material_id ?? "S235JR";

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3 lg:flex-row">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 rounded-panel border border-hairline bg-panel p-3">
        <div className="relative min-h-[320px] flex-1 overflow-hidden rounded border border-hairline">
          <ViewportCanvas pickLatency={pickMs}>
            {layers.beams ? (
              <BeamMeshes
                nodes={project.structure.nodes}
                beams={project.structure.beams}
                wireframe={renderMode === "wireframe"}
                selectedBeamId={selection.beamId}
                onPick={(id) => selectBeam(id)}
              />
            ) : null}
            {layers.supports ? (
              <SupportMarkers
                nodes={project.structure.nodes}
                supports={project.structure.supports}
              />
            ) : null}
            {layers.loads ? (
              <ForceVectors3D nodes={project.structure.nodes} loads={project.structure.loads} />
            ) : null}
            {layers.nodes ? (
              <NodeMarkers positions={nodePositions(project.structure.nodes)} />
            ) : null}
            <BvhPickLayer
              nodes={project.structure.nodes}
              beams={project.structure.beams}
              onPick={(beamId, ms) => {
                setPickMs(ms);
                selectBeam(beamId);
              }}
            />
          </ViewportCanvas>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="max-h-56 overflow-auto">
            <h3 className="mb-1 text-[13px] font-semibold text-ink-secondary">
              <Trans>Noeuds</Trans>
            </h3>
            <NodeTable />
          </div>
          <div className="max-h-56 overflow-auto">
            <h3 className="mb-1 text-[13px] font-semibold text-ink-secondary">
              <Trans>Poutres</Trans>
            </h3>
            <BeamTable />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="flex items-center gap-1 rounded bg-accent px-2.5 py-1.5 text-[13px] text-white"
            onClick={() => addNode(0, 0, 0)}
          >
            <IconPlus size={12} />
            <Trans>Ajouter un noeud</Trans>
          </button>
        </div>
      </section>
      <aside className="w-full shrink-0 rounded-panel border border-hairline bg-panel p-4 lg:w-[320px] lg:overflow-auto">
        <h2 className="mb-3 text-[15px] font-semibold">
          <Trans>Inspecteur de section</Trans>
        </h2>
        <label className="block text-[12px] text-ink-secondary">
          <Trans>Profil (EN 10365)</Trans>
        </label>
        <select
          className="font-data mt-1 w-full rounded border border-hairline px-2 py-1.5 text-[13px]"
          value={newSection}
          onChange={(e) => setNewSection(e.currentTarget.value)}
        >
          {ipeSections.map((s) => (
            <option value={s.designation}>{s.designation}</option>
          ))}
        </select>
        <button
          type="button"
          className="mt-3 flex w-full items-center justify-center gap-1 rounded border border-accent px-2 py-1.5 text-[13px] text-accent disabled:opacity-40"
          disabled={selection.nodeId === null}
          onClick={() => {
            const node = useProjectStore.getState().selection.nodeId;
            if (node === null) return;
            const beams = project.structure.beams;
            const target = beams.find((b) => b.n1 === node || b.n2 === node);
            if (target === undefined) {
              addBeam(node, node === 1 ? 2 : 1, newSection, material);
            } else {
              selectBeam(target.id);
            }
          }}
        >
          <Trans>Connecter au noeud sélectionné</Trans>
        </button>
        <dl className="font-data mt-4 space-y-1 text-[12px] text-ink-secondary">
          <dt className="mt-2 text-[11px] font-medium uppercase tracking-wide">
            <Trans>Catalogue</Trans>
          </dt>
          <dd>{sections.length} profils — EN 10365 / 10210 / 10056</dd>
        </dl>
      </aside>
    </div>
  );
}

/** Instanced node pins (Points layer). */
function NodeMarkers({ positions }: { positions: Float32Array }) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, [positions]);
  return (
    <points geometry={geometry}>
      <pointsMaterial size={0.08} color="#111827" sizeAttenuation />
    </points>
  );
}

/**
 * Canvas-level pointer picking through the accelerated BVH path; measures
 * and reports the wall-clock selection cost (M4: < 0.2 ms @ 10k elements).
 */
function BvhPickLayer({
  nodes,
  beams,
  onPick,
}: {
  nodes: NodeData[];
  beams: BeamData[];
  onPick: (beamId: number | null, ms: number) => void;
}) {
  const geometry = useMemo(() => {
    if (beams.length === 0) {
      return null;
    }
    return buildBeamGeometry(nodes, beams);
  }, [nodes, beams]);
  useBeamBoundsTree(geometry);
  const { camera, gl } = useThree();

  useEffect(() => {
    if (geometry === null) {
      return;
    }
    const dom = gl.domElement;
    const handler = (event: PointerEvent) => {
      const rect = dom.getBoundingClientRect();
      const ndc = {
        x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
        y: -((event.clientY - rect.top) / rect.height) * 2 + 1,
      };
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
      const result = pickBeamAtRay(raycaster, geometry);
      onPick(result.beamId, result.lastSelectionMs);
    };
    dom.addEventListener("pointerdown", handler);
    return () => dom.removeEventListener("pointerdown", handler);
  }, [geometry, camera, gl, onPick]);
  return null;
}

function NodeTable() {
  const nodes = useProjectStore((s) => s.project.structure.nodes);
  const selectNode = useProjectStore((s) => s.selectNode);
  const removeNode = useProjectStore((s) => s.removeNode);
  const moveNode = useProjectStore((s) => s.moveNode);
  const selection = useProjectStore((s) => s.selection);
  return (
    <table className="w-full text-[13px]">
      <thead className="text-left text-[11px] uppercase tracking-wide text-ink-muted">
        <tr>
          <th className="py-1">ID</th>
          <th>X (m)</th>
          <th>Y (m)</th>
          <th>Z (m)</th>
          <th />
        </tr>
      </thead>
      <tbody className="font-data">
        {nodes.map((n) => (
          <tr
            key={n.id}
            className={`cursor-pointer border-t border-hairline ${selection.nodeId === n.id ? "bg-accent/10" : ""}`}
            onClick={() => selectNode(n.id)}
          >
            <td className="py-1">{n.id}</td>
            {(["x", "y", "z"] as const).map((axis) => (
              <td key={axis}>
                <input
                  className="w-20 rounded border border-hairline px-1 py-0.5"
                  value={n[axis]}
                  onChange={(e) => {
                    const v = Number(e.currentTarget.value);
                    if (Number.isFinite(v))
                      moveNode(
                        n.id,
                        axis === "x" ? v : n.x,
                        axis === "y" ? v : n.y,
                        axis === "z" ? v : n.z,
                      );
                  }}
                />
              </td>
            ))}
            <td className="text-right">
              <button
                type="button"
                aria-label="remove node"
                className="text-ink-muted hover:text-fea-max"
                onClick={() => removeNode(n.id)}
              >
                <IconTrash size={13} />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BeamTable() {
  const beams = useProjectStore((s) => s.project.structure.beams);
  const selectBeam = useProjectStore((s) => s.selectBeam);
  const removeBeam = useProjectStore((s) => s.removeBeam);
  const selection = useProjectStore((s) => s.selection);
  return (
    <table className="w-full text-[13px]">
      <thead className="text-left text-[11px] uppercase tracking-wide text-ink-muted">
        <tr>
          <th className="py-1">ID</th>
          <th>N1</th>
          <th>N2</th>
          <th>
            <Trans>Profil</Trans>
          </th>
          <th />
        </tr>
      </thead>
      <tbody className="font-data">
        {beams.map((b) => (
          <tr
            key={b.id}
            className={`cursor-pointer border-t border-hairline ${selection.beamId === b.id ? "bg-accent/10" : ""}`}
            onClick={() => selectBeam(b.id)}
          >
            <td className="py-1">{b.id}</td>
            <td>{b.n1}</td>
            <td>{b.n2}</td>
            <td>{b.section_id}</td>
            <td className="text-right">
              <button
                type="button"
                aria-label="remove beam"
                className="text-ink-muted hover:text-fea-max"
                onClick={() => removeBeam(b.id)}
              >
                <IconTrash size={13} />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
