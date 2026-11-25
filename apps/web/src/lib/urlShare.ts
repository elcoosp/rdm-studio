import LZString from "lz-string";
import * as v from "valibot";
import { ProjectFileSchema, type ProjectFileInput } from "@/schemas/project.schema";

/**
 * Compressed URL sharing of `.rdm` projects (lz-string) — the payload is
 * Valibot-validated before it ever reaches the solver (zero-trust inputs).
 */
export function encodeProject(project: unknown): string {
  return LZString.compressToEncodedURIComponent(JSON.stringify(project));
}

export function decodeProject(payload: string): unknown {
  const json = LZString.decompressFromEncodedURIComponent(payload);
  if (json === null) {
    return null;
  }
  return JSON.parse(json) as unknown;
}

export function parseProject(
  payload: string,
): { ok: true; project: ProjectFileInput } | { ok: false; error: string } {
  const candidate = decodeProject(payload);
  const result = v.safeParse(ProjectFileSchema, candidate);
  if (result.success) {
    return { ok: true, project: result.output };
  }
  return {
    ok: false,
    error: result.issues
      .map((i) => `${i.path?.map((p) => p.key).join(".")} :: ${i.message}`)
      .join("; "),
  };
}
