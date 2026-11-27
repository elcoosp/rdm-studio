/**
 * @rdm-studio/ui — Unified Swiss Metrology UI Package
 * Single source of truth for tokens, icons, primitives, interior micro-interactions,
 * engineering catalog, deep links, and viewport utilities.
 */

// Tokens (import CSS separately: import "@rdm-studio/ui/tokens.css")
export * from "./tokens.css";

// Icons (44 engineering + 5 workflow + brand)
export * from "./icons";

// Primitives (Button, Badge, Card with strict radii)
export * from "./primitives";

// Interior micro-interactions (8 components + NumberFlowValue)
export * from "./interior";

// Templates (15-model engineering catalog)
export * from "./templates";

// Deep links (typed studio URL builders)
export * from "./deeplinks";

// Viewport utilities (5-tier thermal spectrum)
export * from "./viewport";

// Lib utilities
export { cn } from "./lib/cn";