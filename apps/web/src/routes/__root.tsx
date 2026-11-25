import { createRootRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Trans } from "@lingui/react/macro";
import { IconFrame, IconLoad, IconReport, IconResults, IconSupport } from "@/components/icons";

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
    <div className="ml-auto flex shrink-0 gap-1 text-[11px]">
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

function RootLayout() {
  const pathname = useLocation().pathname;
  return (
    <div className="flex h-[100dvh] flex-col">
      <header className="flex h-11 items-center gap-2 overflow-hidden border-b border-hairline bg-panel px-3 sm:gap-4 sm:px-4">
        <Link to="/geometry" className="flex shrink-0 items-center gap-2 text-accent">
          <IconFrame size={18} />
          <span className="hidden font-semibold tracking-tight sm:inline">RDM Studio</span>
        </Link>
        <nav className="flex min-w-0 items-center gap-1 overflow-x-auto" aria-label="workflow">
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
                    className="absolute inset-x-1 -bottom-px h-px bg-accent"
                  />
                ) : null}
              </Link>
            );
          })}
        </nav>
        <LocaleSwitch />
      </header>
      <main className="min-h-0 flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

export const Route = createRootRoute({ component: RootLayout });
