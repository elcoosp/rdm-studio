import type { ProjectData } from "@/state/projectStore";

/**
 * Step 4 KPI math (v1.0.0): model mass from true catalog areas and the
 * corrective-profile helper for the EC3 pass/fail badge (DESIGN.md §6).
 */

/** Total model mass in kg: Σ ρ·A·L over members (A from catalog dims). */
export function computeModelMassKg(
  project: ProjectData,
  areasByDesignation?: Map<string, number>,
): number {
  const nodes = new Map(project.structure.nodes.map((n) => [n.id, n]));
  let total = 0;
  for (const beam of project.structure.beams) {
    const n1 = nodes.get(beam.n1);
    const n2 = nodes.get(beam.n2);
    if (n1 === undefined || n2 === undefined) {
      continue;
    }
    const length = Math.sqrt((n2.x - n1.x) ** 2 + (n2.y - n1.y) ** 2 + (n2.z - n1.z) ** 2);
    const area = areasByDesignation?.get(beam.section_id) ?? 2.24e-3;
    total += 7850 * area * length;
  }
  return total;
}

/** The classic IPE bending series (EN 10365) used for corrective upgrades. */
export const IPE_SERIES = [
  "IPE 100",
  "IPE 120",
  "IPE 140",
  "IPE 160",
  "IPE 180",
  "IPE 200",
  "IPE 220",
  "IPE 240",
  "IPE 270",
  "IPE 300",
  "IPE 330",
  "IPE 360",
  "IPE 400",
  "IPE 450",
  "IPE 500",
  "IPE 550",
  "IPE 600",
] as const;

/** Returns the profile `steps` ranks heavier, or null at the end of series. */
export function nextHeavierProfile(
  designations: string[],
  current: string,
  steps = 1,
): string | null {
  const sorted = designations
    .filter((d) => /^IPE \d+$/.test(d))
    .sort((x, y) => Number(x.split(" ")[1]) - Number(y.split(" ")[1]));
  const index = sorted.indexOf(current);
  if (index < 0) {
    return (
      sorted.find((d) => Number(d.split(" ")[1]) > Number(current.split(" ")[1] || "0")) ?? null
    );
  }
  return sorted[index + steps] ?? null;
}
