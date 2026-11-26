import { Command } from "cmdk";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import {
  ArrowLeftRight,
  BadgeCheck,
  Boxes,
  CircleHelp,
  FileDown,
  FileText,
  FileType2,
  FolderOpen,
  Home,
  KeyRound,
  Languages,
  MousePointerClick,
  Scale,
  Settings2,
  SlidersHorizontal,
  Spline,
} from "lucide-react";
import { BoxSelect, FlipHorizontal2, Merge, Move, Play, Repeat, RotateCw } from "lucide-react";
import { ReleaseHinge } from "@/components/icons/EngineeringIcons";
import { Kbd } from "@/components/ui/kbd";
import { useProjectStore } from "@/state/projectStore";
import { getStudioSteps, type StudioStep } from "@/router";
import { useIsStudio, useSelectedIds } from "@/hooks/useStudioQuery";

/**
 * Keyboard-first command palette (DESIGN.md §6, `cmdk` 1.1.1): instant
 * access to every workflow surface. Opens with ⌘K / Ctrl+K.
 *
 * v2.1.1: icon-led rows (16px Lucide / engineering icons on the left) with
 * `<Kbd>` shortcut chips on the right, across the 5 complete groups —
 * _Navigation_, _Outils CAD_, _Analyses & Normes_, _Modèles & Exports_,
 * _Préférences & Aide_. Every entry EXECUTES: steps navigate (search
 * preserved), CAD actions ride the `rdm-cad-command` window event into
 * the Step 1 toolbar, modals/exports ride their dedicated events, and the
 * locale toggle activates the Lingui catalog in place.
 */

/** One palette row: 16px icon + label (left) and the <Kbd> chip (right). */
function PaletteRow({
  icon: Icon,
  label,
  shortcut,
  onSelect,
  mono = false,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  label: string;
  shortcut?: string;
  onSelect: () => void;
  mono?: boolean;
}) {
  return (
    <Command.Item
      value={`${label} ${shortcut ?? ""}`}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[13px] text-ink-primary data-[selected=true]:bg-accent-tint data-[selected=true]:text-accent"
    >
      <Icon size={16} strokeWidth={1.5} className="shrink-0 text-ink-secondary" />
      <span className={mono ? "font-data" : undefined}>{label}</span>
      {shortcut !== undefined ? (
        <span className="ml-auto pl-2">
          <Kbd className="font-data text-[10px]">{shortcut}</Kbd>
        </span>
      ) : null}
    </Command.Item>
  );
}

function GroupHeading({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-data px-2 pb-1 pt-2 text-[10px] tracking-wide text-ink-muted">
      {children}
    </span>
  );
}

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const steps = getStudioSteps();
  const { beamId } = useSelectedIds();
  const isStudio = useIsStudio();

  if (!open) {
    return null;
  }
  /** v2.1.0: `search: true` preserves the active studio query params. */
  const go = (to: string) => {
    onOpenChange(false);
    void navigate({ to, search: true });
  };
  /** Fires a window-event command consumed by the hosting surface. */
  const fire = (event: string) => {
    onOpenChange(false);
    window.dispatchEvent(new Event(event));
  };
  /** CAD commands ride into the Step 1 toolbar (works on /geometry). */
  const cad = (id: string) => {
    onOpenChange(false);
    if (!isStudio) {
      void navigate({ to: "/geometry", search: true });
    }
    window.dispatchEvent(new CustomEvent("rdm-cad-command", { detail: id }));
    toast(t`Outil CAD activé`, { description: id });
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
      toast(t`Relâchements N1/N2 basculés sur ${targets.length} poutre(s)`);
    }
  };
  /** Basculer FR / EN — in-place Lingui activation (no reload). */
  const toggleLocale = () => {
    onOpenChange(false);
    const next = window.localStorage.getItem("rdm-locale") === "en" ? "fr" : "en";
    void import("@/i18n/i18n").then(({ activateLocale }) => activateLocale(next));
  };

  const stepRow = (step: StudioStep) => (
    <PaletteRow
      key={step.path}
      icon={step.icon ?? Home}
      label={`${step.stepOrder}. ${step.label}`}
      shortcut={String(step.stepOrder)}
      onSelect={() => go(step.path)}
    />
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink-primary/20 p-4 pt-[12vh]"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-lg border border-hairline bg-panel shadow-[0_8px_24px_rgba(15,23,42,0.08)]"
        onClick={(e) => e.stopPropagation()}
        data-testid="command-palette"
      >
        <Command label="Palette de commandes">
          <div className="border-b border-hairline p-2">
            <Command.Input
              autoFocus
              placeholder="Rechercher une étape, un outil, une analyse…"
              className="w-full rounded bg-transparent px-2 py-1.5 text-[13px] outline-none"
            />
          </div>
          <Command.List className="max-h-[60vh] overflow-auto p-1">
            <Command.Empty className="p-3 text-[12px] text-ink-muted">
              <Trans>Aucun résultat.</Trans>
            </Command.Empty>

            <Command.Group
              className="p-1 text-[13px]"
              heading={<GroupHeading>Navigation</GroupHeading>}
            >
              {steps.map(stepRow)}
              <PaletteRow icon={Home} label={t`Accueil`} shortcut="/" onSelect={() => go("/")} />
              <PaletteRow
                icon={Scale}
                label={t`Mentions légales`}
                shortcut="/legal"
                onSelect={() => go("/legal")}
              />
            </Command.Group>

            {isStudio ? (
              <Command.Group
                className="p-1 text-[13px]"
                heading={<GroupHeading>Outils CAD</GroupHeading>}
              >
                <PaletteRow icon={Spline} label={t`Polyligne`} onSelect={() => cad("polyline")} />
                <PaletteRow icon={BoxSelect} label={t`Extruder`} onSelect={() => cad("extrude")} />
                <PaletteRow icon={Move} label={t`Déplacer`} onSelect={() => cad("move")} />
                <PaletteRow icon={RotateCw} label={t`Rotation`} onSelect={() => cad("rotate")} />
                <PaletteRow
                  icon={FlipHorizontal2}
                  label={t`Miroir`}
                  onSelect={() => cad("mirror")}
                />
                <PaletteRow
                  icon={Repeat}
                  label={t`Répétition linéaire`}
                  onSelect={() => cad("array_linear")}
                />
                <PaletteRow
                  icon={Merge}
                  label={t`Fusionner doublons`}
                  onSelect={() => cad("merge_duplicates")}
                />
                <PaletteRow
                  icon={ReleaseHinge}
                  label={t`Relâcher les moments N1/N2`}
                  shortcut="⌥R"
                  onSelect={releaseMoments}
                />
                <PaletteRow
                  icon={MousePointerClick}
                  label={t`Inverser la sélection`}
                  shortcut="⇧⌘I"
                  onSelect={() => {
                    onOpenChange(false);
                    useProjectStore.getState().invertBeamSelection();
                  }}
                />
              </Command.Group>
            ) : null}

            <Command.Group
              className="p-1 text-[13px]"
              heading={<GroupHeading>{t`Analyses & Normes`}</GroupHeading>}
            >
              <PaletteRow
                icon={Play}
                label={t`Calculer 3D & Eurocode 3`}
                shortcut="⌘Entrée"
                onSelect={() => go("/results")}
              />
              <PaletteRow
                icon={SlidersHorizontal}
                label={t`Optimiseur EC3`}
                onSelect={() => {
                  onOpenChange(false);
                  void navigate({ to: "/results", search: { modal: "optim" } as never });
                }}
              />
              <PaletteRow
                icon={ArrowLeftRight}
                label={t`Comparateur de scénarios`}
                onSelect={() => {
                  onOpenChange(false);
                  void navigate({ to: "/results", search: { modal: "compare" } as never });
                }}
              />
              <PaletteRow
                icon={BadgeCheck}
                label={t`Validation — 41 benchmarks analytiques`}
                onSelect={() => fire("rdm-open-validation")}
              />
              <PaletteRow
                icon={Settings2}
                label={t`Réglages normatifs`}
                onSelect={() => fire("rdm-open-settings")}
              />
              <PaletteRow
                icon={KeyRound}
                label={t`Licence & branding`}
                onSelect={() => fire("rdm-open-license")}
              />
            </Command.Group>

            <Command.Group
              className="p-1 text-[13px]"
              heading={<GroupHeading>{t`Modèles & Exports`}</GroupHeading>}
            >
              <PaletteRow
                icon={FolderOpen}
                label={t`Galerie — 12 modèles`}
                onSelect={() => fire("rdm-open-gallery")}
              />
              <PaletteRow
                icon={FileText}
                label={t`Note de calcul PDF / A4`}
                shortcut="⌘P"
                onSelect={() => go("/report")}
              />
              <PaletteRow
                icon={FileDown}
                mono
                label={t`Exporter .rdm`}
                onSelect={() => {
                  onOpenChange(false);
                  void navigate({ to: "/report", search: true }).then(() => {
                    window.dispatchEvent(new Event("rdm-export-rdm"));
                  });
                }}
              />
              <PaletteRow
                icon={Boxes}
                mono
                label={t`Exporter IFC4`}
                onSelect={() => {
                  onOpenChange(false);
                  void navigate({ to: "/report", search: true }).then(() => {
                    window.dispatchEvent(new CustomEvent("rdm-export-bim", { detail: "ifc4" }));
                  });
                }}
              />
              <PaletteRow
                icon={FileType2}
                mono
                label={t`Exporter .docx`}
                onSelect={() => {
                  onOpenChange(false);
                  void navigate({ to: "/report", search: true }).then(() => {
                    window.dispatchEvent(new Event("rdm-export-docx"));
                  });
                }}
              />
            </Command.Group>

            <Command.Group
              className="p-1 text-[13px]"
              heading={<GroupHeading>{t`Préférences & Aide`}</GroupHeading>}
            >
              <PaletteRow icon={Languages} label={t`Basculer FR / EN`} onSelect={toggleLocale} />
              <PaletteRow
                icon={CircleHelp}
                label={t`Lancer le guide interactif`}
                onSelect={() => fire("rdm-start-tour")}
              />
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
