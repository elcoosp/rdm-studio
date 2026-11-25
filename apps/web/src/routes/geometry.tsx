import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { Trans } from "@lingui/react/macro";
import { IconPlus, IconTrash } from "@/components/icons";
import { BottomSheet } from "@/components/BottomSheet";
import { feaClient, type SectionDims, type SectionSummary } from "@/wasmBridge/workerClient";
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
 * Step 1 (DESIGN.md §4 desktop + mockups tape_1): 3D viewport with true
 * catalog extrusions (bug 2), auto-framed camera, explicit N1→N2 beam
 * creation (bug 5), EN 10365 inspector, end releases, buckling lengths
 * and the DXF import modal (rdm-cad).
 */
function GeometryPage() {
  const project = useProjectStore((s) => s.project);
  const selection = useProjectStore((s) => s.selection);
  const layers = useViewportStore((s) => s.layers);
  const renderMode = useViewportStore((s) => s.renderMode);
  const addNode = useProjectStore((s) => s.addNode);
  const addBeam = useProjectStore((s) => s.addBeam);
  const selectBeam = useProjectStore((s) => s.selectBeam);
  const loadProject = useProjectStore((s) => s.loadProject);
  const [sections, setSections] = useState<SectionSummary[]>([]);
  const [sectionDims, setSectionDims] = useState<Map<string, SectionDims>>(new Map());
  const [pickMs, setPickMs] = useState<number | undefined>(undefined);
  const [newSection, setNewSection] = useState("IPE 200");
  const [beamN1, setBeamN1] = useState<number | null>(null);
  const [beamN2, setBeamN2] = useState<number | null>(null);
  const [cadError, setCadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void feaClient.fetchCatalog().then((c) => {
      setSections(c.sections);
      setSectionDims(new Map(c.sectionDims.map((d) => [d.designation, d])));
    });
  }, []);

  const ipeSections = sections;
  const material = project.structure.beams[0]?.material_id ?? "S235JR";
  const selectedBeam = project.structure.beams.find((b) => b.id === selection.beamId) ?? null;
  const nodeIds = project.structure.nodes.map((n) => n.id);

  // Keep the connector defaults sensible as nodes come and go.
  useEffect(() => {
    if ((beamN1 === null || !nodeIds.includes(beamN1)) && nodeIds.length > 0) {
      setBeamN1(nodeIds[0] ?? null);
    }
    if ((beamN2 === null || !nodeIds.includes(beamN2)) && nodeIds.length > 1) {
      setBeamN2(nodeIds[1] ?? null);
    }
  }, [nodeIds, beamN1, beamN2]);

  const onImportDxf = async (file: File) => {
    setCadError(null);
    try {
      const bytes = await file.arrayBuffer();
      const json = await feaClient.importDxf(bytes, file.name.replace(/\.dxf$/i, ""));
      loadProject(JSON.parse(json));
    } catch (error) {
      setCadError(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3 lg:flex-row">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 rounded-panel border border-hairline bg-panel p-3">
        <div className="relative min-h-[320px] flex-1 overflow-hidden rounded border border-hairline">
          {project.structure.nodes.length === 0 ? (
            <div
              className="flex h-full flex-col items-center justify-center gap-2 bg-canvas text-center"
              data-testid="empty-state"
            >
              <p className="text-[14px] font-medium text-ink-secondary">
                <Trans>Modèle vide — commencez par poser un nœud.</Trans>
              </p>
              <p className="max-w-xs text-[12px] text-ink-muted">
                <Trans>
                  Ajoutez des nœuds, reliez-les par des poutres N1 → N2, importez un plan DXF ou
                  choisissez un modèle type dans la galerie de projets.
                </Trans>
              </p>
            </div>
          ) : (
            <ViewportCanvas pickLatency={pickMs} nodes={project.structure.nodes}>
              {layers.beams ? (
                <BeamMeshes
                  nodes={project.structure.nodes}
                  beams={project.structure.beams}
                  wireframe={renderMode === "wireframe"}
                  selectedBeamId={selection.beamId}
                  onPick={(id) => selectBeam(id)}
                  sectionDims={
                    sectionDims as unknown as Map<
                      string,
                      { shape: string; h?: number; b?: number; tw?: number; tf?: number }
                    >
                  }
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
          )}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="max-h-56 overflow-auto">
            <h3 className="mb-1 text-[13px] font-semibold text-ink-secondary">
              <Trans>Nœuds</Trans>
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
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="flex items-center gap-1 rounded bg-accent px-2.5 py-1.5 text-[13px] text-white"
            onClick={() => addNode(0, 0, 0)}
          >
            <IconPlus size={12} />
            <Trans>+ Nœud</Trans>
          </button>
          <button
            type="button"
            className="rounded border border-hairline px-2.5 py-1.5 text-[13px] text-ink-secondary"
            onClick={() => fileRef.current?.click()}
          >
            <Trans>Importer DXF</Trans>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".dxf"
            className="hidden"
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              if (file !== undefined) void onImportDxf(file);
              e.currentTarget.value = "";
            }}
          />
          {cadError !== null ? (
            <span className="self-center text-[12px] text-fea-max">{cadError}</span>
          ) : null}
        </div>
      </section>
      <BottomSheet testId="inspector-sheet" title={<Trans>Inspecteur de section</Trans>}>
        <label className="block text-[12px] text-ink-secondary">
          <Trans>Profil (EN 10365)</Trans>
        </label>
        <select
          className="font-data mt-1 w-full rounded border border-hairline px-2 py-1.5 text-[13px]"
          value={newSection}
          onChange={(e) => setNewSection(e.currentTarget.value)}
        >
          {ipeSections.map((s) => (
            <option key={s.designation} value={s.designation}>
              {s.designation}
            </option>
          ))}
        </select>
        <SectionCatalogRow designation={selectedBeam?.section_id ?? newSection} />

        {/* Bug 5: explicit N1 → N2 selection replaces the hardcoded demo pair. */}
        <h3 className="mt-4 text-[13px] font-semibold text-ink-secondary">
          <Trans>Créer une poutre</Trans>
        </h3>
        <div className="mt-1 flex items-center gap-2">
          <select
            aria-label="N1"
            className="font-data w-full rounded border border-hairline px-2 py-1.5 text-[13px]"
            value={beamN1 ?? ""}
            onChange={(e) => setBeamN1(Number(e.currentTarget.value))}
          >
            {nodeIds.map((id) => (
              <option key={id} value={id}>
                N{id}
              </option>
            ))}
          </select>
          <span className="font-data text-[13px] text-ink-muted">→</span>
          <select
            aria-label="N2"
            className="font-data w-full rounded border border-hairline px-2 py-1.5 text-[13px]"
            value={beamN2 ?? ""}
            onChange={(e) => setBeamN2(Number(e.currentTarget.value))}
          >
            {nodeIds.map((id) => (
              <option key={id} value={id}>
                N{id}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="mt-2 w-full rounded bg-accent px-2 py-1.5 text-[13px] text-white disabled:opacity-40"
          disabled={beamN1 === null || beamN2 === null || beamN1 === beamN2}
          onClick={() => {
            if (beamN1 === null || beamN2 === null || beamN1 === beamN2) return;
            addBeam(beamN1, beamN2, newSection, material);
          }}
        >
          <Trans>Relier N1 → N2</Trans>
        </button>

        {selectedBeam !== null ? (
          <BeamPatchPanel beam={selectedBeam} />
        ) : (
          <p className="mt-3 text-[12px] text-ink-muted">
            <Trans>Sélectionnez une poutre pour éditer ses caractéristiques.</Trans>
          </p>
        )}

        <dl className="font-data mt-4 space-y-1 text-[12px] text-ink-secondary">
          <dt className="mt-2 text-[11px] font-medium text-ink-muted">
            <Trans>Catalogue</Trans>
          </dt>
          <dd>{sections.length} profils — EN 10365 / 10210 / 10056</dd>
        </dl>
      </BottomSheet>
    </div>
  );
}

/** EN 10365 property row for the selected designation (worker catalog). */
function SectionCatalogRow({ designation }: { designation: string }) {
  const [props, setProps] = useState<{
    a: number;
    iy: number;
    iz: number;
    it: number;
    iw: number | null;
    wel_y: number;
    wpl_y: number | null;
    mass_per_m: number;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void import("@/wasmBridge/fea.worker").then(async () => {
      const dto = await feaClient.catalogSectionProperties(designation).catch(() => null);
      if (!cancelled) setProps(dto);
    });
    return () => {
      cancelled = true;
    };
  }, [designation]);
  if (props === null) {
    return null;
  }
  const mm2 = (v: number) => (v * 1e6).toFixed(0);
  const cm4 = (v: number) => (v * 1e8).toFixed(1);
  const cm3 = (v: number) => (v * 1e6).toFixed(1);
  return (
    <dl className="font-data mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-ink-secondary">
      <dt>A</dt>
      <dd className="text-right">{mm2(props.a)} mm²</dd>
      <dt>Iy</dt>
      <dd className="text-right">{cm4(props.iy)} cm⁴</dd>
      <dt>Iz</dt>
      <dd className="text-right">{cm4(props.iz)} cm⁴</dd>
      <dt>It</dt>
      <dd className="text-right">{cm4(props.it)} cm⁴</dd>
      {props.iw !== null ? (
        <>
          <dt>Iw</dt>
          <dd className="text-right">{(props.iw * 1e12).toFixed(2)} cm⁶</dd>
        </>
      ) : null}
      <dt>Wel,y</dt>
      <dd className="text-right">{cm3(props.wel_y)} cm³</dd>
      {props.wpl_y !== null ? (
        <>
          <dt>Wpl,y</dt>
          <dd className="text-right">{cm3(props.wpl_y)} cm³</dd>
        </>
      ) : null}
      <dt>Masse</dt>
      <dd className="text-right">{props.mass_per_m.toFixed(1)} kg/m</dd>
    </dl>
  );
}

/** Roll angle, end releases and buckling lengths of the selected member. */
function BeamPatchPanel({ beam }: { beam: BeamData }) {
  const updateBeam = useProjectStore((s) => s.updateBeam);
  const releaseLabels = ["Ux", "Uy", "Uz", "Rx", "Ry", "Rz"];
  return (
    <div className="mt-3 border-t border-hairline pt-3">
      <p className="font-data text-[12px] text-ink-secondary">
        P{beam.id} · {beam.section_id} · {beam.material_id}
      </p>
      <label className="mt-2 block text-[12px] text-ink-secondary">
        <Trans>Roulis θx (°)</Trans>
      </label>
      <input
        type="number"
        step="1"
        className="font-data mt-1 w-24 rounded border border-hairline px-2 py-1 text-[12px]"
        value={Math.round((beam.roll_angle_rad * 180) / Math.PI)}
        onChange={(e) => {
          const deg = Number(e.currentTarget.value);
          if (Number.isFinite(deg)) updateBeam(beam.id, { roll_angle_rad: (deg * Math.PI) / 180 });
        }}
      />
      <p className="mt-2 text-[12px] text-ink-secondary">
        <Trans>Relâchements N1 / N2</Trans>
      </p>
      <div className="mt-1 grid grid-cols-2 gap-2">
        {(["releases_start", "releases_end"] as const).map((side) => (
          <div key={side} className="rounded border border-hairline p-1">
            <span className="font-data text-[11px] text-ink-muted">
              {side === "releases_start" ? "N1" : "N2"}
            </span>
            <div className="flex gap-1">
              {releaseLabels.map((label, i) => (
                <label key={label} className="font-data flex flex-col items-center text-[10px]">
                  {label}
                  <input
                    type="checkbox"
                    checked={beam[side][i] ?? false}
                    onChange={(e) => {
                      const next = [...beam[side]];
                      next[i] = e.currentTarget.checked;
                      updateBeam(beam.id, { [side]: next });
                    }}
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        {(["k_buckling_y", "k_buckling_z"] as const).map((key) => (
          <label key={key} className="text-[12px] text-ink-secondary">
            {key === "k_buckling_y" ? "ky" : "kz"}
            <input
              type="number"
              step="0.1"
              min="0.1"
              className="font-data ml-1 w-16 rounded border border-hairline px-1 py-0.5 text-[12px]"
              value={beam[key]}
              onChange={(e) => {
                const v = Number(e.currentTarget.value);
                if (Number.isFinite(v) && v > 0) updateBeam(beam.id, { [key]: v });
              }}
            />
          </label>
        ))}
      </div>
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
      <pointsMaterial size={0.08} color="#0F172A" sizeAttenuation />
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
      <thead className="text-left text-[11px] text-ink-muted">
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
            className={`cursor-pointer border-t border-hairline ${selection.nodeId === n.id ? "bg-accent-tint" : ""}`}
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
      <thead className="text-left text-[11px] text-ink-muted">
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
            className={`cursor-pointer border-t border-hairline ${selection.beamId === b.id ? "bg-accent-tint" : ""}`}
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
