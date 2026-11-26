import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useLocation,
  useMatches,
} from "@tanstack/react-router";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { motion } from "motion/react";
import { Trans, useLingui } from "@lingui/react/macro";
import { BadgeCheck, ChevronDown, Redo2, Undo2 } from "lucide-react";
import { retainSearchParams } from "@tanstack/react-router";
import { getStudioSteps } from "@/router";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { SettingsPopover } from "@/components/SettingsPopover";
import { ValidationModal } from "@/components/ValidationModal";
import { OnboardingTour } from "@/components/OnboardingTour";
import { ProjectGalleryModal } from "@/components/ProjectGalleryModal";
import { LicenseBadge } from "@/components/LicenseBadge";
import { SegmentedControl, Tooltip, TooltipGroup } from "@/components/interior";
import { openProjectOrCadFile } from "@/hooks/useFileOpening";
import { redoModel, undoModel, useProjectStore } from "@/state/projectStore";
import { parseProject } from "@/lib/urlShare";
import { quickStartProject, rehydrateProject, type QuickStartKind } from "@/state/projectStore";
import { PersistentStage } from "@/viewport3d/PersistentStage";
import { KeycapHint } from "@/components/KeycapHints";
import { StudioBaseSearchSchema, type StudioBaseSearch } from "@/schemas/searchParams.schema";

/**
 * `_studio` pathless layout (v2.1.2): the locked `100dvh` CAD workstation
 * — the redesigned 48px Swiss Metrology header (h-12, uniform 28px h-7
 * controls, grouped hairline dividers), the 5-step workflow bar (derived
 * from `getStudioSteps()`), the ONE persistent 3D stage and the phone tab
 * bar live here, NOT in `__root`.
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

/**
 * v2.1.2 header locale switch: the interior.dev `SegmentedControl`
 * (shared `layoutId` spring pill, zero layout jump) at the uniform h-7
 * height — the FR / EN buttons keep their exact accessible names for the
 * v1.6.0 layout matrix.
 */
export function LocaleSwitch() {
  const current = useProjectLocale();
  const { t } = useLingui();
  const switchLocale = async (locale: "fr" | "en") => {
    const { activateLocale } = await import("@/i18n/i18n");
    await activateLocale(locale);
  };
  return (
    <SegmentedControl
      size="sm"
      className="shrink-0"
      label={t`Langue de l'interface`}
      value={current}
      onValueChange={(next) => void switchLocale(next === "en" ? "en" : "fr")}
      options={[
        { value: "fr", label: "FR" },
        { value: "en", label: "EN" },
      ]}
    />
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
      <span className="hidden font-data text-[11px] text-ink-muted 2xl:inline">
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

/**
 * v2.1.2 inline-editable project title: click to edit, `Enter` saves
 * (`setName`), `Escape` cancels, blur commits the draft unchanged.
 */
function ProjectTitle({ name }: { name: string }) {
  const setName = useProjectStore((s) => s.setName);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) {
      inputRef.current?.select();
    }
  }, [editing]);
  if (!editing) {
    return (
      <button
        type="button"
        title="Renommer le projet"
        className="hidden min-w-0 max-w-[220px] truncate rounded px-1 py-0.5 text-left text-[12px] font-medium text-ink-primary hover:bg-panel-subtle md:block"
        data-testid="project-title"
        onClick={() => {
          setDraft(name);
          setEditing(true);
        }}
      >
        {name}
      </button>
    );
  }
  return (
    <input
      ref={inputRef}
      value={draft}
      aria-label="Nom du projet"
      data-testid="project-title-input"
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          const trimmed = draft.trim();
          if (trimmed.length > 0) setName(trimmed);
          setEditing(false);
        }
        if (e.key === "Escape") {
          setDraft(name);
          setEditing(false);
        }
      }}
      onBlur={() => {
        setEditing(false);
      }}
      className="font-data h-7 w-44 rounded-[4px] border border-accent-ring bg-panel px-1.5 text-[12px] text-ink-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-ring"
    />
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
  // v2.1.1: the ⌘K palette opens the Validation modal and the project
  // gallery through window events (the header owns both modals).
  useEffect(() => {
    const openValidation = () => setValidationOpen(true);
    const openGallery = () => setGalleryOpen(true);
    window.addEventListener("rdm-open-validation", openValidation);
    window.addEventListener("rdm-open-gallery", openGallery);
    return () => {
      window.removeEventListener("rdm-open-validation", openValidation);
      window.removeEventListener("rdm-open-gallery", openGallery);
    };
  }, []);
  // The stage renders only while the active leaf route declares
  // `stageVisible` in its staticData (report → false).
  const stageVisible = matches.at(-1)?.staticData.stageVisible === true;
  void stageVisible;

  return (
    <div className="flex h-[100dvh] flex-col">
      {/* v2.1.2 — the redesigned 48px header: no `overflow-hidden` on the
          header itself (the portal Settings popover can never clip); every
          zone shrinks via min-w-0 / truncate, and the uniform h-7 (28px)
          controls sit between grouped vertical hairlines. Zero overflow
          verified at 1440×900, 860×900 and 390×844. */}
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-hairline bg-panel pl-3 pr-2 sm:gap-3 sm:pl-4 sm:pr-3">
        {/* Left zone: brand + inline project title + gallery trigger. */}
        <div className="flex min-w-0 shrink items-center gap-1">
          <Link
            to="/geometry"
            id="rdm-logo"
            className="flex shrink-0 items-center gap-1.5 text-accent"
          >
            <img src="/logo-rdm-studio.svg" alt="RDM Studio" className="h-6 w-6 shrink-0" />
            <span className="hidden font-semibold tracking-tight xl:inline">RDM Studio</span>
          </Link>
          {/* The gallery trigger stays a DIRECT sibling of #rdm-logo (the
              `#rdm-logo ~ button` selector contract). */}
          <Tooltip label={<Trans>Galerie de projets</Trans>} side="bottom">
            <button
              type="button"
              aria-label="Galerie de projets"
              title="Galerie de projets"
              className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-[4px] text-ink-muted hover:bg-panel-subtle hover:text-accent md:flex"
              onClick={() => setGalleryOpen(true)}
            >
              <ChevronDown size={14} strokeWidth={1.5} aria-hidden />
            </button>
          </Tooltip>
          <span className="hidden font-data text-ink-muted md:inline">/</span>
          <ProjectTitle name={project.name} />
          <span className="font-data hidden shrink-0 text-[11px] text-ink-muted 2xl:inline">
            {nodeCount} nœuds · {beamCount} poutres
          </span>
        </div>
        {/* Center zone: the unified hairline SEGMENTED workflow rail —
            crisp white active card + Cobalt text + 2px underline. */}
        <nav
          id="rdm-steps"
          className="mx-auto hidden min-w-0 items-center overflow-hidden rounded-[6px] border border-hairline bg-panel-subtle/70 p-0.5 md:flex"
          aria-label="workflow"
        >
          {steps.map((step) => {
            const active = pathname === step.path;
            return (
              <Link
                key={step.path}
                to={step.path}
                aria-label={`Étape ${step.stepOrder}`}
                aria-current={active ? "page" : undefined}
                title={step.label}
                className={`relative flex h-9 shrink-0 items-center gap-1 rounded-[4px] px-1.5 text-[12px] ${
                  active
                    ? "bg-panel font-semibold text-accent shadow-[0_0_0_1px_var(--color-hairline)]"
                    : "text-ink-secondary hover:bg-panel/60"
                }`}
              >
                {step.icon !== undefined ? (
                  <span className="hidden shrink-0 xl:inline">
                    <step.icon size={14} />
                  </span>
                ) : null}
                <span className="whitespace-nowrap">
                  {step.stepOrder}. {step.mobileLabel}
                </span>
                {active ? (
                  <motion.span
                    layoutId="stepper-underline"
                    className="absolute inset-x-1.5 -bottom-px h-[2px] bg-accent"
                  />
                ) : null}
              </Link>
            );
          })}
        </nav>
        {/* Right zone: uniform h-7 action groups separated by vertical
            hairlines — Undo | Redo, ⌘K, offline/license telemetry (2xl+),
            Réglages, 41/41 validation, ?, FR | EN. Secondary pills hide
            below 2xl so the named stepper never overflows. */}
        <div className="ml-auto flex shrink-0 items-center gap-1.5 md:ml-0">
          <TooltipGroup className="hidden md:inline-flex md:items-center md:gap-1.5">
            <div className="flex items-center rounded-[4px] border border-hairline bg-panel p-0.5">
              <Tooltip label="Annuler (⌘Z)">
                <button
                  type="button"
                  aria-label="Annuler la dernière action"
                  title="Annuler (⌘Z)"
                  className="flex h-7 w-7 items-center justify-center rounded-[3px] text-ink-secondary hover:bg-panel-subtle hover:text-ink-primary"
                  onClick={() => undoModel()}
                >
                  <Undo2 size={14} strokeWidth={1.5} aria-hidden />
                </button>
              </Tooltip>
              <span className="h-5 w-px bg-hairline" aria-hidden />
              <Tooltip label="Rétablir (⇧⌘Z)">
                <button
                  type="button"
                  aria-label="Rétablir l'action suivante"
                  title="Rétablir (⇧⌘Z)"
                  className="flex h-7 w-7 items-center justify-center rounded-[3px] text-ink-secondary hover:bg-panel-subtle hover:text-ink-primary"
                  onClick={() => redoModel()}
                >
                  <Redo2 size={14} strokeWidth={1.5} aria-hidden />
                </button>
              </Tooltip>
            </div>
          </TooltipGroup>
          <button
            type="button"
            id="rdm-cmdk"
            className="font-data relative hidden h-7 shrink-0 items-center rounded-[4px] border border-hairline bg-panel px-2 text-[11px] text-ink-secondary hover:bg-panel-subtle hover:text-ink-primary md:flex"
            onClick={() => window.dispatchEvent(new Event("rdm-open-palette"))}
          >
            ⌘K
            <KeycapHint label="⌘K" />
          </button>
          <OfflinePill />
          <LicenseBadge />
          <span className="h-5 w-px bg-hairline max-md:hidden" aria-hidden />
          <SettingsPopover />
          <button
            type="button"
            onClick={() => setValidationOpen(true)}
            aria-label="Validation — 41 benchmarks analytiques"
            title="Validation — 41 benchmarks analytiques"
            className="flex h-7 shrink-0 items-center justify-center gap-1 rounded-[4px] border border-hairline bg-panel px-1.5 text-[12px] font-medium text-ink-secondary hover:bg-panel-subtle hover:text-ink-primary"
          >
            <BadgeCheck size={14} strokeWidth={1.5} className="text-pass-text" aria-hidden />
            <span className="hidden 2xl:inline font-data">41 / 41</span>
          </button>
          <Tooltip label={<Trans>Visite guidée illustrée</Trans>} side="bottom">
            <button
              type="button"
              aria-label="Aide"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] border border-hairline bg-panel text-[12px] text-ink-secondary hover:bg-panel-subtle hover:text-ink-primary"
              onClick={() => window.dispatchEvent(new Event("rdm-start-tour"))}
            >
              ?
            </button>
          </Tooltip>
          <span className="h-5 w-px bg-hairline max-md:hidden" aria-hidden />
          <LocaleSwitch />
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
