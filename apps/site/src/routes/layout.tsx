import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { docsHref, studioHref } from "../lib/env";
import "../styles/app.css";

/**
 * Root layout (v2.2.0) — the v2.1.2 `_marketing` pathless layout ported
 * verbatim: the editorial _Swiss Metrology_ header with the single docs
 * hand-off to the Starlight documentation host (NOT bundled here), the
 * shared footer, and pure document scrolling. TanStack `Link`s became
 * plain anchors (a static export needs no client router) and every
 * cross-app URL resolves through `lib/env.ts` (`PUBLIC_APP_URL` /
 * `PUBLIC_DOCS_URL`, beta `.vercel.app` defaults).
 */

interface Props {
  children?: ReactNode;
}

export const meta = {
  meta: [{ name: "theme-color", content: "#F8FAFC" }],
  link: [{ rel: "icon", type: "image/svg+xml", href: "/logo-rdm-studio.svg" }],
};

function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-panel/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <a href="/" className="flex shrink-0 items-center gap-2 text-accent">
          <img src="/logo-rdm-studio.svg" alt="" className="h-7 w-7 shrink-0" />
          <span className="font-semibold tracking-tight text-ink-primary">RDM Studio</span>
        </a>
        <nav className="hidden items-center gap-5 text-[13px] text-ink-secondary md:flex" aria-label="principale">
          <a
            href="/#fonctionnalites"
            className="rounded px-2 py-1 hover:text-ink-primary hover:bg-accent-tint"
          >
            Fonctionnalités
          </a>
          <a href="/#tarifs" className="rounded px-2 py-1 hover:text-ink-primary hover:bg-accent-tint">
            Tarifs
          </a>
          <a
            href="/legal"
            className="rounded px-2 py-1 hover:text-ink-primary hover:bg-accent-tint"
          >
            Légal
          </a>
          <a
            href={docsHref("/")}
            target="_blank"
            rel="noreferrer"
            className="hover:text-ink-primary"
            data-testid="docs-link"
          >
            Documentation <span aria-hidden>↗</span>
          </a>
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href={studioHref("/geometry")}
            data-testid="cta-open-studio"
            className="hidden items-center gap-1 rounded bg-accent px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-accent-strong sm:flex"
          >
            Ouvrir l'atelier 3D
            <ArrowRight size={14} strokeWidth={1.5} aria-hidden />
          </a>
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
              Atelier de calcul de structures 3D local-first — solveur Rust/WASM, Eurocodes EN
              1990 → 1999, zéro cloud.
            </p>
          </div>
        </div>
        <nav className="text-[12px]" aria-label="produit">
          <p className="font-data mb-1.5 text-[11px] text-ink-muted">Produit</p>
          <a
            href="/#fonctionnalites"
            className="block py-0.5 text-ink-secondary hover:text-ink-primary"
          >
            Fonctionnalités
          </a>
          <a href="/#tarifs" className="block py-0.5 text-ink-secondary hover:text-ink-primary">
            Tarifs
          </a>
          <a
            href={studioHref("/geometry")}
            className="block py-0.5 text-ink-secondary hover:text-ink-primary"
          >
            Ouvrir l'atelier 3D
          </a>
        </nav>
        <nav className="text-[12px]" aria-label="documentation">
          <p className="font-data mb-1.5 text-[11px] text-ink-muted">Documentation</p>
          <a
            href={docsHref("/")}
            target="_blank"
            rel="noreferrer"
            className="block py-0.5 text-ink-secondary hover:text-ink-primary"
          >
            Guides & tutoriels <span aria-hidden>↗</span>
          </a>
          <a
            href={docsHref("/reference/validation-benchmarks/")}
            target="_blank"
            rel="noreferrer"
            className="block py-0.5 text-ink-secondary hover:text-ink-primary"
          >
            API & validation <span aria-hidden>↗</span>
          </a>
        </nav>
        <nav className="text-[12px]" aria-label="légal">
          <p className="font-data mb-1.5 text-[11px] text-ink-muted">Légal</p>
          <a href="/legal" className="block py-0.5 text-ink-secondary hover:text-ink-primary">
            Mentions légales (LCEN)
          </a>
          <a
            href="/legal#rgpd"
            className="block py-0.5 text-ink-secondary hover:text-ink-primary"
          >
            Confidentialité RGPD
          </a>
          <a
            href="/legal#responsabilite"
            className="block py-0.5 text-ink-secondary hover:text-ink-primary"
          >
            Responsabilité de l'ingénieur
          </a>
        </nav>
      </div>
      <div className="border-t border-hairline">
        <p className="font-data mx-auto max-w-6xl px-4 py-3 text-[11px] text-ink-muted sm:px-6">
          © {new Date().getFullYear()} RDM Studio — fonctionne entièrement sur votre poste.
        </p>
      </div>
    </footer>
  );
}

export default function RootLayout({ children }: Props) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-canvas">
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
