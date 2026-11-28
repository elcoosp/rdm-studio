import { Canvas, useThree } from "@react-three/fiber";
import { CameraControls, Grid } from "@react-three/drei";
import { OrientationTriad3D, TriadCameraSync, type TriadDomHandles } from "./OrientationTriad3D";
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
  /** v2.4.0: re-aim the orbit pivot at a raycast hit (cursor-anchored orbit). */
  setTarget(
    targetX: number,
    targetY: number,
    targetZ: number,
    transition: boolean,
  ): Promise<boolean>;
  /** Synchronize camera-controls spherical space after changing camera.up to Z-up. */
  updateCameraUp(): void;
}
type CameraControlsImpl = CameraControlsLike;
import { Trans } from "@lingui/react/macro";
import * as THREE from "three";
import { useProjectStore } from "@/state/projectStore";
import { useViewportStore, type CameraPreset } from "@/state/viewportStore";
import { useViewportParams } from "@/hooks/useStudioQuery";
import { LayerToolbar } from "./LayerToolbar";
import { SegmentedControl } from "@rdm-studio/ui/interior";
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
    controls?.updateCameraUp();
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
 * v2.5.1: cursor-anchored orbit pivot on primary orbit drag (left-button
 * without Shift), ignoring infinite grid planes and distant rays so
 * right-button / Shift pan (`truck`) is never hijacked or clamped.
 */
function PivotToCursor({ controlsRef }: { controlsRef: RefObject<CameraControlsImpl | null> }) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const dom = gl.domElement;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const onPointerDown = (event: PointerEvent): void => {
      // Only retarget on left-click orbit without pan modifiers (never on right-click pan).
      if (event.button !== 0 || event.shiftKey || event.ctrlKey || event.metaKey) {
        return;
      }
      const controls = controlsRef.current;
      if (controls === null) {
        return;
      }
      const rect = dom.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(scene.children, true);
      const hit = hits.find(
        (h) =>
          h.point !== undefined &&
          h.distance < 250 &&
          !(h.object instanceof THREE.GridHelper) &&
          h.object.type !== "GridHelper",
      );
      if (hit !== undefined) {
        void controls.setTarget(hit.point.x, hit.point.y, hit.point.z, false);
      }
    };
    dom.addEventListener("pointerdown", onPointerDown);
    return () => {
      dom.removeEventListener("pointerdown", onPointerDown);
    };
  }, [camera, gl, scene, controlsRef]);
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
  deleteMode = false,
}: {
  children: ReactNode;
  showLayerToolbar?: boolean;
  pickLatency?: number;
  testId?: string;
  /** Model nodes for the auto-framed camera (bug 2). */
  nodes?: NodeData[];
  /** Model members for the snap reticle / cursor pill (§8.3/§8.4). */
  beams?: BeamData[];
  /** v2.4.0: two-step beam deletion — crosshair cursor + helper banner. */
  deleteMode?: boolean;
}) {
  // v2.1.0: the camera preset is the URL `?view=` param — a shared link
  // restores the exact 3D viewpoint.
  const { view: cameraPreset, setView: setCameraPreset } = useViewportParams();
  const controlsRef = useRef<CameraControlsImpl | null>(null);
  const triadRef = useRef<TriadDomHandles | null>(null);
  const runtimeRef = useRef<ViewportRuntime | null>(null);
  const [runtimeReady, setRuntimeReady] = useState(0);
  // Stable callback: an inline arrow here re-runs the bridge effect on
  // every render and loops forever (observed as a pegged main thread).
  const handleRuntimeReady = useCallback(() => setRuntimeReady((n) => n + 1), []);

  // Feature-detect BEFORE mounting R3F: its renderer failure escapes this
  // subtree's boundaries (async setError) and tears down the route.
  // v2.1.0: probe a REAL `webgl2` context creation (not the THREE
  // renderer, which only logs and keeps a dead context on headless
  // Firefox — that logged console errors on every route). A null context
  // degrades to the static fallback with zero console noise.
  const webglSupported = useMemo(() => {
    try {
      const probeCanvas = document.createElement("canvas");
      const gl2 = probeCanvas.getContext("webgl2") ?? probeCanvas.getContext("webgl");
      if (gl2 === null || typeof gl2.getParameter(gl2.VERSION) !== "string") {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  const modelNodes = nodes ?? [];
  const modelBeams = beams ?? [];
  useViewportShortcuts(modelNodes, controlsRef, runtimeRef, setCameraPreset);

  // v2.1.2: camera presets as an interior.dev SegmentedControl — the
  // shared spring pill glides between Iso | XY | XZ | YZ (zero layout
  // jump), contract test ids view-* preserved on each option button.
  const viewPresets = (
    <div className="absolute top-2 right-2 z-30 shadow-xs">
      <SegmentedControl
        size="sm"
        label="Vue caméra"
        value={cameraPreset}
        onValueChange={(next) => setCameraPreset(next as CameraPreset)}
        options={VIEW_PRESETS.map(([preset, label, hint]) => ({
          value: preset,
          label: (
            <span className="relative inline-flex items-center">
              {label}
              <KeycapHint label={hint} />
            </span>
          ),
          testId: `view-${preset}`,
        }))}
      />
    </div>
  );

  if (!webglSupported) {
    return (
      <div className="relative h-full min-h-0 w-full" data-testid={testId}>
        {showLayerToolbar ? <LayerToolbar lastSelectionMs={pickLatency} /> : null}
        {viewPresets}
        <ViewportFallback />
      </div>
    );
  }

  return (
    <div
      className={`relative h-full min-h-0 w-full ${deleteMode ? "cursor-crosshair" : ""}`}
      data-testid={testId}
    >
      <ViewportErrorBoundary>
        {showLayerToolbar ? <LayerToolbar lastSelectionMs={pickLatency} /> : null}
        {/* v1.6.0: compact `Iso | XY | XZ | YZ` presets, z-30 so they stay
            above the persistent stage overlay (fixed z-10) at 860 px with
            ≥ 24 px separation from the left toolbar. */}
        {viewPresets}
        {/* v2.4.0: discreet deletion-mode banner (top-centre). */}
        {deleteMode ? (
          <div
            className="pointer-events-none absolute left-1/2 top-2 z-30 -translate-x-1/2 rounded-[4px] border border-fea-max bg-fea-max/10 px-2.5 py-1 font-data text-[11px] font-medium text-fea-max backdrop-blur"
            data-testid="delete-beam-banner"
          >
            <Trans>Cliquez une poutre pour la supprimer — Échap pour quitter</Trans>
          </div>
        ) : null}
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
            controlsRef.current?.updateCameraUp();
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
          {/* Critically damped orbit/zoom/pan (§8.2, smoothTime 0.25).
              v2.4.0: polar + azimuth fully unlocked (no gimbal clamp) and
              dolly-to-cursor so the zoom homes on the pointer. */}
          <CameraControls
            ref={controlsRef as never}
            makeDefault
            smoothTime={0.25}
            draggingSmoothTime={0.25}
            minPolarAngle={0}
            maxPolarAngle={Math.PI}
            minAzimuthAngle={-Infinity}
            maxAzimuthAngle={Infinity}
            dollyToCursor
          />
          {/* v2.4.0: cursor-anchored orbit pivot (right-click / wheel). */}
          <PivotToCursor controlsRef={controlsRef} />
          {/* v1.3.0 defect 5: bottom-right so the top-right view-preset
              bar (3D Iso | Dessus XY | Face XZ | Côté YZ) stays clear. */}
          {/* v2.4.0: 72px margins keep the gizmo clear of the bottom-right
              status bar and the left-side legends (fea/profile). */}
          <TriadCameraSync triadRef={triadRef} />
        </Canvas>
        <OrientationTriad3D
          nodes={modelNodes}
          controlsRef={controlsRef}
          runtimeRef={runtimeRef}
          triadRef={triadRef}
        />
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
