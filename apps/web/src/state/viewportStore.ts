import { create } from "zustand";

/**
 * Viewport UI state (ARCHITECTURE.md section 5, `viewport3d/`): layer
 * visibility, render mode and camera preset. Kept separate from the model
 * store so 60 FPS picking never re-renders the project tree.
 */
export type CameraPreset = "iso" | "top-xy" | "face-xz" | "side-yz";

export type RenderMode = "volumetric" | "wireframe";

interface ViewportState {
  /** Active 3D tool mode (v1.4.0 hotkeys share it with Step 1). */
  toolMode: "select" | "node" | "beam";
  setToolMode: (mode: "select" | "node" | "beam") => void;
  /** True while the WebGL canvas is mounted (gates `f` / `i` hotkeys). */
  viewportMounted: boolean;
  setViewportMounted: (mounted: boolean) => void;
  layers: {
    nodes: boolean;
    beams: boolean;
    loads: boolean;
    supports: boolean;
    deformed: boolean;
    /** v1.6.0 metrology: N1..Nn / `P1 · IPE 200` screen-space badges. */
    labels: boolean;
    /** v1.6.0 metrology: metric span dimension lines (`4,00 m`). */
    dims: boolean;
    /** v1.6.0 metrology: support reactions & deflection callouts. */
    reactions: boolean;
  };
  renderMode: RenderMode;
  cameraPreset: CameraPreset;
  snapStep: 0.01 | 0.05 | 0.1;
  /** v1.6.0: cutting-plane sync driven by the Step 4 docked inspector. */
  cutting: { beamId: number; ratio: number } | null;
  setCutting: (cutting: { beamId: number; ratio: number } | null) => void;
  toggleLayer: (layer: keyof ViewportState["layers"]) => void;
  setRenderMode: (mode: RenderMode) => void;
  setCameraPreset: (preset: CameraPreset) => void;
  setSnapStep: (step: ViewportState["snapStep"]) => void;
}

export const useViewportStore = create<ViewportState>()((set) => ({
  toolMode: "select",
  setToolMode: (mode) => set({ toolMode: mode }),
  viewportMounted: false,
  setViewportMounted: (mounted) => set({ viewportMounted: mounted }),
  layers: {
    nodes: true,
    beams: true,
    loads: true,
    supports: true,
    deformed: false,
    labels: true,
    dims: false,
    reactions: false,
  },
  renderMode: "volumetric",
  cameraPreset: "iso",
  snapStep: 0.05,
  cutting: null,
  setCutting: (cutting) => set({ cutting }),
  toggleLayer: (layer) => set((st) => ({ layers: { ...st.layers, [layer]: !st.layers[layer] } })),
  setRenderMode: (renderMode) => set({ renderMode }),
  setCameraPreset: (cameraPreset) => set({ cameraPreset }),
  setSnapStep: (snapStep) => set({ snapStep }),
}));
