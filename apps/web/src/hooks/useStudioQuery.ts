import { useCallback, type MouseEvent } from "react";
import { useMatches, useNavigate, useRouterState, useSearch } from "@tanstack/react-router";
import {
  parseLayers,
  serializeLayers,
  snapStepFromUrl,
  snapStepToUrl,
  type LayerKey,
  type StudioBaseSearch,
} from "@/schemas/searchParams.schema";

/**
 * useStudioQuery (v2.1.0 URL-first refactor): ZERO-DUPLICATE hooks over the
 * URL search. Components read directly from TanStack Router `useSearch`
 * and update via `navigate({ search: (prev) => ({ ...prev, ... }), replace:
 * true })` — nothing is mirrored in Zustand stores or component useState.
 *
 * All read hooks use `from: "/_studio"` with `strict: false`, so they work
 * inside the pathless `_studio` layout AND its children, and return
 * `undefined` outside the studio (marketing pages).
 */

function useStudioSearch(): Partial<StudioBaseSearch> {
  return useSearch({ strict: false }) as Partial<StudioBaseSearch>;
}

/**
 * Writes a patch of the studio search onto the CURRENT path with
 * `replace: true` (no history spam while picking/scrubbing). The typed
 * reducer of `navigate` cannot resolve against a runtime pathname, so the
 * updater is cast — the URL contract itself is covered by the Valibot
 * schemas + the E2E suite.
 */
export function useUpdateSearch(): (
  update: (prev: Record<string, unknown>) => Record<string, unknown>,
) => void {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return useCallback(
    (update) => {
      void navigate({
        to: pathname,
        search: update as never,
        replace: true,
      });
    },
    [navigate, pathname],
  );
}

/**
 * useSelectedIds — the single URL-driven selection (`?beam=` / `?node=`).
 * Returns the current ids plus pick handlers that write the URL with
 * `replace: true`.
 */
export function useSelectedIds(): {
  beamId: number | null;
  nodeId: number | null;
  selectBeam: (id: number | null, event?: MouseEvent) => void;
  selectNode: (id: number | null) => void;
  clearSelection: () => void;
} {
  const search = useStudioSearch();
  const updateSearch = useUpdateSearch();
  const beamId = typeof search.beam === "number" ? search.beam : null;
  const nodeId = typeof search.node === "number" ? search.node : null;
  // NOTE: clears keep the key PRESENT with an explicit `undefined` value —
  // `retainSearchParams` only re-injects keys ABSENT from the next search.
  const selectBeam = useCallback(
    (id: number | null) => {
      updateSearch((prev) => ({ ...prev, beam: id ?? undefined }));
    },
    [updateSearch],
  );
  const selectNode = useCallback(
    (id: number | null) => {
      updateSearch((prev) => ({ ...prev, node: id ?? undefined }));
    },
    [updateSearch],
  );
  const clearSelection = useCallback(() => {
    updateSearch((prev) => ({ ...prev, beam: undefined, node: undefined }));
  }, [updateSearch]);
  return { beamId, nodeId, selectBeam, selectNode, clearSelection };
}

/**
 * useViewportParams — camera preset, render mode, snap grid, layer flags
 * and the cutting plane, ALL backed by the URL (`view`, `render`, `snap`,
 * `layers`, `cutBeam`, `cut`). Setters are stable `replace: true`
 * navigations so the browser history stays clean while orbiting/scrubbing.
 */
export function useViewportParams(): {
  view: "iso" | "top-xy" | "face-xz" | "side-yz";
  render: "volumetric" | "wireframe";
  snapStep: 0.01 | 0.05 | 0.1;
  layers: Record<LayerKey, boolean>;
  cutting: { beamId: number; ratio: number } | null;
  setView: (view: "iso" | "top-xy" | "face-xz" | "side-yz") => void;
  setRender: (render: "volumetric" | "wireframe") => void;
  setSnapStep: (step: 0.01 | 0.05 | 0.1) => void;
  toggleLayer: (layer: LayerKey) => void;
  setCutting: (cutting: { beamId: number; ratio: number } | null) => void;
} {
  const search = useStudioSearch();
  const updateSearch = useUpdateSearch();
  const patch = useCallback(
    (update: Partial<StudioBaseSearch>) => {
      updateSearch((prev) => ({ ...prev, ...update }) as Record<string, unknown>);
    },
    [updateSearch],
  );
  const layers = parseLayers(search.layers);
  const cutBeam = typeof search.cutBeam === "number" ? search.cutBeam : null;
  const cut = typeof search.cut === "number" ? search.cut : null;
  return {
    view: search.view ?? "iso",
    render: search.render ?? "volumetric",
    snapStep: snapStepFromUrl(search.snap),
    layers,
    cutting: cutBeam !== null && cut !== null ? { beamId: cutBeam, ratio: cut } : null,
    setView: (view) => patch({ view }),
    setRender: (render) => patch({ render }),
    setSnapStep: (step) => patch({ snap: snapStepToUrl(step) }),
    toggleLayer: (layer) => {
      const next: Record<LayerKey, boolean> = { ...layers };
      next[layer] = !next[layer];
      patch({ layers: serializeLayers(next) });
    },
    setCutting: (cutting) => {
      patch({
        cutBeam: cutting === null ? undefined : cutting.beamId,
        cut: cutting === null ? undefined : cutting.ratio,
      });
    },
  };
}

/**
 * True when the current leaf route belongs to the locked `_studio`
 * workstation (guards selection writes from globally-hosted components).
 */
export function useIsStudio(): boolean {
  const matches = useMatches();
  return matches.at(-1)?.staticData.surface === "studio";
}
