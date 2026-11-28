import { MoveHorizontal, Tag } from "lucide-react";
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

const LAYERS = [
  ["nodes", "Nœuds", NodePin],
  ["beams", "Poutres", BeamSegment],
  ["loads", "Charges", NodalPointLoad],
  ["supports", "Appuis", SupportPinned],
  ["deformed", "Déformée", DeflectionLimit],
] as const;

const METROLOGY_LAYERS = [
  ["labels", "Repères N/P", Tag],
  ["dims", "Cotes", MoveHorizontal],
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

  const btnClass = (active: boolean) =>
    `flex h-6 w-6 items-center justify-center rounded-[4px] transition-colors ${
      active
        ? "bg-accent/14 text-accent font-medium"
        : "text-ink-muted hover:bg-panel-subtle hover:text-ink-primary"
    }`;

  return (
    <div
      className="pointer-events-auto flex h-8 items-center gap-1 rounded-[6px] border border-hairline bg-panel/95 px-1.5 shadow-xs backdrop-blur"
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
              className={btnClass(layers[key])}
              onClick={() => toggleLayer(key)}
            >
              <Icon size={15} />
            </button>
          </Tooltip>
        ))}

        <span className="mx-0.5 h-3.5 w-px bg-hairline" aria-hidden />

        {METROLOGY_LAYERS.map(([key, label, Icon]) => (
          <Tooltip key={key} label={label} side="bottom">
            <button
              type="button"
              data-testid={`layer-${key}`}
              aria-label={label}
              aria-pressed={layers[key]}
              className={btnClass(layers[key])}
              onClick={() => toggleLayer(key)}
            >
              <Icon size={14} strokeWidth={1.75} />
            </button>
          </Tooltip>
        ))}

        <span className="mx-0.5 h-3.5 w-px bg-hairline" aria-hidden />

        <Tooltip label={t`Rendu volumique 3D`} side="bottom">
          <button
            type="button"
            data-testid="render-volumetric"
            aria-label={t`Rendu volumique 3D`}
            aria-pressed={render === "volumetric"}
            className={btnClass(render === "volumetric")}
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
            className={btnClass(render === "wireframe")}
            onClick={() => setRender("wireframe")}
          >
            <WireframeMesh size={15} />
          </button>
        </Tooltip>

        <span className="mx-0.5 h-3.5 w-px bg-hairline" aria-hidden />

        <Tooltip label={t`Grille d'accrochage magnétique`} side="bottom">
          <div className="flex items-center gap-0.5 pl-0.5">
            <MagneticSnap size={14} className="mr-0.5 text-ink-secondary" />
            {SNAP_STEPS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                data-testid={`snap-${label}`}
                className={`font-data h-5 rounded-[3px] px-1.5 text-[10px] font-medium transition-colors ${
                  snapStep === value
                    ? "bg-accent text-white shadow-2xs"
                    : "text-ink-secondary hover:bg-panel-subtle hover:text-ink-primary"
                }`}
                onClick={() => setSnapStep(value)}
              >
                {label}
              </button>
            ))}
            <span className="font-data pl-0.5 text-[10px] text-ink-muted">mm</span>
          </div>
        </Tooltip>

        {lastSelectionMs !== undefined ? (
          <span
            className="font-data hidden shrink-0 pl-1 text-[10px] text-ink-muted xl:inline"
            data-testid="pick-latency"
          >
            {lastSelectionMs < 0.01 ? "<0.01" : lastSelectionMs.toFixed(2)} ms
          </span>
        ) : null}
      </TooltipGroup>
    </div>
  );
}
