/**
 * v2.3.1 Site telemetry — lightweight Umami bridge for the marketing site
 * (apps/site). Mirrors the privacy contract of apps/web's productTelemetry:
 * every call passes through sanitizeTelemetryProps, opt-out is honored,
 * and nothing ever leaves the browser unless Umami is configured.
 */

declare global {
  interface ImportMetaEnv {
    VITE_UMAMI_WEBSITE_ID?: string;
  }
  interface ImportMeta {
    env: ImportMetaEnv;
  }
  interface Window {
    umami?: { track: (event: string, data?: Record<string, unknown>) => void };
  }
}

const SANITIZE_ALLOWLIST: Record<string, string[]> = {
  page_viewed: ["path", "locale"],
  hero_3d_model_switched: ["model"],
  hero_3d_load_changed: ["load_kn"],
  hero_copy_link_clicked: [],
  hero_launch_studio: ["template"],
  showcase_filter_changed: ["sector"],
  showcase_model_viewed: ["model"],
  showcase_launch_studio: ["template"],
  bento_card_clicked: ["card"],
  opensource_cta_clicked: [],
  seo_page_cta_clicked: ["template"],
  docs_try_in_studio_clicked: ["template", "step"],
  locale_switched: ["from", "to"],
};

function sanitizeTelemetryProps<T extends Record<string, unknown>>(
  event: string,
  props: T,
): Record<string, unknown> {
  const allowed = SANITIZE_ALLOWLIST[event];
  if (allowed === undefined) return {};
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (!(key in props)) continue;
    let value = props[key];
    if (key === "path" || key === "template" || key === "step" || key === "sector" || key === "card") {
      value = String(value).replace(/[^a-zA-Z0-9._ -]/g, "").slice(0, 24);
    }
    if (key === "load_kn") {
      value = Math.round(Number(value) * 10) / 10;
    }
    out[key] = value;
  }
  return out;
}

function shouldTrack(): boolean {
  if (typeof window === "undefined") return false;
  const id = import.meta.env.VITE_UMAMI_WEBSITE_ID;
  if (!id || id.trim() === "") return false;
  return window.localStorage.getItem("rdm-telemetry-optout") !== "1";
}

export function trackSiteEvent(event: string, props: Record<string, unknown> = {}): void {
  if (!shouldTrack()) return;
  const clean = sanitizeTelemetryProps(event, props);
  if (typeof window !== "undefined" && window.umami) {
    window.umami.track(event, clean);
  }
}

export function trackPageViewed(path: string, locale: string): void {
  void trackSiteEvent("page_viewed", { path, locale });
}

export function trackHero3dModelSwitched(model: string): void {
  void trackSiteEvent("hero_3d_model_switched", { model });
}

export function trackHero3dLoadChanged(loadKn: number): void {
  void trackSiteEvent("hero_3d_load_changed", { load_kn: loadKn });
}

export function trackHeroCopyLinkClicked(): void {
  void trackSiteEvent("hero_copy_link_clicked");
}

export function trackHeroLaunchStudio(template: string): void {
  void trackSiteEvent("hero_launch_studio", { template });
}

export function trackShowcaseFilterChanged(sector: string): void {
  void trackSiteEvent("showcase_filter_changed", { sector });
}

export function trackShowcaseModelViewed(model: string): void {
  void trackSiteEvent("showcase_model_viewed", { model });
}

export function trackShowcaseLaunchStudio(template: string): void {
  void trackSiteEvent("showcase_launch_studio", { template });
}

export function trackBentoCardClicked(card: string): void {
  void trackSiteEvent("bento_card_clicked", { card });
}

export function trackOpensourceCtaClicked(): void {
  void trackSiteEvent("opensource_cta_clicked");
}

export function trackSeoPageCtaClicked(template: string): void {
  void trackSiteEvent("seo_page_cta_clicked", { template });
}

export function trackDocsTryInStudioClicked(template: string, step: string): void {
  void trackSiteEvent("docs_try_in_studio_clicked", { template, step });
}

export function trackLocaleSwitched(from: string, to: string): void {
  void trackSiteEvent("locale_switched", { from, to });
}
