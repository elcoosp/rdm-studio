/**
 * Typed studio URL builder for deep links across apps/site, apps/docs, apps/web
 * Canonical English query parameters with silent French alias support
 */

export interface StudioUrlParams {
  /** Base URL of the studio app (e.g., "https://rdm-studio-web.vercel.app") */
  baseUrl: string;
  /** Workflow step: "geometry" | "supports" | "loads" | "results" | "report" */
  step?: "geometry" | "supports" | "loads" | "results" | "report";
  /** Canonical English template slug (14 models) */
  template?: string;
  /** Locale: "fr" | "en" — activates requested locale on entry */
  lang?: "fr" | "en";
  /** Project case ID for sharing */
  caseId?: string;
  /** Load combination selector (e.g., "ULS:0", "SLS:0", "MODE:0") */
  combo?: string;
  /** Thermal scale mode: "ec3" | "svm" | "auto" */
  scale?: "ec3" | "svm" | "auto";
  /** Show 3D force diagrams in dock */
  diagrams?: 0 | 1;
  /** Open modal: "optim" | "compare" */
  modal?: "optim" | "compare";
  /** SLS deflection denominator: 200 | 250 | 300 */
  sls?: 200 | 250 | 300;
  /** Cutting plane beam ID */
  cutBeam?: number;
  /** Cutting plane station ratio 0..1 */
  cut?: number;
}

/**
 * Build a fully-typed studio URL with canonical English query parameters.
 * Silent French aliases (portique, warren, travees, potence) are accepted
 * by the studio's SearchParamsSchema and resolved to canonical slugs.
 */
export function buildStudioUrl(params: StudioUrlParams): string {
  const { baseUrl, ...searchParams } = params;
  const url = new URL(baseUrl);

  // Ensure base path is /geometry for template loads, or the specific step
  if (searchParams.step) {
    url.pathname = `/${searchParams.step}`;
  } else if (searchParams.template) {
    url.pathname = "/geometry";
  }

  // Append search parameters (only defined values)
  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

/**
 * Build a "Try in Studio" deep link for documentation/tutorials.
 * Defaults to geometry step with template and locale.
 */
export function buildTryInStudioUrl(params: {
  baseUrl: string;
  template: string;
  lang?: "fr" | "en";
  step?: StudioUrlParams["step"];
}): string {
  return buildStudioUrl({
    baseUrl: params.baseUrl,
    step: params.step ?? "geometry",
    template: params.template,
    lang: params.lang,
  });
}

/**
 * Preset deep-link builders for common documentation scenarios.
 */
export const studioLinks = {
  /** Open a template at the geometry step */
  template: (baseUrl: string, template: string, lang: "fr" | "en" = "fr") =>
    buildStudioUrl({ baseUrl, step: "geometry", template, lang }),

  /** Open at results step with specific combination and scale */
  results: (baseUrl: string, options: {
    combo?: string;
    scale?: "ec3" | "svm" | "auto";
    sls?: 200 | 250 | 300;
    lang?: "fr" | "en";
  }) => buildStudioUrl({ baseUrl, step: "results", ...options }),

  /** Open report with shared case ID */
  report: (baseUrl: string, caseId: string, lang: "fr" | "en" = "fr") =>
    buildStudioUrl({ baseUrl, step: "report", caseId, lang }),

  /** Open optimizer modal */
  optimizer: (baseUrl: string, lang: "fr" | "en" = "fr") =>
    buildStudioUrl({ baseUrl, step: "results", modal: "optim", lang }),

  /** Open scenario comparator */
  compare: (baseUrl: string, lang: "fr" | "en" = "fr") =>
    buildStudioUrl({ baseUrl, step: "results", modal: "compare", lang }),

  /** Open 3D force diagrams */
  diagrams3d: (baseUrl: string, lang: "fr" | "en" = "fr") =>
    buildStudioUrl({ baseUrl, step: "results", diagrams: 1, lang }),
} as const;