import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { I18nProvider, Trans } from "@lingui/react";
import { SegmentedControl } from "@rdm-studio/ui/interior";
import { BrandMark } from "@rdm-studio/ui/primitives";
import { docsHref, studioHref } from "../lib/env";
import { activateSiteLocale, currentSiteLocale, i18n } from "../i18n/i18n";
import { trackSiteEvent, trackLocaleSwitched } from "../lib/productTelemetry";
import {
  localeFromPath,
  normalizeRoutePath,
  pairedRoute,
  type SiteLocale,
} from "../lib/i18nRoutes";
import "../styles/app.css";

/**
 * Root layout (v2.3.0) — the v2.1.2 `_marketing` pathless layout ported
 * verbatim: the editorial _Swiss Metrology_ header with the single docs
 * hand-off to the Starlight documentation host (NOT bundled here), the
 * shared footer, and pure document scrolling. TanStack `Link`s became
 * plain anchors (a static export needs no client router) and every
 * cross-app URL resolves through `lib/env.ts` (`PUBLIC_APP_URL` /
 * `PUBLIC_DOCS_URL`, beta `.vercel.app` defaults).
 *
 * i18n (v2.3.0): `RootLayout` activates the route's locale on the Lingui
 * singleton BEFORE any string is read — SSR and client hydration both
 * render this component first — and wraps the tree in `<I18nProvider>`.
 * The header carries a FR | EN `<SegmentedControl>` that navigates to the
 * paired localized route (`LOCALE_ROUTE_PAIRS`). All header/footer links
 * are locale-prefixed (`/en/...` on EN pages); `studioHref`/`docsHref`
 * forward the active locale (`&lang=` / `/fr/...`).
 */

interface Props {
  children?: ReactNode;
  route?: string;
  url?: string;
}

export const meta = {
  meta: [{ name: "theme-color", content: "#F8FAFC" }],
  link: [{ rel: "icon", type: "image/png", href: "/logo-rdm-studio.png" }],
};

/** Prefix a site path with the EN locale segment (FR is the root). */
function locPath(locale: SiteLocale, path: string): string {
  return locale === "en" ? `/en${path}` : path;
}

function MarketingHeader({ route, url }: { route?: string; url?: string }) {
  const locale = currentSiteLocale();
  const currentPath = normalizeRoutePath(route ?? url);
  const home = locPath(locale, "/");
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-panel/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <a href={home} className="flex shrink-0 items-center gap-2 text-accent">
          <BrandMark size="sm" />
        </a>
        <nav
          className="hidden items-center gap-5 text-[13px] text-ink-secondary md:flex"
          aria-label={i18n._({ id: "site.header.nav.aria", message: "principale" })}
        >
          <a
            href={`${home}#fonctionnalites`}
            className="rounded px-2 py-1 hover:text-ink-primary hover:bg-accent-tint"
          >
            <Trans id="site.header.nav.features" message="Fonctionnalités" />
          </a>
          <a
            href={`${home}#modeles`}
            className="rounded px-2 py-1 hover:text-ink-primary hover:bg-accent-tint"
          >
            <Trans id="site.header.nav.models" message="Modèles" />
          </a>
          <a
            href={`${home}#open-source`}
            className="rounded px-2 py-1 hover:text-ink-primary hover:bg-accent-tint"
          >
            <Trans id="site.header.nav.openSource" message="Open Source" />
          </a>
          <a
            href={locPath(locale, "/legal")}
            className="rounded px-2 py-1 hover:text-ink-primary hover:bg-accent-tint"
          >
            <Trans id="site.header.nav.legal" message="Légal" />
          </a>
          <a
            href={docsHref("/")}
            target="_blank"
            rel="noreferrer"
            className="hover:text-ink-primary"
            data-testid="docs-link"
          >
            <Trans id="site.header.nav.docs" message="Documentation" /> <span aria-hidden>↗</span>
          </a>
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <SegmentedControl
            size="sm"
            testId="locale-switcher"
            label={i18n._({ id: "site.header.language.label", message: "Langue" })}
            options={[
              { value: "fr", label: "FR" },
              { value: "en", label: "EN" },
            ]}
            value={locale}
            onValueChange={(next) => {
              const from = locale;
              const to = next as SiteLocale;
              void trackLocaleSwitched(from, to);
              window.location.href = pairedRoute(currentPath, next as SiteLocale);
            }}
          />
          <a
            href={studioHref("/geometry")}
            data-testid="cta-open-studio"
            className="hidden items-center gap-1 rounded bg-accent px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-accent-strong sm:flex"
            onClick={() => void trackSiteEvent("seo_page_cta_clicked", { template: "home" })}
          >
            <Trans id="site.header.cta.openStudio" message="Ouvrir l'atelier 3D" />
            <ArrowRight size={14} strokeWidth={1.5} aria-hidden />
          </a>
        </div>
      </div>
    </header>
  );
}

function MarketingFooter() {
  const locale = currentSiteLocale();
  const home = locPath(locale, "/");
  const legal = locPath(locale, "/legal");
  return (
    <footer className="border-t border-hairline bg-panel">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:px-6 md:grid-cols-[1fr_auto_auto_auto]">
        <div className="flex flex-col items-start gap-2">
          <BrandMark size="md" />
          <p className="mt-1 max-w-xs text-[12px] leading-4 text-ink-secondary">
            <Trans
              id="site.footer.tagline"
              message="Atelier de calcul de structures 3D local-first — solveur Rust/WASM, Eurocodes EN 1990 → 1999, zéro cloud."
            />
          </p>
        </div>
        <nav
          className="text-[12px]"
          aria-label={i18n._({ id: "site.footer.col.product", message: "Produit" })}
        >
          <p className="font-data mb-1.5 text-[11px] text-ink-muted">
            <Trans id="site.footer.col.product" message="Produit" />
          </p>
          <a
            href={`${home}#fonctionnalites`}
            className="block py-0.5 text-ink-secondary hover:text-ink-primary"
          >
            <Trans id="site.header.nav.features" message="Fonctionnalités" />
          </a>
          <a
            href={`${home}#modeles`}
            className="block py-0.5 text-ink-secondary hover:text-ink-primary"
          >
            <Trans id="site.header.nav.models" message="Modèles" />
          </a>
          <a
            href={`${home}#open-source`}
            className="block py-0.5 text-ink-secondary hover:text-ink-primary"
          >
            <Trans id="site.header.nav.openSource" message="Open Source" />
          </a>
          <a
            href={studioHref("/geometry")}
            className="block py-0.5 text-ink-secondary hover:text-ink-primary"
            onClick={() => void trackSiteEvent("seo_page_cta_clicked", { template: "home" })}
          >
            <Trans id="site.header.cta.openStudio" message="Ouvrir l'atelier 3D" />
          </a>
        </nav>
        <nav
          className="text-[12px]"
          aria-label={i18n._({ id: "site.footer.col.docs", message: "Documentation" })}
        >
          <p className="font-data mb-1.5 text-[11px] text-ink-muted">
            <Trans id="site.footer.col.docs" message="Documentation" />
          </p>
          <a
            href={docsHref("/")}
            target="_blank"
            rel="noreferrer"
            className="block py-0.5 text-ink-secondary hover:text-ink-primary"
          >
            <Trans id="site.footer.docs.guides" message="Guides & tutoriels" />{" "}
            <span aria-hidden>↗</span>
          </a>
          <a
            href={docsHref("/reference/validation-benchmarks/")}
            target="_blank"
            rel="noreferrer"
            className="block py-0.5 text-ink-secondary hover:text-ink-primary"
          >
            <Trans id="site.footer.docs.api" message="API & validation" /> <span aria-hidden>↗</span>
          </a>
        </nav>
        <nav
          className="text-[12px]"
          aria-label={i18n._({ id: "site.footer.col.legal", message: "Légal" })}
        >
          <p className="font-data mb-1.5 text-[11px] text-ink-muted">
            <Trans id="site.footer.col.legal" message="Légal" />
          </p>
          <a href={legal} className="block py-0.5 text-ink-secondary hover:text-ink-primary">
            <Trans id="site.footer.legal.notices" message="Mentions légales (LCEN)" />
          </a>
          <a
            href={`${legal}#rgpd`}
            className="block py-0.5 text-ink-secondary hover:text-ink-primary"
          >
            <Trans id="site.footer.legal.privacy" message="Confidentialité RGPD" />
          </a>
          <a
            href={`${legal}#responsabilite`}
            className="block py-0.5 text-ink-secondary hover:text-ink-primary"
          >
            <Trans
              id="site.footer.legal.liability"
              message="Responsabilité de l'ingénieur"
            />
          </a>
        </nav>
      </div>
      <div className="border-t border-hairline">
        <p className="font-data mx-auto max-w-6xl px-4 py-3 text-[11px] text-ink-muted sm:px-6">
          <Trans
            id="site.footer.copyright"
            message="© {year} RDM Studio — fonctionne entièrement sur votre poste."
            values={{ year: new Date().getFullYear() }}
          />
        </p>
      </div>
    </footer>
  );
}

export default function RootLayout({ children, route, url }: Props) {
  // Locale first: every string below (header, footer, page, islands)
  // reads the singleton, so the route's locale must be active before the
  // first render — SSR and client hydration both enter through here.
  activateSiteLocale(localeFromPath(route ?? url));
  return (
    <I18nProvider i18n={i18n}>
      <div className="flex min-h-[100dvh] flex-col bg-canvas">
        <MarketingHeader route={route} url={url} />
        <main className="flex-1">{children}</main>
        <MarketingFooter />
      </div>
    </I18nProvider>
  );
}
