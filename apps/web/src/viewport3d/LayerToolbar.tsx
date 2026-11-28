import { useViewportParams } from "@/hooks/useStudioQuery";
import { MagneticSnap, VolumetricMesh, WireframeMesh } from "@rdm-studio/ui/icons";
import { Trans, useLingui } from "@lingui/react/macro";
import { Tooltip, TooltipGroup } from "@rdm-studio/ui/interior";

/**
 * Floating layer toolbar (ARCHITECTURE.md section 5, `LayerToolbar.tsx`;
 * section 8.8): selective visibility (Nodes, Beams, Loads, Supports,
 * Deformed), the v1.6.0 metrology toggles (`Repères N/P`, `Cotes`,
 * `Réactions`), the `10 | 50 | 100 mm` magnetic snap grid selector and
 * compact icon-led volumetric / wireframe rendering, plus the live M4
 * picking latency readout when provided.
 */
const LAYERS = [
  ["nodes", "Nœuds"],
  ["beams", "Poutres"],
  ["loads", "Charges"],
  ["supports", "Appuis"],
  ["deformed", "Déformée"],
] as const;

const SNAP_STEPS = [
  [0.01, "10"],
  [0.05, "50"],
  [0.1, "100"],
] as const;

export function LayerToolbar({ lastSelectionMs }: { lastSelectionMs?: number }) {
  // v2.1.0: layer flags (`?layers=`), render mode (`?render=`) and the
  // snap grid (`?snap=`) all live in the URL — shareable per keystroke.
  const { layers, toggleLayer, render, setRender, snapStep, setSnapStep } = useViewportParams();

  // v2.1.2: the strip is a TooltipGroup (300 ms first tooltip, then
  // 0 ms instant switching across siblings) with bottom tooltips.
  const { t } = useLingui();
  return (
    <div
      className="absolute top-2 left-2 z-30 flex max-w-[46%] flex-wrap items-center gap-1 rounded-panel border border-hairline bg-panel/90 p-1 backdrop-blur"
      data-testid="layer-toolbar"
    >
      <TooltipGroup>
        {LAYERS.map(([key, label]) => (
          <Tooltip key={key} label={label} side="bottom">
            <button
              type="button"
              data-testid={`layer-${key}`}
              aria-label={label}
              className={`rounded px-1.5 py-1 text-[11px] ${layers[key] ? "bg-accent/15 text-accent" : "text-ink-muted"}`}
              onClick={() => toggleLayer(key)}
            >
              {label}
            </button>
          </Tooltip>
        ))}
        <span className="mx-0.5 w-px self-stretch bg-hairline" />
        {/* v1.6.0 metrology toggles (requirement 3). */}
        <Tooltip label={<Trans>Repères N/P</Trans>} side="bottom">
          <button
            type="button"
            data-testid="layer-labels"
            className={`rounded px-1.5 py-1 text-[11px] ${layers.labels ? "bg-accent/15 text-accent" : "text-ink-muted"}`}
            onClick={() => toggleLayer("labels")}
          >
            <Trans>Repères N/P</Trans>
          </button>
        </Tooltip>
        <Tooltip label={<Trans>Cotes</Trans>} side="bottom">
          <button
            type="button"
            data-testid="layer-dims"
            className={`rounded px-1.5 py-1 text-[11px] ${layers.dims ? "bg-accent/15 text-accent" : "text-ink-muted"}`}
            onClick={() => toggleLayer("dims")}
          >
            <Trans>Cotes</Trans>
          </button>
        </Tooltip>
        <Tooltip label={<Trans>Réactions</Trans>} side="bottom">
          <button
            type="button"
            data-testid="layer-reactions"
            className={`rounded px-1.5 py-1 text-[11px] ${layers.reactions ? "bg-accent/15 text-accent" : "text-ink-muted"}`}
            onClick={() => toggleLayer("reactions")}
          >
            <Trans>Réactions</Trans>
          </button>
        </Tooltip>
        <span className="mx-0.5 w-px self-stretch bg-hairline" />
        {/* Compact icon-led render mode (≥ 24 px separation, 860 px safe). */}
        <Tooltip label={t`Rendu volumique 3D`} side="bottom">
          <button
            type="button"
            data-testid="render-volumetric"
            aria-label={t`Rendu volumique 3D`}
            className={`flex items-center gap-1 rounded px-1.5 py-1 text-[11px] ${render === "volumetric" ? "bg-accent/15 text-accent" : "text-ink-muted"}`}
            onClick={() => setRender("volumetric")}
          >
            <VolumetricMesh size={16} />
          </button>
        </Tooltip>
        <Tooltip label={t`Rendu filaire`} side="bottom">
          <button
            type="button"
            data-testid="render-wireframe"
            aria-label={t`Rendu filaire`}
            className={`flex items-center gap-1 rounded px-1.5 py-1 text-[11px] ${render === "wireframe" ? "bg-accent/15 text-accent" : "text-ink-muted"}`}
            onClick={() => setRender("wireframe")}
          >
            <WireframeMesh size={16} />
          </button>
        </Tooltip>
        <span className="mx-0.5 w-px self-stretch bg-hairline" />
        {/* v1.6.0: metric snap grid selector (Grille : 10 | 50 | 100 mm). */}
        <Tooltip label={t`Grille d'accrochage magnétique`} side="bottom">
          <span className="flex items-center gap-0.5 rounded border border-hairline px-1 py-0.5">
            <MagneticSnap size={16} />
            {SNAP_STEPS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                data-testid={`snap-${label}`}
                className={`font-data rounded px-1 py-0.5 text-[10px] ${snapStep === value ? "bg-accent/15 text-accent" : "text-ink-muted"}`}
                onClick={() => setSnapStep(value)}
              >
                {label}
              </button>
            ))}
            <span className="font-data text-[10px] text-ink-muted">mm</span>
          </span>
        </Tooltip>
        {lastSelectionMs !== undefined ? (
          <span
            className="font-data rounded px-1.5 py-1 text-[11px] text-ink-muted"
            data-testid="pick-latency"
          >
            {lastSelectionMs < 0.01 ? "<0.01" : lastSelectionMs.toFixed(2)} ms
          </span>
        ) : null}
      </TooltipGroup>
    </div>
  );
}
