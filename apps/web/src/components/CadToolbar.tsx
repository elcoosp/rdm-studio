import { useEffect, useRef, useState, type ReactElement } from "react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { toast } from "sonner";
import {
  BoxSelect,
  ChevronDown,
  CopyPlus,
  FlipHorizontal2,
  Merge,
  MousePointerClick,
  Move,
  Repeat,
  RotateCw,
  ScanSearch,
  Spline,
  Trash2,
} from "lucide-react";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { Input } from "@/components/ui/input";
import { DialogContent, DialogHeader, DialogRoot, DialogTitle } from "@/components/ui/dialog";
import { useProjectStore } from "@/state/projectStore";
import { useSelectedIds } from "@/hooks/useStudioQuery";
import { useViewportStore } from "@/state/viewportStore";
import { CAD_COMMANDS, parseUnitValue, snapCandidates, snapPolar } from "@/modeling/cadTools";
import { compactModel } from "@/modeling/modelCleanup";
import type { CadModel } from "@/modeling/cadTools";
import { trackProductEvent } from "@/lib/productTelemetry";

/**
 * v2.0.2 Swiss Metrology CAD strip (DESIGN.md §4): a hairline segmented
 * tool bar — 5 primary actions on the left with 16px Lucide icons, the 5
 * secondary actions tucked into the compact `Outils ▾` Base UI menu, and
 * the unit-aware parameter + status + help group on the right. The old
 * raw 10-button row (slate borders, wrapping over the app header) is
 * gone.
 */

const PRIMARY: { id: string; label: string; icon: typeof Spline }[] = [
  { id: "polyline", label: "Polyligne", icon: Spline },
  { id: "extrude", label: "Extruder", icon: BoxSelect },
  { id: "move", label: "Déplacer", icon: Move },
  { id: "rotate", label: "Rotation", icon: RotateCw },
  { id: "mirror", label: "Miroir", icon: FlipHorizontal2 },
];

const SECONDARY: { id: string; label: string; icon: typeof Repeat }[] = [
  { id: "array_linear", label: "Répétition linéaire", icon: Repeat },
  { id: "merge_duplicates", label: "Fusionner doublons", icon: Merge },
  { id: "copy_paste", label: "Copier au curseur", icon: CopyPlus },
  { id: "select_similar", label: "Sélection similaire", icon: MousePointerClick },
  { id: "isolate", label: "Isoler", icon: ScanSearch },
];

export function CadToolbar(): ReactElement {
  const project = useProjectStore((st) => st.project);
  const loadProject = useProjectStore((st) => st.loadProject);
  // v2.1.0: the single node selection is URL-backed; the multi-beam
  // batch selection stays in the project store.
  const { nodeId: selectedNodeId } = useSelectedIds();
  const selectedBeamIds = useProjectStore((st) => st.batch.selectedBeamIds);
  const deleteBeamMode = useViewportStore((st) => st.deleteBeamMode);
  const toggleDeleteBeamMode = useViewportStore((st) => st.toggleDeleteBeamMode);
  const setDeleteBeamMode = useViewportStore((st) => st.setDeleteBeamMode);
  const [cheatOpen, setCheatOpen] = useState(false);
  const [input, setInput] = useState("4m");
  const [feedback, setFeedback] = useState<string | null>(null);

  // v2.4.0: Escape exits the two-step beam deletion mode.
  useEffect(() => {
    if (!deleteBeamMode) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDeleteBeamMode(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteBeamMode, setDeleteBeamMode]);

  const runCommand = (id: string): void => {
    const command = CAD_COMMANDS.find((c) => c.id === id);
    if (command === undefined) {
      return;
    }
    // Numeric arguments come from the unit-aware inline input.
    const value = parseUnitValue(input) ?? 0;
    // v2.0.2: `move` targets the live selection (node or multi-beam) and
    // falls back to the whole model when nothing is selected.
    const selectionIds =
      selectedNodeId !== null
        ? [selectedNodeId]
        : selectedBeamIds.length > 0
          ? selectedBeamIds
          : [];
    const arg =
      id === "rotate"
        ? { angle: value }
        : id === "array_linear"
          ? { count: Math.max(Math.round(value), 2), dx: 4, dy: 0, dz: 0 }
          : id === "move"
            ? { dx: value, dy: 0, dz: 0, ids: selectionIds }
            : id === "polyline"
              ? [
                  { x: 0, y: 0, z: 0 },
                  { x: value, y: 0, z: 0 },
                  { x: value, y: 0, z: value },
                ]
              : undefined;
    const model: CadModel = { nodes: project.structure.nodes, beams: project.structure.beams };
    const next = command.apply(model, arg);
    // Preserve the full BeamData fields (roll, releases, k_buckling) for
    // members the CAD registry returned as plain CadBeam seeds.
    const beams = next.beams.map((b) => {
      const existing = project.structure.beams.find((old) => old.id === b.id);
      return (
        existing ?? {
          ...b,
          roll_angle_rad: 0,
          releases_start: [false, false, false, false, false, false],
          releases_end: [false, false, false, false, false, false],
          k_buckling_y: 1.0,
          k_buckling_z: 1.0,
        }
      );
    });
    loadProject({
      ...project,
      structure: { ...project.structure, nodes: next.nodes, beams },
    });
    setFeedback(`${command.label} — ${command.shortcut}`);
    void trackProductEvent("cad_tool_selected", { tool: id });
  };

  // M9.1: 1-click topological cleanup (Ossatures §3.7) with an undoable
  // Sonner summary toast — merge → split → deduplicate → purge.
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

  // v2.1.1: the ⌘K palette dispatches `rdm-cad-command` — the toolbar
  // stays the single execution point (latest closure via a ref).
  const runCommandRef = useRef(runCommand);
  runCommandRef.current = runCommand;
  useEffect(() => {
    const onPaletteCommand = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      if (typeof id === "string") {
        runCommandRef.current(id);
      }
    };
    window.addEventListener("rdm-cad-command", onPaletteCommand);
    return () => window.removeEventListener("rdm-cad-command", onPaletteCommand);
  }, []);

  const snaps = snapCandidates(
    { nodes: project.structure.nodes, beams: project.structure.beams },
    { x: 0, y: 0, z: 0 },
    2,
  );

  return (
    <div
      className="flex h-10 items-center justify-between gap-3 border-b border-hairline bg-panel px-3"
      role="toolbar"
      aria-label={t`Outils CAD`}
    >
      {/* Left: clean ghost CAD tool pills with inline monospaced keycaps (zero redundant tooltips) */}
      <div className="flex min-w-0 items-center gap-1">
        {PRIMARY.map((tool) => {
          const shortcut = CAD_COMMANDS.find((c) => c.id === tool.id)?.shortcut;
          return (
            <button
              key={tool.id}
              type="button"
              aria-label={tool.label}
              onClick={() => runCommand(tool.id)}
              className="group inline-flex h-7 shrink-0 items-center gap-1.5 rounded-[5px] px-2 text-[12px] font-medium text-ink-secondary transition-colors hover:bg-panel-subtle hover:text-ink-primary active:bg-accent-tint active:text-accent"
            >
              <tool.icon
                size={15}
                strokeWidth={1.6}
                className="text-ink-muted transition-colors group-hover:text-accent"
                aria-hidden
              />
              <span className="hidden lg:inline">{tool.label}</span>
              {shortcut !== undefined ? (
                <span className="font-data hidden rounded bg-canvas px-1 py-0.2 text-[10px] text-ink-muted group-hover:text-accent xl:inline">
                  {shortcut}
                </span>
              ) : null}
            </button>
          );
        })}

        <DropdownMenuRoot>
          <DropdownMenuTrigger
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-[5px] px-2 text-[12px] font-medium text-ink-secondary transition-colors hover:bg-panel-subtle hover:text-ink-primary"
            aria-label={t`Outils secondaires`}
          >
            <Trans>Plus</Trans>
            <ChevronDown size={13} strokeWidth={1.6} className="text-ink-muted" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>
              <Trans>Outils CAD avancés</Trans>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {SECONDARY.map((tool) => (
              <DropdownMenuItem
                key={tool.id}
                className="cursor-pointer"
                onSelect={() => runCommand(tool.id)}
              >
                <tool.icon size={15} strokeWidth={1.6} aria-hidden />
                {tool.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenuRoot>

        <span className="mx-1 h-4 w-px shrink-0 bg-hairline" aria-hidden />

        <button
          type="button"
          data-testid="compact-model"
          aria-label={t`Compacter le modèle`}
          onClick={runCompact}
          className="group inline-flex h-7 shrink-0 items-center gap-1.5 rounded-[5px] px-2 text-[12px] font-medium text-ink-secondary transition-colors hover:bg-panel-subtle hover:text-ink-primary"
        >
          <Merge
            size={15}
            strokeWidth={1.6}
            className="text-ink-muted transition-colors group-hover:text-accent"
            aria-hidden
          />
          <span className="hidden xl:inline">
            <Trans>Compacter</Trans>
          </span>
        </button>

        <button
          type="button"
          data-testid="delete-beam-mode"
          aria-pressed={deleteBeamMode}
          aria-label={t`Supprimer des poutres`}
          onClick={() => toggleDeleteBeamMode()}
          className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-[5px] px-2 text-[12px] font-medium transition-colors ${
            deleteBeamMode
              ? "bg-fea-max/12 text-fea-max ring-1 ring-fea-max/30"
              : "text-ink-secondary hover:bg-fea-max/10 hover:text-fea-max"
          }`}
        >
          <Trash2 size={15} strokeWidth={1.6} aria-hidden />
          <span className="hidden xl:inline">
            <Trans>Supprimer</Trans>
          </span>
        </button>
      </div>

      {/* Right: crisp inline metrology step & shortcuts */}
      <div className="flex shrink-0 items-center gap-2">
        <div className="inline-flex h-7 items-center gap-1.5 rounded-[5px] border border-hairline bg-canvas/70 px-2">
          <label
            htmlFor="cad-unit-value"
            className="hidden text-[11px] font-medium text-ink-muted sm:inline"
          >
            <Trans>Pas</Trans>
          </label>
          <Input
            id="cad-unit-value"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            aria-label={t`Valeur unitaire`}
            className="font-data h-6 w-12 rounded-[3px] border-0 bg-panel px-1 text-center text-[11.5px] font-semibold text-ink-primary shadow-2xs focus-visible:ring-1 focus-visible:ring-accent"
          />
          <span
            aria-live="polite"
            className="font-data hidden text-[11px] text-ink-muted md:inline"
            data-testid="cad-feedback"
          >
            {feedback ?? `${snaps.length} pts`}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setCheatOpen(true)}
          aria-label={t`Raccourcis clavier`}
          className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-[5px] px-2 text-[11.5px] font-medium text-ink-secondary transition-colors hover:bg-panel-subtle hover:text-ink-primary"
        >
          <Trans>Raccourcis</Trans>
          <Kbd className="font-data px-1 py-0 text-[10px]">?</Kbd>
        </button>
      </div>
      <DialogRoot open={cheatOpen} onOpenChange={setCheatOpen}>
        <DialogContent
          className="w-[min(92vw,480px)] overflow-hidden p-0"
          data-testid="cad-shortcuts-dialog"
        >
          <DialogHeader className="flex-row items-center justify-between border-b border-hairline bg-canvas/70 px-4 py-3">
            <div>
              <DialogTitle className="text-[14px] font-semibold text-ink-primary">
                <Trans>Raccourcis CAD &amp; Atelier</Trans>
              </DialogTitle>
              <p className="mt-0.5 text-[11px] text-ink-muted">
                <Trans>Commandes clavier actives sur la scène 3D</Trans>
              </p>
            </div>
            <Kbd className="font-data text-[10px]">Esc</Kbd>
          </DialogHeader>

          <div className="max-h-[62vh] space-y-3 overflow-y-auto p-4">
            <div>
              <p className="font-data mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                <Trans>Dessin &amp; Transformations</Trans>
              </p>
              <ul className="divide-y divide-hairline rounded-[6px] border border-hairline bg-panel">
                {CAD_COMMANDS.slice(0, 7).map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between px-3 py-1.5 text-[12px] text-ink-primary"
                  >
                    <span>{c.label}</span>
                    <Kbd className="font-data px-2 py-0.5 text-[11px]">{c.shortcut}</Kbd>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="font-data mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                <Trans>Sélection, Magnétisme &amp; Vue</Trans>
              </p>
              <ul className="divide-y divide-hairline rounded-[6px] border border-hairline bg-panel">
                {CAD_COMMANDS.slice(7).map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between px-3 py-1.5 text-[12px] text-ink-primary"
                  >
                    <span>{c.label}</span>
                    <Kbd className="font-data px-2 py-0.5 text-[11px]">{c.shortcut}</Kbd>
                  </li>
                ))}
                <li className="flex items-center justify-between px-3 py-1.5 text-[12px] text-ink-primary">
                  <span>{t`Accrochage polaire (15°)`}</span>
                  <Kbd className="font-data px-2 py-0.5 text-[11px]">
                    {`Shift · ${Math.round(snapPolar({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }).x * 15)}°`}
                  </Kbd>
                </li>
                <li className="flex items-center justify-between px-3 py-1.5 text-[12px] text-ink-primary">
                  <span>{t`Cadrer la structure`}</span>
                  <Kbd className="font-data px-2 py-0.5 text-[11px]">F</Kbd>
                </li>
                <li className="flex items-center justify-between px-3 py-1.5 text-[12px] text-ink-primary">
                  <span>{t`Palette de commandes`}</span>
                  <Kbd className="font-data px-2 py-0.5 text-[11px]">⌘K</Kbd>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex items-center justify-end border-t border-hairline bg-canvas/70 px-4 py-2.5">
            <button
              type="button"
              onClick={() => setCheatOpen(false)}
              className="rounded-[4px] border border-hairline bg-panel px-3 py-1 text-[12px] font-medium text-ink-primary hover:bg-panel-subtle"
            >
              <Trans>Fermer</Trans>
            </button>
          </div>
        </DialogContent>
      </DialogRoot>
    </div>
  );
}
