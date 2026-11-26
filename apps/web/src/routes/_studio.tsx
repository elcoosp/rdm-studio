import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useLocation,
  useMatches,
} from "@tanstack/react-router";
import { useEffect, useState, useSyncExternalStore } from "react";
import { motion } from "motion/react";
import { Trans } from "@lingui/react/macro";
import { BadgeCheck, ChevronDown, Redo2, Undo2 } from "lucide-react";
import { retainSearchParams } from "@tanstack/react-router";
import { getStudioSteps } from "@/router";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { SettingsPopover } from "@/components/SettingsPopover";
import { ValidationModal } from "@/components/ValidationModal";
import { OnboardingTour } from "@/components/OnboardingTour";
import { ProjectGalleryModal } from "@/components/ProjectGalleryModal";
import { LicenseBadge } from "@/components/LicenseBadge";
import { openProjectOrCadFile } from "@/hooks/useFileOpening";
import { redoModel, undoModel } from "@/state/projectStore";
import { parseProject } from "@/lib/urlShare";
import {
  quickStartProject,
  rehydrateProject,
  useProjectStore,
  type QuickStartKind,
} from "@/state/projectStore";
import { PersistentStage } from "@/viewport3d/PersistentStage";
import { KeycapHint } from "@/components/KeycapHints";
import { StudioBaseSearchSchema, type StudioBaseSearch } from "@/schemas/searchParams.schema";

/**
 * `_studio` pathless layout (v2.1.0): the locked `100dvh` CAD workstation
 * — header, 5-step workflow bar (derived from `getStudioSteps()`), the ONE
 * persistent 3D stage and the phone tab bar live here, NOT in `__root`.
 *
 * URL entry contracts handled by `beforeLoad`:
 * - `?p=<lz-string>` — compressed `.rdm` share link, Valibot-validated,
 *   hydrated BEFORE the first studio render then STRIPPED from the URL.
 * - `?template=warren|portique|potence|travees` — quick-start gallery
 *   model, loaded then stripped the same way.
 * - Neither present — IndexedDB `rehydrateProject()` on the initial mount
 *   only (local-first continuity, zero cloud).
 *
 * `retainSearchParams` keeps the viewport/selection params (`beam`, `node`,
 * `view`, `render`, `snap`, `layers`) alive across Steps 1–5 navigation,
 * so the 3D viewport state and the current selection survive every step
 * switch WITHOUT any Zustand mirror.
 */

/** Runs once per page load: cold-start IndexedDB hydration guard. */
let didInitialRehydrate = false;

export const Route = createFileRoute("/_studio")({
  staticData: { surface: "studio" },
  validateSearch: StudioBaseSearchSchema,
  search: {
    middlewares: [retainSearchParams(["beam", "node", "view", "render", "snap", "layers"])],
  },
  beforeLoad: async ({ search, location }) => {
    const { p, template, ...rest } = search as StudioBaseSearch;
    if (template !== undefined) {
      useProjectStore.getState().loadProject(quickStartProject(template as QuickStartKind));
      throw redirect({ to: location.pathname, search: { ...rest }, replace: true });
    }
    if (typeof p === "string" && p.length > 0) {
      const parsed = parseProject(p);
      if (parsed.ok) {
        useProjectStore.getState().loadProject(parsed.project as never);
      } else {
        console.warn("deep link rejected:", parsed.error);
      }
      throw redirect({ to: location.pathname, search: { ...rest }, replace: true });
    }
    if (!didInitialRehydrate) {
      didInitialRehydrate = true;
      await rehydrateProject();
    }
  },
  component: StudioLayout,
});

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

export function LocaleSwitch() {
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

function StudioLayout() {
  const pathname = useLocation().pathname;
  const matches = useMatches();
  // v2.1.0: the workflow steps are DERIVED from the route tree's
  // `staticData` (surface === "studio", sorted by stepOrder) — adding a
  // step file extends every bar, palette and hotkey automatically.
  const steps = getStudioSteps();
  const project = useProjectStore((s) => s.project);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const nodeCount = project.structure.nodes.length;
  const beamCount = project.structure.beams.length;
  // v1.5.0 unified breakpoint: the mobile tab bar (and every drawer)
  // exists ONLY below 768 px — 860 px split-screen windows get the full
  // locked desktop workstation.
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [validationOpen, setValidationOpen] = useState(false);
  // The stage renders only while the active leaf route declares
  // `stageVisible` in its staticData (report → false).
  const stageVisible = matches.at(-1)?.staticData.stageVisible === true;
  void stageVisible;

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
            <ChevronDown size={14} strokeWidth={1.5} aria-hidden />
          </button>
          <span className="hidden min-w-0 truncate text-[12px] text-ink-muted md:inline">
            / {project.name}
          </span>
        </div>
        {/* Center zone: the derived 5-step flow with the shared gliding
            underline. The labels compact to `N` + icon below xl so
            `FR | EN` stays 100% visible at 860 px. */}
        <nav
          id="rdm-steps"
          className="mx-auto hidden min-w-0 items-center gap-0.5 md:flex"
          aria-label="workflow"
        >
          {steps.map((step) => {
            const active = pathname === step.path;
            return (
              <Link
                key={step.path}
                to={step.path}
                aria-label={`Étape ${step.stepOrder}`}
                className={`relative flex min-h-11 shrink-0 items-center gap-1 rounded px-1.5 py-1.5 text-[13px] text-ink-secondary hover:bg-canvas ${active ? "text-accent" : ""}`}
              >
                {step.icon !== undefined ? <step.icon size={14} /> : null}
                <span className="font-data xl:hidden">{step.stepOrder}</span>
                <span className="hidden xl:inline">
                  <Trans>Étape {step.stepOrder}</Trans>
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
        {/* Right zone: undo/redo, telemetry, ⌘K, offline pill, locale. */}
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
            <Undo2 size={14} strokeWidth={1.5} aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Rétablir l'action suivante"
            title="Rétablir (⇧⌘Z)"
            className="hidden h-7 w-7 shrink-0 items-center justify-center rounded border border-hairline text-[12px] text-ink-secondary md:flex"
            onClick={() => redoModel()}
          >
            <Redo2 size={14} strokeWidth={1.5} aria-hidden />
          </button>
          <button
            type="button"
            id="rdm-cmdk"
            className="relative hidden shrink-0 rounded border border-hairline px-2 py-1 font-data text-[11px] text-ink-secondary md:inline"
            onClick={() => window.dispatchEvent(new Event("rdm-open-palette"))}
          >
            ⌘K
            <KeycapHint label="⌘K" />
          </button>
          <OfflinePill />
          <LicenseBadge />
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
        {/* Normative settings + validation modal (compact on mobile). */}
        <div className="flex shrink-0 items-center gap-1">
          <SettingsPopover />
          <button
            type="button"
            onClick={() => setValidationOpen(true)}
            aria-label="Validation — 41 benchmarks analytiques"
            title="Validation — 41 benchmarks analytiques"
            className="flex items-center rounded-md border border-hairline px-2 py-1 text-xs font-medium hover:bg-panel-subtle"
          >
            <BadgeCheck size={14} strokeWidth={1.5} aria-hidden />
            <span className="hidden xl:inline">&nbsp;Validation</span>
          </button>
        </div>
      </header>
      {validationOpen ? <ValidationModal onClose={() => setValidationOpen(false)} /> : null}
      {/* Locked workstation shell — on md+ the main region NEVER page-
          scrolls (each route manages its own panes); on phones the stacked
          routes may scroll under the fixed tab bar. */}
      <main className="min-h-0 flex-1 overflow-auto pb-14 md:overflow-hidden md:pb-0">
        <Outlet />
      </main>
      {/* The ONE persistent 3D stage: mounted once per studio session, it
          overlays the active route's registered slot pane on Steps 1–4 and
          never remounts — orbit/zoom/pan survive navigation. */}
      <PersistentStage />
      {/* Thumb-friendly bottom tab bar, phones only (< 768 px). */}
      {isMobile ? (
        <nav
          className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-stretch border-t border-hairline bg-panel"
          aria-label="workflow mobile"
        >
          {steps.map((step) => {
            const active = pathname === step.path;
            return (
              <Link
                key={step.path}
                to={step.path}
                aria-label={`Étape ${step.stepOrder}`}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] ${active ? "text-accent" : "text-ink-secondary"}`}
              >
                {step.icon !== undefined ? <step.icon size={20} /> : null}
                {step.mobileLabel}
              </Link>
            );
          })}
        </nav>
      ) : null}
      <OnboardingTour />
      <ProjectGalleryModal
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        // The gallery importer shares the ONE unified file path, so
        // .dxf / .step / .igs imports behave exactly like drag-and-drop.
        onImportFile={(file) => {
          void openProjectOrCadFile(file);
        }}
      />
    </div>
  );
}
