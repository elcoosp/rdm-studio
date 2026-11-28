// apps/web/src/lib/productTelemetry.ts — Product Analytics & Diagnostic Architecture v2.3.1
//
// Core telemetry engine for RDM Studio. Every telemetry call passes through
// `sanitizeTelemetryProps` (per-event allowlist + search-term truncation) and
// is written to the IndexedDB black-box ring-buffer `rdm-diagnostic-log` (last
// 100 sanitized events). Forwarding to Umami Cloud is gated on
// `VITE_UMAMI_WEBSITE_ID` being set AND `localStorage["rdm-telemetry-optout"] !== "1"`.

import { get, set } from "idb-keyval";

// ─────────────────────────────────────────────────────────────────────────────
// Event taxonomy (42 events across 8 user flows)
// ─────────────────────────────────────────────────────────────────────────────

export type TelemetryEventKind =
  | "beam_behavior_set"
  | "combinations_generated"
  | "support_settlement_set"
  // Studio lifecycle & navigation
  | "studio_opened"
  | "step_dwell"
  | "step_completed"
  | "locale_switched"
  // Geometry modeling
  | "node_placed"
  | "beam_connected"
  | "composite_section_applied"
  | "section_searched"
  | "section_zero_results"
  | "search_zero_results"
  // Supports & loads
  | "support_preset_applied"
  | "support_spring_set"
  | "support_cleared"
  | "load_case_added"
  | "load_accel_set"
  | "self_weight_toggled"
  | "env_load_set"
  // Solve & results
  | "solve_attempted"
  | "solver_fault"
  | "advanced_panel_used"
  | "section_cut_used"
  | "force_diagram_toggled"
  // Report & export
  | "export_completed"
  | "chapters_customized"
  | "share_url_copied"
  | "print_clicked"
  | "wasem_achieved"
  // Gallery & templates
  | "template_opened"
  | "template_exported"
  // Validation & licensing
  | "validation_modal_opened"
  | "firm_branding_saved"
  // UI interactions
  | "undo_burst"
  | "rage_click"
  | "disabled_cta_click"
  | "cad_tool_selected"
  | "command_palette_opened"
  | "command_palette_used"
  | "tour_started"
  | "tour_completed"
  | "tour_skipped"
  | "feedback_submitted"
  | "optout_toggled"
  // Site / docs marketing
  | "web_opened"
  | "docs_opened"
  | "try_in_studio_clicked"
  | "seo_page_cta_clicked"
  | "hero_3d_opened"
  | "showcase_opened"
  | "bento_opened"
  | "opensource_clicked";

export interface TelemetryEvent {
  kind: TelemetryEventKind;
  ts: number;
  session_id: string;
  props?: Record<string, unknown>;
}

// Per-event property allowlist. Only these keys survive sanitization.
const ALLOWLIST: Record<TelemetryEventKind, string[]> = {
  studio_opened: [],
  step_dwell: ["step", "dwell_ms"],
  step_completed: ["step"],
  locale_switched: ["from", "to"],
  node_placed: ["n_nodes"],
  beam_connected: ["n_beams"],
  composite_section_applied: ["beams", "elements"],
  section_searched: ["query"],
  section_zero_results: ["query"],
  search_zero_results: ["query"],
  support_preset_applied: ["preset"],
  support_spring_set: ["dof", "stiffness"],
  support_cleared: [],
  load_case_added: ["case"],
  load_accel_set: ["ax", "ay", "az"],
  self_weight_toggled: ["enabled"],
  env_load_set: ["type"],
  solve_attempted: ["n_nodes", "n_beams", "n_load_cases"],
  solver_fault: ["fault"],
  advanced_panel_used: ["panel"],
  section_cut_used: ["axis"],
  force_diagram_toggled: ["visible"],
  export_completed: ["format"],
  chapters_customized: ["chapter"],
  share_url_copied: [],
  print_clicked: [],
  wasem_achieved: ["elapsed_ms", "n_beams", "export_format"],
  template_opened: ["template"],
  template_exported: [],
  validation_modal_opened: [],
  firm_branding_saved: [],
  undo_burst: ["count"],
  rage_click: ["count"],
  disabled_cta_click: ["target"],
  cad_tool_selected: ["tool"],
  command_palette_opened: [],
  command_palette_used: ["action"],
  tour_started: [],
  tour_completed: ["steps"],
  tour_skipped: [],
  feedback_submitted: ["rating"],
  optout_toggled: ["enabled"],
  web_opened: [],
  docs_opened: [],
  try_in_studio_clicked: ["template"],
  seo_page_cta_clicked: ["template"],
  hero_3d_opened: [],
  showcase_opened: ["tab"],
  bento_opened: [],
  beam_behavior_set: [],
  combinations_generated: [],
  support_settlement_set: [],
  opensource_clicked: [],
};

// Search-term fields — truncated to 24 safe chars `[a-zA-Z0-9._ -]`.
const SEARCH_FIELDS = new Set(["query"]);

// Sanitize a raw search term: max 24 chars, only safe characters.
function sanitizeSearchTerm(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/[^a-zA-Z0-9._ -]/g, "").trim();
  return cleaned.slice(0, 24) || undefined;
}

export function sanitizeTelemetryProps(
  kind: TelemetryEventKind,
  props: Record<string, unknown> = {},
): Record<string, unknown> | undefined {
  const allowed = new Set(ALLOWLIST[kind]);
  const out: Record<string, unknown> = {};
  let hasProps = false;

  for (const [key, value] of Object.entries(props)) {
    if (!allowed.has(key)) continue;
    // Never forward node coordinates, member connectivity, loads, project names,
    // or file payloads — those keys are simply not in any allowlist.
    let sanitized = value;
    if (SEARCH_FIELDS.has(key)) {
      sanitized = sanitizeSearchTerm(value);
      if (sanitized === undefined) continue;
    }
    out[key] = sanitized;
    hasProps = true;
  }

  return hasProps ? out : undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Session ID (stable per tab session)
// ─────────────────────────────────────────────────────────────────────────────

let sessionId: string | null = null;

export function getSessionId(): string {
  if (sessionId) return sessionId;
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    sessionId = crypto.randomUUID();
  } else {
    sessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
  return sessionId;
}

// ─────────────────────────────────────────────────────────────────────────────
// IndexedDB black-box ring-buffer — `rdm-diagnostic-log`, last 100 events
// ─────────────────────────────────────────────────────────────────────────────

const DB_NAME = "rdm-diagnostic-log";
const MAX_EVENTS = 100;
let dbReady = false;
let dbInitPromise: Promise<void> | null = null;

async function ensureDb(): Promise<void> {
  if (dbReady) return;
  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      try {
        const stored = await get<TelemetryEvent[]>(DB_NAME);
        if (!Array.isArray(stored)) await set(DB_NAME, []);
      } catch {
        // IndexedDB unavailable in this environment — telemetry is local-only.
      }
      dbReady = true;
    })();
  }
  await dbInitPromise;
}

export async function writeDiagnosticEvent(event: TelemetryEvent): Promise<void> {
  await ensureDb();
  try {
    const stored = (await get<TelemetryEvent[]>(DB_NAME)) ?? [];
    stored.push(event);
    if (stored.length > MAX_EVENTS) stored.splice(0, stored.length - MAX_EVENTS);
    await set(DB_NAME, stored);
  } catch {
    // best-effort local logging; never throw
  }
}

export async function getDiagnosticLog(): Promise<TelemetryEvent[]> {
  await ensureDb();
  try {
    return ((await get<TelemetryEvent[]>(DB_NAME)) ?? []).slice();
  } catch {
    return [];
  }
}

export async function clearDiagnosticLog(): Promise<void> {
  await ensureDb();
  try {
    await set(DB_NAME, []);
  } catch {
    // best-effort
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Umami Cloud bridge — opt-out gated
// ─────────────────────────────────────────────────────────────────────────────

let umamiWebsiteId: string | null = null;

export function getUmamiWebsiteId(): string | null {
  if (umamiWebsiteId !== null) return umamiWebsiteId;
  if (typeof import.meta.env !== "undefined" && import.meta.env.VITE_UMAMI_WEBSITE_ID) {
    umamiWebsiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID;
  } else {
    umamiWebsiteId = ""; // cached negative
  }
  return umamiWebsiteId || null;
}

export function isTelemetryOptedOut(): boolean {
  if (typeof localStorage === "undefined") return true;
  return localStorage.getItem("rdm-telemetry-optout") === "1";
}

export function setTelemetryOptOut(optedOut: boolean): void {
  if (typeof localStorage === "undefined") return;
  if (optedOut) localStorage.setItem("rdm-telemetry-optout", "1");
  else localStorage.removeItem("rdm-telemetry-optout");
}

function canForwardToUmami(): boolean {
  return getUmamiWebsiteId() !== null && !isTelemetryOptedOut();
}

export function forwardToUmami(kind: TelemetryEventKind, props: Record<string, unknown>): void {
  if (!canForwardToUmami()) return;
  const umami = (
    window as unknown as { umami?: (name: string, data?: Record<string, unknown>) => void }
  ).umami;
  if (typeof umami === "function") {
    try {
      umami(kind, props);
    } catch {
      // best-effort
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API: trackProductEvent
// ─────────────────────────────────────────────────────────────────────────────

let wasemAchieved = false;

export function trackProductEvent(
  kind: TelemetryEventKind,
  rawProps: Record<string, unknown> = {},
): void {
  const sanitized = sanitizeTelemetryProps(kind, rawProps);
  const event: TelemetryEvent = {
    kind,
    ts: Date.now(),
    session_id: getSessionId(),
    ...(sanitized ? { props: sanitized } : {}),
  };

  // Always write to the local black-box ring buffer (best-effort, fire-and-forget).
  void writeDiagnosticEvent(event);

  // Forward to Umami Cloud only when enabled and not opted out.
  if (sanitized) {
    forwardToUmami(kind, sanitized);
  }

  // WASEM north star: fires once per session when a valid solve AND an
  // export/share have both completed. Callers must invoke `recordWasemComponents`
  // to register solve + export events; this function handles the once-per-session
  // emission.
  if (kind === "wasem_achieved") {
    wasemAchieved = true;
  }
}

/**
 * Call after both a valid solve and an export/share have completed in the same
 * session. Emits `wasem_achieved` exactly once with elapsed_ms, n_beams, and
 * export_format. Idempotent — subsequent calls are no-ops.
 */
export function recordWasemComponents({
  elapsedMs,
  nBeams,
  exportFormat,
}: {
  elapsedMs: number;
  nBeams: number;
  exportFormat: string;
}): void {
  if (wasemAchieved) return;
  wasemAchieved = true;
  trackProductEvent("wasem_achieved", {
    elapsed_ms: elapsedMs,
    n_beams: nBeams,
    export_format: exportFormat,
  });
}
