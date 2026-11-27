/**
 * Unified Engineering Catalog (v2.3.0)
 * 15 sector-categorized models with canonical English slugs + legacy French aliases
 * Used across apps/site (gallery), apps/docs (TryInStudio), apps/web (quick-start)
 */
export type Sector = "Building & Framing" | "Naval & Lifting" | "Bridges & Frames" | "Timber & Multi-Material";
export interface EngineeringModel {
  /** Canonical English slug (URL-safe, used in ?template=) */
  slug: string;
  /** Human-readable title (sentence case) */
  title: string;
  /** Sector category for filtering */
  sector: Sector;
  /** Short description for gallery cards */
  description: string;
  /** SVG preview path (architectural outline) */
  previewSvg: string;
  /** Mass in kg (approximate) */
  massKg: number;
  /** Primary section designation (e.g., "IPE 300", "HEA 200") */
  primarySection: string;
  /** Legacy French slug aliases for backwards compatibility */
  aliases: string[];
  /** Eurocode standards covered */
  eurocodes: string[];
  /** Tags for search/filter */
  tags: string[];
}
/** All 15 canonical engineering models */
export declare const ENGINEERING_CATALOG: EngineeringModel[];
/** Sector list for filter UI */
export declare const SECTORS: Sector[];
/** Map of all slugs (canonical + aliases) to canonical slug */
export declare const SLUG_ALIASES: Record<string, string>;
/** Resolve any slug/alias to canonical slug */
export declare function resolveSlug(slug: string): string;
/** Get model by canonical slug */
export declare function getModel(slug: string): EngineeringModel | undefined;
/** Get models by sector */
export declare function getModelsBySector(sector: Sector): EngineeringModel[];
/** Get all unique tags */
export declare function getAllTags(): string[];