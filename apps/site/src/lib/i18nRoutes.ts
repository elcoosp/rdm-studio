/**
 * Bilingual route map (FR `/` + EN `/en`) — the single source of truth for
 * locale-aware routing, hreflang alternates and the FR | EN switcher.
 *
 * FR is the canonical locale (x-default) at the root; EN mirrors live under
 * `/en` with localized SEO slugs.
 */

export type SiteLocale = "fr" | "en";

export const LOCALE_ROUTE_PAIRS: ReadonlyArray<{ fr: string; en: string }> = [
  { fr: "/", en: "/en" },
  { fr: "/legal", en: "/en/legal" },
  { fr: "/calcul-poutre-ipe", en: "/en/ipe-beam-calculator" },
  { fr: "/calcul-portique-eurocode-3", en: "/en/portal-frame-eurocode-3" },
  { fr: "/calcul-berceau-levage-naval", en: "/en/naval-lifting-cradle" },
  { fr: "/calcul-poutre-bois-eurocode-5", en: "/en/timber-beam-eurocode-5" },
];

/**
 * Normalize a URL path or an Oxide route id (`routes/en/legal`,
 * `routes/index`) to a site path (`/en/legal`, `/`). Query and hash are
 * stripped.
 */
export function normalizeRoutePath(path: string | undefined | null): string {
  if (!path) return "/";
  let p = path;
  if (p.startsWith("routes/")) p = p.slice("routes/".length);
  p = p.split(/[?#]/)[0] ?? "";
  if (p === "index") return "/";
  return p.startsWith("/") ? p : `/${p}`;
}

/**
 * Resolve the active locale from a URL path (`/en/...`) or an Oxide route id
 * (`routes/en/...`). Anything that is not under `/en` is French.
 */
export function localeFromPath(path: string | undefined | null): SiteLocale {
  const norm = normalizeRoutePath(path);
  if (norm === "/en" || norm.startsWith("/en/")) return "en";
  return "fr";
}

/** Return the localized counterpart of a path (identity outside the map). */
export function pairedRoute(path: string, locale: SiteLocale): string {
  const norm = normalizeRoutePath(path);
  for (const pair of LOCALE_ROUTE_PAIRS) {
    if (pair.fr === norm) return locale === "fr" ? pair.fr : pair.en;
    if (pair.en === norm) return locale === "fr" ? pair.fr : pair.en;
  }
  return locale === "en" ? `/en${norm === "/" ? "" : norm}` : norm;
}

/** `og:locale` value for a site locale. */
export function ogLocale(locale: SiteLocale): string {
  return locale === "fr" ? "fr_FR" : "en_US";
}

/**
 * hreflang alternates for a route pair. `x-default` points at the French
 * (canonical) URL, per the site's FR-first SEO.
 */
export function hreflangLinks(
  frPath: string,
  enPath: string,
  siteUrl: string,
): Array<Record<string, string>> {
  return [
    { rel: "alternate", hreflang: "fr", href: `${siteUrl}${frPath}` },
    { rel: "alternate", hreflang: "en", href: `${siteUrl}${enPath}` },
    { rel: "alternate", hreflang: "x-default", href: `${siteUrl}${frPath}` },
  ];
}
