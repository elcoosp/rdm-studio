/**
 * Cross-app URLs (v2.3.0). Beta testers land on the three `.vercel.app`
 * hosts; swapping to custom domains later is a single env var change at
 * build time (`PUBLIC_SITE_URL` / `PUBLIC_APP_URL` / `PUBLIC_DOCS_URL`).
 * Zero custom domains are hardcoded anywhere in the tree.
 *
 * - SPONSOR_URL: GitHub Sponsors page (100 % open-source funding)
 * - CONTACT_URL: GitHub Discussions (B2B / intranet / prestations)
 * - studioHref resolves template deep links through
 *   `@rdm-studio/ui` `buildStudioUrl` for canonical English slugs with
 *   silent French alias resolution.
 */

const DEFAULT_SITE_URL = "https://rdm-studio-site.vercel.app";
const DEFAULT_APP_URL = "https://rdm-studio-app.vercel.app";
const DEFAULT_DOCS_URL = "https://rdm-studio-docs.vercel.app";
const DEFAULT_SPONSOR_URL = "https://github.com/sponsors/elcoosp";
const DEFAULT_CONTACT_URL = "https://github.com/elcoosp/rdm-studio/discussions";

function readEnv(key: string, fallback: string): string {
  try {
    // Guarded: the same module evaluates in the browser (no `process`).
    if (typeof process !== "undefined" && typeof process.env === "object") {
      const value = process.env[key];
      if (typeof value === "string" && value.length > 0) return value;
    }
  } catch {
    // fall through to the beta default
  }
  return fallback;
}

export const SITE_URL = readEnv("PUBLIC_SITE_URL", DEFAULT_SITE_URL);
export const APP_URL = readEnv("PUBLIC_APP_URL", DEFAULT_APP_URL);
export const DOCS_URL = readEnv("PUBLIC_DOCS_URL", DEFAULT_DOCS_URL);
export const SPONSOR_URL = readEnv("PUBLIC_SPONSOR_URL", DEFAULT_SPONSOR_URL);
export const CONTACT_URL = readEnv("PUBLIC_CONTACT_URL", DEFAULT_CONTACT_URL);

import { buildStudioUrl } from "@rdm-studio/ui/deeplinks";
import { currentSiteLocale } from "../i18n/i18n";
import type { SiteLocale } from "./i18nRoutes";

export { buildStudioUrl };

/** Studio app URL for a given in-app path (default the 3D editor entry).
 * Template deep links (`/geometry?template=<slug>`) are resolved through
 * `buildStudioUrl` for canonical English query parameters; plain paths
 * append directly to `APP_URL`. The active site locale is forwarded as
 * `?lang=` / `&lang=` so the studio opens in the same language as the page
 * that linked to it (default: the locale active on the `i18n` singleton). */
export function studioHref(path = "/geometry", lang: SiteLocale = currentSiteLocale()): string {
  const parsed = new URL(path, "http://localhost");
  if (parsed.pathname === "/geometry" && parsed.searchParams.has("template")) {
    return buildStudioUrl({
      baseUrl: APP_URL,
      step: "geometry",
      template: parsed.searchParams.get("template")!,
      lang,
    });
  }
  if (parsed.pathname === "/geometry") {
    return buildStudioUrl({ baseUrl: APP_URL, step: "geometry", lang });
  }
  const sep = parsed.search ? "&" : "?";
  return `${APP_URL}${path}${sep}lang=${lang}`;
}

/** Build a studio deep link with canonical English template slug.
 * Silent French aliases (portique, warren, travees, potence) are resolved
 * by the studio's SearchParamsSchema. */
export function studioTemplateHref(template: string, lang: SiteLocale = currentSiteLocale()): string {
  return buildStudioUrl({ baseUrl: APP_URL, step: "geometry", template, lang });
}

/** Documentation site URL for a given Starlight path (default `/`).
 * French docs live under `/fr/`; English is the default root locale. */
export function docsHref(path = "/", lang: SiteLocale = currentSiteLocale()): string {
  return lang === "fr" ? `${DOCS_URL}/fr${path}` : `${DOCS_URL}${path}`;
}
