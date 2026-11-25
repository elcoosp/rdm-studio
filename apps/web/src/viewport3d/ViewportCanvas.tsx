import { Canvas, useThree } from "@react-three/fiber";
import { GizmoViewport, Grid, OrbitControls } from "@react-three/drei";
import { useEffect, type ReactNode } from "react";
import * as THREE from "three";
import { useViewportStore, type CameraPreset } from "@/state/viewportStore";
import { LayerToolbar } from "./LayerToolbar";

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
}: {
  children: ReactNode;
  showLayerToolbar?: boolean;
  pickLatency?: number;
  testId?: string;
}) {
  const cameraPreset = useViewportStore((s) => s.cameraPreset);
  const setCameraPreset = useViewportStore((s) => s.setCameraPreset);

  return (
    <div className="relative h-full min-h-0 w-full" data-testid={testId}>
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
        <color attach="background" args={["#F9FAFB"]} />
        <ambientLight intensity={0.9} />
        <directionalLight position={[5, -5, 8]} intensity={1.2} />
        <CameraRig preset={cameraPreset} />
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
        <GizmoViewport axisColors={["#EF4444", "#10B981", "#2563EB"]} labelColor="#111827" />
      </Canvas>
    </div>
  );
}
