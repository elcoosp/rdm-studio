import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Trans } from "@lingui/react/macro";
import { toast } from "sonner";
import { t } from "@lingui/core/macro";
import { IconFrame, IconPlus, PortalFrameIcon } from "@rdm-studio/ui/icons";
import { GeometryFullSearchSchema } from "@/schemas/searchParams.schema";
import { useSelectedIds, useUpdateSearch, useViewportParams } from "@/hooks/useStudioQuery";
import { useViewportStore } from "@/state/viewportStore";
import { BottomSheet } from "@/components/BottomSheet";
import { DesktopSplit } from "@/components/ui/resizable";
import { Button } from "@rdm-studio/ui/primitives";
import { SegmentedControl } from "@rdm-studio/ui/interior";
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
import { familyColorOf } from "@/viewport3d/BeamMeshes";
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
} from "@rdm-studio/ui/icons";
import { ProjectGalleryModal } from "@/components/ProjectGalleryModal";
import { CompositeSectionStudio } from "@/components/CompositeSectionStudio";
import { CadImportDialog } from "@/components/CadImportDialog";
import { ModelDataTable } from "@/components/ModelDataTable";
import { ParametricFrameModal } from "@/components/ParametricFrameModal";
import {
  CustomMaterialButton,
  MemberGroupsPanel,
  StoreyLevelsPanel,
} from "@/components/StudioM12Panels";
import { compactModel } from "@/modeling/modelCleanup";
import { trackProductEvent } from "@/lib/productTelemetry";

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
  const { beamId, selectBeam, selectNode } = useSelectedIds();
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
  // M9.4: the metrology spreadsheet hover highlights nodes in 3D too.
  const [hoverNodeId, setHoverNodeId] = useState<number | null>(null);
  // M9.3: the parametric frame library modal.
  const [parametricOpen, setParametricOpen] = useState(false);
  // M11.2: the composite Sections Droites studio dialog.
  const [compositeOpen, setCompositeOpen] = useState(false);
  // v1.5.0: the data dock rides inside the drawer on phones.
  const isMobile = useMediaQuery("(max-width: 767px)");
  // v1.6.0: the persistent stage slot pane.
  const slotRef = useStageSlot("geometry");
  const toolMode = useViewportStore((s) => s.toolMode);
  const setToolMode = useViewportStore((s) => s.setToolMode);
  // M9.1: Auto-Split on Draw (default ON) — beam tool cuts host beams.
  const autoSplitOnDraw = useViewportStore((s) => s.autoSplitOnDraw);
  const setAutoSplitOnDraw = useViewportStore((s) => s.setAutoSplitOnDraw);

  useEffect(() => {
    void feaClient.fetchCatalog().then((c) => {
      setSections(c.sections);
      setSectionDims(new Map(c.sectionDims.map((d) => [d.designation, d])));
    });
  }, []);

  // M11.2: the ⌘K palette dispatches `rdm-open-composite-studio`.
  useEffect(() => {
    const open = (): void => setCompositeOpen(true);
    window.addEventListener("rdm-open-composite-studio", open);
    return () => window.removeEventListener("rdm-open-composite-studio", open);
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
    void trackProductEvent("node_placed", {
      n_nodes: project.structure.nodes.length + 1,
    });
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
      // M12.5: bidirectional BIM round-trip — `.ifc` (IFC4 structural) and
      // `.saf.json` (SAF) come back through `import_bim` as fresh projects.
      const isIfc = /\.ifc$/i.test(file.name);
      const isSaf = /\.saf\.json$|\.json$/i.test(file.name);
      let json: string;
      let name = file.name.replace(/\.(dxf|step|stp|igs|iges|ifc|json)$/i, "");
      if (isIfc || isSaf) {
        const text = await file.text();
        json = await feaClient.importBim(text, isIfc ? "ifc" : "saf", name);
      } else {
        const bytes = await file.arrayBuffer();
        json = await feaClient.importCad(bytes, file.name, name);
      }
      name = name === "" ? "Import" : name;
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

  // M9.1: the Step 1 Compacter — same atomic pass as the toolbar button,
  // with the undoable Sonner summary toast.
  const runCompact = (): void => {
    const before = structuredClone(useProjectStore.getState().project);
    const { project: cleaned, stats } = compactModel(useProjectStore.getState().project);
    loadProject(cleaned);
    toast(
      t`Modèle compacté : ${stats.splitBeams} poutre(s) découpée(s), ${stats.mergedNodes} nœud(s) fusionné(s)`,
      {
        description: `${stats.removedDuplicates} doublon(s) supprimé(s), ${stats.removedOrphans} nœud(s) orphelin(s)`,
        action: {
          label: t`Annuler`,
          onClick: () => {
            useProjectStore.getState().loadProject(before);
          },
        },
        duration: 5_000,
      },
    );
    void trackProductEvent("cad_tool_selected", { tool: "compact_model" });
  };

  const inspector = (
    <BottomSheet testId="inspector-sheet" title={<Trans>Inspecteur de section</Trans>}>
      {/* v2.3.0: Inspector sections grouped into hairline sub-cards with 16px engineering icons. */}

      {/* v2.3.0: 1-click quick-start switcher — always on top of the
          inspector, empty model or not: the 4 pre-supported, pre-loaded
          flagships, ready to solve and jump straight to Steps 4–5. */}
      <div className="rounded-[6px] border border-hairline bg-panel-subtle/35 p-2.5">
        <h3 className="flex items-center gap-1.5 text-xs font-medium text-ink-secondary mb-2">
          <PortalFrameIcon size={16} />
          <Trans>Modèles rapides (1 clic)</Trans>
        </h3>
        <div className="grid grid-cols-2 gap-1.5">
          {(
            [
              ["naval-cradle", "Berceau naval DNV", "inspector-quick-naval-cradle"],
              ["lifting-beam", "Palonnier 20 t", "inspector-quick-lifting-beam"],
              ["workshop-jib", "Potence 5 t", "inspector-quick-workshop-jib"],
              ["portal-frame", "Portique 18 m", "inspector-quick-portal-frame"],
            ] as const
          ).map(([kind, label, testId]) => (
            <button
              key={kind}
              type="button"
              data-testid={testId}
              className="truncate rounded-[4px] border border-hairline bg-panel px-2 py-1.5 text-left text-[12px] font-medium text-ink-secondary transition-colors hover:border-accent hover:bg-accent-tint/50 hover:text-accent"
              onClick={() => {
                const project = quickStartProject(kind);
                loadProject(project);
                selectBeam(null);
                selectNode(null);
                toast(t`Modèle chargé : ${project.name}`);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Node Placement sub-card */}
      <div className="rounded-[6px] border border-hairline bg-panel-subtle/35 p-2.5">
        <h3 className="flex items-center gap-1.5 text-xs font-medium text-ink-secondary mb-2">
          <NodePin size={16} />
          <Trans>Placement des nœuds</Trans>
        </h3>
        {/* Flat action rows — nested card borders stay out of the inspector.
            v2.1.1 row 1: `+ Nœud` beside the X/Y/Z placement fields with
            EXPLICIT metre labels and unit-suffixed parsing (`4000mm`,
            `4m` — parseUnitValue). v2.1.1 row 2: full-width `Importer CAO`
            + `Galerie de projets` side-by-side so nothing truncates. */}
        <div className="space-y-2" data-testid="node-placement">
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                ["X", nodeX, setNodeX],
                ["Y", nodeY, setNodeY],
                ["Z", nodeZ, setNodeZ],
              ] as const
            ).map(([axis, value, setter]) => (
              <UnitCoordinateField key={axis} axis={axis} value={value} onValue={setter} />
            ))}
          </div>
          {cadError !== null ? <p className="text-[11px] text-fea-max">{cadError}</p> : null}
          <button
            type="button"
            className="flex w-full items-center justify-center gap-1.5 rounded-[4px] bg-accent px-2.5 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-accent-strong"
            data-testid="add-node"
            onClick={placeNode}
          >
            <IconPlus size={12} />
            <Trans>Placer le nœud</Trans>
          </button>
        </div>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          <button
            type="button"
            className="min-w-0 whitespace-nowrap rounded-[4px] border border-hairline bg-panel px-2 py-1.5 text-[12px] font-medium text-ink-secondary transition-colors hover:border-accent hover:text-accent"
            data-testid="open-cad-import"
            onClick={() => setCadOpen(true)}
          >
            <Trans>Importer CAO</Trans>
          </button>
          <button
            type="button"
            className="min-w-0 whitespace-nowrap rounded-[4px] border border-hairline bg-panel px-2 py-1.5 text-[12px] font-medium text-ink-secondary transition-colors hover:border-accent hover:text-accent"
            data-testid="open-gallery"
            onClick={() => setGalleryOpen(true)}
          >
            <Trans>Galerie de projets</Trans>
          </button>
        </div>
        {/* M9.3: Bibliothèque d'ossatures paramétrées (Ossatures §3.10). */}
        <button
          type="button"
          className="mt-1.5 w-full rounded-[4px] border border-accent bg-accent-tint px-2 py-1.5 text-[12px] font-semibold text-accent transition-colors hover:bg-accent hover:text-white"
          data-testid="open-parametric-generator"
          onClick={() => setParametricOpen(true)}
        >
          <Trans>Générer une ossature paramétrée…</Trans>
        </button>
        {/* M9.1: 1-click topological cleanup (Compacter / Nettoyer §3.7). */}
        <button
          type="button"
          className="mt-1.5 w-full rounded-[4px] border border-hairline bg-panel px-2 py-1.5 text-[12px] font-medium text-ink-secondary transition-colors hover:border-accent hover:text-accent"
          data-testid="compact-model-inspector"
          onClick={runCompact}
        >
          <Trans>Compacter / nettoyer le modèle</Trans>
        </button>
      </div>

      {/* Material & Profile Selection sub-card */}
      <div className="mt-2 rounded-[6px] border border-hairline bg-panel-subtle/35 p-2.5">
        <h3 className="flex items-center gap-1.5 text-xs font-medium text-ink-secondary mb-2">
          <SteelJointIcon size={16} />
          <Trans>Matériau et profilé</Trans>
        </h3>
        {/* 2-column key-value property grid (craft-floor: flat hairlines). */}
        {/* v2.0.2: family pills full-width above the grid, still filtering
            the profile list directly by designation family. */}
        <FamilyPills active={family} onPick={(picked: FamilyName) => setFamily(picked)} />
        <div className="mt-2.5 grid grid-cols-[84px_1fr] items-center gap-x-2 gap-y-2">
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
          <label className="flex items-center gap-1 text-xs font-medium text-ink-secondary whitespace-nowrap">
            <ProfileIpe size={15} />
            <Trans>Profilé</Trans>
          </label>
          {/* v1.6.0: family-accurate cross-section icons per designation,
              v2.1.2: right-aligned kg/m · h metadata on every row. */}
          <ComboboxRoot
            items={familySections.map((s) => s.designation)}
            value={selectedBeam?.section_id ?? newSection}
            onValueChange={(next: string | null) => {
              if (next === null) return;
              setNewSection(next);
              void trackProductEvent("section_searched", { query: next });
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
        {/* M11.2: entry trigger of the visual Sections Droites studio. */}
        <button
          type="button"
          className="mt-2 w-full rounded-[4px] border border-accent bg-accent-tint px-2 py-1.5 text-[12px] font-semibold text-accent transition-colors hover:bg-accent hover:text-white"
          data-testid="open-composite-section-studio"
          onClick={() => setCompositeOpen(true)}
        >
          <Trans>Studio Sections Composées…</Trans>
        </button>
      </div>

      {/* Create Beam sub-card */}
      <div className="mt-2 rounded-[6px] border border-hairline bg-panel-subtle/35 p-2.5">
        <h3 className="flex items-center gap-1.5 text-xs font-medium text-ink-secondary mb-2">
          <ProfileIpe size={16} />
          <Trans>Créer une poutre</Trans>
        </h3>
        {/* Bug 5: explicit N1 → N2 selection replaces the hardcoded demo pair.
            v2.1.2: searchable Comboboxes with NodePin icons + coordinates. */}
        <div className="mt-2.5 grid grid-cols-[84px_1fr] items-center gap-x-2 gap-y-2">
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
          className="mt-2.5 w-full rounded-[4px] bg-accent px-2.5 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-accent-strong disabled:opacity-40"
          disabled={beamN1 === null || beamN2 === null || beamN1 === beamN2 || pairAlreadyLinked}
          data-testid="connect-beam"
          onClick={() => {
            if (beamN1 === null || beamN2 === null || beamN1 === beamN2 || pairAlreadyLinked)
              return;
            const newBeamId = addBeam(beamN1, beamN2, newSection, material);
            void trackProductEvent("beam_connected", {
              n_beams: project.structure.beams.length + 1,
            });
            selectBeam(newBeamId);
          }}
        >
          {pairAlreadyLinked ? <Trans>Déjà reliés</Trans> : <Trans>Relier N1 → N2</Trans>}
        </button>
      </div>

      {/* Selected-member patch panel sub-card */}
      <div className="mt-2 rounded-[6px] border border-hairline bg-panel-subtle/35 p-2.5">
        <h3 className="flex items-center gap-1.5 text-xs font-medium text-ink-secondary mb-2">
          <TorqueMoment size={16} />
          <Trans>Caractéristiques de la poutre</Trans>
        </h3>
        {selectedBeam !== null ? (
          <BeamPatchPanel beam={selectedBeam} />
        ) : (
          <p className="text-[12px] text-ink-muted">
            <Trans>Sélectionnez une poutre pour éditer ses caractéristiques.</Trans>
          </p>
        )}
      </div>

      {/* M12.4 — user-defined material dialog (persisted in materials). */}
      <CustomMaterialButton beamIds={selectedBeam !== null ? [selectedBeam.id] : undefined} />

      {/* M12.3 — named member groups over the batch selection. */}
      <MemberGroupsPanel />

      {/* M12.3 — storey levels (Z elevations) + 1-click auto-detection. */}
      <StoreyLevelsPanel />

      <p className="mt-2 font-data border-t border-hairline pt-3 text-[12px] text-ink-secondary">
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
      <ParametricFrameModal open={parametricOpen} onClose={() => setParametricOpen(false)} />
      <CompositeSectionStudio open={compositeOpen} onOpenChange={setCompositeOpen} />

      {isMobile ? (
        <ModelDataTable
          onHoverNode={setHoverNodeId}
          onHoverBeam={setHoverBeamId}
          sections={sections.map((s) => s.designation)}
        />
      ) : null}

      {/* v1.3.0 Step 2 hand-off. */}
      <button
        type="button"
        className="mt-2 w-full rounded border border-hairline px-2.5 py-1.5 text-[13px] text-accent hover:bg-accent-tint disabled:opacity-40"
        data-testid="next-supports"
        disabled={project.structure.beams.length === 0}
        onClick={() => void navigate({ to: "/supports" })}
      >
        <Trans>Suivant : Définir les liaisons →</Trans>
      </button>
    </BottomSheet>
  );

  const main = (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* v1.6.0: the persistent stage slot — the ONE canvas in the studio
          layout overlays this pane, so orbit/zoom survive every step. */}
      {/* v2.0.1: the CAD toolbar docks as a flow row ABOVE the viewport
          slot — it can no longer overlap the app header, the in-stage
          layer toolbar or the Iso|XY|XZ|YZ camera presets. */}
      <CadToolbar />
      <div
        ref={slotRef}
        className="relative min-h-0 flex-1 overflow-hidden bg-canvas"
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
                className="rounded-[4px] border border-hairline px-3 py-1.5 text-[13px] text-ink-secondary"
                onClick={() => setCadOpen(true)}
              >
                <Trans>Importer CAO</Trans>
              </button>
            </div>
            {/* v1.4.0: 1-click quick-start pills (mockups tape_1). v2.3.0:
                the naval & lifting flagships ride the same row. */}
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {(
                [
                  ["warren", "Treillis Warren 24 m"],
                  ["portique", "Portique 18 m"],
                  ["potence", "Potence HEA 200"],
                  ["travees", "Poutre 3 travées"],
                  ["naval-cradle", "Berceau de transport naval DNV"],
                  ["lifting-beam", "Palonnier de levage 20 t"],
                  ["workshop-jib", "Potence d'atelier 5 t"],
                ] as const
              ).map(([kind, label]) => (
                <button
                  key={kind}
                  type="button"
                  data-testid={`quick-${kind}`}
                  className="truncate rounded-[4px] border border-hairline bg-panel px-2 py-1.5 text-left text-[12px] font-medium text-ink-secondary transition-colors hover:border-accent hover:bg-accent-tint/50 hover:text-accent"
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
        {sectionCounts.length > 0 ? (
          <div
            className="pointer-events-none absolute bottom-8 left-2 z-30 flex max-w-[62%] flex-wrap gap-1 rounded-panel border border-hairline bg-panel/90 p-1 backdrop-blur"
            data-testid="profile-legend"
          >
            {sectionCounts.map(([designation, count]) => (
              <span
                key={designation}
                className="font-data flex items-center gap-1 rounded bg-panel-subtle px-1.5 py-0.5 text-[10px] text-ink-secondary"
              >
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 rounded-[2px]"
                  style={{ backgroundColor: familyColorOf(designation) }}
                />
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
          hoveredNodeId: hoverNodeId,
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
        {/* M9.1: Auto-Split on Draw — a member drawn onto an existing
            beam's interior cuts the host at the landing point. */}
        {toolMode === "beam" ? (
          <label
            className="ml-auto flex shrink-0 items-center gap-1.5 pr-1 text-[11px] text-ink-secondary"
            data-testid="auto-split-toggle"
          >
            <Checkbox
              checked={autoSplitOnDraw}
              onCheckedChange={(checked) => setAutoSplitOnDraw(checked === true)}
              aria-label="Auto-découpe au dessin"
            />
            <Trans>Auto-découpe</Trans>
          </label>
        ) : null}
      </div>
      {!isMobile ? (
        <ModelDataTable
          onHoverNode={setHoverNodeId}
          onHoverBeam={setHoverBeamId}
          sections={sections.map((s) => s.designation)}
        />
      ) : null}
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
    <label className="flex min-w-0 flex-col gap-1">
      <span className="font-data text-[10px] font-medium text-ink-muted">{axis} (m)</span>
      <Input
        inputMode="decimal"
        aria-label={`Placement ${axis} (m)`}
        placeholder="0"
        value={draft ?? (value === null ? "" : String(value))}
        onChange={(e) => {
          const raw = e.currentTarget.value;
          setDraft(raw);
          onValue(parseUnitValue(raw));
        }}
        onBlur={() => setDraft(null)}
        className="font-data h-7 w-full min-w-0 px-2 text-[12px]"
      />
    </label>
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
      <div className="mt-2.5 grid grid-cols-[84px_1fr] items-center gap-x-2 gap-y-2">
        <label className="text-xs font-medium text-ink-secondary" htmlFor="roll-angle">
          <Trans>Roulis θx (°)</Trans>
        </label>
        <div className="flex items-center gap-1.5">
          <NumberFieldRoot
            id="roll-angle"
            data-testid="beam-roll-angle"
            value={Math.round((beam.roll_angle_rad * 180) / Math.PI)}
            onValueChange={(deg) => {
              if (deg !== null) updateBeam(beam.id, { roll_angle_rad: (deg * Math.PI) / 180 });
            }}
          >
            <NumberFieldInput className="h-8 w-20" />
          </NumberFieldRoot>
          <div className="flex gap-1">
            {[0, 45, 90].map((deg) => (
              <button
                key={deg}
                type="button"
                data-testid={`beam-roll-${deg}`}
                aria-pressed={Math.round((beam.roll_angle_rad * 180) / Math.PI) === deg}
                className={`rounded border px-1.5 py-0.5 font-data text-[11px] ${
                  Math.round((beam.roll_angle_rad * 180) / Math.PI) === deg
                    ? "border-accent bg-accent-tint text-accent"
                    : "border-hairline text-ink-secondary hover:border-accent hover:text-accent"
                }`}
                onClick={() => updateBeam(beam.id, { roll_angle_rad: (deg * Math.PI) / 180 })}
              >
                {deg}°
              </button>
            ))}
          </div>
        </div>
        <span className="text-xs font-medium text-ink-secondary">
          <Trans>Comportement axial</Trans>
        </span>
        {/* M10.3 (RDM 7): tension-only / compression-only bracing members. */}
        <SegmentedControl
          testId="beam-axial-behavior"
          label="Comportement axial"
          size="sm"
          value={beam.behavior ?? "Standard"}
          onValueChange={(next) => {
            updateBeam(beam.id, {
              behavior: next as BeamData["behavior"],
            });
            void trackProductEvent("beam_behavior_set", { behavior: next });
          }}
          options={[
            { value: "Standard", label: <Trans>Standard</Trans> },
            { value: "TensionOnly", label: <Trans>Tirant</Trans> },
            { value: "CompressionOnly", label: <Trans>Buton</Trans> },
          ]}
        />
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
      {/* M9.2: Discrétiser une poutre (Ossatures §3.8.13) — N tronçons
          (2–50) with 1-click presets; the pure `modelCleanup` transform
          keeps outer releases, rigid interior junctions and remaps loads. */}
      <div
        className="mt-2 flex items-center justify-between gap-2 border-t border-hairline pt-2"
        data-testid="subdivide-panel"
      >
        <span className="flex items-center gap-1.5 text-[12px] text-ink-secondary">
          <TorqueMoment size={16} />
          <Trans>Discrétiser (N tronçons)</Trans>
        </span>
        <div className="flex items-center gap-1">
          {[2, 4, 8, 10].map((preset) => (
            <button
              key={preset}
              type="button"
              data-testid={`subdivide-preset-${preset}`}
              aria-pressed={segments === preset}
              className={`rounded border px-1.5 py-0.5 font-data text-[11px] ${
                segments === preset
                  ? "border-accent bg-accent-tint text-accent"
                  : "border-hairline text-ink-secondary hover:border-accent hover:text-accent"
              }`}
              onClick={() => setSegments(preset)}
            >
              {preset}
            </button>
          ))}
          <NumberFieldRoot
            value={segments}
            step={1}
            min={2}
            max={50}
            onValueChange={(v) => setSegments(v)}
          >
            <NumberFieldInput className="font-data h-8 w-14" aria-label="Nombre de tronçons" />
          </NumberFieldRoot>
        </div>
        <button
          type="button"
          data-testid="subdivide-beam"
          className="rounded border border-accent px-2 py-1 text-[12px] text-accent hover:bg-accent-tint disabled:opacity-40"
          disabled={segments === null || segments < 2}
          onClick={() => {
            if (segments === null || segments < 2) return;
            subdivideBeam(beam.id, segments);
            toast(t`P${beam.id} discrétisée en ${segments} tronçons`, { duration: 3_000 });
          }}
        >
          <Trans>Discrétiser</Trans>
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
