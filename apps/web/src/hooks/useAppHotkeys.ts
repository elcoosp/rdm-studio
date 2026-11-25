import { useNavigate } from "@tanstack/react-router";
import { useLocation } from "@tanstack/react-router";
import { useHotkeys } from "react-hotkeys-hook";
import { toast } from "sonner";
import { useProjectStore } from "@/state/projectStore";
import { redoModel, undoModel } from "@/state/projectStore";
import { useViewportStore } from "@/state/viewportStore";

/**
 * Centralized keyboard layer (v1.4.0, react-hotkeys-hook): every
 * production shortcut lives here — no ad-hoc `keydown` listeners in
 * components. `mod` maps to ⌘ on macOS and Ctrl elsewhere; form fields
 * never swallow model shortcuts (`enableOnFormTags: false`).
 */
export function useAppHotkeys(onTogglePalette: () => void): void {
  const navigate = useNavigate();
  const pathname = useLocation().pathname;
  const setToolMode = useViewportStore((s) => s.setToolMode);
  const viewportMounted = useViewportStore((s) => s.viewportMounted);

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

  // ⌘Enter — run the calculation and jump to Step 4.
  useHotkeys(
    "mod+enter",
    (event) => {
      event.preventDefault();
      void navigate({ to: "/results" });
    },
    { enableOnFormTags: false },
  );

  // ⌘P — Step 5 print/PDF sheet.
  useHotkeys(
    "mod+p",
    (event) => {
      event.preventDefault();
      void navigate({ to: "/report" });
    },
    { enableOnFormTags: false },
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
  useHotkeys(
    "escape",
    () => {
      if (pathname === "/geometry") {
        useProjectStore.getState().clearBeamSelection();
        useProjectStore.getState().selectNode(null);
        setToolMode("select");
      }
    },
    { enableOnFormTags: false },
  );

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
      if (pathname !== "/geometry") {
        return;
      }
      event.preventDefault();
      const { project, selection, updateBeam } = useProjectStore.getState();
      const targets =
        selection.selectedBeamIds.length > 0
          ? selection.selectedBeamIds
          : selection.beamId === null
            ? []
            : [selection.beamId];
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
      if (pathname !== "/geometry") {
        return;
      }
      event.preventDefault();
      const { project, selection, removeNode, removeBeam } = useProjectStore.getState();
      if (selection.selectedBeamIds.length > 0) {
        for (const id of selection.selectedBeamIds) {
          if (project.structure.beams.some((b) => b.id === id)) {
            removeBeam(id);
          }
        }
      } else if (selection.beamId !== null) {
        removeBeam(selection.beamId);
      } else if (selection.nodeId !== null) {
        removeNode(selection.nodeId);
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
        window.dispatchEvent(new CustomEvent("rdm-camera-iso"));
      }
    },
    { enableOnFormTags: false },
  );
}
