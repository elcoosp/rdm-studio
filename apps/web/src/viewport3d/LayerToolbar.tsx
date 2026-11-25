import { useViewportStore } from "@/state/viewportStore";

/**
 * Floating layer toolbar (ARCHITECTURE.md section 5, `LayerToolbar.tsx`;
 * section 8.8): selective visibility (Nodes, Beams, Loads, Supports,
 * Deformed) and volumetric / wireframe rendering, plus the live M4 picking
 * latency readout when provided.
 */
const LAYERS = [
  ["nodes", "Nœuds"],
  ["beams", "Poutres"],
  ["loads", "Charges"],
  ["supports", "Appuis"],
  ["deformed", "Déformée"],
] as const;

export function LayerToolbar({ lastSelectionMs }: { lastSelectionMs?: number }) {
  const layers = useViewportStore((s) => s.layers);
  const toggleLayer = useViewportStore((s) => s.toggleLayer);
  const renderMode = useViewportStore((s) => s.renderMode);
  const setRenderMode = useViewportStore((s) => s.setRenderMode);

  return (
    <div
      className="absolute top-2 left-2 z-10 flex flex-wrap gap-1 rounded-panel border border-hairline bg-panel/90 p-1 backdrop-blur"
      data-testid="layer-toolbar"
    >
      {LAYERS.map(([key, label]) => (
        <button
          key={key}
          type="button"
          data-testid={`layer-${key}`}
          className={`rounded px-2 py-1 text-[11px] ${layers[key] ? "bg-accent/15 text-accent" : "text-ink-muted"}`}
          onClick={() => toggleLayer(key)}
        >
          {label}
        </button>
      ))}
      <span className="mx-1 w-px bg-hairline" />
      <button
        type="button"
        data-testid="render-volumetric"
        className={`rounded px-2 py-1 text-[11px] ${renderMode === "volumetric" ? "bg-accent/15 text-accent" : "text-ink-muted"}`}
        onClick={() => setRenderMode("volumetric")}
      >
        Volumique
      </button>
      <button
        type="button"
        data-testid="render-wireframe"
        className={`rounded px-2 py-1 text-[11px] ${renderMode === "wireframe" ? "bg-accent/15 text-accent" : "text-ink-muted"}`}
        onClick={() => setRenderMode("wireframe")}
      >
        Filaire
      </button>
      {lastSelectionMs !== undefined ? (
        <span
          className="font-data rounded px-2 py-1 text-[11px] text-ink-muted"
          data-testid="pick-latency"
        >
          {lastSelectionMs < 0.01 ? "<0.01" : lastSelectionMs.toFixed(2)} ms
        </span>
      ) : null}
    </div>
  );
}
