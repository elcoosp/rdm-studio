/**
 * Cross-app URLs (v2.2.0). Beta testers land on the three `.vercel.app`
 * hosts; swapping to custom domains later is a single env var change at
 * build time (`PUBLIC_SITE_URL` / `PUBLIC_APP_URL` / `PUBLIC_DOCS_URL`).
 * Zero custom domains are hardcoded anywhere in the tree.
 */
const DEFAULT_SITE_URL = "https://rdm-studio-site.vercel.app";
const DEFAULT_APP_URL = "https://rdm-studio-app.vercel.app";
const DEFAULT_DOCS_URL = "https://rdm-studio-docs.vercel.app";

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

/** Studio app URL for a given in-app path (default the 3D editor entry). */
export function studioHref(path = "/geometry"): string {
  return `${APP_URL}${path}`;
}

/** Documentation site URL for a given Starlight path (default `/`). */
export function docsHref(path = "/"): string {
  return `${DOCS_URL}${path}`;
}
