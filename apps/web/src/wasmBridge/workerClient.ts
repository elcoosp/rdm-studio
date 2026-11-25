import type { WorkerRequest } from "./fea.worker";

/** Typed result of a solve (mirrors SolveReport in rdm-wasm). */
export interface CombinationReport {
  kind: string;
  label: string;
  beams: { beam_id: number; utilization: number; midspan_deflection: number }[];
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

interface Pending {
  onResult: (data: unknown) => void;
  onError: (fault: SolveFault) => void;
}

/** Last successful solve, shared across routes (report/export step). */
let lastReport: SolveReport | null = null;

export function getLastReport(): SolveReport | null {
  return lastReport;
}

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
        | { type: "CATALOG"; sections: SectionSummary[]; materials: string[] }
        | { type: "PDF_RESULT"; pdf: Uint8Array };
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

  fetchCatalog(): Promise<{ sections: SectionSummary[]; materials: string[] }> {
    return new Promise<{ sections: SectionSummary[]; materials: string[] }>((resolve, reject) => {
      this.enqueue(
        { type: "FETCH_CATALOG" },
        {
          onResult: (data) => resolve(data as { sections: SectionSummary[]; materials: string[] }),
          onError: reject,
        },
      );
    });
  }
}

export const feaClient = new FeaClient();
