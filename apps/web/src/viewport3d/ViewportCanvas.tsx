import { Canvas, useThree } from "@react-three/fiber";
import { CameraControls, GizmoHelper, GizmoViewport, Grid } from "@react-three/drei";
import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

/** Minimal glide surface we need from drei's CameraControls ref. */
interface CameraControlsLike {
  setLookAt(
    posX: number,
    posY: number,
    posZ: number,
    targetX: number,
    targetY: number,
    targetZ: number,
    transition: boolean,
  ): Promise<boolean>;
}
type CameraControlsImpl = CameraControlsLike;
import { Trans } from "@lingui/react/macro";
import * as THREE from "three";
import { useProjectStore } from "@/state/projectStore";
import { useViewportStore, type CameraPreset } from "@/state/viewportStore";
import { LayerToolbar } from "./LayerToolbar";
import { modelBounds } from "./ProfileShapes";
import { SnapOverlay, type ViewportRuntime } from "./SnapOverlay";
import { KeycapHint } from "@/components/KeycapHints";
import type { BeamData, NodeData } from "@/state/projectStore";

/**
 * Three.js / R3F scene chrome (ARCHITECTURE.md section 5, `ViewportCanvas.tsx`):
 * Z-up metric scene, infinite metric floor grid, XYZ gizmo (top-right),
 * critically damped `CameraControls` glides (§8.2, smoothTime 0.25) for the
 * view presets and `F` (zoom extents) / `I` (iso) shortcuts, snap reticle
 * + hover cursor pill overlay (§8.3/§8.4), floating layer toolbar.
 */

/** Preset camera positions (Z-up): iso, top (Dessus XY), face XZ, side YZ. */
const PRESET_POSITIONS: Record<CameraPreset, [number, number, number]> = {
  iso: [6, -6, 4.5],
  "top-xy": [0, -0.001, 8],
  "face-xz": [0, 8, 0.001],
  "side-yz": [8, 0.001, 0],
};

/** In-Canvas bridge exposing camera + canvas to the DOM snap overlay. */
function RuntimeBridge({
  runtimeRef,
  onReady,
}: {
  runtimeRef: RefObject<ViewportRuntime | null>;
  onReady: () => void;
}) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  useEffect(() => {
    runtimeRef.current = {
      camera,
      dom: gl.domElement,
      width: size.width,
      height: size.height,
    };
    onReady();
  }, [camera, gl, size, runtimeRef, onReady]);
  // v1.4.0: overlay listeners re-bind on init/resize via this counter.
  const [, setRuntimeReady] = useState(0);
  useEffect(() => {
    setRuntimeReady((n) => n + 1);
  }, [camera, gl, size]);
  return null;
}

/**
 * Critically damped preset glides (§8.2): `setLookAt` animates over the
 * CameraControls smoothTime (0.25 s) instead of hard-jumping the camera.
 */
function CameraRig({
  preset,
  controlsRef,
}: {
  preset: CameraPreset;
  controlsRef: RefObject<CameraControlsImpl | null>;
}) {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const controls = controlsRef.current;
    if (controls === null) {
      // Fallback until the controls mount (first frame).
      const [x, y, z] = PRESET_POSITIONS[preset];
      camera.position.set(x, y, z);
      camera.up.set(0, 0, 1);
      camera.lookAt(0, 0, 0.5);
      return;
    }
    const [x, y, z] = PRESET_POSITIONS[preset];
    void controls.setLookAt(x, y, z, 0, 0, 0.5, true);
    invalidate();
  }, [camera, invalidate, preset, controlsRef]);
  return null;
}

/**
 * Zoom-extents glide to the model bounding box on mount and whenever the
 * model identity changes (bug 2 + §8.2 `F` shortcut share this path).
 */
function fitToModel(
  nodes: NodeData[],
  controlsRef: RefObject<CameraControlsImpl | null>,
  camera: THREE.Camera,
): void {
  if (nodes.length === 0) {
    return;
  }
  const { center, radius } = modelBounds(nodes);
  const distance = Math.max(radius * 2.6, 1);
  const controls = controlsRef.current;
  if (controls !== null) {
    void controls.setLookAt(
      center[0] + distance * 0.62,
      center[1] - distance * 0.62,
      center[2] + distance * 0.48,
      center[0],
      center[1],
      center[2],
      true,
    );
    return;
  }
  camera.position.set(
    center[0] + distance * 0.62,
    center[1] - distance * 0.62,
    center[2] + distance * 0.48,
  );
  camera.up.set(0, 0, 1);
  camera.lookAt(center[0], center[1], center[2]);
}

function FitCamera({
  nodes,
  controlsRef,
}: {
  nodes: NodeData[];
  controlsRef: RefObject<CameraControlsImpl | null>;
}) {
  const camera = useThree((s) => s.camera);
  // v1.4.0 defect 8: frame the model on mount and on project/template
  // identity changes ONLY — never on every node/beam edit.
  const projectName = useProjectStore((s) => s.project.name);
  const firstFrame = useRef(false);
  useEffect(() => {
    if (!firstFrame.current) {
      firstFrame.current = true;
      fitToModel(nodes, controlsRef, camera);
    }
  }, [camera, controlsRef, nodes]);
  useEffect(() => {
    fitToModel(nodes, controlsRef, camera);
  }, [projectName, camera, controlsRef]);
  return null;
}

/**
 * `F` zoom-extents / `I` iso keyboard shortcuts (§8.2). Lives OUTSIDE the
 * Canvas (no R3F hooks) — the camera arrives via the runtime ref bridge.
 */
function useViewportShortcuts(
  nodes: NodeData[],
  controlsRef: RefObject<CameraControlsImpl | null>,
  runtimeRef: RefObject<ViewportRuntime | null>,
  setCameraPreset: (p: CameraPreset) => void,
): void {
  useEffect(() => {
    // v1.4.0: camera shortcuts arrive from the centralized hotkeys layer.
    const onFit = () => {
      const camera = runtimeRef.current?.camera;
      if (camera !== undefined) {
        fitToModel(nodes, controlsRef, camera);
      }
    };
    const onIso = () => setCameraPreset("iso");
    window.addEventListener("rdm-camera-fit", onFit);
    window.addEventListener("rdm-camera-iso", onIso);
    return () => {
      window.removeEventListener("rdm-camera-fit", onFit);
      window.removeEventListener("rdm-camera-iso", onIso);
    };
  }, [nodes, controlsRef, runtimeRef, setCameraPreset]);

  // v1.4.0: gate the f / i hotkeys while the canvas is alive.
  useEffect(() => {
    setViewportMounted(true);
    return () => setViewportMounted(false);
  }, [setViewportMounted]);
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
        <Trans>Vue 3D indisponible (WebGL) — édition et calculs actifs.</Trans>
      </p>
    </div>
  );
}

const VIEW_PRESETS = [
  ["iso", "Iso", "I"],
  ["top-xy", "XY", "X"],
  ["face-xz", "XZ", "Y"],
  ["side-yz", "YZ", "Z"],
] as const;

const setViewportMounted = (mounted: boolean) =>
  useViewportStore.getState().setViewportMounted(mounted);

export function ViewportCanvas({
  children,
  showLayerToolbar = true,
  pickLatency,
  testId = "viewport-canvas",
  nodes,
  beams,
}: {
  children: ReactNode;
  showLayerToolbar?: boolean;
  pickLatency?: number;
  testId?: string;
  /** Model nodes for the auto-framed camera (bug 2). */
  nodes?: NodeData[];
  /** Model members for the snap reticle / cursor pill (§8.3/§8.4). */
  beams?: BeamData[];
}) {
  const cameraPreset = useViewportStore((s) => s.cameraPreset);
  const setCameraPreset = useViewportStore((s) => s.setCameraPreset);
  const controlsRef = useRef<CameraControlsImpl | null>(null);
  const runtimeRef = useRef<ViewportRuntime | null>(null);
  const [runtimeReady, setRuntimeReady] = useState(0);
  // Stable callback: an inline arrow here re-runs the bridge effect on
  // every render and loops forever (observed as a pegged main thread).
  const handleRuntimeReady = useCallback(() => setRuntimeReady((n) => n + 1), []);

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

  const modelNodes = nodes ?? [];
  const modelBeams = beams ?? [];
  useViewportShortcuts(modelNodes, controlsRef, runtimeRef, setCameraPreset);

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
        {/* v1.6.0: compact `Iso | XY | XZ | YZ` presets, z-30 so they stay
            above the persistent stage overlay (fixed z-10) at 860 px with
            ≥ 24 px separation from the left toolbar. */}
        <div className="absolute top-2 right-2 z-30 flex gap-1 rounded-panel border border-hairline bg-panel/90 p-1 backdrop-blur">
          {VIEW_PRESETS.map(([preset, label, hint]) => (
            <button
              key={preset}
              type="button"
              data-testid={`view-${preset}`}
              className={`relative rounded px-2 py-1 text-[11px] ${cameraPreset === preset ? "bg-accent/15 text-accent" : "text-ink-muted"}`}
              onClick={() => setCameraPreset(preset)}
            >
              {label}
              <KeycapHint label={hint} />
            </button>
          ))}
        </div>
        <Canvas
          dpr={[1, 2]}
          camera={{ position: PRESET_POSITIONS.iso, fov: 45 }}
          // v1.6.0: preserveDrawingBuffer keeps the depth/color buffer alive
          // so `captureViewportPng()` can embed a live 3D snapshot into the
          // Step 5 A4 sheet & Takumi PDF.
          gl={{ antialias: true, preserveDrawingBuffer: true }}
          style={{ background: "var(--color-canvas)" }}
          onCreated={({ gl, camera }) => {
            gl.toneMapping = THREE.NoToneMapping;
            camera.up.set(0, 0, 1);
          }}
        >
          <color attach="background" args={["#F8FAFC"]} />
          <ambientLight intensity={0.9} />
          <directionalLight position={[5, -5, 8]} intensity={1.2} />
          <CameraRig preset={cameraPreset} controlsRef={controlsRef} />
          {nodes !== undefined && nodes.length > 0 ? (
            <FitCamera nodes={modelNodes} controlsRef={controlsRef} />
          ) : null}
          <RuntimeBridge runtimeRef={runtimeRef} onReady={handleRuntimeReady} />
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
          {/* Critically damped orbit/zoom/pan (§8.2, smoothTime 0.25). */}
          <CameraControls
            ref={controlsRef as never}
            makeDefault
            smoothTime={0.25}
            draggingSmoothTime={0.25}
          />
          {/* v1.3.0 defect 5: bottom-right so the top-right view-preset
              bar (3D Iso | Dessus XY | Face XZ | Côté YZ) stays clear. */}
          {/* v2.0.2: anchored cleanly in the bottom-right corner (44px
              margins) with a compact 0.75 scale — it no longer floats
              over the viewport centre or overlaps the legend. */}
          <GizmoHelper alignment="bottom-right" margin={[44, 44]}>
            <GizmoViewport
              scale={0.75}
              axisColors={["#DC2626", "#10b981", "#1D4ED8"]}
              labelColor="#0F172A"
            />
          </GizmoHelper>
        </Canvas>
        {/* Snap reticle + cursor pill (DOM overlay, §8.3/§8.4). */}
        {nodes !== undefined && beams !== undefined ? (
          <SnapOverlay
            nodes={modelNodes}
            beams={modelBeams}
            runtimeRef={runtimeRef}
            runtimeReady={runtimeReady}
          />
        ) : null}
      </ViewportErrorBoundary>
      {/* runtimeReady only forces the overlay to re-attach. */}
      <span hidden data-runtime-ready={runtimeReady} />
    </div>
  );
}
