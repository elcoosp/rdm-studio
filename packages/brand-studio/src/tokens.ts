import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "../../..");
export const UI_TOKENS_CSS_PATH = path.join(REPO_ROOT, "packages/ui/src/tokens.css");

export interface SwissMetrologyTokens {
  canvas: string;
  panel: string;
  panelSubtle: string;
  hairline: string;
  borderSubtle: string;
  inkPrimary: string;
  inkSecondary: string;
  inkMuted: string;
  accent: string;
  accentStrong: string;
  accentTint: string;
  accentRing: string;
  passBg: string;
  passBorder: string;
  passText: string;
  feaTier1: string;
  feaTier2: string;
  feaTier3: string;
  feaTier4: string;
  feaTier5: string;
  radiusBadge: string;
  radiusControl: string;
  radiusOverlay: string;
}

let cachedTokens: SwissMetrologyTokens | null = null;

/**
 * Reads `packages/ui/src/tokens.css` (the single source of truth for RDM Studio)
 * so every Takumi banner/card matches `@rdm-studio/ui` tokens identically.
 */
export function loadUiTokens(): SwissMetrologyTokens {
  if (cachedTokens) return cachedTokens;
  const css = fs.readFileSync(UI_TOKENS_CSS_PATH, "utf-8");
  const rootMatch = css.match(/:root\s*\{([\s\S]*?)\n\}/);
  const rootBlock = rootMatch?.[1] ?? css;

  const vars = new Map<string, string>();
  for (const m of rootBlock.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    const k = m[1]?.trim();
    const v = m[2]?.trim();
    if (k && v) vars.set(k, v);
  }

  const req = (name: string): string => {
    const val = vars.get(name);
    if (!val) {
      throw new Error(`Missing token ${name} in ${UI_TOKENS_CSS_PATH}`);
    }
    return val;
  };

  cachedTokens = {
    canvas: req("--color-canvas"),
    panel: req("--color-panel"),
    panelSubtle: req("--color-panel-subtle"),
    hairline: req("--color-hairline"),
    borderSubtle: req("--color-border-subtle"),
    inkPrimary: req("--color-ink-primary"),
    inkSecondary: req("--color-ink-secondary"),
    inkMuted: req("--color-ink-muted"),
    accent: req("--color-accent"),
    accentStrong: req("--color-accent-strong"),
    accentTint: req("--color-accent-tint"),
    accentRing: req("--color-accent-ring"),
    passBg: req("--color-pass-bg"),
    passBorder: req("--color-pass-border"),
    passText: req("--color-pass-text"),
    feaTier1: req("--color-fea-tier-1"),
    feaTier2: req("--color-fea-tier-2"),
    feaTier3: req("--color-fea-tier-3"),
    feaTier4: req("--color-fea-tier-4"),
    feaTier5: req("--color-fea-tier-5"),
    radiusBadge: req("--radius-badge"),
    radiusControl: req("--radius-control"),
    radiusOverlay: req("--radius-overlay"),
  };
  return cachedTokens;
}
