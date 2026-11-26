import { i18n } from "@lingui/core";

/**
 * Lingui runtime (section 5, `i18n/`): FR is the source locale, EN is the
 * second catalog; switching is in-place (no reload, section 11).
 */
export type Locale = "fr" | "en" | "es" | "de" | "pt_BR";

const catalogs: Record<Locale, () => Promise<{ messages: Record<string, unknown> }>> = {
  fr: () => import("./locales/fr.mjs"),
  en: () => import("./locales/en.mjs"),
  // v2.0.0: ES / DE / PT-BR scaffolds (needs review).
  es: () => import("./locales/es.mjs"),
  de: () => import("./locales/de.mjs"),
  pt_BR: () => import("./locales/pt_BR.mjs"),
};

export async function activateLocale(locale: Locale): Promise<void> {
  const { messages } = await catalogs[locale]();
  i18n.load(locale, messages as never);
  i18n.activate(locale);
  localStorage.setItem("rdm-locale", locale);
  // v1.3.0: notify the header's active-locale pill.
  window.dispatchEvent(new Event("rdm-locale-change"));
  document.documentElement.lang = locale;
}

export function initialLocale(): Locale {
  return (localStorage.getItem("rdm-locale") as Locale | null) ?? "fr";
}
