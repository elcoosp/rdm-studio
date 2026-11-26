import { useEffect } from "react";
import { toast } from "sonner";
import * as v from "valibot";
import { feaClient } from "@/wasmBridge/workerClient";
import { useProjectStore } from "@/state/projectStore";
import { ProjectFileSchema } from "@/schemas/project.schema";

/**
 * File-opening surface (v1.4.0): drag-and-drop of `.rdm` models and CAD
 * wireframes onto the app shell, plus the PWA `launchQueue` consumer
 * backing the manifest's `file_handlers`. CAD imports go through the
 * same extension-dispatched worker path as the Step 1 dialog.
 *
 * v1.5.0: `openProjectOrCadFile` is exported so the gallery modal, the
 * shell drop target and the PWA `launchQueue` share ONE importer — the
 * gallery used to parse only `.rdm` JSON and silently fail on CAD files.
 *
 * v1.6.0 security audit B: every `.rdm` payload is validated through
 * `v.safeParse(ProjectFileSchema, ...)` BEFORE it reaches
 * `loadProject` — a hand-crafted file (negative spring stiffness, NaN
 * coordinates, unknown load kinds) used to crash the solver or persist
 * poisoned state into IndexedDB.
 */
export async function openProjectOrCadFile(file: File): Promise<boolean> {
  const lower = file.name.toLowerCase();
  try {
    if (lower.endsWith(".rdm")) {
      const text = await file.text();
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        toast.error(`Fichier .rdm illisible (JSON invalide) : ${file.name}`);
        return false;
      }
      // v2.0.2: legacy version-1 files migrate through the Rust
      // `migrate_to_v2` pass before the v2 schema gate.
      if (raw !== null && typeof raw === "object" && (raw as { version?: unknown }).version === 1) {
        const migrated = await feaClient.migrateProjectJson(text);
        // v2.1.1: the Rust migrate rejects malformed v1 payloads with a
        // `{ kind: "Fault" }` OBJECT — surface the clean invalid-model
        // toast instead of letting JSON.parse throw a cryptic TypeError.
        if (typeof migrated !== "string") {
          toast.error(`Projet .rdm invalide : ${file.name}`);
          return false;
        }
        try {
          raw = JSON.parse(migrated) as unknown;
        } catch {
          toast.error(`Fichier .rdm illisible (JSON invalide) : ${file.name}`);
          return false;
        }
      }
      const parsed = v.safeParse(ProjectFileSchema, raw);
      if (!parsed.success) {
        const first = parsed.issues[0];
        toast.error(
          `Projet .rdm invalide : ${file.name}${
            first === undefined ? "" : ` — ${String(first.message)}`
          }`,
        );
        return false;
      }
      useProjectStore.getState().loadProject(parsed.output);
      toast(`Projet chargé : ${file.name}`);
      return true;
    }
    if (/\.(dxf|step|stp|igs|iges)$/.test(lower)) {
      const bytes = await file.arrayBuffer();
      const name = file.name.replace(/\.(dxf|step|stp|igs|iges)$/i, "");
      const json = await feaClient.importCad(bytes, file.name, name);
      useProjectStore.getState().loadProject(JSON.parse(json));
      toast(`CAO importée : ${file.name}`);
      return true;
    }
    return false;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : `Échec d'ouverture : ${file.name}`);
    return false;
  }
}

/**
 * v2.1.1: the window-level `dragover` / `dragleave` / `drop` listeners are
 * attached ONCE at module load (singleton flag) instead of inside the
 * React effect. A `DragEvent("drop")` dispatched immediately after
 * `page.goto("/geometry")` used to race the effect mount (StrictMode
 * remounts included) and silently miss the payload — module scope removes
 * the race entirely.
 */
const isOurFile = (event: DragEvent): boolean =>
  Array.from(event.dataTransfer?.files ?? []).some((file) =>
    /\.(rdm|dxf|step|stp|igs|iges)$/i.test(file.name),
  );
const onDragOver = (event: DragEvent) => {
  if (isOurFile(event)) {
    event.preventDefault();
    document.body.classList.add("rdm-dragging");
  }
};
const onDragLeave = () => {
  document.body.classList.remove("rdm-dragging");
};
const onDrop = (event: DragEvent) => {
  if (!isOurFile(event)) {
    return;
  }
  event.preventDefault();
  document.body.classList.remove("rdm-dragging");
  for (const file of event.dataTransfer?.files ?? []) {
    void openProjectOrCadFile(file);
  }
};
let shellDropListenersAttached = false;
function attachShellDropListeners(): void {
  if (shellDropListenersAttached) {
    return;
  }
  shellDropListenersAttached = true;
  window.addEventListener("dragover", onDragOver);
  window.addEventListener("dragleave", onDragLeave);
  window.addEventListener("drop", onDrop);
}
attachShellDropListeners();

export function useFileOpening(): void {
  useEffect(() => {
    // PWA file handler (double-click an .rdm in the OS).
    if ("launchQueue" in window) {
      const queue = (
        window as unknown as {
          launchQueue: {
            setConsumer: (consumer: (params: { files: FileSystemFileHandle[] }) => void) => void;
          };
        }
      ).launchQueue;
      queue.setConsumer((params) => {
        for (const handle of params.files) {
          void handle.getFile().then(openProjectOrCadFile);
        }
      });
    }
    // Shell-level drag-and-drop lives at module scope (singleton above);
    // the highlight class is handled by the CSS `rdm-dragging` rule.
  }, []);
}
