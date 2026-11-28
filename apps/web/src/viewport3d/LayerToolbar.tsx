import { Ruler, Tag } from "lucide-react";
import { useViewportParams } from "@/hooks/useStudioQuery";
import {
  BeamSegment,
  DeflectionLimit,
  MagneticSnap,
  NodalPointLoad,
  NodePin,
  SupportPinned,
  SupportReaction,
  VolumetricMesh,
  WireframeMesh,
} from "@rdm-studio/ui/icons";
import { useLingui } from "@lingui/react/macro";
import { Tooltip, TooltipGroup } from "@rdm-studio/ui/interior";

/**
 * Compact Swiss Metrology floating layer toolbar (ARCHITECTURE.md §5, §8.8):
 * icon-led toggles inside a TooltipGroup (300 ms initial delay, 0 ms sibling
 * scrub) so the entire bar stays on 1 single line alongside `Iso | XY | XZ | YZ`
 * even on narrow tablet viewports (zero wrapping, zero scrollbar).
 */
const LAYERS = [
  ["nodes", "Nœuds", NodePin],
  ["beams", "Poutres", BeamSegment],
  ["loads", "Charges", NodalPointLoad],
  ["supports", "Appuis", SupportPinned],
  ["deformed", "Déformée", DeflectionLimit],
] as const;

const METROLOGY_LAYERS = [
  ["labels", "Repères N/P", Tag],
  ["dims", "Cotes", Ruler],
  ["reactions", "Réactions", SupportReaction],
] as const;

const SNAP_STEPS = [
  [0.01, "10"],
  [0.05, "50"],
  [0.1, "100"],
] as const;

export function LayerToolbar({ lastSelectionMs }: { lastSelectionMs?: number }) {
  const { layers, toggleLayer, render, setRender, snapStep, setSnapStep } = useViewportParams();
  const { t } = useLingui();

  return (
    <div
      className="pointer-events-auto flex items-center gap-0.5 rounded-panel border border-hairline bg-panel/92 p-1 shadow-2xs backdrop-blur"
      data-testid="layer-toolbar"
    >
      <TooltipGroup>
        {LAYERS.map(([key, label, Icon]) => (
          <Tooltip key={key} label={label} side="bottom">
            <button
              type="button"
              data-testid={`layer-${key}`}
              aria-label={label}
              aria-pressed={layers[key]}
              className={`flex h-6.5 w-6.5 items-center justify-center rounded-[4px] transition-colors ${
                layers[key]
                  ? "bg-accent/15 text-accent"
                  : "text-ink-muted hover:bg-panel-subtle hover:text-ink-primary"
              }`}
              onClick={() => toggleLayer(key)}
            >
              <Icon size={15} />
            </button>
          </Tooltip>
        ))}

        <span className="mx-0.5 h-4 w-px bg-hairline" aria-hidden />

        {METROLOGY_LAYERS.map(([key, label, Icon]) => (
          <Tooltip key={key} label={label} side="bottom">
            <button
              type="button"
              data-testid={`layer-${key}`}
              aria-label={label}
              aria-pressed={layers[key]}
              className={`flex h-6.5 w-6.5 items-center justify-center rounded-[4px] transition-colors ${
                layers[key]
                  ? "bg-accent/15 text-accent"
                  : "text-ink-muted hover:bg-panel-subtle hover:text-ink-primary"
              }`}
              onClick={() => toggleLayer(key)}
            >
              <Icon size={14} strokeWidth={1.7} />
            </button>
          </Tooltip>
        ))}

        <span className="mx-0.5 h-4 w-px bg-hairline" aria-hidden />

        <Tooltip label={t`Rendu volumique 3D`} side="bottom">
          <button
            type="button"
            data-testid="render-volumetric"
            aria-label={t`Rendu volumique 3D`}
            aria-pressed={render === "volumetric"}
            className={`flex h-6.5 w-6.5 items-center justify-center rounded-[4px] transition-colors ${
              render === "volumetric"
                ? "bg-accent/15 text-accent"
                : "text-ink-muted hover:bg-panel-subtle hover:text-ink-primary"
            }`}
            onClick={() => setRender("volumetric")}
          >
            <VolumetricMesh size={15} />
          </button>
        </Tooltip>

        <Tooltip label={t`Rendu filaire`} side="bottom">
          <button
            type="button"
            data-testid="render-wireframe"
            aria-label={t`Rendu filaire`}
            aria-pressed={render === "wireframe"}
            className={`flex h-6.5 w-6.5 items-center justify-center rounded-[4px] transition-colors ${
              render === "wireframe"
                ? "bg-accent/15 text-accent"
                : "text-ink-muted hover:bg-panel-subtle hover:text-ink-primary"
            }`}
            onClick={() => setRender("wireframe")}
          >
            <WireframeMesh size={15} />
          </button>
        </Tooltip>

        <span className="mx-0.5 h-4 w-px bg-hairline" aria-hidden />

        <Tooltip label={t`Grille d'accrochage magnétique`} side="bottom">
          <span className="flex h-6.5 items-center gap-0.5 rounded-[4px] bg-canvas/80 px-1.5">
            <MagneticSnap size={14} className="text-ink-muted" />
            {SNAP_STEPS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                data-testid={`snap-${label}`}
                className={`font-data rounded-[3px] px-1 py-0.5 text-[10px] font-medium transition-colors ${
                  snapStep === value
                    ? "bg-accent/15 text-accent"
                    : "text-ink-muted hover:text-ink-primary"
                }`}
                onClick={() => setSnapStep(value)}
              >
                {label}
              </button>
            ))}
            <span className="font-data text-[9.5px] text-ink-muted">mm</span>
          </span>
        </Tooltip>

        {lastSelectionMs !== undefined ? (
          <span
            className="font-data hidden shrink-0 px-1 text-[10px] text-ink-muted xl:inline"
            data-testid="pick-latency"
          >
            {lastSelectionMs < 0.01 ? "<0.01" : lastSelectionMs.toFixed(2)} ms
          </span>
        ) : null}
      </TooltipGroup>
    </div>
  );
}
