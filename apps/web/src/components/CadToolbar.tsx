import { useEffect, useRef, useState, type ReactElement } from "react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
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
} from "lucide-react";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProjectStore } from "@/state/projectStore";
import { useSelectedIds } from "@/hooks/useStudioQuery";
import { CAD_COMMANDS, parseUnitValue, snapCandidates, snapPolar } from "@/modeling/cadTools";
import type { CadModel } from "@/modeling/cadTools";

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
  const [cheatOpen, setCheatOpen] = useState(false);
  const [input, setInput] = useState("4m");
  const [feedback, setFeedback] = useState<string | null>(null);

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
      className="flex items-center justify-between gap-2 rounded-panel border border-hairline bg-panel px-2 py-1.5"
      role="toolbar"
      aria-label={t`Outils CAD`}
    >
      {/* Left segmented group: 5 primary actions + the Outils ▾ menu. */}
      <div className="inline-flex min-w-0 items-center rounded-[4px] border border-hairline bg-panel-subtle/60">
        {PRIMARY.map((tool) => (
          <button
            key={tool.id}
            type="button"
            title={`${tool.label} (${CAD_COMMANDS.find((c) => c.id === tool.id)?.shortcut ?? ""})`}
            aria-label={tool.label}
            onClick={() => runCommand(tool.id)}
            className="flex shrink-0 items-center gap-1.5 border-r border-hairline px-2.5 py-1.5 text-[12px] font-medium text-ink-secondary last:border-r-0 hover:bg-accent-tint hover:text-accent"
          >
            <tool.icon size={16} strokeWidth={1.5} aria-hidden />
            <span className="hidden lg:inline">{tool.label}</span>
          </button>
        ))}
        <DropdownMenuRoot>
          <DropdownMenuTrigger
            className="flex shrink-0 items-center gap-1 px-2.5 py-1.5 text-[12px] font-medium text-ink-secondary hover:bg-accent-tint hover:text-accent"
            aria-label={t`Outils secondaires`}
          >
            <Trans>Outils</Trans>
            <ChevronDown size={14} strokeWidth={1.5} aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>
              <Trans>Outils CAD secondaires</Trans>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {SECONDARY.map((tool) => (
              <DropdownMenuItem
                key={tool.id}
                className="cursor-pointer"
                onSelect={() => runCommand(tool.id)}
              >
                <tool.icon size={16} strokeWidth={1.5} aria-hidden />
                {tool.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenuRoot>
      </div>

      {/* Right compact parameter & help group. */}
      <div className="flex shrink-0 items-center gap-2">
        <label className="flex items-center gap-1 text-[11px] text-ink-secondary">
          <span className="hidden sm:inline">
            <Trans>Valeur</Trans>
          </span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            aria-label={t`Valeur unitaire`}
            className="font-data h-7 w-16 rounded-[4px] border border-hairline bg-panel px-1.5 text-[12px] text-ink-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-ring"
          />
        </label>
        <span
          aria-live="polite"
          className="hidden text-[11px] text-ink-muted md:inline"
          data-testid="cad-feedback"
        >
          {feedback ?? `snap: ${snaps.length}`}
        </span>
        <button
          type="button"
          onClick={() => setCheatOpen(true)}
          aria-label={t`Raccourcis clavier`}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] border border-hairline text-ink-secondary hover:border-accent hover:text-accent"
        >
          ?
        </button>
      </div>
      {cheatOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t`Aide-mémoire des raccourcis`}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-ink-primary/40 p-4"
          onClick={() => setCheatOpen(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-md overflow-auto rounded-panel border border-hairline bg-panel p-5 shadow-[0_8px_24px_rgba(15,23,42,0.12)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-3 text-lg font-bold text-ink-primary">
              <Trans>Raccourcis CAD</Trans>
            </h2>
            <ul className="space-y-1 text-sm text-ink-secondary">
              {CAD_COMMANDS.map((c) => (
                <li key={c.id} className="flex justify-between">
                  <span>{c.label}</span>
                  <kbd className="font-data rounded border border-hairline bg-panel-subtle px-2 text-xs text-ink-primary">
                    {c.shortcut}
                  </kbd>
                </li>
              ))}
              <li className="flex justify-between">
                <span>{t`Polar 15°`}</span>
                <kbd className="font-data rounded border border-hairline bg-panel-subtle px-2 text-xs text-ink-primary">
                  {`${snapPolar({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }).x.toFixed(0)}°`}
                </kbd>
              </li>
            </ul>
            <button
              type="button"
              onClick={() => setCheatOpen(false)}
              className="mt-4 w-full rounded bg-accent py-1.5 text-sm font-semibold text-white hover:bg-accent/90"
            >
              <Trans>Fermer</Trans>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
