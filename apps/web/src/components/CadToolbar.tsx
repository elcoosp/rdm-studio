import { useState, type ReactElement } from "react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useProjectStore } from "../state/projectStore";
import { CAD_COMMANDS, parseUnitValue, snapCandidates, snapPolar } from "../modeling/cadTools";

/**
 * CAD Transform & Shortcuts toolbar (v2.0.0): the 10 registered
 * commands (`modeling/cadTools.ts`) as one-click buttons plus the `?`
 * cheat-sheet modal generated from the same registry.
 */
export function CadToolbar(): ReactElement {
  const project = useProjectStore((st) => st.project);
  const loadProject = useProjectStore((st) => st.loadProject);
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
    const arg =
      id === "rotate"
        ? { angle: value }
        : id === "array_linear"
          ? { count: Math.max(Math.round(value), 2), dx: 4, dy: 0, dz: 0 }
          : id === "move"
            ? { dx: value, dy: 0, dz: 0, ids: [] as number[] }
            : id === "polyline"
              ? [
                  { x: 0, y: 0, z: 0 },
                  { x: value, y: 0, z: 0 },
                  { x: value, y: 0, z: value },
                ]
              : undefined;
    const model = { nodes: project.structure.nodes, beams: project.structure.beams };
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

  const snaps = snapCandidates(
    { nodes: project.structure.nodes, beams: project.structure.beams },
    { x: 0, y: 0, z: 0 },
    2,
  );

  return (
    <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label={t`Outils CAD`}>
      {CAD_COMMANDS.filter((c) => c.group !== "Snapping").map((command) => (
        <button
          key={command.id}
          type="button"
          title={`${command.label} (${command.shortcut})`}
          aria-label={command.label}
          onClick={() => runCommand(command.id)}
          className="rounded border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
        >
          {command.label}
        </button>
      ))}
      <label className="ml-2 flex items-center gap-1 text-xs">
        <Trans>Valeur</Trans>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          aria-label={t`Valeur unitaire`}
          className="w-20 rounded border border-slate-300 bg-transparent px-1 dark:border-slate-600"
        />
      </label>
      <span aria-live="polite" className="text-xs text-slate-500">
        {feedback ?? `snap: ${snaps.length}`}
      </span>
      <button
        type="button"
        onClick={() => setCheatOpen(true)}
        aria-label={t`Aide-mémoire des raccourcis`}
        title="?"
        className="rounded-full border border-slate-400 px-2 py-0.5 text-xs font-bold"
      >
        ?
      </button>
      {cheatOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t`Aide-mémoire des raccourcis`}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setCheatOpen(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-md overflow-auto rounded-xl bg-white p-5 shadow-2xl dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-3 text-lg font-bold">
              <Trans>Raccourcis CAD</Trans>
            </h2>
            <ul className="space-y-1 text-sm">
              {CAD_COMMANDS.map((c) => (
                <li key={c.id} className="flex justify-between">
                  <span>{c.label}</span>
                  <kbd className="rounded bg-slate-100 px-2 font-mono text-xs dark:bg-slate-800">
                    {c.shortcut}
                  </kbd>
                </li>
              ))}
              <li className="flex justify-between">
                <span>{t`Polar 15°`}</span>
                <kbd className="rounded bg-slate-100 px-2 font-mono text-xs dark:bg-slate-800">
                  {`${snapPolar({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }).x.toFixed(0)}°`}
                </kbd>
              </li>
            </ul>
            <button
              type="button"
              onClick={() => setCheatOpen(false)}
              className="mt-4 w-full rounded bg-blue-600 py-1.5 text-sm font-semibold text-white"
            >
              <Trans>Fermer</Trans>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
