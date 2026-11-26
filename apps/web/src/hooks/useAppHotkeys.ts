import { useEffect } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useHotkeys } from "react-hotkeys-hook";
import { toast } from "sonner";
import { redoModel, undoModel, useProjectStore } from "@/state/projectStore";
import { useViewportStore } from "@/state/viewportStore";
import { useIsStudio, useSelectedIds } from "@/hooks/useStudioQuery";

/**
 * Centralized keyboard layer (v1.4.0, react-hotkeys-hook): every
 * production shortcut lives here — no ad-hoc `keydown` listeners in
 * components. `mod` maps to ⌘ on macOS and Ctrl elsewhere; form fields
 * never swallow model shortcuts (`enableOnFormTags: false`).
 *
 * v2.1.0: `⌘Enter` / `⌘P` navigate with `search: true` so the active
 * URL state (`beam`, `view`, `snap`, `layers`, `combo`, …) survives the
 * step switch — the URL is the single source of truth.
 */
export function useAppHotkeys(onTogglePalette: () => void): void {
  const navigate = useNavigate();
  const pathname = useLocation().pathname;
  const setToolMode = useViewportStore((s) => s.setToolMode);
  const viewportMounted = useViewportStore((s) => s.viewportMounted);
  const { beamId, nodeId, selectBeam, selectNode, clearSelection } = useSelectedIds();
  const isStudio = useIsStudio();

  // ⌘K — command palette.
  useHotkeys(
    "mod+k",
    (event) => {
      event.preventDefault();
      onTogglePalette();
    },
    { enableOnFormTags: false, preventDefault: true },
  );

  // ⌘Z / ⇧⌘Z — model undo/redo (zundo temporal).
  useHotkeys("mod+z", (event) => {
    event.preventDefault();
    undoModel();
  });
  useHotkeys("mod+shift+z", (event) => {
    event.preventDefault();
    redoModel();
  });

  // ⌘Enter — run the calculation and jump to Step 4 (search preserved).
  useHotkeys(
    "mod+enter",
    (event) => {
      event.preventDefault();
      void navigate({ to: "/results", search: true });
    },
    { enableOnFormTags: false },
  );

  // ⌘P — Step 5 print/PDF sheet (search preserved).
  useHotkeys(
    "mod+p",
    (event) => {
      event.preventDefault();
      void navigate({ to: "/report", search: true });
    },
    { enableOnFormTags: false },
  );

  // v2.1.1: 1–5 — jump straight to a workflow step (search preserved).
  useHotkeys(
    "1,2,3,4,5",
    (event) => {
      if (!isStudio) {
        return;
      }
      event.preventDefault();
      const paths: Record<string, string> = {
        "1": "/geometry",
        "2": "/supports",
        "3": "/loads",
        "4": "/results",
        "5": "/report",
      };
      const to = paths[event.key];
      if (to !== undefined) {
        void navigate({ to, search: true });
      }
    },
    { enableOnFormTags: false, preventDefault: true },
  );

  // v2.1.1: / — back to the commercial landing (studio only).
  useHotkeys(
    "/",
    (event) => {
      if (!isStudio) {
        return;
      }
      event.preventDefault();
      void navigate({ to: "/" });
    },
    { enableOnFormTags: false, preventDefault: true },
  );

  // Step 1 tool modes: V selection, N node, B linking, Esc clears.
  useHotkeys(
    "v",
    () => {
      if (pathname === "/geometry") setToolMode("select");
    },
    { enableOnFormTags: false },
  );
  useHotkeys(
    "n",
    () => {
      if (pathname === "/geometry") setToolMode("node");
    },
    { enableOnFormTags: false },
  );
  useHotkeys(
    "b",
    () => {
      if (pathname === "/geometry") setToolMode("beam");
    },
    { enableOnFormTags: false },
  );
  // Escape clears the selection (v2.1.1: through the URL, dialog-aware).
  // A dedicated keydown listener lives in this centralized layer —
  // react-hotkeys-hook v5 does not deliver bare Escape reliably in
  // headless runs. When NO dialog is open it also blurs the focused
  // table row first: a focused <tr> keeps the key events captured and
  // the URL write from clearSelection could otherwise be swallowed by
  // the table's own keyboard handling on Firefox.
  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !window.location.pathname.startsWith("/geometry")) {
        return;
      }
      event.preventDefault();
      if (document.querySelector('[role="dialog"]') === null) {
        const active = document.activeElement;
        if (active instanceof HTMLElement && active !== document.body) {
          active.blur();
        }
      }
      useProjectStore.getState().clearBeamSelection();
      clearSelection();
      setToolMode("select");
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [clearSelection, setToolMode]);

  // ⇧⌘I — invert the multi-beam selection (Step 1 batch inspector).
  useHotkeys(
    "shift+mod+i",
    (event) => {
      if (pathname === "/geometry") {
        event.preventDefault();
        useProjectStore.getState().invertBeamSelection();
      }
    },
    { enableOnFormTags: false, preventDefault: true },
  );

  // ⌥R — toggle N1/N2 end-moment releases on the selected members.
  useHotkeys(
    "alt+r",
    (event) => {
      if (!isStudio) {
        return;
      }
      event.preventDefault();
      const { project, batch, updateBeam } = useProjectStore.getState();
      const targets =
        batch.selectedBeamIds.length > 0 ? batch.selectedBeamIds : beamId === null ? [] : [beamId];
      for (const id of targets) {
        const beam = project.structure.beams.find((b) => b.id === id);
        if (beam === undefined) {
          continue;
        }
        const released = beam.releases_start[1] ?? false;
        const start = [...beam.releases_start];
        const end = [...beam.releases_end];
        start[1] = !released;
        end[1] = !released;
        updateBeam(id, { releases_start: start, releases_end: end });
      }
      if (targets.length > 0) {
        toast(`Relâchements N1/N2 basculés sur ${targets.length} poutre(s)`);
      }
    },
    { enableOnFormTags: false, preventDefault: true },
  );

  // Delete / Backspace — remove the selected node or member(s).
  useHotkeys(
    "delete, backspace",
    (event) => {
      if (!isStudio) {
        return;
      }
      event.preventDefault();
      const { project, batch, removeNode, removeBeam } = useProjectStore.getState();
      if (batch.selectedBeamIds.length > 0) {
        for (const id of batch.selectedBeamIds) {
          if (project.structure.beams.some((b) => b.id === id)) {
            removeBeam(id);
          }
        }
        useProjectStore.getState().clearBeamSelection();
        selectBeam(null);
      } else if (beamId !== null) {
        removeBeam(beamId);
        selectBeam(null);
      } else if (nodeId !== null) {
        removeNode(nodeId);
        selectNode(null);
      }
    },
    { enableOnFormTags: false, preventDefault: true },
  );

  // f / i — camera zoom extents / isometric (only while the canvas lives).
  useHotkeys(
    "f",
    () => {
      if (viewportMounted) {
        window.dispatchEvent(new CustomEvent("rdm-camera-fit"));
      }
    },
    { enableOnFormTags: false },
  );
  useHotkeys(
    "i",
    () => {
      if (viewportMounted) {
        void navigate({ search: { view: "iso" } as never, replace: true });
      }
    },
    { enableOnFormTags: false },
  );
}
