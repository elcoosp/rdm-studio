import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { Trans } from "@lingui/react/macro";
import { IconPlus, IconTrash } from "@/components/icons";
import { BottomSheet } from "@/components/BottomSheet";
import { Button } from "@/components/ui/button";
import { feaClient, type SectionDims, type SectionSummary } from "@/wasmBridge/workerClient";
import type { ProfileDims } from "@/viewport3d/ProfileShapes";
import { useProjectStore, type BeamData, type NodeData } from "@/state/projectStore";
import { ProfileIpe } from "@/components/icons/EngineeringIcons";
import { useViewportStore } from "@/state/viewportStore";
import { ViewportCanvas } from "@/viewport3d/ViewportCanvas";
import { BeamMeshes, buildBeamGeometry, nodePositions } from "@/viewport3d/BeamMeshes";
import { SupportMarkers } from "@/viewport3d/SupportMarkers";
import { NodeMarkers } from "@/viewport3d/NodeMarkers";
import { ForceVectors3D } from "@/viewport3d/ForceVectors3D";
import { useBeamBoundsTree, pickBeamAtRay } from "@/viewport3d/useBvhPicking";
import { ProjectGalleryModal } from "@/components/ProjectGalleryModal";
import { CadImportDialog } from "@/components/CadImportDialog";
import { toast } from "sonner";

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
  const updateBeam = useProjectStore((s) => s.updateBeam);
  const [sections, setSections] = useState<SectionSummary[]>([]);
  const [sectionDims, setSectionDims] = useState<Map<string, SectionDims>>(new Map());
  const [pickMs, setPickMs] = useState<number | undefined>(undefined);
  const [newSection, setNewSection] = useState("IPE 200");
  const [beamN1, setBeamN1] = useState<number | null>(null);
  const [beamN2, setBeamN2] = useState<number | null>(null);
  // Explicit user picks stay sticky: the auto-default must never override
  // a person examining (or re-linking) a specific pair.
  const userN1 = useRef(false);
  const userN2 = useRef(false);
  const [material, setMaterial] = useState("S235JR");
  const [cadError, setCadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [cadOpen, setCadOpen] = useState(false);
  const [cadBusy, setCadBusy] = useState(false);
  // v1.3.0 Step 1: segmented tool modes with keyboard shortcuts.
  const [toolMode, setToolMode] = useState<"select" | "node" | "beam">("select");
  const [hoverBeamId, setHoverBeamId] = useState<number | null>(null);
  const [hoverNodeId, setHoverNodeId] = useState<number | null>(null);

  useEffect(() => {
    void feaClient.fetchCatalog().then((c) => {
      setSections(c.sections);
      setSectionDims(new Map(c.sectionDims.map((d) => [d.designation, d])));
    });
  }, []);

  // Tool-mode shortcuts [V] selection, [N] node placement, [B] linking.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target !== null && /input|textarea|select/i.test(target.tagName)) {
        return;
      }
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "v") setToolMode("select");
      else if (key === "n") setToolMode("node");
      else if (key === "b") setToolMode("beam");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const navigate = useNavigate();
  const ipeSections = sections;
  const selectedBeam = project.structure.beams.find((b) => b.id === selection.beamId) ?? null;
  const nodeIds = project.structure.nodes.map((n) => n.id);

  // Keep the connector defaults sensible as nodes come and go (v1.3.0
  // defect 2: default to the LAST two nodes that are not yet linked).
  useEffect(() => {
    if (nodeIds.length === 0) {
      return;
    }
    const linked = new Set(
      project.structure.beams.map((b) => {
        const lo = Math.min(b.n1, b.n2);
        const hi = Math.max(b.n1, b.n2);
        return `${lo}-${hi}`;
      }),
    );
    const isLinked = (a: number, b: number) => linked.has(`${Math.min(a, b)}-${Math.max(a, b)}`);
    const last = nodeIds[nodeIds.length - 1] ?? null;
    const prev = nodeIds[nodeIds.length - 2] ?? null;
    if (!userN1.current && (beamN1 === null || !nodeIds.includes(beamN1))) {
      setBeamN1(last);
    }
    if (
      !userN2.current &&
      (beamN2 === null ||
        !nodeIds.includes(beamN2) ||
        (beamN1 !== null && beamN1 === beamN2) ||
        isLinked(beamN1 ?? -1, beamN2))
    ) {
      const candidate =
        prev !== null && prev !== beamN1 && !isLinked(beamN1 ?? -1, prev)
          ? prev
          : (nodeIds.find((id) => id !== beamN1 && !isLinked(beamN1 ?? -1, id)) ?? null);
      setBeamN2(candidate);
    }
  }, [nodeIds, beamN1, beamN2, project.structure.beams]);

  // v1.3.0 defect 2: an (N1, N2) pair that already exists disables the
  // connector ("Déjà reliés").
  const pairAlreadyLinked = (() => {
    if (beamN1 === null || beamN2 === null || beamN1 === beamN2) {
      return false;
    }
    const key = `${Math.min(beamN1, beamN2)}-${Math.max(beamN1, beamN2)}`;
    return project.structure.beams.some(
      (b) => `${Math.min(b.n1, b.n2)}-${Math.max(b.n1, b.n2)}` === key,
    );
  })();

  /** v1.3.0 defect 2: default placement walks +2 m past the max X. */
  const nextDefaultPosition = (): [number, number, number] => {
    if (project.structure.nodes.length === 0) {
      return [0, 0, 0];
    }
    const maxX = Math.max(...project.structure.nodes.map((n) => n.x));
    return [maxX + 2.0, 0, 0];
  };

  const onImportCad = async (file: File, encastreLeft: boolean) => {
    setCadError(null);
    setCadBusy(true);
    const before = structuredClone(useProjectStore.getState().project);
    try {
      const bytes = await file.arrayBuffer();
      const name = file.name.replace(/\.(dxf|step|stp|igs|iges)$/i, "");
      const json = await feaClient.importCad(bytes, file.name, name);
      const imported = JSON.parse(json) as Parameters<typeof loadProject>[0];
      loadProject(imported);
      // Optional convenience restraint: fix the leftmost node.
      if (encastreLeft && imported.structure.nodes.length > 0) {
        const leftmost = imported.structure.nodes.reduce((m, n) => (n.x < m.x ? n : m));
        useProjectStore.getState().setSupport(leftmost.id, [true, true, true, true, true, true]);
      }
      setCadOpen(false);
      toast("Import réussi", {
        description: `${imported.structure.beams.length} poutre(s) importée(s) depuis ${file.name}.`,
        action: {
          label: "Annuler",
          onClick: () => loadProject(before),
        },
        duration: 5_000,
      });
    } catch (error) {
      setCadError(error instanceof Error ? error.message : String(error));
    } finally {
      setCadBusy(false);
    }
  };

  const sectionDimsConverted = useMemo(
    () =>
      new Map<string, ProfileDims>(
        Array.from(sectionDims.entries()).map(([k, v]) => [
          k,
          { shape: v.shape, h: v.h ?? undefined, b: v.b ?? undefined, tw: v.tw ?? undefined, tf: v.tf ?? undefined },
        ]),
      ),
    [sectionDims],
  );

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
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  size="lg"
                  data-testid="empty-place-node"
                  onClick={() => addNode(...nextDefaultPosition())}
                >
                  <Trans>+ Placer un premier nœud</Trans>
                </Button>
                <Button variant="outline" size="lg" onClick={() => setGalleryOpen(true)}>
                  <Trans>Charger un modèle type</Trans>
                </Button>
                <button
                  type="button"
                  className="rounded border border-hairline px-3 py-1.5 text-[13px] text-ink-secondary"
                  onClick={() => fileRef.current?.click()}
                >
                  <Trans>Importer DXF</Trans>
                </button>
              </div>
              <p className="max-w-xs text-[12px] text-ink-muted">
                <Trans>
                  Ajoutez des nœuds, reliez-les par des poutres N1 → N2, importez un plan DXF ou
                  choisissez un modèle type dans la galerie de projets.
                </Trans>
              </p>
            </div>
          ) : (
            <ViewportCanvas
              pickLatency={pickMs}
              nodes={project.structure.nodes}
              beams={project.structure.beams}
            >
              {layers.beams ? (
                <BeamMeshes
                  nodes={project.structure.nodes}
                  beams={project.structure.beams}
                  wireframe={renderMode === "wireframe"}
                  selectedBeamId={selection.beamId}
                  onPick={(id) => selectBeam(id)}
                  sectionDims={sectionDimsConverted}
                  hoveredBeamId={hoverBeamId}
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
                <NodeMarkers
                  positions={nodePositions(project.structure.nodes)}
                  highlightNodeId={hoverNodeId}
                />
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
        {/* v1.3.0 Step 1: segmented 3D tool modes ([V]/[N]/[B]). */}
        <div
          className="flex items-center gap-1 rounded border border-hairline p-0.5"
          data-testid="tool-modes"
        >
          {(
            [
              ["select", "Sélection", "V"],
              ["node", "+ Nœud", "N"],
              ["beam", "Relier", "B"],
            ] as const
          ).map(([mode, label, hint]) => (
            <button
              key={mode}
              type="button"
              data-testid={`tool-${mode}`}
              className={`flex min-h-8 flex-1 items-center justify-center gap-1 rounded px-2 text-[12px] ${
                toolMode === mode
                  ? "bg-accent-tint text-accent"
                  : "text-ink-secondary hover:text-ink-primary"
              }`}
              onClick={() => setToolMode(mode)}
            >
              {label}
              <span className="font-data text-[10px] text-ink-muted">[{hint}]</span>
            </button>
          ))}
          {toolMode === "node" ? (
            <span className="px-2 text-[11px] text-ink-muted">
              le bouton + Nœud place au-delà du dernier point (magnétique)
            </span>
          ) : null}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="max-h-56 overflow-auto">
            <h3 className="mb-1 text-[13px] font-semibold text-ink-secondary">
              <Trans>Nœuds</Trans>
            </h3>
            <NodeTable onHoverNode={setHoverNodeId} />
          </div>
          <div className="max-h-56 overflow-auto">
            <h3 className="mb-1 text-[13px] font-semibold text-ink-secondary">
              <Trans>Poutres</Trans>
            </h3>
            <BeamTable onHoverBeam={setHoverBeamId} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="flex items-center gap-1 rounded bg-accent px-2.5 py-1.5 text-[13px] text-white"
            data-testid="add-node"
            onClick={() => {
              const [x, y, z] = nextDefaultPosition();
              addNode(x, y, z);
            }}
          >
            <IconPlus size={12} />
            <Trans>+ Nœud</Trans>
          </button>
          <button
            type="button"
            className="rounded border border-hairline px-2.5 py-1.5 text-[13px] text-ink-secondary"
            data-testid="open-cad-import"
            onClick={() => setCadOpen(true)}
          >
            <Trans>Importer CAO</Trans>
          </button>
          {cadError !== null ? (
            <span className="self-center text-[12px] text-fea-max">{cadError}</span>
          ) : null}
          {/* v1.3.0 Step 1: next-step hand-off (RDM 7 flow). */}
          <button
            type="button"
            className="ml-auto rounded border border-hairline px-2.5 py-1.5 text-[13px] text-accent hover:bg-accent-tint disabled:opacity-40"
            data-testid="next-supports"
            disabled={project.structure.beams.length === 0}
            onClick={() => void navigate({ to: "/supports" })}
          >
            <Trans>Suivant : Définir les liaisons →</Trans>
          </button>
        </div>
      </section>
      <BottomSheet testId="inspector-sheet" title={<Trans>Inspecteur de section</Trans>}>
        <label className="block text-[12px] text-ink-secondary">
          <Trans>Matériau</Trans>
        </label>
        <select
          className="mt-1 w-full rounded-[4px] border border-hairline px-2 py-1.5 text-[13px]"
          value={material}
          onChange={(e) => {
            const next = e.currentTarget.value;
            setMaterial(next);
            if (selectedBeam !== null) {
              updateBeam(selectedBeam.id, { material_id: next });
            }
          }}
        >
          {["S235JR", "S355J2", "304L", "6061-T6"].map((m) => (
            <option key={m} value={m}>
              {m === "S235JR"
                ? "Acier S235JR"
                : m === "S355J2"
                  ? "Acier S355J2"
                  : m === "304L"
                    ? "Inox 304L"
                    : "Alu 6061-T6"}
            </option>
          ))}
        </select>
        <label className="mt-3 flex items-center gap-1.5 text-[12px] text-ink-secondary">
          <ProfileIpe size={14} />
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
            onChange={(e) => {
              userN1.current = true;
              setBeamN1(Number(e.currentTarget.value));
            }}
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
            onChange={(e) => {
              userN2.current = true;
              setBeamN2(Number(e.currentTarget.value));
            }}
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
          disabled={beamN1 === null || beamN2 === null || beamN1 === beamN2 || pairAlreadyLinked}
          data-testid="connect-beam"
          onClick={() => {
            if (beamN1 === null || beamN2 === null || beamN1 === beamN2 || pairAlreadyLinked)
              return;
            addBeam(beamN1, beamN2, newSection, material);
          }}
        >
          {pairAlreadyLinked ? <Trans>Déjà reliés</Trans> : <Trans>Relier N1 → N2</Trans>}
        </button>

        {selectedBeam !== null ? (
          <BeamPatchPanel beam={selectedBeam} />
        ) : (
          <p className="mt-3 text-[12px] text-ink-muted">
            <Trans>Sélectionnez une poutre pour éditer ses caractéristiques.</Trans>
          </p>
        )}

        <ProjectGalleryModal open={galleryOpen} onClose={() => setGalleryOpen(false)} />
        <CadImportDialog
          open={cadOpen}
          onClose={() => setCadOpen(false)}
          onImport={(file, encastre) => void onImportCad(file, encastre)}
          busy={cadBusy}
          error={cadError}
        />
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

function NodeTable({
  onHoverNode,
}: {
  onHoverNode?: (id: number | null) => void;
} = {}) {
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
            className={`cursor-pointer border-t border-hairline transition-colors ${selection.nodeId === n.id ? "bg-accent-tint" : "hover:bg-canvas"}`}
            onMouseEnter={() => onHoverNode?.(n.id)}
            onMouseLeave={() => onHoverNode?.(null)}
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

function BeamTable({
  onHoverBeam,
}: {
  onHoverBeam?: (id: number | null) => void;
} = {}) {
  const beams = useProjectStore((s) => s.project.structure.beams);
  const selectBeam = useProjectStore((s) => s.selectBeam);
  const removeBeam = useProjectStore((s) => s.removeBeam);
  const selection = useProjectStore((s) => s.selection);
  const batchUpdateBeams = useProjectStore((s) => s.batchUpdateBeams);
  const [batchIds, setBatchIds] = useState<number[]>([]);
  return (
    <>
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
              className={`cursor-pointer border-t border-hairline transition-colors ${selection.beamId === b.id || batchIds.includes(b.id) ? "bg-accent-tint" : "hover:bg-canvas"}`}
              onMouseEnter={() => onHoverBeam?.(b.id)}
              onMouseLeave={() => onHoverBeam?.(null)}
              onClick={(e) => {
                if (e.shiftKey) {
                  setBatchIds((ids) =>
                    ids.includes(b.id) ? ids.filter((x) => x !== b.id) : [...ids, b.id],
                  );
                  return;
                }
                selectBeam(b.id);
              }}
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
      {batchIds.length > 0 ? (
        <div
          className="mt-2 rounded border border-accent-ring bg-accent-tint p-2"
          data-testid="batch-editor"
        >
          <p className="font-data text-[12px] text-accent">
            {batchIds.length} poutre(s) sélectionnée(s)
          </p>
          <div className="mt-1 flex gap-2">
            <select
              aria-label="batch section"
              className="font-data w-full rounded-[4px] border border-hairline px-1 py-1 text-[12px]"
              onChange={(e) => {
                batchUpdateBeams(batchIds, { section_id: e.currentTarget.value });
                setBatchIds([]);
              }}
              defaultValue=""
            >
              <option value="" disabled>
                Profil…
              </option>
              {Array.from(new Set(beams.map((b) => b.section_id))).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="rounded border border-hairline px-2 text-[12px] text-ink-secondary"
              onClick={() => setBatchIds([])}
            >
              Annuler
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
