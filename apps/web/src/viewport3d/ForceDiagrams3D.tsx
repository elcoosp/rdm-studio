import { useEffect, useMemo, useState, type ReactElement } from "react";
import * as THREE from "three";
import { create } from "zustand";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { feaClient, type SpanForceSample } from "../wasmBridge/workerClient";
import { useProjectStore, type BeamData, type NodeData } from "../state/projectStore";
import {
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

/**
 * ForceDiagrams3D (v2.1.0): TRUE 3D signed internal-force diagrams drawn
 * along the 3D members inside the persistent stage (22fd9fa audit item).
 *
 * - `ForceDiagram3DLayer` — the in-canvas layer: per member, the sampled
 *   signed diagram (My, Mz, Vz, N or T) is extruded as a ribbon mesh in
 *   the member's strong-axis plane, cobalt for positive ordinates and
 *   crimson for negative ones.
 * - `ForceDiagrams3DPanel` — the DOM control panel docked under Step 4's
 *   220px inspector (component, amplitude, palette + envelope summary).
 *
 * The samples come from the exact Timoshenko `beam_span_forces` endpoint
 * (24 stations per member) — the same curves as the uPlot dock, so the
 * 3D ribbons and the 2D diagrams never disagree.
 */

type DiagramComponent = "my" | "vz" | "n" | "mz" | "t";

const COMPONENT_LABELS: Record<DiagramComponent, string> = {
  my: "My",
  vz: "Vz",
  n: "N",
  mz: "Mz",
  t: "T",
};

const COMPONENT_UNITS: Record<DiagramComponent, string> = {
  my: "kN·m",
  vz: "kN",
  n: "kN",
  mz: "kN·m",
  t: "kN·m",
};

interface DiagramUiState {
  component: DiagramComponent;
  amplitude: number;
  palette: keyof typeof PALETTES;
  setComponent: (c: DiagramComponent) => void;
  setAmplitude: (a: number) => void;
  setPalette: (p: keyof typeof PALETTES) => void;
}

const PALETTES = {
  viridis: ["#440154", "#31688e", "#35b779", "#fde725"],
  cividis: ["#00204d", "#31446b", "#7b7b78", "#ffea46"],
} as const;

export const useDiagramStore = create<DiagramUiState>()((set) => ({
  component: "my",
  amplitude: 1,
  palette: "viridis",
  setComponent: (component) => set({ component }),
  setAmplitude: (amplitude) => set({ amplitude }),
  setPalette: (palette) => set({ palette }),
}));

/** Per-member signed samples keyed by beam id, cached across renders. */
type SamplesMap = Map<number, SpanForceSample[]>;

/**
 * Samples the signed internal forces of EVERY member (24 stations) in one
 * cached pass — keyed by the project structure signature so geometry or
 * load edits invalidate the cache through the worker's solve cache.
 */
function useForceSamples(): { samples: SamplesMap; maxAbs: number } {
  const project = useProjectStore((st) => st.project);
  const signature = useMemo(() => JSON.stringify(project.structure), [project.structure]);
  const [state, setState] = useState<{ samples: SamplesMap; maxAbs: number }>({
    samples: new Map(),
    maxAbs: 1e-9,
  });
  useEffect(() => {
    let cancelled = false;
    const beams = project.structure.beams;
    const map: SamplesMap = new Map();
    void Promise.all(
      beams.map(async (beam) => {
        const samples = await feaClient.beamSpanForces(project, beam.id, 24).catch(() => []);
        if (!cancelled && samples.length > 0) {
          map.set(beam.id, samples);
        }
      }),
    ).then(() => {
      if (!cancelled) {
        let maxAbs = 1e-9;
        for (const samples of map.values()) {
          for (const sample of samples) {
            maxAbs = Math.max(
              maxAbs,
              Math.abs(sample.my),
              Math.abs(sample.mz),
              Math.abs(sample.n),
              Math.abs(sample.t),
              Math.abs(sample.vz),
            );
          }
        }
        setState({ samples: map, maxAbs });
      }
    });
    return () => {
      cancelled = true;
    };
    // Recompute on every model mutation (signature) — worker-side cache
    // makes repeated solves cheap (9a749c2).
  }, [signature, project, setState]);
  return state;
}

/** Diagram-plane basis of one member (v2.1.0): the axis direction plus the
 * perpendicular in which the ordinates are drawn (strong axis = containing
 * global Z for planar members, lateral axis for N). */
function memberPlane(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
): { axis: THREE.Vector3; dir: THREE.Vector3; length: number } {
  const ax = new THREE.Vector3(a.x, a.y, a.z);
  const bx = new THREE.Vector3(b.x, b.y, b.z);
  const axis = bx.clone().sub(ax);
  const length = Math.max(axis.length(), 1e-9);
  axis.divideScalar(length);
  const up = new THREE.Vector3(0, 0, 1);
  const lateral = new THREE.Vector3().crossVectors(axis, up);
  if (lateral.lengthSq() < 1e-6) {
    // Vertical member: the strong plane contains global X.
    lateral.set(1, 0, 0);
  }
  lateral.normalize();
  const strong = new THREE.Vector3().crossVectors(lateral, axis).normalize();
  return { axis, dir: strong, length };
}

/** Builds one ribbon mesh per member for the active component. */
function DiagramRibbons({
  nodes,
  beams,
  samples,
  component,
  maxAbs,
  amplitude,
}: {
  nodes: NodeData[];
  beams: BeamData[];
  samples: SamplesMap;
  component: DiagramComponent;
  maxAbs: number;
  amplitude: number;
}): ReactElement {
  const geometries = useMemo(() => {
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const out: { beamId: number; geometry: THREE.BufferGeometry; positive: boolean }[] = [];
    for (const beam of beams) {
      const a = nodeById.get(beam.n1);
      const b = nodeById.get(beam.n2);
      const memberSamples = samples.get(beam.id);
      if (a === undefined || b === undefined || memberSamples === undefined) {
        continue;
      }
      const { axis, dir, length } = memberPlane(a, b);
      const positions: number[] = [];
      const colors: number[] = [];
      const cobalt = new THREE.Color("#1D4ED8");
      const crimson = new THREE.Color("#DC2626");
      const pushTriangle = (
        o1: THREE.Vector3,
        p1: THREE.Vector3,
        o2: THREE.Vector3,
        p2: THREE.Vector3,
        positive: boolean,
      ) => {
        const color = positive ? cobalt : crimson;
        for (const v of [o1, p1, p2, o1, p2, o2]) {
          positions.push(v.x, v.y, v.z);
          colors.push(color.r, color.g, color.b);
        }
      };
      const origin = new THREE.Vector3(a.x, a.y, a.z);
      let prevO = origin.clone();
      let prevP: THREE.Vector3 | null = null;
      for (const sample of memberSamples) {
        const raw = Number(sample[component] ?? 0);
        const ordinate = (raw / maxAbs) * amplitude * (length * 0.35);
        const point = origin
          .clone()
          .add(axis.clone().multiplyScalar(sample.ratio * length))
          .add(dir.clone().multiplyScalar(ordinate));
        if (prevP !== null) {
          pushTriangle(
            prevO,
            prevP,
            origin.clone().add(axis.clone().multiplyScalar(sample.ratio * length)),
            point,
            raw >= 0,
          );
        }
        prevO = origin.clone().add(axis.clone().multiplyScalar(sample.ratio * length));
        prevP = point;
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      out.push({ beamId: beam.id, geometry, positive: true });
    }
    return out;
  }, [nodes, beams, samples, component, maxAbs, amplitude]);

  useEffect(() => {
    return () => {
      for (const entry of geometries) {
        entry.geometry.dispose();
      }
    };
  }, [geometries]);

  return (
    <group data-testid="force-diagrams-3d">
      {geometries.map((entry) => (
        <mesh key={entry.beamId} geometry={entry.geometry}>
          <meshBasicMaterial
            vertexColors
            transparent
            opacity={0.42}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

/** In-canvas layer mounted by `PersistentStage` when `diagrams=1`. */
export function ForceDiagram3DLayer(): ReactElement | null {
  const nodes = useProjectStore((st) => st.project.structure.nodes);
  const beams = useProjectStore((st) => st.project.structure.beams);
  const component = useDiagramStore((st) => st.component);
  const amplitude = useDiagramStore((st) => st.amplitude);
  const { samples, maxAbs } = useForceSamples();
  if (beams.length === 0 || samples.size === 0) {
    return null;
  }
  return (
    <DiagramRibbons
      nodes={nodes}
      beams={beams}
      samples={samples}
      component={component}
      maxAbs={maxAbs}
      amplitude={amplitude}
    />
  );
}

/** Docked control panel + envelope summary (Step 4, inside the 220px
 * dock). v2.1.2 (audit fix): the panel is COMPACT — p-2, one-line
 * controls, h-20 SVG — so it fits inside the dock's 220px without any
 * internal scrollbar. */
export function ForceDiagrams3DPanel(): ReactElement {
  const component = useDiagramStore((st) => st.component);
  const amplitude = useDiagramStore((st) => st.amplitude);
  const palette = useDiagramStore((st) => st.palette);
  const setComponent = useDiagramStore((st) => st.setComponent);
  const setAmplitude = useDiagramStore((st) => st.setAmplitude);
  const setPalette = useDiagramStore((st) => st.setPalette);
  const beams = useProjectStore((st) => st.project.structure.beams);
  const { samples, maxAbs } = useForceSamples();

  return (
    <section
      aria-label={t`Diagrammes d'efforts 3D`}
      className="flex h-full min-h-0 flex-col rounded-panel border border-hairline bg-panel p-2"
      data-testid="force-diagrams-panel"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className="text-[12px] font-semibold text-ink-primary">
          <Trans>Diagrammes N/V/T/M sur les membres 3D</Trans>
        </h3>
        <SelectRoot
          value={component}
          onValueChange={(next) => setComponent(next as DiagramComponent)}
        >
          <SelectTrigger
            aria-label={t`Composante`}
            className="h-7 w-auto gap-1 text-[11px]"
            data-testid="diagram-component-select"
          >
            <span className="font-data">{`${COMPONENT_LABELS[component]} (${COMPONENT_UNITS[component]})`}</span>
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(COMPONENT_LABELS) as DiagramComponent[]).map((key) => (
              <SelectItem key={key} value={key}>
                {`${COMPONENT_LABELS[key]} (${COMPONENT_UNITS[key]})`}
              </SelectItem>
            ))}
          </SelectContent>
        </SelectRoot>
        <label className="flex w-40 items-center gap-1.5 text-[11px] text-ink-secondary">
          <Trans>Amplitude</Trans>
          <Slider
            value={amplitude}
            min={0.2}
            max={3}
            step={0.1}
            onValueChange={(v) => {
              if (typeof v === "number") setAmplitude(v);
            }}
            aria-label={t`Amplitude`}
            className="min-w-0 flex-1"
          />
        </label>
        <SelectRoot
          value={palette}
          onValueChange={(next) => setPalette(next as keyof typeof PALETTES)}
        >
          <SelectTrigger
            aria-label={t`Palette`}
            className="h-7 w-auto gap-1 text-[11px]"
            data-testid="diagram-palette-select"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="viridis">viridis</SelectItem>
            <SelectItem value="cividis">cividis</SelectItem>
          </SelectContent>
        </SelectRoot>
      </div>
      {beams.length === 0 || samples.size === 0 ? (
        <p className="mt-2 text-[11px] text-ink-muted">
          {t`Résoudre le modèle pour afficher les enveloppes.`}
        </p>
      ) : (
        <svg
          viewBox="0 0 640 120"
          role="img"
          className="mt-1 min-h-0 w-full flex-1"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden
        >
          {beams.map((beam, index) => {
            const memberSamples = samples.get(beam.id);
            if (memberSamples === undefined || memberSamples.length === 0) {
              return null;
            }
            const values = memberSamples.map((s) => Number(s[component] ?? 0));
            const hi = Math.max(...values);
            const lo = Math.min(...values);
            const half = 46;
            const y0 = 60;
            const x = 20 + index * (600 / Math.max(beams.length, 1));
            const h1 = (Math.abs(hi) / maxAbs) * half * amplitude;
            const h2 = (Math.abs(lo) / maxAbs) * half * amplitude;
            const [fillLow, fillMid, fillHigh] = PALETTES[palette];
            const color = hi >= 0 && lo >= 0 ? fillHigh : lo < 0 && hi < 0 ? fillLow : fillMid;
            return (
              <g key={beam.id}>
                <rect
                  x={x}
                  y={y0 - h1}
                  width={24}
                  height={Math.max(h1, 1)}
                  fill={color}
                  opacity={0.5}
                />
                <rect x={x} y={y0} width={24} height={Math.max(h2, 1)} fill={color} opacity={0.3} />
                <text x={x + 2} y={12} fontSize={8} fill="#475569">
                  B{beam.id}
                </text>
                <text x={x + 2} y={y0 - h1 - 2} fontSize={7} fill="#475569">
                  {hi.toPrecision(3)}
                </text>
                <text x={x + 2} y={y0 + h2 + 8} fontSize={7} fill="#475569">
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
