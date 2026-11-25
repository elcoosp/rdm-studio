import { useEffect, useRef, type ReactNode } from "react";
import { create } from "zustand";

/**
 * Persistent 3D stage coordination (v1.6.0, `PersistentStage.tsx`): ONE
 * WebGL canvas lives in `__root.tsx` for Steps 1–4 and NEVER remounts on
 * navigation, so the orbit/zoom/pan camera state is preserved across
 * steps. Routes register
 *
 * - a **slot** — the bordered viewport pane they lay out (the stage is
 *   glued over it every frame, so the pane keeps owning the page layout,
 *   scroll and rounded borders), and
 * - **content** — the route-specific 3D layers (`BeamMeshes`, markers,
 *   loads, cutting plane) which render inside the persistent canvas.
 *
 * Both are registered through stable callbacks reading the latest values
 * from refs, so route re-renders never touch the canvas React tree.
 */
/** Per-route render inputs for the shared beam geometry (v1.6.0). */
export interface StageRenderOptions {
  /** Thermal ratios per beam id (results route). */
  colorRatios?: Map<number, number>;
  /** Nodal displacement vector for the deformed shape (results route). */
  displacements?: number[] | Float64Array;
  /** Deformation exaggeration factor. */
  deformScale?: number;
  /** Wireframe rendering (LayerToolbar). */
  wireframe?: boolean;
  /** Selected member (cobalt rim). */
  selectedBeamId?: number | null;
  /** Table-hovered member (soft cobalt rim). */
  hoveredBeamId?: number | null;
}

interface StageState {
  /** DOM pane the stage must cover (null = hide, e.g. Step 5). */
  slotEl: HTMLElement | null;
  /** Route key owning the current slot (drives visibility). */
  slotKey: string | null;
  /** Latest route-specific 3D layer stack getter. */
  contentGetter: (() => ReactNode) | null;
  /** Route key of the registered content. */
  contentKey: string | null;
  /** Latest per-route render options getter. */
  optionsGetter: (() => StageRenderOptions) | null;
  /** `toDataURL` bridge exposed by the canvas (Step 5 PNG snapshot). */
  capture: (() => string | null) | null;
  setSlot: (key: string | null, el: HTMLElement | null) => void;
  setContent: (key: string, getter: () => ReactNode) => void;
  setOptions: (key: string, getter: () => StageRenderOptions) => void;
  clearContent: (key: string) => void;
  setCapture: (capture: (() => string | null) | null) => void;
}

export const useStageStore = create<StageState>()((set, get) => ({
  slotEl: null,
  slotKey: null,
  contentGetter: null,
  contentKey: null,
  optionsGetter: null,
  capture: null,
  setSlot: (key, el) => set({ slotKey: key, slotEl: el }),
  setContent: (key, getter) => {
    if (get().contentKey === key) {
      set({ contentGetter: getter });
    } else {
      set({ contentKey: key, contentGetter: getter });
    }
  },
  setOptions: (key, getter) => set({ optionsGetter: getter }),
  clearContent: (key) => {
    if (get().contentKey === key) {
      set({ contentKey: null, contentGetter: null });
    }
  },
  setCapture: (capture) => set({ capture }),
}));

/**
 * Registers a DOM element as the persistent stage slot for one route.
 * The stage overlays the returned ref element with the live WebGL canvas.
 */
export function useStageSlot(key: string): (el: HTMLElement | null) => void {
  return (el: HTMLElement | null) => {
    useStageStore.getState().setSlot(el === null ? null : key, el);
  };
}

/**
 * Declares the route-specific 3D layer stack + render inputs rendered
 * inside the persistent canvas. Both are captured in refs the effect
 * dereferences on registration; the effect runs after EVERY route render
 * (no dep array) so the stage always shows the freshest layer stack
 * without remounting the canvas.
 */
export function StageContent({
  k,
  options,
  children,
}: {
  k: string;
  options?: StageRenderOptions;
  children: ReactNode;
}): null {
  const latest = useRef<ReactNode>(children);
  latest.current = children;
  const latestOptions = useRef<StageRenderOptions | undefined>(options);
  latestOptions.current = options;
  const key = useRef(k);
  key.current = k;
  useEffect(() => {
    const store = useStageStore.getState();
    store.setContent(key.current, () => latest.current);
    if (latestOptions.current !== undefined) {
      store.setOptions(key.current, () => latestOptions.current ?? {});
    }
    return () => {
      useStageStore.getState().clearContent(key.current);
    };
  });
  return null;
}

/**
 * Grabs a PNG snapshot of the persistent 3D stage (Step 5 A4 sheet &
 * Takumi PDF embed). Returns null when the canvas has never mounted.
 */
export function captureViewportPng(): string | null {
  const capture = useStageStore.getState().capture;
  return capture === null ? null : capture();
}
