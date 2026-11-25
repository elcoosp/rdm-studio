import { createRootRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { Trans } from "@lingui/react/macro";
import { IconFrame, IconLoad, IconReport, IconResults, IconSupport } from "@/components/icons";
import { UpdatePrompt } from "@/components/UpdatePrompt";
import { CommandPalette } from "@/components/CommandPalette";
import { ProjectGalleryModal } from "@/components/ProjectGalleryModal";
import { useProjectStore } from "@/state/projectStore";
import { KeycapHint } from "@/components/KeycapHints";

const STEPS = [
  { to: "/geometry", icon: IconFrame },
  { to: "/supports", icon: IconSupport },
  { to: "/loads", icon: IconLoad },
  { to: "/results", icon: IconResults },
  { to: "/report", icon: IconReport },
] as const;

function LocaleSwitch() {
  const switchLocale = async (locale: "fr" | "en") => {
    const { activateLocale } = await import("@/i18n/i18n");
    await activateLocale(locale);
  };
  return (
    <div className="flex shrink-0 gap-1 text-[11px]">
      <button
        type="button"
        className="rounded border border-hairline px-2 py-0.5"
        onClick={() => void switchLocale("fr")}
      >
        FR
      </button>
      <button
        type="button"
        className="rounded border border-hairline px-2 py-0.5"
        onClick={() => void switchLocale("en")}
      >
        EN
      </button>
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
      <span className="hidden font-data text-[11px] text-ink-muted md:inline">
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

const TOUR_STEPS = [
  {
    element: "#rdm-logo",
    popover: { title: "RDM Studio", description: "Galerie de projets et modèles types." },
  },
  {
    element: "#rdm-steps",
    popover: {
      title: "5 étapes",
      description: "Géométrie → Liaisons → Charges → Calcul → Rapport.",
    },
  },
  { element: "#rdm-cmdk", popover: { title: "⌘K", description: "Palette de commandes clavier." } },
];

function RootLayout() {
  const pathname = useLocation().pathname;
  const project = useProjectStore((s) => s.project);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const nodeCount = project.structure.nodes.length;
  const beamCount = project.structure.beams.length;
  const isMobile = typeof window !== "undefined" && window.innerWidth < 1024;

  return (
    <div className="flex h-[100dvh] flex-col">
      <header className="flex h-11 items-center gap-2 overflow-hidden border-b border-hairline bg-panel px-3 sm:gap-3 sm:px-4">
        <Link
          to="/geometry"
          id="rdm-logo"
          className="flex shrink-0 items-center gap-1.5 text-accent"
        >
          <img src="/logo-rdm-studio.svg" alt="RDM Studio" className="h-6 w-6 shrink-0" />
          <span className="hidden font-semibold tracking-tight sm:inline">RDM Studio</span>
          <span className="hidden text-[12px] text-ink-muted md:inline">/ {project.name}</span>
        </Link>
        <button
          type="button"
          aria-label="Galerie de projets"
          className="hidden shrink-0 rounded px-1 py-0.5 text-[12px] text-ink-muted hover:text-accent md:inline"
          onClick={() => setGalleryOpen(true)}
        >
          ▾
        </button>
        <nav
          id="rdm-steps"
          className="hidden min-w-0 items-center gap-1 overflow-x-auto lg:flex"
          aria-label="workflow"
        >
          {STEPS.map((step, index) => {
            const active = pathname === step.to;
            return (
              <Link
                key={step.to}
                to={step.to}
                aria-label={`Étape ${index + 1}`}
                className={`relative flex min-h-11 shrink-0 items-center gap-1.5 rounded px-2 py-1.5 text-[13px] text-ink-secondary hover:bg-canvas ${active ? "text-accent" : ""}`}
              >
                <step.icon size={14} />
                <span className="hidden sm:inline">
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
        <span className="font-data hidden shrink-0 text-[11px] text-ink-muted lg:inline">
          {nodeCount} nœuds · {beamCount} poutres
        </span>
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
          onClick={() =>
            driver({
              steps: TOUR_STEPS,
              showProgress: true,
              nextBtnText: "Suivant",
              prevBtnText: "Retour",
              doneBtnText: "Terminé",
            }).drive()
          }
        >
          ?
        </button>
        <LocaleSwitch />
      </header>
      <main className="min-h-0 flex-1 overflow-auto pb-14 lg:pb-0">
        <Outlet />
        <UpdatePrompt />
      </main>
      {/* Thumb-friendly bottom tab bar, mobile only (DESIGN.md §4). */}
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
                {["Géométrie", "Liaisons", "Charges", "Résultats", "Rapport"][index]}
              </Link>
            );
          })}
        </nav>
      ) : null}
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <ProjectGalleryModal open={galleryOpen} onClose={() => setGalleryOpen(false)} />
    </div>
  );
}

export const Route = createRootRoute({ component: RootLayout });
