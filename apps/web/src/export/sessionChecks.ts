import type { ConnectionCheckResult, TrainEnvelopeResult } from "@/wasmBridge/workerClient";

/**
 * M12.5 — session registry of the advanced M12 analyses feeding the Step 5
 * report: the last EN 1993-1-8 connection verification run in the Studio
 * Assemblages and the last moving-load envelope of the Convois panel.
 * Module-level singletons with a version counter (same pattern as
 * `lastReport` in the worker client) — the report chapters render
 * "whenever present" and re-render on every new record.
 */

export interface SessionConnectionCheck {
  /** Beam the check ran on (`P4 · IPE 200`). */
  beamLabel: string;
  /** Full engine result (trace + utilizations). */
  result: ConnectionCheckResult;
}

let connectionCheck: SessionConnectionCheck | null = null;
let connectionVersion = 0;
const connectionListeners = new Set<() => void>();

export function recordConnectionCheck(value: SessionConnectionCheck): void {
  connectionCheck = value;
  connectionVersion += 1;
  for (const listener of connectionListeners) {
    listener();
  }
}

export function getConnectionCheck(): SessionConnectionCheck | null {
  return connectionCheck;
}

/** Subscribe to connection-check updates (report chapters). */
export function subscribeConnectionCheck(listener: () => void): () => void {
  connectionListeners.add(listener);
  return () => {
    connectionListeners.delete(listener);
  };
}

export interface SessionMovingEnvelope {
  /** Beam id the envelope ran on. */
  beamId: number;
  /** Train label (`EN 1991-2 LM1`, `Pont roulant`, `Convoi personnalisé`). */
  trainLabel: string;
  /** Governing envelope from the engine. */
  envelope: TrainEnvelopeResult;
}

let movingEnvelope: SessionMovingEnvelope | null = null;
let movingVersion = 0;
const movingListeners = new Set<() => void>();

export function recordMovingEnvelope(value: SessionMovingEnvelope): void {
  movingEnvelope = value;
  movingVersion += 1;
  for (const listener of movingListeners) {
    listener();
  }
}

export function getMovingEnvelope(): SessionMovingEnvelope | null {
  return movingEnvelope;
}

/** Subscribe to moving-envelope updates (report chapters). */
export function subscribeMovingEnvelope(listener: () => void): () => void {
  movingListeners.add(listener);
  return () => {
    movingListeners.delete(listener);
  };
}
