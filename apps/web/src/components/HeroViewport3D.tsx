import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Grid, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { spectrumColor } from "@/viewport3d/BeamMeshes";

/**
 * HeroViewport3D (v2.1.2): the single-context Three.js / R3F structural
 * stage behind the `/` Hero — a REAL Z-up portal frame / Warren truss /
 * 3-span beam rendered as true extruded members over the metric floor
 * grid, with a gentle harmonic deflection breathing and thermal stress
 * colors driven by the live load slider (20 → 120 kN). The canvas is
 * lazy-loaded (React.lazy + instant SVG skeleton for a sub-200 ms LCP),
 * viewport-aware (`IntersectionObserver` pauses the frameloop when
 * scrolled out of view), fully disposed on switch/unmount, and falls back
 * to the crisp architectural SVG when WebGL is unavailable.
 */

export type HeroModel = "portique" | "warren" | "travees";

type HeroNode = { x: number; y: number; z: number };
type HeroBeam = { a: HeroNode; b: HeroNode; kind: "column" | "girder" | "chord" | "diagonal" };

/** Model builders (SI metres, Z-up) — the same three flagship shapes as
 * the quick-start templates, drawn as real members. */
function buildModel(model: HeroModel): { beams: HeroBeam[]; loads: number[] } {
  const n = (x: number, y: number, z: number): HeroNode => ({ x, y, z });
  if (model === "portique") {
    // Portique 18 m — HEA 200 columns, IPE 300 girder.
    const beams: HeroBeam[] = [
      { a: n(0, 0, 0), b: n(0, 0, 5), kind: "column" },
      { a: n(18, 0, 0), b: n(18, 0, 5), kind: "column" },
      { a: n(0, 0, 5), b: n(18, 0, 5), kind: "girder" },
    ];
    return { beams, loads: [3, 6, 9, 12, 15] };
  }
  if (model === "warren") {
    // Treillis Warren 24 m — bottom + top chords, alternating diagonals.
    const bottom = [0, 6, 12, 18, 24].map((x) => n(x, 0, 0));
    const top = [3, 9, 15, 21].map((x) => n(x, 0, 3));
    const beams: HeroBeam[] = [];
    for (let i = 0; i < bottom.length - 1; i++) {
      const a = bottom[i];
      const b = bottom[i + 1];
      if (a !== undefined && b !== undefined) beams.push({ a, b, kind: "chord" });
    }
    for (let i = 0; i < top.length - 1; i++) {
      const a = top[i];
      const b = top[i + 1];
      if (a !== undefined && b !== undefined) beams.push({ a, b, kind: "chord" });
    }
    // Alternating diagonals: bottom0→top0, top0→bottom1, bottom1→top1 …
    const pairs: [number, number][] = [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 2],
      [2, 2],
      [2, 3],
      [3, 3],
      [3, 4],
    ];
    for (const [ti, bi] of pairs) {
      const a = bottom[bi];
      const b = top[ti];
      if (a !== undefined && b !== undefined) beams.push({ a, b, kind: "diagonal" });
    }
    return { beams, loads: [3, 9, 15, 21] };
  }
  // Poutre 3 travées — 3 × 6 m continue.
  const beams: HeroBeam[] = [];
  const xs = [0, 6, 12, 18];
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i];
    const b = xs[i + 1];
    if (a !== undefined && b !== undefined) {
      beams.push({ a: n(a, 0, 0), b: n(b, 0, 0), kind: "girder" });
    }
  }
  return { beams, loads: [3, 9, 15] };
}

/** Per-member stress ratio (0..1.25) driving the 5-tier thermal spectrum. */
function memberRatio(kind: HeroBeam["kind"], loadKN: number): number {
  const factor =
    kind === "girder" ? 1 : kind === "column" ? 0.82 : kind === "diagonal" ? 0.58 : 0.5;
  const base = loadKN / 96; // η = 1.00 at ~96 kN on the governing member.
  return Math.min(1.25, base * factor);
}

const MEMBER_SIZE: Record<HeroBeam["kind"], [number, number]> = {
  // (width across, depth) in metres — IPE 300 / HEA 200-ish silhouettes.
  girder: [0.3, 0.14],
  column: [0.19, 0.19],
  chord: [0.2, 0.1],
  diagonal: [0.11, 0.09],
};

/** Shared unit axis for the segment quaternion (allocation-free). */
const X_AXIS = new THREE.Vector3(1, 0, 0);

/** One extruded member. Horizontal girders bow with a 5-segment discrete
 * parabolic deflection (ends pinned to the joints, midspan breathing);
 * inclined/vertical members stay rigid. All motion runs through refs —
 * zero React re-renders per frame. */
function Member({ beam, loadKN }: { beam: HeroBeam; loadKN: number }) {
  const { a, b, kind } = beam;
  const [width, depth] = MEMBER_SIZE[kind];
  const ratio = memberRatio(kind, loadKN);
  const color = useMemo(() => spectrumToHex(ratio), [ratio]);
  const horizontal = Math.abs(b.z - a.z) < 1e-9 && Math.abs(b.x - a.x) > 1e-9;
  const SEGMENTS = 5;
  const length = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  const segLength = length / SEGMENTS;

  // Rigid member: one static box.
  const staticGeometry = useMemo(
    () => new THREE.BoxGeometry(length, depth, width),
    [length, depth, width],
  );
  useEffect(() => () => staticGeometry.dispose(), [staticGeometry]);
  const staticQuaternion = useMemo(() => {
    const dir = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z).normalize();
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
  }, [a, b]);

  // Deflected girder: 5 boxes whose centers/quaternions re-align each
  // frame to the parabolic sample points f(x) = 4·x·(1-x).
  const segRefs = useRef<(THREE.Group | null)[]>([]);
  const segQuats = useMemo(() => {
    const quats: THREE.Quaternion[] = [];
    for (let i = 0; i < SEGMENTS; i++) {
      quats.push(new THREE.Quaternion());
    }
    return quats;
  }, []);

  useFrame(({ clock }) => {
    if (!horizontal) return;
    // Gentle harmonic breathing: amplitude oscillates with the 1.35 rad/s
    // instrument cadence, scaled by the member's stress ratio.
    const amplitude = (0.02 + 0.09 * ratio) * (0.55 + 0.45 * Math.sin(clock.elapsedTime * 1.35));
    for (let i = 0; i < SEGMENTS; i++) {
      const seg = segRefs.current[i];
      if (seg === undefined || seg === null) continue;
      const t0 = i / SEGMENTS;
      const t1 = (i + 1) / SEGMENTS;
      const f0 = 4 * t0 * (1 - t0);
      const f1 = 4 * t1 * (1 - t1);
      const z0 = a.z - amplitude * f0;
      const z1 = b.z - amplitude * f1;
      const mid = new THREE.Vector3(
        a.x + ((b.x - a.x) * (t0 + t1)) / 2,
        a.y + ((b.y - a.y) * (t0 + t1)) / 2,
        (z0 + z1) / 2,
      );
      seg.position.copy(mid);
      const dir = new THREE.Vector3(b.x - a.x, b.y - a.y, z1 - z0).normalize();
      const quat = segQuats[i];
      if (quat !== undefined) {
        quat.setFromUnitVectors(X_AXIS, dir);
        seg.quaternion.copy(quat);
      }
    }
  });

  if (!horizontal) {
    const mid = new THREE.Vector3((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    return (
      <group
        position={[mid.x, mid.y, mid.z]}
        quaternion={[
          staticQuaternion.x,
          staticQuaternion.y,
          staticQuaternion.z,
          staticQuaternion.w,
        ]}
      >
        <mesh geometry={staticGeometry}>
          <meshStandardMaterial color={color} metalness={0.08} roughness={0.62} />
        </mesh>
      </group>
    );
  }

  return (
    <group>
      {Array.from({ length: SEGMENTS }, (_, i) => {
        const t0 = i / SEGMENTS;
        const t1 = (i + 1) / SEGMENTS;
        const cx = a.x + ((b.x - a.x) * (t0 + t1)) / 2;
        const cy = a.y + ((b.y - a.y) * (t0 + t1)) / 2;
        return (
          <group
            key={i}
            ref={(node) => {
              segRefs.current[i] = node;
            }}
            position={[cx, cy, a.z]}
          >
            <mesh>
              <boxGeometry args={[segLength * 1.004, depth, width]} />
              <meshStandardMaterial color={color} metalness={0.08} roughness={0.62} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function spectrumToHex(ratio: number): string {
  const [r, g, b] = spectrumColor(ratio);
  const to = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** Node sphere (joint dots, ink). */
function Joint({ node }: { node: HeroNode }) {
  return (
    <mesh position={[node.x, node.y, node.z]}>
      <sphereGeometry args={[0.09, 12, 10]} />
      <meshStandardMaterial color="#0F172A" roughness={0.5} />
    </mesh>
  );
}

/** Support symbol under a node: base plate (fixed) or pin cone. */
function Support({ node, fixed }: { node: HeroNode; fixed: boolean }) {
  if (fixed) {
    return (
      <group position={[node.x, node.y, node.z - 0.14]}>
        <mesh>
          <boxGeometry args={[0.7, 0.5, 0.1]} />
          <meshStandardMaterial color="#1D4ED8" roughness={0.5} />
        </mesh>
      </group>
    );
  }
  return (
    <group position={[node.x, node.y, node.z - 0.16]}>
      <mesh rotation={[0, 0, 0]}>
        <coneGeometry args={[0.24, 0.32, 12]} />
        <meshStandardMaterial color="#1D4ED8" roughness={0.5} />
      </mesh>
    </group>
  );
}

/** Downward crimson load arrow (shaft + head) pointing at the member. */
function LoadArrow({
  x,
  y,
  zTop,
  zBottom,
  intensity,
}: {
  x: number;
  y: number;
  zTop: number;
  zBottom: number;
  intensity: number;
}) {
  const shaft = zTop - zBottom;
  return (
    <group position={[x, y, zBottom + shaft / 2]}>
      <mesh>
        <cylinderGeometry args={[0.02 + 0.012 * intensity, 0.02 + 0.012 * intensity, shaft, 8]} />
        <meshStandardMaterial color="#DC2626" />
      </mesh>
      <mesh position={[0, 0, -shaft / 2 - 0.09]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.075 + 0.04 * intensity, 0.18, 10]} />
        <meshStandardMaterial color="#DC2626" />
      </mesh>
    </group>
  );
}

/** Scene root: model members + joints + supports + load arrows + grid. */
function HeroScene({ model, loadKN }: { model: HeroModel; loadKN: number }) {
  const { beams, loads } = useMemo(() => buildModel(model), [model]);
  const joints = useMemo(() => {
    const seen = new Map<string, HeroNode>();
    for (const beam of beams) {
      seen.set(`${beam.a.x},${beam.a.z}`, beam.a);
      seen.set(`${beam.b.x},${beam.b.z}`, beam.b);
    }
    return [...seen.values()];
  }, [beams]);
  const supports = useMemo(() => {
    if (model === "portique") {
      return [
        { node: { x: 0, y: 0, z: 0 }, fixed: true },
        { node: { x: 18, y: 0, z: 0 }, fixed: false },
      ];
    }
    if (model === "warren") {
      return [
        { node: { x: 0, y: 0, z: 0 }, fixed: true },
        { node: { x: 24, y: 0, z: 0 }, fixed: false },
      ];
    }
    return [0, 6, 12, 18].map((x) => ({ node: { x, y: 0, z: 0 }, fixed: x === 0 }));
  }, [model]);
  const intensity = loadKN / 120;
  // Arrow altitude: just above the loaded member (girder top / top chord).
  const arrowBase = model === "portique" ? 5.34 : model === "warren" ? 3.34 : 0.34;
  const arrowTip = model === "portique" ? 5.06 : model === "warren" ? 3.06 : 0.06;
  return (
    <>
      <color attach="background" args={["#F8FAFC"]} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[6, -8, 12]} intensity={1.25} />
      <directionalLight position={[-8, 6, 6]} intensity={0.4} />
      <Grid
        rotation={[Math.PI / 2, 0, 0]}
        cellSize={0.5}
        cellThickness={0.5}
        sectionSize={2}
        sectionThickness={1}
        sectionColor="#94A3B8"
        cellColor="#D8DFE8"
        fadeDistance={42}
        fadeStrength={1}
        infiniteGrid
      />
      {beams.map((beam, i) => (
        <Member key={`${i}-${model}`} beam={beam} loadKN={loadKN} />
      ))}
      {joints.map((node, i) => (
        <Joint key={`j-${i}-${model}`} node={node} />
      ))}
      {supports.map((support, i) => (
        <Support key={`s-${i}-${model}`} node={support.node} fixed={support.fixed} />
      ))}
      {loads.map((x, i) => (
        <LoadArrow
          key={`l-${i}-${model}`}
          x={x}
          y={0}
          zTop={arrowBase}
          zBottom={arrowTip}
          intensity={intensity}
        />
      ))}
      <OrbitControls enableZoom={false} enablePan={false} makeDefault target={[9, 0, 1.4]} />
    </>
  );
}

/** WebGL capability probe (same guardrail as `ViewportCanvas`). */
function useWebGLAvailable(): boolean {
  return useMemo(() => {
    try {
      const probe = document.createElement("canvas");
      const gl2 = probe.getContext("webgl2", { antialias: true });
      if (gl2 === null) return false;
      gl2.getExtension("WEBGL_lose_context")?.loseContext();
      return true;
    } catch {
      return false;
    }
  }, []);
}

/** Camera identity per model so every shape lands framed. */
const CAMERA: Record<HeroModel, { position: [number, number, number]; fov: number }> = {
  portique: { position: [24, -21, 10], fov: 40 },
  warren: { position: [30, -25, 13], fov: 40 },
  travees: { position: [26, -22, 12], fov: 40 },
};

export function HeroViewport3D({
  model,
  loadKN,
}: {
  model: HeroModel;
  loadKN: number;
}): React.ReactElement {
  const webgl = useWebGLAvailable();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);
  const [webglAlive, setWebglAlive] = useState(true);

  // Viewport-aware frameloop: pause rendering entirely when the hero
  // scrolls out of view (battery / 60 FPS budget on the marketing page).
  useEffect(() => {
    const el = wrapRef.current;
    if (el === null) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setInView(entry.isIntersecting);
      },
      { threshold: 0.05 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (!webgl || !webglAlive) {
    return <HeroFallbackSvg model={model} loadKN={loadKN} />;
  }

  return (
    <div ref={wrapRef} className="h-full w-full" data-testid="hero-3d-stage">
      <Canvas
        key={model}
        dpr={[1, 1.5]}
        frameloop={inView ? "always" : "never"}
        camera={{ position: CAMERA[model].position, fov: CAMERA[model].fov, up: [0, 0, 1] }}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        style={{ background: "var(--color-canvas)" }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.NoToneMapping;
        }}
        onError={() => setWebglAlive(false)}
      >
        <Suspense fallback={null}>
          <HeroScene model={model} loadKN={loadKN} />
        </Suspense>
      </Canvas>
    </div>
  );
}

/** Graceful architectural SVG fallback (headless / old GPU / no WebGL). */
export function HeroFallbackSvg({
  model,
  loadKN,
}: {
  model: HeroModel;
  loadKN: number;
}): React.ReactElement {
  const ratio = Math.min(1.25, loadKN / 96);
  const [, , b] = spectrumColor(ratio);
  const stroke = spectrumToHex(ratio);
  void b;
  return (
    <div className="flex h-full w-full items-center justify-center" data-testid="hero-3d-stage">
      <svg
        viewBox="0 0 420 240"
        className="h-full w-full"
        role="img"
        aria-label="Schéma structurel"
      >
        <g stroke="#E2E8F0" strokeWidth="1">
          {[0, 1, 2, 3, 4].map((i) => (
            <line key={`v${i}`} x1={40 + i * 85} y1="30" x2={40 + i * 85} y2="215" />
          ))}
          {[0, 1, 2].map((i) => (
            <line key={`h${i}`} x1="30" y1={60 + i * 55} x2="390" y2={60 + i * 55} />
          ))}
        </g>
        <g stroke={stroke} strokeWidth="3" fill="none" strokeLinecap="round">
          {model === "portique" ? <path d="M110 210 V80 H300 V210" /> : null}
          {model === "warren" ? (
            <path d="M40 60 H380 M60 170 H360 M40 60 L60 170 L100 60 L140 170 L180 60 L220 170 L260 60 L300 170 L340 60 L360 170" />
          ) : null}
          {model === "travees" ? <path d="M40 130 H380" /> : null}
        </g>
        {model === "travees"
          ? [40, 155, 270, 380].map((x) => (
              <g key={x} stroke="#1D4ED8" fill="#1D4ED8">
                <path d={`M${x - 9} 212 L${x + 9} 212 L${x} 198 Z`} />
              </g>
            ))
          : null}
        <g stroke="#DC2626" strokeWidth="1.5" fill="none">
          {[110, 148, 186, 224, 262, 300].map((x) => (
            <g key={x}>
              <line x1={x} y1="46" x2={x} y2="72" />
              <path d={`M${x - 4} 66 L${x} 74 L${x + 4} 66`} strokeLinejoin="round" />
            </g>
          ))}
        </g>
        <text
          x="210"
          y="232"
          textAnchor="middle"
          fontSize="10"
          fill="#94A3B8"
          className="font-data"
        >
          {`q = ${loadKN} kN · Vue 3D indisponible (WebGL) — schéma de secours`}
        </text>
      </svg>
    </div>
  );
}
