import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn class composer", () => {
  it("merges tailwind classes", () => {
    expect(cn("px-2", "text-sm")).toContain("px-2");
  });
  it("lets later classes win on conflicts", () => {
    const merged = cn("p-2", "p-4");
    expect(merged).toContain("p-4");
    expect(merged).not.toContain("p-2 ");
  });
  it("drops falsy inputs", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });
});

// ---------------------------------------------------------------------------
// v2.1.2 hygiene gates (AGENTS.md §2 primitives + icon parity): the
// shadcn/Base UI migration is ENFORCED here — zero raw native form /
// overlay elements may return to components/, routes/ or viewport3d/, and
// the 44 custom engineering icons must stay exported.
// ---------------------------------------------------------------------------
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC_ROOT = join(__dirname, "..");
const SCANNED_DIRS = ["components", "routes", "viewport3d"];

/** Strips JS/TSX comments so doc mentions never trip the hygiene scan. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
}

function* walkTsx(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === "wasm-pkg") continue;
      yield* walkTsx(full);
    } else if (entry.endsWith(".tsx") && !entry.endsWith(".test.tsx")) {
      yield full;
    }
  }
}

describe("v2.1.2 Base UI hygiene (zero raw native controls)", () => {
  it("renders no raw <select> in components/routes/viewport3d", () => {
    const offenders: string[] = [];
    for (const dir of SCANNED_DIRS) {
      for (const file of walkTsx(join(SRC_ROOT, dir))) {
        if (/<select[\s>]/.test(stripComments(readFileSync(file, "utf8")))) {
          offenders.push(file);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('renders no raw <input type="checkbox"> or type="range"', () => {
    const offenders: string[] = [];
    for (const dir of SCANNED_DIRS) {
      for (const file of walkTsx(join(SRC_ROOT, dir))) {
        const text = stripComments(readFileSync(file, "utf8"));
        if (/type=["']checkbox["']/.test(text) || /type=["']range["']/.test(text)) {
          offenders.push(file);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("renders no raw <details>/<summary> disclosures", () => {
    const offenders: string[] = [];
    for (const dir of SCANNED_DIRS) {
      for (const file of walkTsx(join(SRC_ROOT, dir))) {
        if (/<details[\s>]/.test(stripComments(readFileSync(file, "utf8")))) {
          offenders.push(file);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('renders no hand-rolled role="dialog" overlays', () => {
    const offenders: string[] = [];
    for (const dir of SCANNED_DIRS) {
      for (const file of walkTsx(join(SRC_ROOT, dir))) {
        if (/role=["']dialog["']/.test(stripComments(readFileSync(file, "utf8")))) {
          offenders.push(file);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("v2.1.2 engineering icon parity (44 icons)", () => {
  it("exports all 44 icons from EngineeringIcons.tsx", async () => {
    const module = await import("../components/icons/EngineeringIcons");
    const expected = [
      // 32 from mockups/icons-sheet.html
      "ProfileIpe",
      "ProfileHea",
      "ProfileUpn",
      "ProfileChs",
      "ProfileRhs",
      "ProfileAngle",
      "VolumetricMesh",
      "WireframeMesh",
      "SupportFixed",
      "SupportPinned",
      "SupportRoller",
      "SupportSlider",
      "SupportSpring",
      "ReleaseHinge",
      "SupportReaction",
      "LocalAxes",
      "NodalPointLoad",
      "UniformBeamLoad",
      "TrapezoidalLoad",
      "SpanPointLoad",
      "TorqueMoment",
      "SelfWeightGravity",
      "DynamicAcceleration",
      "LoadCombination",
      "RollAngle",
      "MagneticSnap",
      "MergeNodes",
      "SectionCut",
      "FlexuralBuckling",
      "LateralTorsionalBuckling",
      "DeflectionLimit",
      "ModalVibration",
      // 12 from mockups/icons-sheet-v2.html
      "BeamSegment",
      "NodePin",
      "PortalFrameIcon",
      "WarrenTrussIcon",
      "ContinuousBeamIcon",
      "WindLoadIcon",
      "SnowLoadIcon",
      "ThermalLoadIcon",
      "MassWeightIcon",
      "ConcreteBeamIcon",
      "TimberBeamIcon",
      "SteelJointIcon",
    ];
    expect(expected).toHaveLength(44);
    const missing = expected.filter(
      (name) => typeof (module as Record<string, unknown>)[name] !== "function",
    );
    expect(missing).toEqual([]);
  });
});
