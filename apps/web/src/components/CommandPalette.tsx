import { Command } from "cmdk";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Trans } from "@lingui/react/macro";
import { useProjectStore } from "@/state/projectStore";
import { getStudioSteps } from "@/router";
import { useIsStudio, useSelectedIds } from "@/hooks/useStudioQuery";

/**
 * Keyboard-first command palette (DESIGN.md §6, `cmdk` 1.1.1): instant
 * access to the 5 steps, profile presets and exports. Opens with ⌘K / Ctrl+K.
 *
 * v2.1.0: the steps group is DERIVED from the router's `staticData` via
 * `getStudioSteps()` (zero hardcoded STEPS array), and every navigation
 * passes `search: true` so the active URL state survives the jump — the
 * `⌘Entrée` / `⌘P` power actions included.
 */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const steps = getStudioSteps();
  const selectedBeamIds = useProjectStore((s) => s.batch.selectedBeamIds);
  const { beamId } = useSelectedIds();
  const isStudio = useIsStudio();
  const hasSelection = selectedBeamIds.length > 0 || beamId !== null;

  if (!open) {
    return null;
  }
  /** v2.1.0: `search: true` preserves the active studio query params. */
  const go = (to: string) => {
    onOpenChange(false);
    void navigate({ to, search: true });
  };
  /** Toggles N1/N2 end-moment releases on the active selection (⌥R path). */
  const releaseMoments = () => {
    onOpenChange(false);
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
  };
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink-primary/20 p-4 pt-[12vh]"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-lg border border-hairline bg-panel shadow-[0_8px_24px_rgba(15,23,42,0.08)]"
        onClick={(e) => e.stopPropagation()}
      >
        <Command label="Palette de commandes">
          <div className="border-b border-hairline p-2">
            <Command.Input
              autoFocus
              placeholder="Rechercher une étape, un profil, une action…"
              className="w-full rounded bg-transparent px-2 py-1.5 text-[13px] outline-none"
            />
          </div>
          <Command.List className="max-h-72 overflow-auto p-1">
            <Command.Empty className="p-3 text-[12px] text-ink-muted">
              <Trans>Aucun résultat.</Trans>
            </Command.Empty>
            {isStudio && hasSelection ? (
              <Command.Group heading="Sélection active" className="p-2 text-[13px]">
                <Command.Item
                  value="Relâcher les moments N1/N2"
                  onSelect={releaseMoments}
                  className="flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1.5 data-[selected=true]:bg-accent-tint"
                >
                  <Trans>Relâcher les moments N1/N2</Trans>
                  <span className="font-data text-[10px] text-ink-muted">⌥R</span>
                </Command.Item>
                <Command.Item
                  value="Inverser la sélection"
                  onSelect={() => {
                    onOpenChange(false);
                    useProjectStore.getState().invertBeamSelection();
                  }}
                  className="flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1.5 data-[selected=true]:bg-accent-tint"
                >
                  <Trans>Inverser la sélection</Trans>
                  <span className="font-data text-[10px] text-ink-muted">⇧⌘I</span>
                </Command.Item>
              </Command.Group>
            ) : null}
            <Command.Group heading="Calcul" className="p-2 text-[13px]">
              <Command.Item
                value="Lancer le calcul 3D & Eurocode 3"
                onSelect={() => go("/results")}
                className="flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1.5 data-[selected=true]:bg-accent-tint"
              >
                <Trans>Lancer le calcul 3D & Eurocode 3</Trans>
                <span className="font-data text-[10px] text-ink-muted">⌘Entrée</span>
              </Command.Item>
              <Command.Item
                value="Note de calcul A4 / PDF"
                onSelect={() => go("/report")}
                className="flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1.5 data-[selected=true]:bg-accent-tint"
              >
                <Trans>Note de calcul A4 / PDF</Trans>
                <span className="font-data text-[10px] text-ink-muted">⌘P</span>
              </Command.Item>
            </Command.Group>
            <Command.Group heading="Étapes" className="p-2 text-[13px]">
              {steps.map((step) => (
                <Command.Item
                  key={step.path}
                  value={`${step.stepOrder} ${step.label}`}
                  onSelect={() => go(step.path)}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 data-[selected=true]:bg-accent-tint"
                >
                  {step.label}
                </Command.Item>
              ))}
            </Command.Group>
            <Command.Group heading="Profils" className="p-2 text-[13px]">
              {["IPE 200", "IPE 240", "IPE 300", "HEA 200", "HEB 300"].map((p) => (
                <Command.Item
                  key={p}
                  value={p}
                  onSelect={() => {
                    onOpenChange(false);
                    void navigate({ to: "/geometry", search: true });
                  }}
                  className="font-data flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 data-[selected=true]:bg-accent-tint"
                >
                  {p}
                </Command.Item>
              ))}
            </Command.Group>
            <Command.Group heading="Exports" className="p-2 text-[13px]">
              <Command.Item
                value="Rapport PDF"
                onSelect={() => go("/report")}
                className="cursor-pointer rounded px-2 py-1.5 data-[selected=true]:bg-accent-tint"
              >
                Rapport PDF
              </Command.Item>
              <Command.Item
                value="Resultats CSV"
                onSelect={() => go("/report")}
                className="cursor-pointer rounded px-2 py-1.5 data-[selected=true]:bg-accent-tint"
              >
                Résultats CSV
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
