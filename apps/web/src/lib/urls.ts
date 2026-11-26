/**
 * Cross-app URLs (v2.2.0). The studio links to the documentation host and
 * receives hand-offs from the marketing site; the beta defaults are the free
 * `.vercel.app` hosts and a custom-domain swap is one env var at build time:
 * `VITE_DOCS_URL` (docs host) and `VITE_APP_URL` (studio, for the site side).
 */
export const DOCS_URL: string =
  import.meta.env.VITE_DOCS_URL ?? "https://rdm-studio-docs.vercel.app";

/** Documentation page for a given Starlight path (default `/`). */
export function docsHref(path = "/"): string {
  return `${DOCS_URL}${path}`;
}
