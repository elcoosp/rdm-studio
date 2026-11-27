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
export declare function buildStudioUrl(params: StudioUrlParams): string;
/**
 * Build a "Try in Studio" deep link for documentation/tutorials.
 * Defaults to geometry step with template and locale.
 */
export declare function buildTryInStudioUrl(params: {
  baseUrl: string;
  template: string;
  lang?: "fr" | "en";
  step?: StudioUrlParams["step"];
}): string;
/**
 * Preset deep-link builders for common documentation scenarios.
 */
export declare const studioLinks: {
  /** Open a template at the geometry step */
  readonly template: (baseUrl: string, template: string, lang?: "fr" | "en") => string;
  /** Open at results step with specific combination and scale */
  readonly results: (baseUrl: string, options: {
    combo?: string;
    scale?: "ec3" | "svm" | "auto";
    sls?: 200 | 250 | 300;
    lang?: "fr" | "en";
  }) => string;
  /** Open report with shared case ID */
  readonly report: (baseUrl: string, caseId: string, lang?: "fr" | "en") => string;
  /** Open optimizer modal */
  readonly optimizer: (baseUrl: string, lang?: "fr" | "en") => string;
  /** Open scenario comparator */
  readonly compare: (baseUrl: string, lang?: "fr" | "en") => string;
  /** Open 3D force diagrams */
  readonly diagrams3d: (baseUrl: string, lang?: "fr" | "en") => string;
};