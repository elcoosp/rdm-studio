import type { WorkerRequest } from "./fea.worker";

/** Typed result of a solve (mirrors SolveReport in rdm-wasm). */
export interface CombinationReport {
  kind: string;
  label: string;
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
}

export interface StressGrid {
  bounds: [number, number, number, number];
  points: StressPoint[];
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
        | { type: "SPAN_FORCES_FAULT"; fault: SolveFault };
      const pending = this.queue.shift()?.pending;
      if (pending === undefined) {
        return;
      }
      this.busy = false;
      if (data.type === "SOLVE_FAULT") {
        pending.onError(data.fault);
      } else if (data.type === "SOLVE_RESULT") {
        lastReport = data.report;
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
}

export const feaClient = new FeaClient();

/** v1.4.0: last eigen-mode report getter for the report sheet. */
let lastModalReport: ModalReport | null = null;

export function getLastModalReport(): ModalReport | null {
  return lastModalReport;
}
