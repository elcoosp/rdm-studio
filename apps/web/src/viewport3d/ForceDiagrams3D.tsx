import { useEffect, useMemo, useState, type ReactElement } from "react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { feaClient, type BeamEnvelopeDto } from "../wasmBridge/workerClient";
import { useProjectStore } from "../state/projectStore";

/**
 * ForceDiagrams3D (v1.8.0): signed min/max force envelopes along the
 * 3D members, rendered as translucent SVG fills over the stage overlay.
 * Amplitude slider + extrema badges + palette (viridis / cividis).
 */

const PALETTES = {
  viridis: ["#440154", "#31688e", "#35b779", "#fde725"],
  cividis: ["#00204d", "#31446b", "#7b7b78", "#ffea46"],
} as const;

type DiagramComponent = "my" | "vz" | "n" | "mz" | "t";

const COMPONENT_LABELS: Record<DiagramComponent, string> = {
  my: "My (N·m)",
  vz: "Vz (N)",
  n: "N (N)",
  mz: "Mz (N·m)",
  t: "T (N·m)",
};

/**
 * v2.0.1: null-safe envelope payload normalization — the worker may answer
 * with a fault object, an id-keyed map or a plain array depending on the
 * solve outcome; every shape collapses to a beam_id-sorted array or null.
 */
function normalizeEnvelopes(payload: unknown): BeamEnvelopeDto[] | null {
  if (Array.isArray(payload)) {
    return (payload as BeamEnvelopeDto[])
      .filter((e) => e !== null && typeof e === "object" && "beam_id" in e)
      .sort((a, b) => a.beam_id - b.beam_id);
  }
  if (payload !== null && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (typeof record.kind === "string") {
      return null;
    }
    const values = Object.values(record).filter(
      (v): v is BeamEnvelopeDto =>
        v !== null && typeof v === "object" && "beam_id" in (v as object),
    );
    return values.length > 0 ? values.sort((a, b) => a.beam_id - b.beam_id) : null;
  }
  return null;
}

export function ForceDiagrams3D(): ReactElement {
  const project = useProjectStore((st) => st.project);
  const [envelopes, setEnvelopes] = useState<BeamEnvelopeDto[] | null>(null);
  const [component, setComponent] = useState<DiagramComponent>("my");
  const [amplitude, setAmplitude] = useState(1.0);
  const [palette, setPalette] = useState<keyof typeof PALETTES>("viridis");

  useEffect(() => {
    void feaClient
      .engineCall("compute_envelopes_json", project)
      .then((payload) => {
        const normalized = normalizeEnvelopes(payload);
        if (normalized === null) {
          console.error("compute_envelopes_json returned a non-array payload:", payload);
        }
        setEnvelopes(normalized);
      })
      .catch(() => setEnvelopes(null));
    return undefined;
  }, [project]);

  const scale = useMemo(() => {
    if (envelopes === null || !Array.isArray(envelopes) || envelopes.length === 0) {
      return 1;
    }
    return envelopes.reduce((acc, e) => {
      const [lo, hi] = e[component];
      return Math.max(acc, Math.abs(lo), Math.abs(hi));
    }, 1e-9);
  }, [envelopes, component]);

  return (
    <section
      aria-label={t`Diagrammes d'efforts 3D`}
      className="rounded-xl border border-slate-200 bg-white/90 p-4 dark:border-slate-700 dark:bg-slate-900/90"
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-bold">
          <Trans>Diagrammes N/V/T/M (envelopes)</Trans>
        </h3>
        <select
          value={component}
          onChange={(e) => setComponent(e.target.value as DiagramComponent)}
          aria-label={t`Composante`}
          className="rounded border border-slate-300 bg-transparent px-2 py-1 text-xs dark:border-slate-600"
        >
          {(Object.keys(COMPONENT_LABELS) as DiagramComponent[]).map((key) => (
            <option key={key} value={key}>
              {COMPONENT_LABELS[key]}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-xs">
          <Trans>Amplitude</Trans>
          <input
            type="range"
            min={0.2}
            max={3}
            step={0.1}
            value={amplitude}
            onChange={(e) => setAmplitude(Number(e.target.value))}
            aria-label={t`Amplitude`}
          />
        </label>
        <select
          value={palette}
          onChange={(e) => setPalette(e.target.value as keyof typeof PALETTES)}
          aria-label={t`Palette`}
          className="rounded border border-slate-300 bg-transparent px-2 py-1 text-xs dark:border-slate-600"
        >
          <option value="viridis">viridis</option>
          <option value="cividis">cividis</option>
        </select>
      </div>
      {envelopes === null || !Array.isArray(envelopes) || envelopes.length === 0 ? (
        <p className="text-xs text-slate-500">{t`Résoudre le modèle pour afficher les enveloppes.`}</p>
      ) : (
        <svg viewBox="0 0 640 120" role="img" className="h-28 w-full">
          {envelopes.map((env, index) => {
            const [lo, hi] = env[component];
            const y0 = 60;
            const half = 46;
            const h1 = (Math.abs(hi) / scale) * half * amplitude;
            const h2 = (Math.abs(lo) / scale) * half * amplitude;
            const x = 20 + index * (600 / Math.max(envelopes.length, 1));
            const color =
              PALETTES[palette][
                Math.min(
                  PALETTES[palette].length - 1,
                  Math.round(((hi - lo) / (2 * scale)) * (PALETTES[palette].length - 1)),
                )
              ];
            return (
              <g key={env.beam_id}>
                <rect
                  x={x}
                  y={y0 - h1}
                  width={24}
                  height={Math.max(h1, 1)}
                  fill={color}
                  opacity={0.5}
                />
                <rect x={x} y={y0} width={24} height={Math.max(h2, 1)} fill={color} opacity={0.3} />
                <text x={x + 2} y={12} fontSize={8}>
                  B{env.beam_id}
                </text>
                <text x={x + 2} y={y0 - h1 - 2} fontSize={7}>
                  {hi.toPrecision(3)}
                </text>
                <text x={x + 2} y={y0 + h2 + 8} fontSize={7}>
                  {lo.toPrecision(3)}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </section>
  );
}
