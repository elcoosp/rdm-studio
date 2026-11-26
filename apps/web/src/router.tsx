import type { ComponentType } from "react";
import { createRouter } from "@tanstack/react-router";
import { Link, type ErrorComponentProps } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

/**
 * Typed router instance (v2.1.0 URL-first refactor): the router is created
 * ONCE here so `getStudioSteps()` can derive the workflow dynamically from
 * `staticData` — zero hardcoded STEPS arrays anywhere in the app — and so
 * `Register` / `StaticDataRouteOption` module augmentation lives next to
 * the instance it describes.
 */

/** Full-bleed marketing/studio-independent 404 (_Swiss Metrology_ card). */
function NotFoundCard() {
  return (
    <div
      className="flex min-h-[50vh] w-full flex-col items-center justify-center gap-3 bg-canvas px-6 py-16 text-center"
      data-testid="not-found-card"
    >
      <p className="font-data text-[13px] tracking-wide text-ink-muted">404</p>
      <h1 className="max-w-md text-balance text-[24px] font-semibold leading-8 text-ink-primary">
        Cette page n'existe pas dans l'atelier.
      </h1>
      <p className="max-w-md text-[14px] leading-5 text-ink-secondary">
        Le modèle courant est intact : il reste enregistré en local et vous pouvez reprendre le
        calcul là où vous l'avez laissé.
      </p>
      <Link
        to="/geometry"
        className="mt-2 rounded bg-accent px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-accent-hover"
      >
        Retour à l'atelier 3D →
      </Link>
    </div>
  );
}

/** Router-level error boundary with a safe recovery path. */
function ErrorCard({ error, reset }: ErrorComponentProps) {
  return (
    <div
      className="flex min-h-[50vh] w-full flex-col items-center justify-center gap-3 bg-canvas px-6 py-16 text-center"
      data-testid="error-card"
    >
      <h1 className="max-w-md text-balance text-[24px] font-semibold leading-8 text-ink-primary">
        Une erreur inattendue est survenue.
      </h1>
      <p className="font-data max-w-md break-all text-[12px] leading-4 text-ink-secondary">
        {error instanceof Error ? error.message : String(error)}
      </p>
      <p className="max-w-md text-[14px] leading-5 text-ink-secondary">
        Votre projet est enregistré en local (IndexedDB) — aucune donnée n'est perdue.
      </p>
      <button
        type="button"
        className="mt-2 rounded bg-accent px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-accent-hover"
        onClick={() => {
          void import("@/state/projectStore").then(({ rehydrateProject }) => rehydrateProject());
          reset();
        }}
      >
        Recharger l'atelier en sécurité →
      </button>
    </div>
  );
}

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  defaultStructuralSharing: true,
  // v2.1.2: native View Transitions on every route navigation — a crisp
  // 160 ms cross-fade (see the `::view-transition-*` rules in app.css)
  // with the persistent 3D stage PINNED (`view-transition-name: none` on
  // [data-testid="persistent-stage"]) so the WebGL canvas never flickers
  // between /, /legal, /geometry and /report. Respects
  // `prefers-reduced-motion` (document.hidden-aware in TanStack core).
  defaultViewTransition: true,
  defaultNotFoundComponent: NotFoundCard,
  defaultErrorComponent: ErrorCard,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

declare module "@tanstack/router-core" {
  interface StaticDataRouteOption {
    /** UI family the route belongs to (drives layout-dependent chrome). */
    surface?: "marketing" | "studio";
    /** 1-based position in the studio workflow bar. */
    stepOrder?: number;
    /** Full label in the desktop step bar / command palette. */
    label?: string;
    /** Compact label in the phone bottom tab bar. */
    mobileLabel?: string;
    /** Workflow icon (24px custom engineering iconography). */
    icon?: ComponentType<{ size?: number; className?: string }>;
    /** Whether the persistent 3D stage overlays this route's slot pane. */
    stageVisible?: boolean;
    /** Keyboard hint surfaced in tooltips / the palette. */
    shortcut?: string;
  }
}

/** One derived workflow step (replaces every hardcoded STEPS array). */
export interface StudioStep {
  /** Route path (`/geometry`, `/supports`, …). */
  path: string;
  label: string;
  mobileLabel: string;
  icon: ComponentType<{ size?: number; className?: string }> | undefined;
  stageVisible: boolean;
  shortcut?: string;
  stepOrder: number;
}

/**
 * Derives the 5 studio steps dynamically from the registered route tree:
 * routes carrying `staticData.surface === "studio"` AND a `stepOrder`,
 * sorted by that order. Adding a 6th step in the file tree is the ONLY
 * change needed to extend the workflow bar, the phone tabs, the command
 * palette and the hotkeys.
 */
export function getStudioSteps(): StudioStep[] {
  return Object.values(router.routesById)
    .map((route) => ({ route, staticData: route.options.staticData }))
    .filter(
      (entry) =>
        entry.staticData?.surface === "studio" &&
        typeof entry.staticData?.stepOrder === "number" &&
        entry.staticData?.stepOrder > 0,
    )
    .sort((a, b) => (a.staticData?.stepOrder ?? 0) - (b.staticData?.stepOrder ?? 0))
    .map(({ route, staticData }) => ({
      path: route.fullPath,
      label: staticData?.label ?? route.fullPath,
      mobileLabel: staticData?.mobileLabel ?? staticData?.label ?? route.fullPath,
      icon: staticData?.icon,
      stageVisible: staticData?.stageVisible === true,
      shortcut: staticData?.shortcut,
      stepOrder: staticData?.stepOrder ?? 0,
    }));
}
