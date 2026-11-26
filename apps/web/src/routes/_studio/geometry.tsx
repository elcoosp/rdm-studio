import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Trans } from "@lingui/react/macro";
import { toast } from "sonner";
import { ChevronDown, ChevronUp } from "lucide-react";
import { t } from "@lingui/core/macro";
import { IconFrame, IconPlus, IconTrash } from "@/components/icons";
import { GeometryFullSearchSchema } from "@/schemas/searchParams.schema";
import { useSelectedIds, useUpdateSearch, useViewportParams } from "@/hooks/useStudioQuery";
import { useViewportStore } from "@/state/viewportStore";
import { BottomSheet } from "@/components/BottomSheet";
import { DesktopSplit } from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { NumberFieldRoot, NumberFieldInput } from "@/components/ui/number-field";
import { Input } from "@/components/ui/input";
import {
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxRoot,
} from "@/components/ui/combobox";
import { Checkbox } from "@/components/ui/checkbox";
import { feaClient, type SectionDims, type SectionSummary } from "@/wasmBridge/workerClient";
import { useProjectStore, type BeamData, type NodeData } from "@/state/projectStore";
import { FamilyPills, familyOfDesignation, type FamilyName } from "@/components/FamilyPills";
import { CadToolbar } from "@/components/CadToolbar";
import { StageContent, useStageSlot } from "@/state/stageStore";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { quickStartProject } from "@/state/projectStore";
import { parseUnitValue } from "@/modeling/cadTools";
import {
  MassWeightIcon,
  NodePin,
  ProfileAngle,
  ProfileChs,
  ProfileHea,
  ProfileIpe,
  ProfileRhs,
  ProfileUpn,
  ReleaseHinge,
  SteelJointIcon,
  TorqueMoment,
} from "@/components/icons/EngineeringIcons";
import { ProjectGalleryModal } from "@/components/ProjectGalleryModal";
import { CadImportDialog } from "@/components/CadImportDialog";

export const Route = createFileRoute("/_studio/geometry")({
  staticData: {
    surface: "studio",
    stepOrder: 1,
    label: "Géométrie & Profilés",
    mobileLabel: "Géométrie",
    icon: IconFrame,
    stageVisible: true,
    shortcut: "1",
  },
  validateSearch: GeometryFullSearchSchema,
  component: GeometryPage,
});

/**
 * Step 1 (DESIGN.md §4 desktop + mockups tape_1, v2.1.2): locked `md+`
 * workstation — 320px left inspector beside a full-height 3D viewport
 * (the PERSISTENT stage slot) with a collapsible bottom data dock. The
 * 3D canvas lives in the `_studio` layout and never remounts across
 * Steps 1–4. Every picker is a shadcn/Base UI primitive (Matériau =
 * Select with engineering icons, N1/N2 + batch profile = searchable
 * Combobox with right-aligned kg/m · h metadata), the release toggles
 * are Base UI `Checkbox`es and the placement fields ride `Input`.
 */
function GeometryPage() {
  const project = useProjectStore((s) => s.project);
  // v2.1.0: selection and render mode are URL-driven (zero Zustand mirror).
  const { beamId, selectBeam } = useSelectedIds();
  const { render } = useViewportParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const addNode = useProjectStore((s) => s.addNode);
  const addBeam = useProjectStore((s) => s.addBeam);
  const loadProject = useProjectStore((s) => s.loadProject);
  const updateBeam = useProjectStore((s) => s.updateBeam);
  const [sections, setSections] = useState<SectionSummary[]>([]);
  const [sectionDims, setSectionDims] = useState<Map<string, SectionDims>>(new Map());
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
  // v1.6.0: compact X/Y/Z placement fields beside the `+ Nœud` button.
  const [nodeX, setNodeX] = useState<number | null>(null);
  const [nodeY, setNodeY] = useState<number | null>(null);
  const [nodeZ, setNodeZ] = useState<number | null>(null);
  const [hoverBeamId, setHoverBeamId] = useState<number | null>(null);
  // v1.5.0: the data dock rides inside the drawer on phones.
  const isMobile = useMediaQuery("(max-width: 767px)");
  // v1.6.0: the persistent stage slot pane.
  const slotRef = useStageSlot("geometry");
  const toolMode = useViewportStore((s) => s.toolMode);
  const setToolMode = useViewportStore((s) => s.setToolMode);

  useEffect(() => {
    void feaClient.fetchCatalog().then((c) => {
      setSections(c.sections);
      setSectionDims(new Map(c.sectionDims.map((d) => [d.designation, d])));
    });
  }, []);

  const ipeSections = sections;
  // v2.0.1: FamilyPills filter the profile list directly (by designation
  // family) inside the left inspector, above the profile Combobox.
  const family = (search.family ?? "Tous") as FamilyName;
  const updateSearch = useUpdateSearch();
  const setFamily = (next: FamilyName) => {
    updateSearch((prev) => ({ ...prev, family: next === "Tous" ? undefined : next }));
  };
  const familySections =
    family === "Tous"
      ? ipeSections
      : ipeSections.filter((s) => familyOfDesignation(s.designation) === family);
  const selectedBeam = project.structure.beams.find((b) => b.id === beamId) ?? null;
  const nodeIds = project.structure.nodes.map((n) => n.id);

  /** Profile metadata row: mass (kg/m) + depth h (mm), right-aligned mono. */
  const profileMeta = (designation: string): string => {
    const dims = sectionDims.get(designation);
    if (dims === undefined) return "";
    const kgPerM = dims.a * 7850;
    const hMm = dims.h !== null ? Math.round(dims.h * 1000) : null;
    return `${kgPerM.toFixed(1).replace(".", ",")} kg/m${hMm !== null ? ` · h ${hMm}` : ""}`;
  };

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

  /** v1.6.0: X/Y/Z fields win when filled; otherwise walk +2 m. */
  const placeNode = () => {
    const fallback = nextDefaultPosition();
    const x = nodeX ?? fallback[0];
    const y = nodeY ?? fallback[1];
    const z = nodeZ ?? fallback[2];
    addNode(x, y, z);
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
      {/* Flat action rows — nested card borders stay out of the inspector.
          v2.1.1 row 1: `+ Nœud` beside the X/Y/Z placement fields with
          EXPLICIT metre labels and unit-suffixed parsing (`4000mm`,
          `4m` — parseUnitValue). v2.1.1 row 2: full-width `Importer CAO`
          + `Galerie de projets` side-by-side so nothing truncates. */}
      <div className="flex flex-wrap items-end gap-2" data-testid="node-placement">
        <button
          type="button"
          className="flex items-center gap-1 rounded bg-accent px-2.5 py-1.5 text-[13px] text-white"
          data-testid="add-node"
          onClick={placeNode}
        >
          <IconPlus size={12} />
          <Trans>Nœud</Trans>
        </button>
        {(
          [
            ["X", nodeX, setNodeX],
            ["Y", nodeY, setNodeY],
            ["Z", nodeZ, setNodeZ],
          ] as const
        ).map(([axis, value, setter]) => (
          <UnitCoordinateField key={axis} axis={axis} value={value} onValue={setter} />
        ))}
        {cadError !== null ? (
          <span className="self-center text-[12px] text-fea-max">{cadError}</span>
        ) : null}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          className="min-w-0 whitespace-nowrap rounded border border-hairline px-2 py-1.5 text-[13px] text-ink-secondary"
          data-testid="open-cad-import"
          onClick={() => setCadOpen(true)}
        >
          <Trans>Importer CAO</Trans>
        </button>
        <button
          type="button"
          className="min-w-0 whitespace-nowrap rounded border border-hairline px-2 py-1.5 text-[13px] text-ink-secondary"
          data-testid="open-gallery"
          onClick={() => setGalleryOpen(true)}
        >
          <Trans>Galerie de projets</Trans>
        </button>
      </div>

      {/* 2-column key-value property grid (craft-floor: flat hairlines). */}
      {/* v2.0.2: family pills full-width above the grid, still filtering
          the profile list directly by designation family. */}
      <FamilyPills active={family} onPick={(picked: FamilyName) => setFamily(picked)} />
      <section className="border-t border-hairline pt-3">
        <div className="grid grid-cols-[112px_1fr] items-center gap-x-2 gap-y-2">
          <label className="text-xs font-medium text-ink-secondary" htmlFor="material-select">
            <Trans>Matériau</Trans>
          </label>
          <SelectRoot
            id="material-select"
            value={material}
            onValueChange={(next) => {
              if (next === null) return;
              setMaterial(next);
              if (selectedBeam !== null) {
                updateBeam(selectedBeam.id, { material_id: next });
              }
            }}
          >
            <SelectTrigger aria-label={t`Matériau`} data-testid="material-select">
              <span className="flex min-w-0 items-center gap-1.5">
                <MaterialIcon material={material} />
                <SelectValue />
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="S235JR">
                <span className="flex items-center gap-1.5">
                  <SteelJointIcon size={16} />
                  Acier S235JR
                </span>
              </SelectItem>
              <SelectItem value="S355J2">
                <span className="flex items-center gap-1.5">
                  <SteelJointIcon size={16} />
                  Acier S355J2
                </span>
              </SelectItem>
              <SelectItem value="304L">
                <span className="flex items-center gap-1.5">
                  <SteelJointIcon size={16} />
                  Inox 304L
                </span>
              </SelectItem>
              <SelectItem value="6061-T6">
                <span className="flex items-center gap-1.5">
                  <MassWeightIcon size={16} />
                  Alu 6061-T6
                </span>
              </SelectItem>
            </SelectContent>
          </SelectRoot>
          <label className="flex items-center gap-1.5 text-xs font-medium text-ink-secondary">
            <ProfileIpe size={16} />
            <Trans>Profil (EN 10365)</Trans>
          </label>
          {/* v1.6.0: family-accurate cross-section icons per designation,
              v2.1.2: right-aligned kg/m · h metadata on every row. */}
          <ComboboxRoot
            items={familySections.map((s) => s.designation)}
            value={selectedBeam?.section_id ?? newSection}
            onValueChange={(next: string | null) => {
              if (next === null) return;
              setNewSection(next);
              if (selectedBeam !== null) {
                updateBeam(selectedBeam.id, { section_id: next });
              }
            }}
          >
            <ComboboxInput id="section-search" className="h-8" />
            <ComboboxContent
              className="min-w-[300px]"
              renderItem={(designation: string) => (
                <ComboboxItem key={designation} value={designation}>
                  <ProfileFamilyIcon designation={designation} />
                  <span className="font-data flex-1 whitespace-nowrap">{designation}</span>
                  <span className="font-data whitespace-nowrap text-right text-[10px] text-ink-muted">
                    {profileMeta(designation)}
                  </span>
                </ComboboxItem>
              )}
            >
              <ComboboxEmpty>Aucun profilé trouvé</ComboboxEmpty>
            </ComboboxContent>
          </ComboboxRoot>
        </div>
        <SectionCatalogRow designation={selectedBeam?.section_id ?? newSection} />
      </section>

      {/* Bug 5: explicit N1 → N2 selection replaces the hardcoded demo pair.
          v2.1.2: searchable Comboboxes with NodePin icons + coordinates. */}
      <section className="border-t border-hairline pt-3">
        <h3 className="text-xs font-medium text-ink-secondary">
          <Trans>Créer une poutre</Trans>
        </h3>
        <div className="mt-2 grid grid-cols-[112px_1fr] items-center gap-x-2 gap-y-2">
          <span className="text-xs font-medium text-ink-secondary">Extrémités</span>
          <div className="flex items-center gap-2">
            <NodeCombobox
              ariaLabel="N1"
              nodes={project.structure.nodes}
              value={beamN1}
              onPick={(id) => {
                userN1.current = true;
                setBeamN1(id);
              }}
            />
            <span className="font-data text-[13px] text-ink-muted">→</span>
            <NodeCombobox
              ariaLabel="N2"
              nodes={project.structure.nodes}
              value={beamN2}
              onPick={(id) => {
                userN2.current = true;
                setBeamN2(id);
              }}
            />
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
            const newBeamId = addBeam(beamN1, beamN2, newSection, material);
            // v2.1.0: the single selection is URL-backed — selecting the
            // freshly created member writes `?beam=` (replace: true).
            selectBeam(newBeamId);
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

      {isMobile ? <DataDock onHoverBeam={setHoverBeamId} /> : null}

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
      {/* v1.6.0: the persistent stage slot — the ONE canvas in the studio
          layout overlays this pane, so orbit/zoom survive every step. */}
      {/* v2.0.1: the CAD toolbar docks as a flow row ABOVE the viewport
          slot — it can no longer overlap the app header, the in-stage
          layer toolbar or the Iso|XY|XZ|YZ camera presets. */}
      <CadToolbar />
      <div
        ref={slotRef}
        className="relative min-h-0 flex-1 overflow-hidden rounded-panel border border-hairline bg-panel"
        data-testid="geometry-stage-slot"
      >
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
        ) : null}
        {/* v2.1.2: HUD corners lifted above the 24px stage status bar. */}
        {sectionCounts.length > 0 && project.structure.nodes.length > 0 ? (
          <div
            className="pointer-events-none absolute bottom-8 left-2 z-30 flex max-w-[62%] flex-wrap gap-1 rounded-panel border border-hairline bg-panel/90 p-1 backdrop-blur"
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
          className="pointer-events-none absolute bottom-8 left-1/2 z-30 hidden -translate-x-1/2 font-data text-[10px] text-ink-muted md:block"
          data-testid="viewport-hint"
        >
          Clic G Sélection · Clic D Orbite · Maj+Glisser Pan · Clic D Nœud Menu · Suppr Effacer
        </p>
      </div>
      {/* Route render inputs for the shared stage geometry. */}
      <StageContent
        k="geometry"
        options={{
          wireframe: render === "wireframe",
          selectedBeamId: beamId,
          hoveredBeamId: hoverBeamId,
        }}
      >
        {null}
      </StageContent>
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
            <Trans>cliquez le plan de grille pour poser un nœud (accrochage magnétique)</Trans>
          </span>
        ) : null}
        {toolMode === "beam" ? (
          <span className="hidden px-2 text-[11px] text-ink-muted lg:inline">
            <Trans>cliquez deux nœuds pour relier (N départ cyan)</Trans>
          </span>
        ) : null}
      </div>
      {!isMobile ? <DataDock onHoverBeam={setHoverBeamId} /> : null}
    </section>
  );

  return <DesktopSplit inspector={inspector} main={main} />;
}

/** Material-family icon for the Matériau Select trigger rows. */
function MaterialIcon({ material }: { material: string }): React.ReactElement {
  if (material === "6061-T6") {
    return <MassWeightIcon size={16} />;
  }
  if (material === "304L") {
    return <SteelJointIcon size={16} />;
  }
  return <SteelJointIcon size={16} />;
}

/**
 * Searchable node picker (v2.1.2): a Base UI Combobox whose rows carry the
 * `NodePin` icon, the node id and its (x, y, z) coordinates — replacing
 * the raw `<select aria-label="N1">` (zero raw selects anywhere).
 */
function NodeCombobox({
  ariaLabel,
  nodes,
  value,
  onPick,
}: {
  ariaLabel: string;
  nodes: NodeData[];
  value: number | null;
  onPick: (id: number) => void;
}) {
  const selected = nodes.find((n) => n.id === value);
  return (
    <ComboboxRoot
      items={nodes.map((n) => n.id)}
      value={value ?? null}
      onValueChange={(next: number | null) => {
        if (next !== null) onPick(next);
      }}
      itemToStringValue={(id: number) => `N${id}`}
    >
      <ComboboxInput
        aria-label={ariaLabel}
        className="h-8"
        placeholder={selected !== undefined ? `N${selected.id}` : "N…"}
      />
      <ComboboxContent
        renderItem={(id: number) => {
          const node = nodes.find((n) => n.id === id);
          return (
            <ComboboxItem key={id} value={id}>
              <NodePin size={16} />
              <span className="font-data flex-1">
                N{id}
                {node !== undefined
                  ? ` · (${node.x.toFixed(2)} ; ${node.y.toFixed(2)} ; ${node.z.toFixed(2)})`
                  : ""}
              </span>
            </ComboboxItem>
          );
        }}
      >
        <ComboboxEmpty>Aucun nœud</ComboboxEmpty>
      </ComboboxContent>
    </ComboboxRoot>
  );
}

/** Family-accurate profile icon (EN 10365 / 10210 / 10056 designations). */
export function ProfileFamilyIcon({ designation }: { designation: string }) {
  const d = designation.toUpperCase();
  if (d.startsWith("HE")) {
    return <ProfileHea size={16} />;
  }
  if (d.startsWith("UP") || d.startsWith("UPE")) {
    return <ProfileUpn size={16} />;
  }
  if (d.startsWith("CHS")) {
    return <ProfileChs size={16} />;
  }
  if (d.startsWith("RHS") || d.startsWith("SHS")) {
    return <ProfileRhs size={16} />;
  }
  if (d.startsWith("L ") || d.includes("ANGLE")) {
    return <ProfileAngle size={16} />;
  }
  return <ProfileIpe size={16} />;
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
  onHoverNode?: (id: number | null) => void;
  onHoverBeam: (id: number | null) => void;
}) {
  // v2.1.0: dock tab (`?tab=`) and visibility (`?dock=`) are URL-backed.
  const search = Route.useSearch();
  const updateSearch = useUpdateSearch();
  const tab = search.tab ?? "nodes";
  const open = (search.dock ?? 1) === 1;
  const setTab = (next: "nodes" | "beams") => {
    updateSearch((prev) => ({ ...prev, tab: next }));
  };
  const setOpen = (next: boolean) => {
    updateSearch((prev) => ({ ...prev, dock: next ? 1 : 0 }));
  };
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
          className="ml-auto flex h-7 w-7 items-center justify-center rounded text-ink-muted hover:text-ink-primary"
          data-testid="data-dock-toggle"
          onClick={() => setOpen(!open)}
        >
          {open ? (
            <ChevronDown size={14} strokeWidth={1.5} aria-hidden />
          ) : (
            <ChevronUp size={14} strokeWidth={1.5} aria-hidden />
          )}
        </button>
      </div>
      {open ? (
        <div className="h-44 overflow-auto border-t border-hairline px-2 pb-2">
          {tab === "nodes" ? (
            <NodeTable onHoverNode={onHoverNode} />
          ) : (
            <BeamTable onHoverBeam={onHoverBeam} />
          )}
        </div>
      ) : null}
    </section>
  );
}

/** Coordinate cell editor (Base UI NumberField, inline in the data dock).
 *  v2.1.1: `w-16` keeps the Nœuds table free of any horizontal scrollbar. */
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
        className="h-7 w-16 px-1 py-0 text-[12px]"
        aria-label={`Nœud ${node.id} · coordonnée ${axis}`}
      />
    </NumberFieldRoot>
  );
}

/**
 * v2.1.1 unit-aware placement field: an explicit `X (m)` metre label plus
 * unit-suffixed parsing through `parseUnitValue` — `4000mm` and `4m` both
 * land as 4 m, plain numbers stay metres, invalid drafts clear the value.
 */
function UnitCoordinateField({
  axis,
  value,
  onValue,
}: {
  axis: "X" | "Y" | "Z";
  value: number | null;
  onValue: (v: number | null) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <label className="flex items-center gap-1 text-[11px] text-ink-muted">
      <span className="font-data shrink-0">{axis} (m)</span>
      <Input
        inputMode="decimal"
        aria-label={`Placement ${axis} (m)`}
        placeholder={axis}
        value={draft ?? (value === null ? "" : String(value))}
        onChange={(e) => {
          const raw = e.currentTarget.value;
          setDraft(raw);
          onValue(parseUnitValue(raw));
        }}
        onBlur={() => setDraft(null)}
        className="h-6 w-16 px-1 text-[12px]"
      />
    </label>
  );
}

/** Node table on the shared TanStack DataTable (v1.5.0 data dock). */
function NodeTable({ onHoverNode }: { onHoverNode?: (id: number | null) => void } = {}) {
  const nodes = useProjectStore((s) => s.project.structure.nodes);
  // v2.1.0: node selection reads/writes `?node=` (URL single source of truth).
  const { nodeId, selectNode } = useSelectedIds();
  const removeNode = useProjectStore((s) => s.removeNode);
  const moveNode = useProjectStore((s) => s.moveNode);
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
      rowClassName={(n) => (nodeId === n.id ? "bg-accent-tint" : undefined)}
    />
  );
}

function BeamTable({ onHoverBeam }: { onHoverBeam?: (id: number | null) => void } = {}) {
  const beams = useProjectStore((s) => s.project.structure.beams);
  const storeNodes = useProjectStore((s) => s.project.structure.nodes);
  // v2.1.0: single pick = `?beam=` in the URL; shift-click keeps the
  // transient batch selection in the project store (not URL-duplicated).
  const { beamId, selectBeam } = useSelectedIds();
  const removeBeam = useProjectStore((s) => s.removeBeam);
  const selectedBeamIds = useProjectStore((s) => s.batch.selectedBeamIds);
  const batchUpdateBeams = useProjectStore((s) => s.batchUpdateBeams);
  const columns = useMemo<ColumnDef<BeamData, unknown>[]>(() => {
    const lengthOf = (beam: BeamData): number => {
      const n1 = storeNodes.find((n) => n.id === beam.n1);
      const n2 = storeNodes.find((n) => n.id === beam.n2);
      if (n1 === undefined || n2 === undefined) {
        return 0;
      }
      return Math.hypot(n2.x - n1.x, n2.y - n1.y, n2.z - n1.z);
    };
    return [
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
        // v1.6.0: computed member length column (mono, French comma).
        id: "length",
        header: "L (m)",
        meta: { numeric: true },
        cell: (ctx: { row: { original: BeamData } }) => (
          <span className="font-data">
            {lengthOf(ctx.row.original).toFixed(2).replace(".", ",")}
          </span>
        ),
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
    ];
  }, [removeBeam, storeNodes]);
  const batchProfiles = useMemo(() => Array.from(new Set(beams.map((b) => b.section_id))), [beams]);
  return (
    <>
      <DataTable<BeamData>
        columns={columns}
        data={beams}
        onRowClick={(b, event) => {
          if (event.shiftKey) {
            // Shift+Click extends the multi-selection (batch inspector).
            useProjectStore.getState().toggleBeamSelection(b.id);
            return;
          }
          selectBeam(b.id);
        }}
        onRowHover={
          onHoverBeam === undefined ? undefined : (b) => onHoverBeam(b === null ? null : b.id)
        }
        rowClassName={(b) =>
          beamId === b.id || selectedBeamIds.includes(b.id) ? "bg-accent-tint" : undefined
        }
      />
      {selectedBeamIds.length > 0 ? (
        <div
          className="mt-2 rounded border border-accent-ring bg-accent-tint p-2"
          data-testid="batch-editor"
        >
          <p className="font-data text-[12px] text-accent">
            {selectedBeamIds.length} poutre(s) sélectionnée(s)
          </p>
          {/* v1.4.0: cumulative ΣL / Σm for the multi-selection. */}
          {(() => {
            let totalLength = 0;
            for (const id of selectedBeamIds) {
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
            const designation =
              beams.find((b) => selectedBeamIds.includes(b.id))?.section_id ?? "IPE 200";
            const mass = totalLength * (unitMassKgM[designation] ?? 22.4);
            return (
              <p className="font-data text-[11px] text-ink-muted">
                ΣL = {totalLength.toFixed(2).replace(".", ",")} m · Σm ≈{" "}
                {mass.toFixed(1).replace(".", ",")} kg
              </p>
            );
          })()}
          <div className="mt-1 flex gap-2">
            {/* v2.1.2: batch section picker as a Select (zero raw selects). */}
            <SelectRoot
              value=""
              onValueChange={(next) => {
                if (next === null || next === "") return;
                batchUpdateBeams(selectedBeamIds, { section_id: next });
                useProjectStore.getState().clearBeamSelection();
              }}
            >
              <SelectTrigger aria-label="batch section" className="h-8 text-[12px]">
                <SelectValue placeholder="Profil…" />
              </SelectTrigger>
              <SelectContent>
                {batchProfiles.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </SelectRoot>
            <button
              type="button"
              className="rounded border border-hairline px-2 text-[12px] text-ink-secondary"
              onClick={() => useProjectStore.getState().clearBeamSelection()}
            >
              Annuler
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** Roll angle, releases, treillis toggle, subdivision and buckling lengths. */
function BeamPatchPanel({ beam }: { beam: BeamData }) {
  const updateBeam = useProjectStore((s) => s.updateBeam);
  const subdivideBeam = useProjectStore((s) => s.subdivideBeam);
  const releaseLabels = ["Ux", "Uy", "Uz", "Rx", "Ry", "Rz"];
  const [segments, setSegments] = useState<number | null>(4);
  const isTruss =
    beam.releases_start.slice(1).every(Boolean) && beam.releases_end.slice(1).every(Boolean);
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
      {/* v1.6.0: 1-click `Beam::truss` articulation toggle (RDM practice). */}
      <button
        type="button"
        data-testid="toggle-truss"
        className={`mt-2 flex w-full items-center justify-center gap-1.5 rounded border px-2 py-1.5 text-[12px] ${
          isTruss
            ? "border-accent bg-accent-tint text-accent"
            : "border-hairline text-ink-secondary hover:border-accent hover:text-accent"
        }`}
        onClick={() => {
          // Barre de treillis : libère Uy/Uz/Rx/Ry/Rz aux deux extrémités
          // (seul l'effort normal reste), exactement `Beam::truss` en Rust.
          const released = [false, true, true, true, true, true];
          const rigid = [false, false, false, false, false, false];
          const next = isTruss ? rigid : released;
          updateBeam(beam.id, { releases_start: next, releases_end: next });
        }}
      >
        <ReleaseHinge size={16} />
        <Trans>Barre de treillis (articuler N1/N2)</Trans>
      </button>
      {/* v1.6.0: subdivide the member into N collinear tronçons. */}
      <div
        className="mt-2 flex items-center justify-between gap-2 border-t border-hairline pt-2"
        data-testid="subdivide-panel"
      >
        <span className="flex items-center gap-1.5 text-[12px] text-ink-secondary">
          <TorqueMoment size={16} />
          <Trans>Subdiviser en N tronçons</Trans>
        </span>
        <NumberFieldRoot
          value={segments}
          step={1}
          min={2}
          max={24}
          onValueChange={(v) => setSegments(v)}
        >
          <NumberFieldInput className="font-data h-8 w-14" aria-label="Nombre de tronçons" />
        </NumberFieldRoot>
        <button
          type="button"
          data-testid="subdivide-beam"
          className="rounded border border-accent px-2 py-1 text-[12px] text-accent hover:bg-accent-tint disabled:opacity-40"
          disabled={segments === null || segments < 2}
          onClick={() => {
            if (segments === null || segments < 2) return;
            subdivideBeam(beam.id, segments);
            toast(t`P${beam.id} subdivisée en ${segments} tronçons`, { duration: 3_000 });
          }}
        >
          <Trans>Subdiviser</Trans>
        </button>
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
                  <Checkbox
                    checked={beam[side][i] ?? false}
                    onCheckedChange={(checked) => {
                      const next = [...beam[side]];
                      next[i] = checked === true;
                      updateBeam(beam.id, { [side]: next });
                    }}
                    aria-label={`${side === "releases_start" ? "N1" : "N2"} ${label}`}
                    className="mt-0.5"
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

/**
 * EN 10365 property row + scaled 2D cross-section SVG diagram (v1.6.0):
 * `h, b, tw, tf` dimensions annotated in mm, drawn to scale from the
 * catalog outline.
 */
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
  const [dims, setDims] = useState<SectionDims | null>(null);
  useEffect(() => {
    let cancelled = false;
    void feaClient.fetchCatalog().then((c) => {
      const found = c.sectionDims.find((d) => d.designation === designation) ?? null;
      if (!cancelled) setDims(found);
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
    <>
      {dims?.h != null && dims.b != null ? <SectionDiagram dims={dims} /> : null}
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
        <dd className="text-right">{props.mass_per_m.toFixed(1).replace(".", ",")} kg/m</dd>
      </dl>
    </>
  );
}

/**
 * Scaled 2D cross-section diagram (v1.6.0): the true catalog outline
 * (`DoubleSymmetricI`, `Channel`, hollow, angle) drawn in an SVG viewBox
 * with `h / b / tw / tf` mm annotations, from `catalog_section_shapes`.
 */
export function SectionDiagram({ dims }: { dims: SectionDims }) {
  const mm = (v: number | null): number => (v ?? 0) * 1000;
  const h = mm(dims.h);
  const b = mm(dims.b);
  const tw = mm(dims.tw);
  const tf = mm(dims.tf);
  const isChs = dims.shape === "CircularHollow";
  const maxDim = Math.max(h, b, 1);
  const scale = 100 / maxDim;
  const vbW = Math.max(b * scale, 60) + 44;
  const vbH = h * scale + 44;
  const cx = vbW / 2;
  const cy = vbH / 2;
  return (
    <figure
      className="mt-2 rounded border border-hairline bg-panel-subtle p-2"
      data-testid="section-diagram"
    >
      <svg viewBox={`0 0 ${vbW} ${vbH}`} className="h-24 w-full" role="img" aria-label="Coupe 2D">
        <g stroke="#1D4ED8" fill="#EFF6FF" strokeWidth="1">
          {isChs ? (
            <>
              <circle cx={cx} cy={cy} r={(h / 2) * scale} />
              <circle
                cx={cx}
                cy={cy}
                r={Math.max((h / 2) * scale - tf * scale, 2)}
                fill="#F8FAFC"
              />
            </>
          ) : dims.shape === "RectangularHollow" ? (
            <>
              <rect
                x={cx - (b * scale) / 2}
                y={cy - (h * scale) / 2}
                width={b * scale}
                height={h * scale}
              />
              <rect
                x={cx - (b * scale) / 2 + tw * scale}
                y={cy - (h * scale) / 2 + tf * scale}
                width={Math.max(b * scale - 2 * tw * scale, 2)}
                height={Math.max(h * scale - 2 * tf * scale, 2)}
                fill="#F8FAFC"
              />
            </>
          ) : dims.shape === "Channel" ? (
            <path
              d={`M ${cx - (b * scale) / 2} ${cy - (h * scale) / 2}
                  h ${b * scale} v ${tf * scale} h -${(b - tw) * scale} v ${(h - 2 * tf) * scale} h ${(b - tw) * scale} v ${tf * scale} h -${b * scale} Z`}
            />
          ) : (
            /* Doubly-symmetric I */
            <path
              d={`M ${cx - (b * scale) / 2} ${cy - (h * scale) / 2}
                  h ${b * scale} v ${tf * scale} h -${((b - tw) / 2) * scale} v ${(h - 2 * tf) * scale} h ${((b - tw) / 2) * scale} v ${tf * scale} h -${b * scale} Z`}
            />
          )}
        </g>
        {/* Metric annotations (mm, JetBrains Mono, tabular). */}
        <g stroke="#475569" strokeWidth="0.75" fill="#475569" fontSize="8">
          <line
            x1={cx + (b * scale) / 2 + 4}
            y1={cy - (h * scale) / 2}
            x2={cx + (b * scale) / 2 + 4}
            y2={cy + (h * scale) / 2}
          />
          <text x={cx + (b * scale) / 2 + 7} y={cy} dominantBaseline="middle">
            h = {h.toFixed(0)}
          </text>
          <line
            x1={cx - (b * scale) / 2}
            y1={cy + (h * scale) / 2 + 4}
            x2={cx + (b * scale) / 2}
            y2={cy + (h * scale) / 2 + 4}
          />
          <text x={cx} y={cy + (h * scale) / 2 + 12} textAnchor="middle">
            b = {b.toFixed(0)}
          </text>
          <text x={cx} y={cy - (h * scale) / 2 - 4} textAnchor="middle" fontSize="7">
            tf = {tf.toFixed(1)} · tw = {tw.toFixed(1)}
          </text>
        </g>
      </svg>
      <figcaption className="font-data text-[10px] text-ink-muted">
        <Trans>Coupe EN — dimensions en mm</Trans>
      </figcaption>
    </figure>
  );
}
