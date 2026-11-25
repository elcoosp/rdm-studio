import { Canvas, useThree } from "@react-three/fiber";
import { GizmoHelper, GizmoViewport, Grid, OrbitControls } from "@react-three/drei";
import { Component, useEffect, useMemo, type ReactNode } from "react";
import { Trans } from "@lingui/react/macro";
import * as THREE from "three";
import { useViewportStore, type CameraPreset } from "@/state/viewportStore";
import { LayerToolbar } from "./LayerToolbar";
import { modelBounds } from "./ProfileShapes";
import type { NodeData } from "@/state/projectStore";

/**
 * Three.js / R3F scene chrome (ARCHITECTURE.md section 5, `ViewportCanvas.tsx`):
 * Z-up metric scene, infinite metric floor grid, XYZ gizmo (top-right), CAD
 * orbit controls with touch enabled (section 8.7), floating view-preset and
 * layer toolbars. Model layers are passed as children by each route.
 */
const PRESET_POSITIONS: Record<CameraPreset, [number, number, number]> = {
  iso: [6, -6, 4.5],
  "top-xy": [0, -0.001, 8],
  "face-xz": [0, 8, 0.001],
  "side-yz": [8, 0.001, 0],
};

function CameraRig({ preset }: { preset: CameraPreset }) {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    const [x, y, z] = PRESET_POSITIONS[preset];
    camera.position.set(x, y, z);
    camera.up.set(0, 0, 1);
    camera.lookAt(0, 0, 0.5);
    camera.updateProjectionMatrix();
  }, [camera, preset]);
  return null;
}

/**
 * Auto-frames the camera to the model bounding box on mount and whenever
 * the model identity changes (bug 2: no more staring at an empty corner).
 */
function FitCamera({ nodes }: { nodes: NodeData[] }) {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const signature = `${nodes.length}:${nodes[0]?.id ?? 0}:${nodes[nodes.length - 1]?.id ?? 0}`;
  useEffect(() => {
    if (nodes.length === 0) {
      return;
    }
    const { center, radius } = modelBounds(nodes);
    const distance = Math.max(radius * 2.6, 1);
    camera.position.set(
      center[0] + distance * 0.62,
      center[1] - distance * 0.62,
      center[2] + distance * 0.48,
    );
    camera.up.set(0, 0, 1);
    camera.lookAt(center[0], center[1], center[2]);
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, invalidate, signature, nodes]);
  return null;
}

/**
 * WebGL fallback (M8 robustness): headless browsers, old GPUs and context
 * loss must degrade to a static notice — never take the app shell down.
 */
class ViewportErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    if (this.state.failed) {
      return <ViewportFallback />;
    }
    return this.props.children;
  }
}

function ViewportFallback() {
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-2 border border-hairline bg-canvas"
      data-testid="viewport-fallback"
    >
      <svg viewBox="0 0 160 90" className="h-24 w-40" aria-hidden>
        <line x1="20" y1="70" x2="80" y2="70" stroke="#94A3B8" strokeWidth="3" />
        <line x1="140" y1="70" x2="80" y2="70" stroke="#94A3B8" strokeWidth="3" />
        <line x1="20" y1="70" x2="20" y2="25" stroke="#94A3B8" strokeWidth="3" />
        <line x1="140" y1="70" x2="140" y2="25" stroke="#94A3B8" strokeWidth="3" />
        <line x1="20" y1="25" x2="80" y2="12" stroke="#1D4ED8" strokeWidth="3" />
        <line x1="140" y1="25" x2="80" y2="12" stroke="#1D4ED8" strokeWidth="3" />
        <circle cx="20" cy="70" r="3" fill="#0F172A" />
        <circle cx="140" cy="70" r="3" fill="#0F172A" />
      </svg>
      <p className="text-[12px] text-ink-muted">
        <Trans>Vue 3D indisponible (WebGL) — edition et calculs actifs.</Trans>
      </p>
    </div>
  );
}

const VIEW_PRESETS = [
  ["iso", "3D Iso"],
  ["top-xy", "Dessus XY"],
  ["face-xz", "Face XZ"],
  ["side-yz", "Côté YZ"],
] as const;

export function ViewportCanvas({
  children,
  showLayerToolbar = true,
  pickLatency,
  testId = "viewport-canvas",
  nodes,
}: {
  children: ReactNode;
  showLayerToolbar?: boolean;
  pickLatency?: number;
  testId?: string;
  /** Model nodes for the auto-framed camera (bug 2). */
  nodes?: NodeData[];
}) {
  const cameraPreset = useViewportStore((s) => s.cameraPreset);
  const setCameraPreset = useViewportStore((s) => s.setCameraPreset);
  // Feature-detect BEFORE mounting R3F: its renderer failure escapes this
  // subtree's boundaries (async setError) and tears down the route. The
  // probe mirrors R3F's real construction — a bare getContext() can succeed
  // where the renderer then fails (observed on headless Firefox).
  const webglSupported = useMemo(() => {
    try {
      const probeCanvas = document.createElement("canvas");
      const probe = new THREE.WebGLRenderer({
        canvas: probeCanvas,
        antialias: true,
        powerPreference: "high-performance",
      });
      probe.dispose();
      return true;
    } catch {
      return false;
    }
  }, []);

  if (!webglSupported) {
    return (
      <div className="relative h-full min-h-0 w-full" data-testid={testId}>
        {showLayerToolbar ? <LayerToolbar lastSelectionMs={pickLatency} /> : null}
        <ViewportFallback />
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-0 w-full" data-testid={testId}>
      <ViewportErrorBoundary>
        {showLayerToolbar ? <LayerToolbar lastSelectionMs={pickLatency} /> : null}
        <div className="absolute top-2 right-2 z-10 flex gap-1 rounded-panel border border-hairline bg-panel/90 p-1 backdrop-blur">
          {VIEW_PRESETS.map(([preset, label]) => (
            <button
              key={preset}
              type="button"
              data-testid={`view-${preset}`}
              className={`rounded px-2 py-1 text-[11px] ${cameraPreset === preset ? "bg-accent/15 text-accent" : "text-ink-muted"}`}
              onClick={() => setCameraPreset(preset)}
            >
              {label}
            </button>
          ))}
        </div>
        <Canvas
          dpr={[1, 2]}
          camera={{ position: PRESET_POSITIONS.iso, fov: 45 }}
          gl={{ antialias: true }}
          style={{ background: "var(--color-canvas)" }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.NoToneMapping;
          }}
        >
          <color attach="background" args={["#F8FAFC"]} />
          <ambientLight intensity={0.9} />
          <directionalLight position={[5, -5, 8]} intensity={1.2} />
          <CameraRig preset={cameraPreset} />
          {nodes !== undefined && nodes.length > 0 ? <FitCamera nodes={nodes} /> : null}
          <Grid
            rotation={[Math.PI / 2, 0, 0]}
            cellSize={0.5}
            cellThickness={0.5}
            sectionSize={2}
            sectionThickness={1}
            sectionColor="#94A3B8"
            cellColor="#D1D5DB"
            fadeDistance={30}
            fadeStrength={1}
            infiniteGrid
          />
          {children}
          <OrbitControls makeDefault enableDamping />
          <GizmoHelper alignment="top-right" margin={[72, 72]}>
            <GizmoViewport axisColors={["#DC2626", "#10b981", "#1D4ED8"]} labelColor="#0F172A" />
          </GizmoHelper>
        </Canvas>
      </ViewportErrorBoundary>
    </div>
  );
}
