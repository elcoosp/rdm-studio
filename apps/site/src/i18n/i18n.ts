/**
 * Lingui runtime for apps/site — synchronous catalog loading.
 *
 * The compiled catalogs (`./locales/fr.ts`, `./locales/en.ts`, produced by
 * `pnpm --filter site i18n:compile`) are imported statically so the SSR
 * prerender AND the client hydration render the exact active locale on the
 * first pass, with zero hydration mismatch. No async `load()` / dynamic
 * `import()` here: a locale switch mid-render would desync SSR and client.
 *
 * The `i18n` object is a process-wide singleton; every render activates its
 * own locale synchronously at the top of `RootLayout` (from the route / URL
 * props) before any string is read, and React's synchronous render cannot
 * interleave two renders in the same worker — so per-request activation is
 * safe. Islands reuse the same singleton via `<I18nProvider i18n={i18n}>`.
 *
 * Runtime API only (explicit `id` + `message`): no macros, no transform —
 * no Babel, no SWC plugin. Oxide has no Vite/SWC hook in its dev browser
 * path, and the runtime API extracts cleanly (`lingui extract`).
 */
import { i18n } from "@lingui/core";
import { messages as messagesFr } from "./locales/fr";
import { messages as messagesEn } from "./locales/en";
import type { SiteLocale } from "../lib/i18nRoutes";

i18n.load({ fr: messagesFr, en: messagesEn });
i18n.activate("fr");

export function activateSiteLocale(locale: SiteLocale): void {
  i18n.activate(locale);
}

/** Locale currently active on the `i18n` singleton — read at render time
 * (after `RootLayout` activated it from the route props) to pick the
 * locale-aware variant of a URL or a number format. Defaults to `fr`. */
export function currentSiteLocale(): SiteLocale {
  return i18n.locale === "en" ? "en" : "fr";
}

export { i18n };
export type { SiteLocale };
