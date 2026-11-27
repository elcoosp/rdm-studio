/**
 * Per-page head model (Oxide §16.3 `HeadTags`) shared by every
 * `page.server.ts` — one conversion from the site's rich meta model
 * (title / description / canonical / Open Graph / JSON-LD) to the neutral
 * head the framework merges and emits (`<title>`, `<meta>`, `<link
 * rel="canonical|alternate">`, `<script type="application/ld+json">`).
 *
 * `titleTemplate: "%s"` is deliberate: the framework's data-derived head
 * would otherwise append its `%s · Atlas` conformance template to every
 * page title (see `packages/react/src/render.ts` `head()`). The site's
 * titles already carry their own suffix (`— RDM Studio`).
 */
import { SITE_URL } from "./env";
import { hreflangLinks, ogLocale, type SiteLocale } from "./i18nRoutes";

export type PageMetaInput = {
  /** Full `<title>` (already suffixed with `— RDM Studio`). */
  title: string;
  description: string;
  /** Path of this page, e.g. `/calcul-poutre-ipe` or `/en/ipe-beam-calculator`. */
  canonicalPath: string;
  ogType?: "website" | "article";
  ogTitle?: string;
  ogDescription?: string;
  locale: SiteLocale;
  /** FR path of the pair (for hreflang). */
  pairedFrPath: string;
  /** EN path of the pair (for hreflang). */
  pairedEnPath: string;
  /** JSON-LD entries (objects, stringified on emit). */
  jsonLd?: Array<Record<string, unknown>>;
};

export function buildHeadTags(input: PageMetaInput): Record<string, unknown> {
  const canonical = `${SITE_URL}${input.canonicalPath}`;
  const meta: Array<Record<string, string>> = [
    { name: "description", content: input.description },
    { property: "og:title", content: input.ogTitle ?? input.title },
    { property: "og:description", content: input.ogDescription ?? input.description },
    { property: "og:url", content: canonical },
    { property: "og:type", content: input.ogType ?? "article" },
    { property: "og:site_name", content: "RDM Studio" },
    { property: "og:locale", content: ogLocale(input.locale) },
  ];
  const link: Array<Record<string, string>> = [
    { rel: "canonical", href: canonical },
    ...hreflangLinks(input.pairedFrPath, input.pairedEnPath, SITE_URL),
  ];
  return {
    title: input.title,
    titleTemplate: "%s",
    meta,
    link,
    style: [],
    script: [],
    jsonLd: input.jsonLd ?? [],
  };
}
