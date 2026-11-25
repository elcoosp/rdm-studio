import { create } from "zustand";

/**
 * Viewport UI state (ARCHITECTURE.md section 5, `viewport3d/`): layer
 * visibility, render mode and camera preset. Kept separate from the model
 * store so 60 FPS picking never re-renders the project tree.
 */
export type CameraPreset = "iso" | "top-xy" | "face-xz" | "side-yz";

export type RenderMode = "volumetric" | "wireframe";

interface ViewportState {
  layers: {
    nodes: boolean;
    beams: boolean;
    loads: boolean;
    supports: boolean;
    deformed: boolean;
  };
  renderMode: RenderMode;
  cameraPreset: CameraPreset;
  snapStep: 0.01 | 0.05 | 0.1;
  toggleLayer: (layer: keyof ViewportState["layers"]) => void;
  setRenderMode: (mode: RenderMode) => void;
  setCameraPreset: (preset: CameraPreset) => void;
  setSnapStep: (step: ViewportState["snapStep"]) => void;
}

export const useViewportStore = create<ViewportState>()((set) => ({
  layers: { nodes: true, beams: true, loads: true, supports: true, deformed: false },
  renderMode: "volumetric",
  cameraPreset: "iso",
  snapStep: 0.05,
  toggleLayer: (layer) => set((st) => ({ layers: { ...st.layers, [layer]: !st.layers[layer] } })),
  setRenderMode: (renderMode) => set({ renderMode }),
  setCameraPreset: (cameraPreset) => set({ cameraPreset }),
  setSnapStep: (snapStep) => set({ snapStep }),
}));
