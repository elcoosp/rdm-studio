import { useEffect, useState } from "react";
import type { WorkerRequest } from "./fea.worker";

/** Typed result of a solve (mirrors SolveReport in rdm-wasm). */
export interface CombinationReport {
  kind: string;
  label: string;
  /** v1.6.0: exact EN 1990 multipliers (`["G", 1.35]`, `["Q", 1.5]`, ...). */
  multipliers: [string, number][];
  beams: {
    beam_id: number;
    utilization: number;
    /** v1.3.0: governing resistance name (`Mb,Rd`, `Von Mises`, …). */
    governing_check: string;
    /** v1.4.0: every individual check ratio at the governing station. */
    checks: [string, number][];
    /** v1.4.0: cross-section class 1..=4 (null = n/a). */
    class_index: number | null;
    /** v1.4.0: flexural buckling factors / LTB reduction. */
    chi_y: number | null;
    chi_z: number | null;
    chi_lt: number | null;
    /** v1.4.0: governing bending resistance (N·m) for the capacity line. */
    m_rd: number;
    /** v1.3.0: peak von Mises stress over the stations (Pa). */
    max_sigma_vm: number;
    midspan_deflection: number;
    /** v1.6.0: plastic axial resistance Npl,Rd (N). */
    n_pl_rd: number;
    /** v1.6.0: plastic shear resistance Vpl,Rd (N). */
    v_pl_rd: number;
    /** v1.6.0: elastic critical moment Mcr (N·m, null = LTB n/a). */
    m_cr: number | null;
    /** v1.6.0: LTB slenderness λLT (null = LTB n/a). */
    lambda_lt: number | null;
    /** v1.6.0: member length (m) for the SLS allowance readouts. */
    length: number;
  }[];
}

export interface CaseReport {
  code: string;
  displacements: number[];
  reactions: number[];
  beam_end_forces: number[];
}

export interface SolveReport {
  n_nodes: number;
  n_beams: number;
  cases: CaseReport[];
  combinations: CombinationReport[];
}

export interface SolveFault {
  kind: string;
  message: string;
}

export interface SectionSummary {
  designation: string;
  family: string;
  standard: string;
}

/** True SI outline dims of a catalog profile (bug 2 extrusion). */
export interface SectionDims {
  designation: string;
  shape: string;
  h: number | null;
  b: number | null;
  tw: number | null;
  tf: number | null;
  /** v1.6.0: exact catalog area A (m²) — zero extra property roundtrips. */
  a: number;
}

/** One extracted eigenmode (v1.0.0 modal engine). */
export interface ModeShape {
  mode_index: number;
  frequency_hz: number;
  omega: number;
  displacements: number[];
}

export interface ModalReport {
  n_modes: number;
  modes: ModeShape[];
}

/** One sigma_vM point of the cross-section grid (v1.0.0 section cut). */
export interface StressPoint {
  y: number;
  z: number;
  sigma_vm: number;
}

export interface SpanForceSample {
  ratio: number;
  n: number;
  my: number;
  mz: number;
  vz: number;
  /** v1.6.0: torsional moment T (N·m) — the 5th internal-force curve. */
  t: number;
}

/** v1.6.0: structured pre-solve diagnostic (rdm_model::ModelIssue). */
export interface ModelIssue {
  code: string;
  subject: string;
  message: string;
}

/** v1.6.0: parametric generation request (mirrors ParametricParams). */
export interface ParametricParamsInput {
  template: "WarrenTruss" | "PortalFrame" | "Cantilever" | "ContinuousBeam";
  span_m: number;
  height_m: number;
  bays: number;
  primary_section: string;
  secondary_section: string;
  material_id: string;
}

export interface StressGrid {
  bounds: [number, number, number, number];
  points: StressPoint[];
}

// ---------------------------------------------------------------------------
// v1.8.0 / v1.9.0 — priority lanes (latest-wins live solve + engine calls).
// ---------------------------------------------------------------------------

/** One closed-form benchmark result of the Validation modal. */
export interface BenchResultDto {
  id: string;
  title: string;
  expected: number;
  computed: number;
  rel_error: number;
  unit: string;
  passed: boolean;
}

/** One node of the KaTeX CalcTrace tree. */
export interface CalcTraceNodeDto {
  clause: string;
  title: string;
  formula_latex: string;
  substituted: string;
  value: number;
  limit: number;
  unit: string;
  passed: boolean;
  children: CalcTraceNodeDto[];
}

/** Per-member min/max envelope of the internal forces. */
export interface BeamEnvelopeDto {
  beam_id: number;
  n: [number, number];
  my: [number, number];
  mz: [number, number];
  vz: [number, number];
  t: [number, number];
}

/** EC3 optimizer output for one member group. */
export interface GroupOptimizationDto {
  chosen: string | null;
  passes: number;
  pareto: [string, number, number][];
}

/** Linear buckling mode (λcr + normalized shape). */
export interface BucklingModeDto {
  mode_index: number;
  lambda_cr: number;
  shape: number[];
}

export interface BucklingReportDto {
  modes: BucklingModeDto[];
}

export type EngineFn =
  | "build_combinations_v2_json"
  | "member_calc_trace"
  | "compute_envelopes_json"
  | "custom_section_preview"
  | "generate_env_loads_json"
  | "optimize_sections_json"
  | "buckling_analysis_json"
  | "seismic_spectrum_json"
  | "export_bim"
  | "multi_material_check_json"
  | "moving_loads_envelope_json";

interface LanePending {
  resolve: (value: unknown) => void;
  reject: (fault: SolveFault) => void;
}

const lanePending = new Map<number, LanePending>();
const enginePending = new Map<string, LanePending>();
let liveTokenCounter = 0;
let liveListeners = new Set<(token: number) => void>();

declare global {
  interface Window {
    __rdmLiveSolveListeners?: Set<(token: number) => void>;
  }
}

/** Notification hook used by the drag-solve loop (re-solve coalescing). */
export function onLiveSolve(listener: (token: number) => void): () => void {
  liveListeners.add(listener);
  return () => {
    liveListeners.delete(listener);
  };
}

interface Pending {
  onResult: (data: unknown) => void;
  onError: (fault: SolveFault) => void;
}

/** Last successful solve, shared across routes (report/export step). */
let lastReport: SolveReport | null = null;

export function getLastReport(): SolveReport | null {
  return lastReport;
}

/**
 * 150 ms trailing debounce shared by all callers (bug 10: one timer for the
 * whole app; every call during the window re-arms the same solve).
 */
function createAutoSolve(run: () => Promise<SolveReport>): { trigger: () => Promise<SolveReport> } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let latest: Promise<SolveReport> = Promise.reject(new Error("never solved"));
  latest.catch(() => undefined);
  return {
    trigger: () => {
      if (timer !== null) {
        clearTimeout(timer);
      }
      latest = new Promise<SolveReport>((resolve, reject) => {
        timer = setTimeout(() => {
          run().then(resolve, reject);
        }, 150);
      });
      return latest;
    },
  };
}

let autoSolveRunner: { trigger: () => Promise<SolveReport> } | null = null;

/** Singleton worker client; requests are queued in order. */
class FeaClient {
  private worker: Worker;
  private queue: { request: WorkerRequest; pending: Pending }[] = [];
  private busy = false;

  constructor() {
    this.worker = new Worker(new URL("./fea.worker.ts", import.meta.url), {
      type: "module",
    });
    this.worker.onmessage = (event: MessageEvent) => {
      const data = event.data as
        | { type: "SOLVE_RESULT"; report: SolveReport }
        | { type: "SOLVE_FAULT"; fault: SolveFault }
        | {
            type: "CATALOG";
            sections: SectionSummary[];
            materials: string[];
            sectionDims: SectionDims[];
          }
        | { type: "PDF_RESULT"; pdf: Uint8Array }
        | { type: "MODAL_RESULT"; report: ModalReport }
        | { type: "MODAL_FAULT"; fault: SolveFault }
        | { type: "STRESS_RESULT"; grid: StressGrid }
        | { type: "STRESS_FAULT"; fault: SolveFault }
        | { type: "DXF_RESULT"; json: string }
        | { type: "FINGERPRINT_RESULT"; hash: string }
        | { type: "DXF_FAULT"; fault: SolveFault }
        | { type: "CATALOG_PROPS_RESULT"; props: unknown }
        | { type: "CATALOG_PROPS_FAULT"; fault: SolveFault }
        | { type: "SPAN_FORCES_RESULT"; forces: SpanForceSample[] }
        | { type: "SPAN_FORCES_FAULT"; fault: SolveFault }
        | { type: "MODEL_ISSUES_RESULT"; issues: ModelIssue[] }
        | { type: "MODEL_ISSUES_FAULT"; fault: SolveFault }
        | { type: "PARAMETRIC_RESULT"; json: string }
        | { type: "PARAMETRIC_FAULT"; fault: SolveFault }
        | { type: "LIVE_RESULT"; token: number }
        | { type: "LIVE_FAULT"; token: number; fault: SolveFault }
        | { type: "CASE_RESULT"; token: number; response: unknown }
        | { type: "CASE_FAULT"; token: number; fault: SolveFault }
        | { type: "VALIDATION_RESULT"; results: BenchResultDto[] }
        | { type: "ENGINE_RESULT"; fn: string; result: unknown };
      // v1.8.0: lane messages bypass the ordered queue (priority lanes).
      if (
        data.type === "LIVE_RESULT" ||
        data.type === "LIVE_FAULT" ||
        data.type === "CASE_RESULT" ||
        data.type === "CASE_FAULT" ||
        data.type === "VALIDATION_RESULT" ||
        data.type === "ENGINE_RESULT"
      ) {
        if (data.type === "LIVE_RESULT") {
          lanePending.get(data.token)?.resolve(undefined);
          lanePending.delete(data.token);
        } else if (data.type === "LIVE_FAULT") {
          lanePending.get(data.token)?.reject(data.fault);
          lanePending.delete(data.token);
        } else if (data.type === "CASE_RESULT") {
          lanePending.get(data.token)?.resolve(data.response);
          lanePending.delete(data.token);
        } else if (data.type === "CASE_FAULT") {
          lanePending.get(data.token)?.reject(data.fault);
          lanePending.delete(data.token);
        } else if (data.type === "VALIDATION_RESULT") {
          const pending = enginePending.get("VALIDATION_SUITE");
          if (pending !== undefined) {
            pending.resolve(data.results);
            enginePending.delete("VALIDATION_SUITE");
          }
        } else {
          const pending = enginePending.get(data.fn);
          if (pending !== undefined) {
            pending.resolve(data.result);
            enginePending.delete(data.fn);
          }
        }
        return;
      }
      const pending = this.queue.shift()?.pending;
      if (pending === undefined) {
        return;
      }
      this.busy = false;
      if (data.type === "SOLVE_FAULT") {
        pending.onError(data.fault);
      } else if (data.type === "SOLVE_RESULT") {
        lastReport = data.report;
        for (const listener of reportListeners) {
          listener(lastReport);
        }
        pending.onResult(data.report);
      } else if (data.type === "PDF_RESULT") {
        pending.onResult(data.pdf);
      } else if (
        data.type === "MODAL_FAULT" ||
        data.type === "STRESS_FAULT" ||
        data.type === "DXF_FAULT"
      ) {
        pending.onError(data.fault);
      } else if (data.type === "MODAL_RESULT") {
        lastModalReport = data.report;
        pending.onResult(data.report);
      } else if (data.type === "STRESS_RESULT") {
        pending.onResult(data.grid);
      } else if (data.type === "DXF_RESULT") {
        pending.onResult(data.json);
      } else if (data.type === "FINGERPRINT_RESULT") {
        pending.onResult(data.hash);
      } else if (data.type === "SPAN_FORCES_FAULT") {
        pending.onError(data.fault);
      } else if (data.type === "SPAN_FORCES_RESULT") {
        pending.onResult(data.forces);
      } else if (data.type === "MODEL_ISSUES_FAULT") {
        pending.onError(data.fault);
      } else if (data.type === "MODEL_ISSUES_RESULT") {
        pending.onResult(data.issues);
      } else if (data.type === "PARAMETRIC_FAULT") {
        pending.onError(data.fault);
      } else if (data.type === "PARAMETRIC_RESULT") {
        pending.onResult(data.json);
      } else if (data.type === "CATALOG_PROPS_FAULT") {
        pending.onError(data.fault);
      } else if (data.type === "CATALOG_PROPS_RESULT") {
        pending.onResult(data.props);
      } else {
        pending.onResult(data);
      }
      this.drain();
    };
  }

  private drain(): void {
    if (this.busy || this.queue.length === 0) {
      return;
    }
    this.busy = true;
    const next = this.queue[0];
    if (next !== undefined) {
      this.worker.postMessage(next.request);
    }
  }

  private enqueue(request: WorkerRequest, pending: Pending): void {
    this.queue.push({ request, pending });
    this.drain();
  }

  /**
   * v1.8.0 live drag-solve lane (priority, latest-wins coalescing): every
   * call cancels the previous token so only the newest model state is
   * solved, keeping the UI inside the < 20 ms interactive budget.
   */
  liveSolve(project: unknown): Promise<void> {
    const token = ++liveTokenCounter;
    for (const [pendingToken, pending] of lanePending) {
      if (pendingToken < token) {
        pending.reject({ kind: "Fault", message: "superseded" });
        lanePending.delete(pendingToken);
      }
    }
    for (const listener of liveListeners) {
      listener(token);
    }
    this.worker.postMessage({ type: "CANCEL_SOLVE" } satisfies WorkerRequest);
    return new Promise<void>((resolve, reject) => {
      lanePending.set(token, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.worker.postMessage({ type: "LIVE_SOLVE", token, project } satisfies WorkerRequest);
    });
  }

  /** v1.8.0: cancels the live lane (drag-end). */
  cancelLiveSolve(): void {
    this.worker.postMessage({ type: "CANCEL_SOLVE" } satisfies WorkerRequest);
    liveTokenCounter += 1;
  }

  /** v1.8.0: < 2 ms case superposition from the cached factorization. */
  solveCaseRhs(weights: { case: string; weight: number }[]): Promise<unknown> {
    const token = ++liveTokenCounter + 1_000_000;
    return new Promise<unknown>((resolve, reject) => {
      lanePending.set(token, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.worker.postMessage({ type: "SOLVE_CASE_RHS", token, weights } satisfies WorkerRequest);
    });
  }

  /** v1.8.0: the 41 closed-form benchmarks for the Validation modal. */
  fetchValidationSuite(): Promise<BenchResultDto[]> {
    return new Promise<BenchResultDto[]>((resolve, reject) => {
      if (enginePending.has("VALIDATION_SUITE")) {
        reject({ kind: "Fault", message: "validation in flight" });
        return;
      }
      enginePending.set("VALIDATION_SUITE", {
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.worker.postMessage({ type: "VALIDATION_SUITE" } satisfies WorkerRequest);
    });
  }

  /** v1.8.0/v1.9.0: named engine call over the generic lane. */
  engineCall(fn: EngineFn, ...args: unknown[]): Promise<unknown> {
    return new Promise<unknown>((resolve, reject) => {
      const key = `${fn}:${(liveTokenCounter += 1)}`;
      enginePending.set(key, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.worker.postMessage({ type: "ENGINE_CALL", fn, args } satisfies WorkerRequest);
      // Route the reply by fn-name (single in-flight per fn is the UI norm).
      const original = enginePending.get(key);
      enginePending.delete(key);
      enginePending.set(fn, original ?? { resolve, reject });
    });
  }

  solveModel(project: unknown): Promise<SolveReport> {
    return new Promise<SolveReport>((resolve, reject) => {
      this.enqueue(
        { type: "SOLVE_MODEL", project },
        { onResult: (data) => resolve(data as SolveReport), onError: reject },
      );
    });
  }

  renderReportPdf(html: string, images?: { src: string; data: Uint8Array }[]): Promise<Uint8Array> {
    return new Promise<Uint8Array>((resolve, reject) => {
      this.enqueue(
        { type: "RENDER_PDF", html, images },
        { onResult: (data) => resolve(data as Uint8Array), onError: reject },
      );
    });
  }

  fetchCatalog(): Promise<{
    sections: SectionSummary[];
    materials: string[];
    sectionDims: SectionDims[];
  }> {
    return new Promise<{
      sections: SectionSummary[];
      materials: string[];
      sectionDims: SectionDims[];
    }>((resolve, reject) => {
      this.enqueue(
        { type: "FETCH_CATALOG" },
        {
          onResult: (data) =>
            resolve(
              data as {
                sections: SectionSummary[];
                materials: string[];
                sectionDims: SectionDims[];
              },
            ),
          onError: reject,
        },
      );
    });
  }

  /** Natural frequencies + mode shapes (v1.0.0 modal engine). */
  modalAnalysis(project: unknown, nModes: number): Promise<ModalReport> {
    return new Promise<ModalReport>((resolve, reject) => {
      this.enqueue(
        { type: "MODAL_ANALYSIS", project, nModes },
        { onResult: (data) => resolve(data as ModalReport), onError: reject },
      );
    });
  }

  /** sigma_vM cross-section grid (v1.0.0 section cut). */
  sectionStress(
    project: unknown,
    beamId: number,
    ratio: number,
    gridN: number,
  ): Promise<StressGrid> {
    return new Promise<StressGrid>((resolve, reject) => {
      this.enqueue(
        { type: "SECTION_STRESS", project, beamId, ratio, gridN },
        { onResult: (data) => resolve(data as StressGrid), onError: reject },
      );
    });
  }

  /** EN 10365 properties of one designation (Step 1 inspector). */
  catalogSectionProperties(designation: string): Promise<{
    a: number;
    iy: number;
    iz: number;
    it: number;
    iw: number | null;
    wel_y: number;
    wpl_y: number | null;
    mass_per_m: number;
  }> {
    return new Promise((resolve, reject) => {
      this.enqueue(
        { type: "CATALOG_PROPERTIES", designation },
        {
          onResult: (data) =>
            resolve(
              data as {
                a: number;
                iy: number;
                iz: number;
                it: number;
                iw: number | null;
                wel_y: number;
                wpl_y: number | null;
                mass_per_m: number;
              },
            ),
          onError: reject,
        },
      );
    });
  }

  /** n-point internal forces of one member (Step 4 diagrams). */
  beamSpanForces(project: unknown, beamId: number, nRatios: number): Promise<SpanForceSample[]> {
    return new Promise<SpanForceSample[]>((resolve, reject) => {
      this.enqueue(
        { type: "SPAN_FORCES", project, beamId, nRatios },
        { onResult: (data) => resolve(data as SpanForceSample[]), onError: reject },
      );
    });
  }

  /** DXF import -> fresh .rdm project JSON (v1.0.0 CAD engine). */
  /** v1.4.0: canonical SHA-256 fingerprint of the `.rdm` model. */
  projectFingerprint(projectJson: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      this.enqueue(
        { type: "FINGERPRINT", projectJson },
        { onResult: (data) => resolve(data as string), onError: reject },
      );
    });
  }

  /** v1.3.0: extension-dispatched CAD import (.dxf/.step/.stp/.igs/.iges). */
  importCad(bytes: ArrayBuffer, filename: string, name: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      this.enqueue(
        { type: "IMPORT_CAD", bytes, filename, name },
        { onResult: (data) => resolve(data as string), onError: reject },
      );
    });
  }

  importDxf(bytes: ArrayBuffer, name: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      this.enqueue(
        { type: "IMPORT_DXF", bytes, name },
        { onResult: (data) => resolve(data as string), onError: reject },
      );
    });
  }

  /**
   * Auto-reactive solving (v1.0.0 bug 10): debounced 150 ms after any model
   * mutation so results and the report never go stale.
   */
  autoSolve(getProject: () => unknown): Promise<SolveReport> {
    autoSolveRunner ??= createAutoSolve(() => this.solveModel(getProject()));
    return autoSolveRunner.trigger();
  }

  /**
   * v1.6.0: structured pre-solve diagnostics (`rdm_model::validate_model`)
   * surfaced as live badges on Steps 1–3.
   */
  validateModelIssues(project: unknown): Promise<ModelIssue[]> {
    return new Promise<ModelIssue[]>((resolve, reject) => {
      this.enqueue(
        { type: "MODEL_ISSUES", project },
        { onResult: (data) => resolve(data as ModelIssue[]), onError: reject },
      );
    });
  }

  /**
   * v1.6.0: parametric structure generator — returns the fresh `.rdm`
   * project JSON string produced by `rdm-cad::parametric`.
   */
  generateParametricStructure(params: ParametricParamsInput, name: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      this.enqueue(
        { type: "GENERATE_PARAMETRIC", params, name },
        { onResult: (data) => resolve(data as string), onError: reject },
      );
    });
  }
}

export const feaClient = new FeaClient();

/** v1.4.0: last eigen-mode report getter for the report sheet. */
let lastModalReport: ModalReport | null = null;

export function getLastModalReport(): ModalReport | null {
  return lastModalReport;
}

/**
 * v1.6.0: last-report pub/sub for the 3D metrology overlays — the
 * ViewportLabels reaction / deflection callouts re-render on every
 * auto-solve without polling the module variable.
 */
type ReportListener = (report: SolveReport | null) => void;
const reportListeners = new Set<ReportListener>();

export function subscribeLastReport(listener: ReportListener): () => void {
  reportListeners.add(listener);
  listener(lastReport);
  return () => {
    reportListeners.delete(listener);
  };
}

/** React hook form of {@link subscribeLastReport}. */
export function useLastReport(): SolveReport | null {
  const [report, setReport] = useState<SolveReport | null>(lastReport);
  useEffect(() => subscribeLastReport(setReport), []);
  return report;
}
