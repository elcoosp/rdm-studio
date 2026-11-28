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
  /**
   * v2.4.0: two-step beam deletion mode — when true, clicking a member in
   * the 3D viewport removes it (staying in the mode for chained deletes)
   * until Escape or the toolbar toggle is pressed again.
   */
  deleteBeamMode: boolean;
  setDeleteBeamMode: (active: boolean) => void;
  toggleDeleteBeamMode: () => void;
  /**
   * M9.1 Auto-Split on Draw: when true (default), completing a drawn beam
   * whose endpoints land strictly inside an existing host beam cuts the
   * host at the landing point so the member connects cleanly.
   */
  autoSplitOnDraw: boolean;
  setAutoSplitOnDraw: (active: boolean) => void;
  /**
   * M9.4 CAD ghost preview: the armed start node id plus the live snapped
   * cursor point while the beam tool draws (null when idle).
   */
  drawGhost: {
    startNodeId: number;
    cursor: { x: number; y: number; z: number };
    /** True when the cursor is axis-aligned with the start node (X/Y/Z). */
    axisLock: "X" | "Y" | "Z" | null;
  } | null;
  setDrawGhost: (
    ghost: {
      startNodeId: number;
      cursor: { x: number; y: number; z: number };
      axisLock: "X" | "Y" | "Z" | null;
    } | null,
  ) => void;
}

export const useViewportStore = create<ViewportState>()((set) => ({
  toolMode: "select",
  setToolMode: (mode) => set({ toolMode: mode }),
  viewportMounted: false,
  setViewportMounted: (mounted) => set({ viewportMounted: mounted }),
  deleteBeamMode: false,
  setDeleteBeamMode: (active) => set({ deleteBeamMode: active }),
  toggleDeleteBeamMode: () => set((s) => ({ deleteBeamMode: !s.deleteBeamMode })),
  autoSplitOnDraw: true,
  setAutoSplitOnDraw: (active) => set({ autoSplitOnDraw: active }),
  drawGhost: null,
  setDrawGhost: (ghost) => set({ drawGhost: ghost }),
}));
