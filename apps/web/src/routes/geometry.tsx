import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import type { ColumnDef } from "@tanstack/react-table";
import { Trans } from "@lingui/react/macro";
import { IconPlus, IconTrash } from "@/components/icons";
import { BottomSheet } from "@/components/BottomSheet";
import { DesktopSplit } from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { NumberFieldRoot, NumberFieldInput } from "@/components/ui/number-field";
import { feaClient, type SectionDims, type SectionSummary } from "@/wasmBridge/workerClient";
import { useProjectStore, type BeamData, type NodeData } from "@/state/projectStore";
import { ProfileIpe } from "@/components/icons/EngineeringIcons";
import { useViewportStore } from "@/state/viewportStore";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { quickStartProject } from "@/state/projectStore";
import { ViewportCanvas } from "@/viewport3d/ViewportCanvas";
import { BeamMeshes, buildBeamGeometry, nodePositions } from "@/viewport3d/BeamMeshes";
import { SupportMarkers } from "@/viewport3d/SupportMarkers";
import { NodeMarkers } from "@/viewport3d/NodeMarkers";
import { ForceVectors3D } from "@/viewport3d/ForceVectors3D";
import { useBeamBoundsTree, pickBeamAtRay } from "@/viewport3d/useBvhPicking";
import { ProjectGalleryModal } from "@/components/ProjectGalleryModal";
import { CadImportDialog } from "@/components/CadImportDialog";
import {
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxRoot,
} from "@/components/ui/combobox";
import { toast } from "sonner";

export const Route = createFileRoute("/geometry")({
  component: GeometryPage,
});

/**
 * Step 1 (DESIGN.md §4 desktop + mockups tape_1): locked `md+` workstation
 * — 320px left inspector (`DesktopSplit`, inspector FIRST) beside a
 * full-height 3D viewport commanding 75%+ of the screen with a collapsible
 * bottom data dock (Nœuds/Poutres, Base UI NumberField inline editing).
 * Phone (< 768 px): the inspector becomes the Vaul drawer and the dock
 * lives inside it.
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
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [cadOpen, setCadOpen] = useState(false);
  const [cadBusy, setCadBusy] = useState(false);
  // v1.3.0 Step 1: segmented tool modes with keyboard shortcuts.
  // v1.4.0: tool mode lives in the viewport store, shared with hotkeys.
  const toolMode = useViewportStore((s) => s.toolMode);
  const setToolMode = useViewportStore((s) => s.setToolMode);
  const [hoverBeamId, setHoverBeamId] = useState<number | null>(null);
  const [hoverNodeId, setHoverNodeId] = useState<number | null>(null);
  // v1.5.0: the data dock rides inside the drawer on phones.
  const isMobile = useMediaQuery("(max-width: 767px)");

  useEffect(() => {
    void feaClient.fetchCatalog().then((c) => {
      setSections(c.sections);
      setSectionDims(new Map(c.sectionDims.map((d) => [d.designation, d])));
    });
  }, []);

  // v1.4.0: V / N / B shortcuts live in the centralized useAppHotkeys layer.

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

  /** v1.5.0 profile legend: active sections + member counts. */
  const sectionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const beam of project.structure.beams) {
      counts.set(beam.section_id, (counts.get(beam.section_id) ?? 0) + 1);
    }
    return [...counts.entries()];
  }, [project.structure.beams]);

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

  const inspector = (
    <BottomSheet testId="inspector-sheet" title={<Trans>Inspecteur de section</Trans>}>
      {/* Flat action row — nested card borders stay out of the inspector. */}
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
          <Trans>Nœud</Trans>
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
      </div>

      {/* 2-column key-value property grid (craft-floor: flat hairlines). */}
      <section className="border-t border-hairline pt-3">
        <div className="grid grid-cols-[112px_1fr] items-center gap-x-2 gap-y-2">
          <label className="text-xs font-medium text-ink-secondary" htmlFor="material-select">
            <Trans>Matériau</Trans>
          </label>
          <select
            id="material-select"
            className="h-8 w-full rounded-[4px] border border-hairline bg-panel px-2 text-[13px]"
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
          <label className="flex items-center gap-1.5 text-xs font-medium text-ink-secondary">
            <ProfileIpe size={14} />
            <Trans>Profil (EN 10365)</Trans>
          </label>
          {/* v1.4.0: searchable Base UI Combobox with cross-section icons —
              applies immediately to the selected member. */}
          <ComboboxRoot
            items={ipeSections.map((s) => s.designation)}
            value={selectedBeam?.section_id ?? newSection}
            onValueChange={(next: string | null) => {
              if (next === null) return;
              setNewSection(next);
              if (selectedBeam !== null) {
                updateBeam(selectedBeam.id, { section_id: next });
              }
            }}
          >
            <ComboboxInput className="h-8" />
            <ComboboxContent
              renderItem={(designation: string) => (
                <ComboboxItem key={designation} value={designation}>
                  <ProfileIpe size={14} />
                  <span className="font-data flex-1">{designation}</span>
                </ComboboxItem>
              )}
            >
              <ComboboxEmpty>Aucun profilé trouvé</ComboboxEmpty>
            </ComboboxContent>
          </ComboboxRoot>
        </div>
        <SectionCatalogRow designation={selectedBeam?.section_id ?? newSection} />
      </section>

      {/* Bug 5: explicit N1 → N2 selection replaces the hardcoded demo pair. */}
      <section className="border-t border-hairline pt-3">
        <h3 className="text-xs font-medium text-ink-secondary">
          <Trans>Créer une poutre</Trans>
        </h3>
        <div className="mt-2 grid grid-cols-[112px_1fr] items-center gap-x-2 gap-y-2">
          <span className="text-xs font-medium text-ink-secondary">Extrémités</span>
          <div className="flex items-center gap-2">
            <select
              aria-label="N1"
              className="font-data h-8 w-full rounded-[4px] border border-hairline bg-panel px-2 text-[13px]"
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
              className="font-data h-8 w-full rounded-[4px] border border-hairline bg-panel px-2 text-[13px]"
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
      </section>

      {/* Selected-member patch panel (roll, releases, buckling lengths). */}
      <section className="border-t border-hairline pt-3">
        {selectedBeam !== null ? (
          <BeamPatchPanel beam={selectedBeam} />
        ) : (
          <p className="text-[12px] text-ink-muted">
            <Trans>Sélectionnez une poutre pour éditer ses caractéristiques.</Trans>
          </p>
        )}
      </section>

      <p className="font-data border-t border-hairline pt-3 text-[12px] text-ink-secondary">
        {sections.length} profils — EN 10365 / 10210 / 10056
      </p>

      <ProjectGalleryModal open={galleryOpen} onClose={() => setGalleryOpen(false)} />
      <CadImportDialog
        open={cadOpen}
        onClose={() => setCadOpen(false)}
        onImport={(file, encastre) => void onImportCad(file, encastre)}
        busy={cadBusy}
        error={cadError}
      />

      {isMobile ? <DataDock onHoverNode={setHoverNodeId} onHoverBeam={setHoverBeamId} /> : null}

      {/* v1.3.0 Step 2 hand-off. */}
      <button
        type="button"
        className="w-full rounded border border-hairline px-2.5 py-1.5 text-[13px] text-accent hover:bg-accent-tint disabled:opacity-40"
        data-testid="next-supports"
        disabled={project.structure.beams.length === 0}
        onClick={() => void navigate({ to: "/supports" })}
      >
        <Trans>Suivant : Définir les liaisons →</Trans>
      </button>
    </BottomSheet>
  );

  const main = (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 p-3">
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-panel border border-hairline bg-panel">
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
                onClick={() => setCadOpen(true)}
              >
                <Trans>Importer CAO</Trans>
              </button>
            </div>
            {/* v1.4.0: 1-click quick-start pills (mockups tape_1). */}
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {(
                [
                  ["warren", "Treillis Warren 24 m"],
                  ["portique", "Portique 18 m"],
                  ["potence", "Potence HEA 200"],
                  ["travees", "Poutre 3 travées"],
                ] as const
              ).map(([kind, label]) => (
                <button
                  key={kind}
                  type="button"
                  data-testid={`quick-${kind}`}
                  className="rounded-full border border-hairline px-2.5 py-1 text-[12px] text-ink-secondary hover:border-accent hover:text-accent"
                  onClick={() => loadProject(quickStartProject(kind))}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="max-w-xs text-[12px] text-ink-muted">
              <Trans>
                Ajoutez des nœuds, reliez-les par des poutres N1 → N2, importez un plan DXF ou
                choisissez un modèle type dans la galerie de projets.
              </Trans>
            </p>
          </div>
        ) : (
          <>
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
                  sectionDims={sectionDims}
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
                <ForceVectors3D
                  nodes={project.structure.nodes}
                  beams={project.structure.beams}
                  loads={project.structure.loads}
                />
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
            {/* v1.5.0 HUD corners: LayerToolbar top-left and camera presets
                top-right render inside ViewportCanvas; the profile legend
                owns bottom-left and the hint bottom-center — GizmoHelper
                keeps bottom-right (all four stay non-overlapping). */}
            {sectionCounts.length > 0 ? (
              <div
                className="absolute bottom-2 left-2 z-10 flex max-w-[62%] flex-wrap gap-1 rounded-panel border border-hairline bg-panel/90 p-1 backdrop-blur"
                data-testid="profile-legend"
              >
                {sectionCounts.map(([designation, count]) => (
                  <span
                    key={designation}
                    className="font-data rounded bg-panel-subtle px-1.5 py-0.5 text-[10px] text-ink-secondary"
                  >
                    {designation} × {count}
                  </span>
                ))}
              </div>
            ) : null}
            <p
              className="pointer-events-none absolute bottom-2 left-1/2 z-10 hidden -translate-x-1/2 font-data text-[10px] text-ink-muted md:block"
              data-testid="viewport-hint"
            >
              Clic G Sélection · Clic D Orbite · Maj+Glisser Pan · Suppr Effacer
            </p>
          </>
        )}
      </div>
      {/* v1.3.0 Step 1: segmented 3D tool modes ([V]/[N]/[B]). */}
      <div
        className="flex shrink-0 items-center gap-1 rounded border border-hairline bg-panel p-0.5"
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
          <span className="hidden px-2 text-[11px] text-ink-muted lg:inline">
            le bouton + Nœud place au-delà du dernier point (magnétique)
          </span>
        ) : null}
      </div>
      {!isMobile ? <DataDock onHoverNode={setHoverNodeId} onHoverBeam={setHoverBeamId} /> : null}
    </section>
  );

  return <DesktopSplit inspector={inspector} main={main} />;
}

/**
 * Collapsible bottom data dock (v1.5.0): Nœuds / Poutres TanStack tables
 * behind a h-9 tab bar with a h-44 scroll pane when expanded — the 3D
 * viewport commands 75%+ of the screen. On phones the dock rides inside
 * the drawer instead of stealing viewport height.
 */
function DataDock({
  onHoverNode,
  onHoverBeam,
}: {
  onHoverNode: (id: number | null) => void;
  onHoverBeam: (id: number | null) => void;
}) {
  const [tab, setTab] = useState<"nodes" | "beams">("nodes");
  const [open, setOpen] = useState(true);
  const nodeCount = useProjectStore((s) => s.project.structure.nodes.length);
  const beamCount = useProjectStore((s) => s.project.structure.beams.length);
  return (
    <section
      className="shrink-0 overflow-hidden rounded border border-hairline bg-panel"
      data-testid="data-dock"
    >
      <div className="flex h-9 items-center gap-1 px-1.5">
        <button
          type="button"
          data-testid="dock-tab-nodes"
          className={`flex h-7 items-center rounded px-2 text-[12px] ${
            tab === "nodes" ? "bg-accent-tint text-accent" : "text-ink-secondary"
          }`}
          onClick={() => setTab("nodes")}
        >
          Nœuds ({nodeCount})
        </button>
        <button
          type="button"
          data-testid="dock-tab-beams"
          className={`flex h-7 items-center rounded px-2 text-[12px] ${
            tab === "beams" ? "bg-accent-tint text-accent" : "text-ink-secondary"
          }`}
          onClick={() => setTab("beams")}
        >
          Poutres ({beamCount})
        </button>
        <button
          type="button"
          aria-label={open ? "Replier le tableau de données" : "Déplier le tableau de données"}
          className="ml-auto flex h-7 w-7 items-center justify-center rounded text-[12px] text-ink-muted hover:text-ink-primary"
          data-testid="data-dock-toggle"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "▾" : "⌃"}
        </button>
      </div>
      {open ? (
        <div className="h-44 overflow-auto border-t border-hairline px-2 pb-2">
          {tab === "nodes" ? (
            <>
              <h3 className="py-1 text-[13px] font-semibold text-ink-secondary">
                <Trans>Nœuds</Trans>
              </h3>
              <NodeTable onHoverNode={onHoverNode} />
            </>
          ) : (
            <>
              <h3 className="py-1 text-[13px] font-semibold text-ink-secondary">
                <Trans>Poutres</Trans>
              </h3>
              <BeamTable onHoverBeam={onHoverBeam} />
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}

/** Coordinate cell editor (Base UI NumberField, inline in the data dock). */
function CoordinateCell({
  node,
  axis,
  onMove,
}: {
  node: NodeData;
  axis: "x" | "y" | "z";
  onMove: (id: number, x: number, y: number, z: number) => void;
}) {
  return (
    <NumberFieldRoot
      value={node[axis]}
      step={0.1}
      onValueChange={(value) => {
        if (value === null) {
          return;
        }
        onMove(
          node.id,
          axis === "x" ? value : node.x,
          axis === "y" ? value : node.y,
          axis === "z" ? value : node.z,
        );
      }}
    >
      <NumberFieldInput
        className="h-7 w-20 px-1 py-0 text-[12px]"
        aria-label={`Nœud ${node.id} · coordonnée ${axis}`}
      />
    </NumberFieldRoot>
  );
}

/** Node table on the shared TanStack DataTable (v1.5.0 data dock). */
function NodeTable({ onHoverNode }: { onHoverNode?: (id: number | null) => void } = {}) {
  const nodes = useProjectStore((s) => s.project.structure.nodes);
  const selectNode = useProjectStore((s) => s.selectNode);
  const removeNode = useProjectStore((s) => s.removeNode);
  const moveNode = useProjectStore((s) => s.moveNode);
  const selection = useProjectStore((s) => s.selection);
  const columns = useMemo<ColumnDef<NodeData, unknown>[]>(
    () => [
      {
        accessorKey: "id",
        header: "ID",
        cell: (ctx) => <span className="pr-2">{ctx.row.original.id}</span>,
      },
      ...(["x", "y", "z"] as const).map((axis) => ({
        id: axis,
        header: `${axis.toUpperCase()} (m)`,
        meta: { numeric: true },
        cell: (ctx: { row: { original: NodeData } }) => (
          <CoordinateCell node={ctx.row.original} axis={axis} onMove={moveNode} />
        ),
      })),
      {
        id: "remove",
        header: "",
        cell: (ctx: { row: { original: NodeData } }) => (
          <button
            type="button"
            aria-label={`Supprimer le nœud ${ctx.row.original.id}`}
            className="text-ink-muted hover:text-fea-max"
            onClick={(event) => {
              event.stopPropagation();
              removeNode(ctx.row.original.id);
            }}
          >
            <IconTrash size={13} />
          </button>
        ),
      },
    ],
    [moveNode, removeNode],
  );
  return (
    <DataTable<NodeData>
      columns={columns}
      data={nodes}
      onRowClick={(n) => selectNode(n.id)}
      onRowHover={
        onHoverNode === undefined ? undefined : (n) => onHoverNode(n === null ? null : n.id)
      }
      rowClassName={(n) => (selection.nodeId === n.id ? "bg-accent-tint" : undefined)}
    />
  );
}

function BeamTable({ onHoverBeam }: { onHoverBeam?: (id: number | null) => void } = {}) {
  const beams = useProjectStore((s) => s.project.structure.beams);
  const storeNodes = useProjectStore((s) => s.project.structure.nodes);
  const selectBeam = useProjectStore((s) => s.selectBeam);
  const removeBeam = useProjectStore((s) => s.removeBeam);
  const selection = useProjectStore((s) => s.selection);
  const batchUpdateBeams = useProjectStore((s) => s.batchUpdateBeams);
  const [batchIds, setBatchIds] = useState<number[]>([]);
  const columns = useMemo<ColumnDef<BeamData, unknown>[]>(
    () => [
      {
        accessorKey: "id",
        header: "ID",
        cell: (ctx) => <span className="pr-2">{ctx.row.original.id}</span>,
      },
      { accessorKey: "n1", header: "N1" },
      { accessorKey: "n2", header: "N2" },
      {
        accessorKey: "section_id",
        header: "Profil",
        cell: (ctx) => <span className="font-data">{ctx.row.original.section_id}</span>,
      },
      {
        id: "remove",
        header: "",
        cell: (ctx: { row: { original: BeamData } }) => (
          <button
            type="button"
            aria-label={`Supprimer la poutre ${ctx.row.original.id}`}
            className="text-ink-muted hover:text-fea-max"
            onClick={(event) => {
              event.stopPropagation();
              removeBeam(ctx.row.original.id);
            }}
          >
            <IconTrash size={13} />
          </button>
        ),
      },
    ],
    [removeBeam],
  );
  return (
    <>
      <DataTable<BeamData>
        columns={columns}
        data={beams}
        onRowClick={(b, event) => {
          if (event.shiftKey) {
            // Shift+Click extends the multi-selection (batch inspector).
            setBatchIds((ids) =>
              ids.includes(b.id) ? ids.filter((x) => x !== b.id) : [...ids, b.id],
            );
            return;
          }
          selectBeam(b.id);
        }}
        onRowHover={
          onHoverBeam === undefined ? undefined : (b) => onHoverBeam(b === null ? null : b.id)
        }
        rowClassName={(b) =>
          selection.beamId === b.id || batchIds.includes(b.id) ? "bg-accent-tint" : undefined
        }
      />
      {batchIds.length > 0 ? (
        <div
          className="mt-2 rounded border border-accent-ring bg-accent-tint p-2"
          data-testid="batch-editor"
        >
          <p className="font-data text-[12px] text-accent">
            {batchIds.length} poutre(s) sélectionnée(s)
          </p>
          {/* v1.4.0: cumulative ΣL / Σm for the multi-selection. */}
          {(() => {
            let totalLength = 0;
            for (const id of batchIds) {
              const beam = beams.find((b) => b.id === id);
              if (beam === undefined) continue;
              const n1 = storeNodes.find((n) => n.id === beam.n1);
              const n2 = storeNodes.find((n) => n.id === beam.n2);
              if (n1 === undefined || n2 === undefined) continue;
              totalLength += Math.hypot(n2.x - n1.x, n2.y - n1.y, n2.z - n1.z);
            }
            const unitMassKgM: Record<string, number> = {
              "IPE 140": 16.4,
              "IPE 200": 22.4,
              "IPE 240": 30.7,
              "IPE 300": 42.2,
              "HEA 200": 42.3,
              "HEA 180": 35.2,
            };
            const designation = beams.find((b) => batchIds.includes(b.id))?.section_id ?? "IPE 200";
            const mass = totalLength * (unitMassKgM[designation] ?? 22.4);
            return (
              <p className="font-data text-[11px] text-ink-muted">
                ΣL = {totalLength.toFixed(2)} m · Σm ≈ {mass.toFixed(1)} kg
              </p>
            );
          })()}
          <div className="mt-1 flex gap-2">
            <select
              aria-label="batch section"
              className="font-data h-8 w-full rounded-[4px] border border-hairline bg-panel px-1 text-[12px]"
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

/** Roll angle, end releases and buckling lengths of the selected member. */
function BeamPatchPanel({ beam }: { beam: BeamData }) {
  const updateBeam = useProjectStore((s) => s.updateBeam);
  const releaseLabels = ["Ux", "Uy", "Uz", "Rx", "Ry", "Rz"];
  return (
    <div>
      <p className="font-data text-[12px] text-ink-secondary">
        P{beam.id} · {beam.section_id} · {beam.material_id}
      </p>
      <div className="mt-2 grid grid-cols-[112px_1fr] items-center gap-x-2 gap-y-2">
        <label className="text-xs font-medium text-ink-secondary" htmlFor="roll-angle">
          <Trans>Roulis θx (°)</Trans>
        </label>
        <NumberFieldRoot
          id="roll-angle"
          value={Math.round((beam.roll_angle_rad * 180) / Math.PI)}
          onValueChange={(deg) => {
            if (deg !== null) updateBeam(beam.id, { roll_angle_rad: (deg * Math.PI) / 180 });
          }}
        >
          <NumberFieldInput className="h-8 w-24" />
        </NumberFieldRoot>
        <span className="text-xs font-medium text-ink-secondary">
          <Trans>Longueurs de flambement</Trans>
        </span>
        <div className="flex gap-2">
          {(["k_buckling_y", "k_buckling_z"] as const).map((key) => (
            <NumberFieldRoot
              key={key}
              value={beam[key]}
              step={0.1}
              min={0.1}
              onValueChange={(v) => {
                if (v !== null && v > 0) updateBeam(beam.id, { [key]: v });
              }}
            >
              <NumberFieldInput
                className="h-8 w-16"
                aria-label={key === "k_buckling_y" ? "ky" : "kz"}
              />
            </NumberFieldRoot>
          ))}
        </div>
      </div>
      <p className="mt-2 text-[12px] text-ink-secondary">
        <Trans>Relâchements N1 / N2</Trans>
      </p>
      <div className="mt-1 grid grid-cols-2 gap-2">
        {(["releases_start", "releases_end"] as const).map((side) => (
          <div key={side} className="border-t border-hairline pt-1">
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
