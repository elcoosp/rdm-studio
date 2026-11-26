import { useRef } from "react";
import { Trans } from "@lingui/react/macro";
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * CAD import dialog (v1.3.0 Step 1): extension-dispatched `.dxf`,
 * `.step`/`.stp`, `.igs`/`.iges` wireframe import with an optional
 * "Encastrer le nœud le plus à gauche" convenience restraint. The import
 * itself stays undoable — the caller snapshots the project and offers an
 * `Annuler` toast.
 */
export function CadImportDialog({
  open,
  onClose,
  onImport,
  busy,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (file: File, encastreLeft: boolean) => void;
  busy?: boolean;
  error?: string | null;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <DialogRoot open={open} onOpenChange={(next: boolean) => (next ? undefined : onClose())}>
      <DialogContent data-testid="cad-import-dialog">
        <DialogHeader>
          <DialogTitle>
            <Trans>Importer un modèle CAO</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>
              Fils wireframe : DXF (LINE/POLYLINE), STEP (LINE/TRIMMED_CURVE) et IGES (110) — unités
              mm converties en m.
            </Trans>
          </DialogDescription>
        </DialogHeader>
        <label className="flex items-center gap-2 text-[12px] text-ink-secondary">
          <Checkbox defaultChecked id="cad-encastre-check" data-testid="cad-encastre" />
          <Trans>Encastrer le nœud le plus à gauche</Trans>
        </label>
        <input
          ref={fileRef}
          type="file"
          accept=".dxf,.step,.stp,.igs,.iges"
          className="hidden"
          data-testid="cad-file-input"
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            const encastre = document.getElementById(
              "cad-encastre-check",
            ) as HTMLInputElement | null;
            if (file !== undefined) {
              onImport(file, encastre?.checked ?? false);
            }
            e.currentTarget.value = "";
          }}
        />
        {error !== null && error !== "" ? (
          <p className="text-[12px] text-fea-max" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-3 flex justify-end gap-2">
          <DialogClose
            render={
              <Button variant="ghost" size="sm">
                <Trans>Annuler</Trans>
              </Button>
            }
          />
          <Button
            size="sm"
            disabled={busy}
            data-testid="cad-choose"
            onClick={() => fileRef.current?.click()}
          >
            {busy ? "Import…" : <Trans>Choisir un fichier…</Trans>}
          </Button>
        </div>
      </DialogContent>
    </DialogRoot>
  );
}
