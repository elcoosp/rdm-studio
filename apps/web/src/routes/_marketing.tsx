import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Trans } from "@lingui/react/macro";
import { ArrowRight } from "lucide-react";
import { LicenseBadge } from "@/components/LicenseBadge";
import { LocaleSwitch } from "./_studio";

/**
 * `_marketing` pathless layout (v2.1.0): the commercial surface of the
 * product — the landing page at `/` and the legal pages at `/legal`. Pure
 * document scrolling (normal flow, no locked viewport), the editorial
 * _Swiss Metrology_ header with the single `/docs` hand-off to the
 * Astro Starlight documentation package (NOT bundled inside the PWA), and
 * the shared footer. ZERO legacy redirect logic: `/` renders here.
 */
export const Route = createFileRoute("/_marketing")({
  staticData: { surface: "marketing" },
  component: MarketingLayout,
});

function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-panel/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2 text-accent">
          <img src="/logo-rdm-studio.svg" alt="" className="h-7 w-7 shrink-0" />
          <span className="font-semibold tracking-tight text-ink-primary">RDM Studio</span>
        </Link>
        <nav
          className="hidden items-center gap-5 text-[13px] text-ink-secondary md:flex"
          aria-label="principale"
        >
          {/* v2.1.1: TanStack `Link` with hash — clicking Fonctionnalités /
              Tarifs from /legal navigates cleanly back to `/` and scrolls
              to the section, and the active link gets the Cobalt tint
              pill via `activeProps`. */}
          <Link
            to="/"
            hash="fonctionnalites"
            hashScrollIntoView={true}
            activeProps={{
              className: "rounded bg-accent-tint px-2 py-1 font-semibold text-accent",
            }}
            className="hover:text-ink-primary"
          >
            <Trans>Fonctionnalités</Trans>
          </Link>
          <Link
            to="/"
            hash="tarifs"
            hashScrollIntoView={true}
            activeProps={{
              className: "rounded bg-accent-tint px-2 py-1 font-semibold text-accent",
            }}
            className="hover:text-ink-primary"
          >
            <Trans>Tarifs</Trans>
          </Link>
          <Link
            to="/legal"
            activeProps={{
              className: "rounded bg-accent-tint px-2 py-1 font-semibold text-accent",
            }}
            className="hover:text-ink-primary"
          >
            <Trans>Légal</Trans>
          </Link>
          <a
            href="/docs/"
            target="_blank"
            rel="noreferrer"
            className="hover:text-ink-primary"
            data-testid="docs-link"
          >
            <Trans>
              Documentation <span aria-hidden>↗</span>
            </Trans>
          </a>
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <LicenseBadge />
          <LocaleSwitch />
          <Link
            to="/geometry"
            data-testid="cta-open-studio"
            className="hidden items-center gap-1 rounded bg-accent px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-accent-hover sm:flex"
          >
            <Trans>Ouvrir l'atelier 3D</Trans>
            <ArrowRight size={14} strokeWidth={1.5} aria-hidden />
          </Link>
        </div>
      </div>
    </header>
  );
}

function MarketingFooter() {
  return (
    <footer className="border-t border-hairline bg-panel">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:px-6 md:grid-cols-[1fr_auto_auto_auto]">
        <div className="flex items-start gap-2 text-accent">
          <img src="/logo-rdm-studio.svg" alt="" className="h-7 w-7 shrink-0" />
          <div>
            <p className="font-semibold tracking-tight text-ink-primary">RDM Studio</p>
            <p className="mt-1 max-w-xs text-[12px] leading-4 text-ink-secondary">
              <Trans>
                Atelier de calcul de structures 3D local-first — solveur Rust/WASM, Eurocodes EN
                1990 → 1999, zéro cloud.
              </Trans>
            </p>
          </div>
        </div>
        <nav className="text-[12px]" aria-label="produit">
          <p className="font-data mb-1.5 text-[11px] text-ink-muted">
            <Trans>Produit</Trans>
          </p>
          <Link
            to="/"
            hash="fonctionnalites"
            hashScrollIntoView={true}
            className="block py-0.5 text-ink-secondary hover:text-ink-primary"
          >
            <Trans>Fonctionnalités</Trans>
          </Link>
          <Link
            to="/"
            hash="tarifs"
            hashScrollIntoView={true}
            className="block py-0.5 text-ink-secondary hover:text-ink-primary"
          >
            <Trans>Tarifs</Trans>
          </Link>
          <Link to="/geometry" className="block py-0.5 text-ink-secondary hover:text-ink-primary">
            <Trans>Ouvrir l'atelier 3D</Trans>
          </Link>
        </nav>
        <nav className="text-[12px]" aria-label="documentation">
          <p className="font-data mb-1.5 text-[11px] text-ink-muted">
            <Trans>Documentation</Trans>
          </p>
          <a
            href="/docs/"
            target="_blank"
            rel="noreferrer"
            className="block py-0.5 text-ink-secondary hover:text-ink-primary"
          >
            <Trans>
              Guides & tutoriels <span aria-hidden>↗</span>
            </Trans>
          </a>
          <a
            href="/docs/"
            target="_blank"
            rel="noreferrer"
            className="block py-0.5 text-ink-secondary hover:text-ink-primary"
          >
            <Trans>
              API & validation <span aria-hidden>↗</span>
            </Trans>
          </a>
        </nav>
        <nav className="text-[12px]" aria-label="légal">
          <p className="font-data mb-1.5 text-[11px] text-ink-muted">
            <Trans>Légal</Trans>
          </p>
          <Link to="/legal" className="block py-0.5 text-ink-secondary hover:text-ink-primary">
            <Trans>Mentions légales (LCEN)</Trans>
          </Link>
          <Link
            to="/legal"
            hash="rgpd"
            className="block py-0.5 text-ink-secondary hover:text-ink-primary"
          >
            <Trans>Confidentialité RGPD</Trans>
          </Link>
          <Link
            to="/legal"
            hash="responsabilite"
            className="block py-0.5 text-ink-secondary hover:text-ink-primary"
          >
            <Trans>Responsabilité de l'ingénieur</Trans>
          </Link>
        </nav>
      </div>
      <div className="border-t border-hairline">
        <p className="font-data mx-auto max-w-6xl px-4 py-3 text-[11px] text-ink-muted sm:px-6">
          © {new Date().getFullYear()} RDM Studio —{" "}
          <Trans>fonctionne entièrement sur votre poste.</Trans>
        </p>
      </div>
    </footer>
  );
}

function MarketingLayout() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-canvas">
      <MarketingHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <MarketingFooter />
    </div>
  );
}
