import { createRootRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useEffect, useState, useSyncExternalStore } from "react";
import { motion } from "motion/react";
import { Trans } from "@lingui/react/macro";
import { Toaster } from "sonner";
import { useAppHotkeys } from "@/hooks/useAppHotkeys";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { OnboardingTour } from "@/components/OnboardingTour";
import { openProjectOrCadFile, useFileOpening } from "@/hooks/useFileOpening";
import { redoModel, undoModel } from "@/state/projectStore";
import { IconFrame, IconLoad, IconReport, IconResults, IconSupport } from "@/components/icons";
import { UpdatePrompt } from "@/components/UpdatePrompt";
import { CommandPalette } from "@/components/CommandPalette";
import { ProjectGalleryModal } from "@/components/ProjectGalleryModal";
import { useProjectStore } from "@/state/projectStore";
import { PersistentStage } from "@/viewport3d/PersistentStage";
import { KeycapHint } from "@/components/KeycapHints";

const STEPS = [
  { to: "/geometry", icon: IconFrame },
  { to: "/supports", icon: IconSupport },
  { to: "/loads", icon: IconLoad },
  { to: "/results", icon: IconResults },
  { to: "/report", icon: IconReport },
] as const;

const MOBILE_LABELS = ["Géométrie", "Liaisons", "Charges", "Résultats", "Rapport"];

function LocaleSwitch() {
  const current = useProjectLocale();
  const switchLocale = async (locale: "fr" | "en") => {
    const { activateLocale } = await import("@/i18n/i18n");
    await activateLocale(locale);
  };
  return (
    <div className="flex shrink-0 gap-1 text-[11px]">
      {(["fr", "en"] as const).map((locale) => (
        <button
          key={locale}
          type="button"
          aria-pressed={current === locale}
          className={`rounded px-2 py-0.5 font-data transition-colors ${
            current === locale
              ? "bg-accent-tint text-accent ring-1 ring-accent-ring"
              : "border border-hairline text-ink-secondary hover:text-ink-primary"
          }`}
          onClick={() => void switchLocale(locale)}
        >
          {locale.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

/** Reads the persisted locale signal the i18n module maintains. */
function useProjectLocale(): "fr" | "en" {
  return useSyncExternalStore(
    (notify) => {
      window.addEventListener("rdm-locale-change", notify);
      return () => window.removeEventListener("rdm-locale-change", notify);
    },
    () => (window.localStorage.getItem("rdm-locale") === "en" ? "en" : "fr"),
    () => "fr",
  );
}

/** Offline status pill (DESIGN.md §7.7). */
function OfflinePill() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (online) {
    return (
      <span className="hidden font-data text-[11px] text-ink-muted xl:inline">
        Enregistré en local
      </span>
    );
  }
  return (
    <span className="rounded border border-fea-warn/50 bg-fea-warn/10 px-1.5 py-0.5 font-data text-[11px] text-ink-secondary">
      Mode hors-ligne actif
    </span>
  );
}

function RootLayout() {
  const pathname = useLocation().pathname;
  const project = useProjectStore((s) => s.project);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const nodeCount = project.structure.nodes.length;
  const beamCount = project.structure.beams.length;
  // v1.5.0 unified breakpoint: the mobile tab bar (and every drawer)
  // exists ONLY below 768 px — 860 px split-screen windows get the full
  // locked desktop workstation.
  const isMobile = useMediaQuery("(max-width: 767px)");
  useAppHotkeys(() => setPaletteOpen((open) => !open));
  // v1.4.0: drag-and-drop + PWA launchQueue file opening.
  useFileOpening();

  return (
    <div className="flex h-[100dvh] flex-col">
      <header className="flex h-11 shrink-0 items-center justify-between gap-2 overflow-hidden border-b border-hairline bg-panel px-3 sm:gap-3 sm:px-4">
        {/* Left zone: brand + project switcher. */}
        <div className="flex min-w-0 shrink-0 items-center gap-1.5">
          <Link
            to="/geometry"
            id="rdm-logo"
            className="flex shrink-0 items-center gap-1.5 text-accent"
          >
            <img src="/logo-rdm-studio.svg" alt="RDM Studio" className="h-6 w-6 shrink-0" />
            <span className="hidden font-semibold tracking-tight sm:inline">RDM Studio</span>
          </Link>
          <button
            type="button"
            aria-label="Galerie de projets"
            title="Galerie de projets"
            className="hidden shrink-0 rounded px-1 py-0.5 text-[12px] text-ink-muted hover:text-accent md:inline"
            onClick={() => setGalleryOpen(true)}
          >
            ▾
          </button>
          <span className="hidden min-w-0 truncate text-[12px] text-ink-muted md:inline">
            / {project.name}
          </span>
        </div>
        {/* Center zone: the 5-step flow with the shared gliding underline.
            v1.6.0 bug 1: NO overflow-x-auto — the step labels compact to
            `N` + icon below xl so `FR | EN` stays 100% visible at 860 px
            with zero horizontal scrolling. */}
        <nav
          id="rdm-steps"
          className="mx-auto hidden min-w-0 items-center gap-0.5 md:flex"
          aria-label="workflow"
        >
          {STEPS.map((step, index) => {
            const active = pathname === step.to;
            return (
              <Link
                key={step.to}
                to={step.to}
                aria-label={`Étape ${index + 1}`}
                className={`relative flex min-h-11 shrink-0 items-center gap-1 rounded px-1.5 py-1.5 text-[13px] text-ink-secondary hover:bg-canvas ${active ? "text-accent" : ""}`}
              >
                <step.icon size={14} />
                <span className="font-data xl:hidden">{index + 1}</span>
                <span className="hidden xl:inline">
                  <Trans>Étape {index + 1}</Trans>
                </span>
                {active ? (
                  <motion.span
                    layoutId="stepper-underline"
                    className="absolute inset-x-1 -bottom-px h-[2px] bg-accent"
                  />
                ) : null}
              </Link>
            );
          })}
        </nav>
        {/* Right zone: undo/redo, telemetry, ⌘K, offline pill, tour, locale
            (ml-auto keeps it flush right when the center zone is hidden). */}
        <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-0">
          <span className="font-data hidden text-[11px] text-ink-muted lg:inline">
            {nodeCount} nœuds · {beamCount} poutres
          </span>
          <button
            type="button"
            aria-label="Annuler la dernière action"
            title="Annuler (⌘Z)"
            className="hidden h-7 w-7 shrink-0 items-center justify-center rounded border border-hairline text-[12px] text-ink-secondary md:flex"
            onClick={() => undoModel()}
          >
            ↩
          </button>
          <button
            type="button"
            aria-label="Rétablir l'action suivante"
            title="Rétablir (⇧⌘Z)"
            className="hidden h-7 w-7 shrink-0 items-center justify-center rounded border border-hairline text-[12px] text-ink-secondary md:flex"
            onClick={() => redoModel()}
          >
            ↪
          </button>
          <button
            type="button"
            id="rdm-cmdk"
            className="relative hidden shrink-0 rounded border border-hairline px-2 py-1 font-data text-[11px] text-ink-secondary md:inline"
            onClick={() => setPaletteOpen(true)}
          >
            ⌘K
            <KeycapHint label="⌘K" />
          </button>
          <OfflinePill />
          <button
            type="button"
            aria-label="Aide"
            className="hidden h-7 w-7 shrink-0 items-center justify-center rounded border border-hairline text-[12px] text-ink-secondary md:flex"
            onClick={() => window.dispatchEvent(new Event("rdm-start-tour"))}
          >
            ?
          </button>
          <LocaleSwitch />
        </div>
      </header>
      {/* v1.5.0: locked workstation shell — on md+ the main region NEVER
          page-scrolls (each route manages its own panes); on phones the
          stacked routes may scroll under the fixed tab bar. */}
      <main className="min-h-0 flex-1 overflow-auto pb-14 md:overflow-hidden md:pb-0">
        <Outlet />
        <UpdatePrompt />
      </main>
      {/* v1.6.0 requirement 1: the ONE persistent 3D stage. Mounted once at
          the root, it overlays the active route's registered slot pane on
          Steps 1–4 and never remounts — orbit/zoom/pan survive navigation,
          and one BVH-indexed geometry serves rendering & picking. */}
      <PersistentStage />
      {/* Thumb-friendly bottom tab bar, phones only (< 768 px). */}
      {isMobile ? (
        <nav
          className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-stretch border-t border-hairline bg-panel"
          aria-label="workflow mobile"
        >
          {STEPS.map((step, index) => {
            const active = pathname === step.to;
            return (
              <Link
                key={step.to}
                to={step.to}
                aria-label={`Étape ${index + 1}`}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] ${active ? "text-accent" : "text-ink-secondary"}`}
              >
                <step.icon size={20} />
                {MOBILE_LABELS[index]}
              </Link>
            );
          })}
        </nav>
      ) : null}
      <OnboardingTour />
      {/* Sonner host: undo/what-if toasts fire from every step. */}
      <Toaster position="bottom-right" />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <ProjectGalleryModal
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        // v1.5.0 defect: the gallery importer shares the ONE unified file
        // path, so .dxf / .step / .igs imports behave exactly like
        // drag-and-drop instead of JSON.parse-crashing on CAD files.
        onImportFile={(file) => {
          void openProjectOrCadFile(file);
        }}
      />
    </div>
  );
}

export const Route = createRootRoute({ component: RootLayout });
