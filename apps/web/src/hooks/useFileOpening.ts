import { useEffect } from "react";
import { toast } from "sonner";
import { feaClient } from "@/wasmBridge/workerClient";
import { useProjectStore } from "@/state/projectStore";

/**
 * File-opening surface (v1.4.0): drag-and-drop of `.rdm` models and CAD
 * wireframes onto the app shell, plus the PWA `launchQueue` consumer
 * backing the manifest's `file_handlers`. CAD imports go through the
 * same extension-dispatched worker path as the Step 1 dialog.
 *
 * v1.5.0: `openProjectOrCadFile` is exported so the gallery modal, the
 * shell drop target and the PWA `launchQueue` share ONE importer — the
 * gallery used to parse only `.rdm` JSON and silently fail on CAD files.
 */
export async function openProjectOrCadFile(file: File): Promise<boolean> {
  const lower = file.name.toLowerCase();
  try {
    if (lower.endsWith(".rdm")) {
      const text = await file.text();
      const project = JSON.parse(text) as Parameters<
        ReturnType<typeof useProjectStore.getState>["loadProject"]
      >[0];
      useProjectStore.getState().loadProject(project);
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

    // Shell-level drag-and-drop (highlight handled by the CSS class).
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
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);
}
