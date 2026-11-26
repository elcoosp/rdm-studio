import { create } from "zustand";

/**
 * Viewport UI state (ARCHITECTURE.md section 5, `viewport3d/`) — v2.1.0
 * URL-first refactor: every URL-backed field (`renderMode`, `cameraPreset`,
 * `snapStep`, `layers`, `cutting`) moved to the TanStack Router search via
 * `useStudioQuery` (the URL is the single source of truth). This store now
 * holds ONLY the two transient fields that must never enter the URL.
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
}

export const useViewportStore = create<ViewportState>()((set) => ({
  toolMode: "select",
  setToolMode: (mode) => set({ toolMode: mode }),
  viewportMounted: false,
  setViewportMounted: (mounted) => set({ viewportMounted: mounted }),
}));
