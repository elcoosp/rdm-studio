import { Command } from "cmdk";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useEffect } from "react";
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
  Layers,
  KeyRound,
  Languages,
  MessageSquareWarning,
  MousePointerClick,
  Scale,
  Search,
  Settings2,
  SlidersHorizontal,
  Spline,
} from "lucide-react";
import { BoxSelect, FlipHorizontal2, Merge, Move, Play, Repeat, RotateCw } from "lucide-react";
import { ReleaseHinge } from "@rdm-studio/ui/icons";
import { Kbd } from "@rdm-studio/ui/primitives";
import { useProjectStore } from "@/state/projectStore";
import { getStudioSteps, type StudioStep } from "@/router";
import { useIsStudio, useSelectedIds } from "@/hooks/useStudioQuery";
import { trackProductEvent } from "@/lib/productTelemetry";

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
      className="group flex cursor-pointer items-center gap-2.5 rounded-[4px] px-2.5 py-1.5 text-[13px] text-ink-primary transition-colors data-[selected=true]:bg-accent-tint data-[selected=true]:text-accent"
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] border border-hairline bg-canvas text-ink-secondary transition-colors group-data-[selected=true]:border-accent-ring group-data-[selected=true]:bg-panel group-data-[selected=true]:text-accent">
        <Icon size={14} strokeWidth={1.5} />
      </span>
      <span className={mono ? "font-data truncate" : "truncate"}>{label}</span>
      {shortcut !== undefined ? (
        <span className="ml-auto shrink-0 pl-2">
          <Kbd className="font-data text-[10px]">{shortcut}</Kbd>
        </span>
      ) : null}
    </Command.Item>
  );
}

function GroupHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-data flex items-center justify-between px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
      <span>{children}</span>
    </div>
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

  useEffect(() => {
    if (open) void trackProductEvent("command_palette_opened");
  }, [open]);

  if (!open) return null;

  const go = (to: string) => {
    onOpenChange(false);
    void trackProductEvent("command_palette_used", { action: `nav:${to}` });
    void navigate({ to, search: true });
  };

  const fire = (event: string) => {
    onOpenChange(false);
    void trackProductEvent("command_palette_used", { action: event });
    window.dispatchEvent(new Event(event));
  };

  const cad = (id: string) => {
    onOpenChange(false);
    void trackProductEvent("command_palette_used", { action: `cad:${id}` });
    if (!isStudio) void navigate({ to: "/geometry", search: true });
    window.dispatchEvent(new CustomEvent("rdm-cad-command", { detail: id }));
    toast(t`Outil CAD activé`, { description: id });
  };

  const releaseMoments = () => {
    onOpenChange(false);
    void trackProductEvent("command_palette_used", { action: "release_moments" });
    const { project, batch, updateBeam } = useProjectStore.getState();
    const targets =
      batch.selectedBeamIds.length > 0 ? batch.selectedBeamIds : beamId === null ? [] : [beamId];
    for (const id of targets) {
      const beam = project.structure.beams.find((b) => b.id === id);
      if (beam === undefined) continue;
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

  const toggleLocale = () => {
    onOpenChange(false);
    void trackProductEvent("command_palette_used", { action: "toggle_locale" });
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
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink-primary/25 p-4 pt-[10vh] backdrop-blur-[1px]"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-[8px] border border-hairline bg-panel shadow-[0_12px_32px_rgba(15,23,42,0.12)]"
        onClick={(e) => e.stopPropagation()}
        data-testid="command-palette"
      >
        <Command label="Palette de commandes">
          <div className="flex items-center gap-2.5 border-b border-hairline bg-canvas/60 px-3 py-2.5">
            <Search size={16} strokeWidth={1.5} className="shrink-0 text-ink-muted" aria-hidden />
            <Command.Input
              autoFocus
              placeholder={t`Rechercher une étape, un outil, une analyse…`}
              className="w-full bg-transparent text-[13px] text-ink-primary placeholder:text-ink-muted focus:outline-none focus-visible:outline-none"
            />
            <Kbd className="font-data shrink-0 text-[10px]">Esc</Kbd>
          </div>

          <Command.List className="max-h-[58vh] divide-y divide-hairline overflow-y-auto px-1.5 py-1">
            <Command.Empty className="py-8 text-center text-[12px] text-ink-muted">
              <Trans>Aucun résultat.</Trans>
            </Command.Empty>

            <Command.Group className="py-1" heading={<GroupHeading>Navigation</GroupHeading>}>
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
              <Command.Group className="py-1" heading={<GroupHeading>Outils CAD</GroupHeading>}>
                <PaletteRow
                  icon={Layers}
                  label={t`Studio Sections Composées`}
                  shortcut="⌥S"
                  onSelect={() => fire("rdm-open-composite-studio")}
                />
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
              className="py-1"
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
                label={t`Édition & branding`}
                onSelect={() => fire("rdm-open-license")}
              />
            </Command.Group>

            <Command.Group
              className="py-1"
              heading={<GroupHeading>{t`Modèles & Exports`}</GroupHeading>}
            >
              <PaletteRow
                icon={FolderOpen}
                label={t`Galerie — 15 modèles`}
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
                  void navigate({ to: "/report", search: true }).then(() =>
                    window.dispatchEvent(new Event("rdm-export-rdm")),
                  );
                }}
              />
              <PaletteRow
                icon={Boxes}
                mono
                label={t`Exporter IFC4`}
                onSelect={() => {
                  onOpenChange(false);
                  void navigate({ to: "/report", search: true }).then(() =>
                    window.dispatchEvent(new CustomEvent("rdm-export-bim", { detail: "ifc4" })),
                  );
                }}
              />
              <PaletteRow
                icon={FileType2}
                mono
                label={t`Exporter .docx`}
                onSelect={() => {
                  onOpenChange(false);
                  void navigate({ to: "/report", search: true }).then(() =>
                    window.dispatchEvent(new Event("rdm-export-docx")),
                  );
                }}
              />
            </Command.Group>

            <Command.Group
              className="py-1"
              heading={<GroupHeading>{t`Préférences & Aide`}</GroupHeading>}
            >
              <PaletteRow icon={Languages} label={t`Basculer FR / EN`} onSelect={toggleLocale} />
              <PaletteRow
                icon={CircleHelp}
                label={t`Lancer le guide interactif`}
                onSelect={() => fire("rdm-start-tour")}
              />
              <PaletteRow
                icon={MessageSquareWarning}
                label={t`Signaler un blocage / Idée`}
                onSelect={() => fire("rdm-open-feedback")}
              />
            </Command.Group>
          </Command.List>

          <div className="font-data flex items-center justify-between border-t border-hairline bg-canvas px-3 py-1.5 text-[10px] text-ink-muted">
            <span className="flex items-center gap-2">
              <span>
                <Kbd className="text-[9px]">↑↓</Kbd> Naviguer
              </span>
              <span>
                <Kbd className="text-[9px]">↵</Kbd> Exécuter
              </span>
            </span>
            <span>RDM Studio · ⌘K</span>
          </div>
        </Command>
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink-primary/25 p-4 pt-[10vh] backdrop-blur-[1px]"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-[8px] border border-hairline bg-panel shadow-[0_12px_32px_rgba(15,23,42,0.12)]"
        onClick={(e) => e.stopPropagation()}
        data-testid="command-palette"
      >
        <Command label="Palette de commandes">
          <div className="flex items-center gap-2.5 border-b border-hairline bg-canvas/60 px-3 py-2.5">
            <Search size={16} strokeWidth={1.5} className="shrink-0 text-ink-muted" aria-hidden />
            <Command.Input
              autoFocus
              placeholder={t`Rechercher une étape, un outil, une analyse…`}
              className="w-full bg-transparent text-[13px] text-ink-primary placeholder:text-ink-muted focus:outline-none focus-visible:outline-none"
            />
            <Kbd className="font-data shrink-0 text-[10px]">Esc</Kbd>
          </div>

          <Command.List className="max-h-[58vh] divide-y divide-hairline overflow-y-auto px-1.5 py-1">
            <Command.Empty className="py-8 text-center text-[12px] text-ink-muted">
              <Trans>Aucun résultat.</Trans>
            </Command.Empty>

            <Command.Group className="py-1" heading={<GroupHeading>Navigation</GroupHeading>}>
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
              <Command.Group className="py-1" heading={<GroupHeading>Outils CAD</GroupHeading>}>
                <PaletteRow
                  icon={Layers}
                  label={t`Studio Sections Composées`}
                  shortcut="⌥S"
                  onSelect={() => fire("rdm-open-composite-studio")}
                />
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
              className="py-1"
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
                label={t`Édition & branding`}
                onSelect={() => fire("rdm-open-license")}
              />
            </Command.Group>

            <Command.Group
              className="py-1"
              heading={<GroupHeading>{t`Modèles & Exports`}</GroupHeading>}
            >
              <PaletteRow
                icon={FolderOpen}
                label={t`Galerie — 15 modèles`}
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
                  void navigate({ to: "/report", search: true }).then(() =>
                    window.dispatchEvent(new Event("rdm-export-rdm")),
                  );
                }}
              />
              <PaletteRow
                icon={Boxes}
                mono
                label={t`Exporter IFC4`}
                onSelect={() => {
                  onOpenChange(false);
                  void navigate({ to: "/report", search: true }).then(() =>
                    window.dispatchEvent(new CustomEvent("rdm-export-bim", { detail: "ifc4" })),
                  );
                }}
              />
              <PaletteRow
                icon={FileType2}
                mono
                label={t`Exporter .docx`}
                onSelect={() => {
                  onOpenChange(false);
                  void navigate({ to: "/report", search: true }).then(() =>
                    window.dispatchEvent(new Event("rdm-export-docx")),
                  );
                }}
              />
            </Command.Group>

            <Command.Group
              className="py-1"
              heading={<GroupHeading>{t`Préférences & Aide`}</GroupHeading>}
            >
              <PaletteRow icon={Languages} label={t`Basculer FR / EN`} onSelect={toggleLocale} />
              <PaletteRow
                icon={CircleHelp}
                label={t`Lancer le guide interactif`}
                onSelect={() => fire("rdm-start-tour")}
              />
              <PaletteRow
                icon={MessageSquareWarning}
                label={t`Signaler un blocage / Idée`}
                onSelect={() => fire("rdm-open-feedback")}
              />
            </Command.Group>
          </Command.List>

          <div className="font-data flex items-center justify-between border-t border-hairline bg-canvas px-3 py-1.5 text-[10px] text-ink-muted">
            <span className="flex items-center gap-2">
              <span>
                <Kbd className="text-[9px]">↑↓</Kbd> Naviguer
              </span>
              <span>
                <Kbd className="text-[9px]">↵</Kbd> Exécuter
              </span>
            </span>
            <span>RDM Studio · ⌘K</span>
          </div>
        </Command>
      </div>
    </div>
  );
}
