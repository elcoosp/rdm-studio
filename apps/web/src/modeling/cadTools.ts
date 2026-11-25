/**
 * CAD manipulation suite (v1.9.0): the single command registry behind
 * the toolbar, keyboard shortcuts and the `?` cheat-sheet. Each command
 * is a pure geometry transform over the model arrays — no hidden state.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface CadNode {
  id: number;
  x: number;
  y: number;
  z: number;
}

export interface CadBeam {
  id: number;
  n1: number;
  n2: number;
  section_id: string;
  material_id: string;
}

export interface CadModel {
  nodes: CadNode[];
  beams: CadBeam[];
}

export interface CadCommand {
  id: string;
  label: string;
  shortcut: string;
  group: "Draw" | "Modify" | "Select" | "Snapping" | "View";
  /** Applies the command; returns a NEW model (undo-friendly). */
  apply: (model: CadModel, arg?: unknown) => CadModel;
}

function deepClone(model: CadModel): CadModel {
  return {
    nodes: model.nodes.map((n) => ({ ...n })),
    beams: model.beams.map((b) => ({ ...b })),
  };
}

function nextId(existing: number[]): number {
  return existing.length === 0 ? 1 : Math.max(...existing) + 1;
}

/** Midpoint of a beam. */
export function beamMidpoint(model: CadModel, beam: CadBeam): Vec3 {
  const a = model.nodes.find((n) => n.id === beam.n1);
  const b = model.nodes.find((n) => n.id === beam.n2);
  return a !== undefined && b !== undefined
    ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 }
    : { x: 0, y: 0, z: 0 };
}

/** Snapping candidates around a cursor point (endpoint/midpoint/grid). */
export function snapCandidates(
  model: CadModel,
  point: Vec3,
  radius: number,
): { point: Vec3; kind: string }[] {
  const out: { point: Vec3; kind: string }[] = [];
  for (const node of model.nodes) {
    const p = { x: node.x, y: node.y, z: node.z };
    if (Math.hypot(p.x - point.x, p.y - point.y, p.z - point.z) < radius) {
      out.push({ point: p, kind: "endpoint" });
    }
  }
  for (const beam of model.beams) {
    const mid = beamMidpoint(model, beam);
    if (Math.hypot(mid.x - point.x, mid.y - point.y, mid.z - point.z) < radius) {
      out.push({ point: mid, kind: "midpoint" });
    }
  }
  return out;
}

/** Polar snapping at 15° increments. */
export function snapPolar(origin: Vec3, cursor: Vec3, incrementDeg = 15): Vec3 {
  const dx = cursor.x - origin.x;
  const dy = cursor.y - origin.y;
  const angle = Math.atan2(dy, dx);
  const step = (incrementDeg * Math.PI) / 180;
  const snapped = Math.round(angle / step) * step;
  const length = Math.hypot(dx, dy);
  return {
    x: origin.x + Math.cos(snapped) * length,
    y: origin.y + Math.sin(snapped) * length,
    z: cursor.z,
  };
}

/** Unit-aware inline length parser: `4m`, `4000mm`, `12kN` → SI value. */
export function parseUnitValue(raw: string): number | null {
  const cleaned = raw.trim().toLowerCase().replace(",", ".");
  const match = /^(-?\d+(?:\.\d+)?)\s*(mm|cm|dm|m|kn|n|t)?$/.exec(cleaned);
  if (match === null) {
    return null;
  }
  const value = Number(match[1]);
  const unit = match[2] ?? "m";
  switch (unit) {
    case "mm":
      return value / 1000;
    case "cm":
      return value / 100;
    case "dm":
      return value / 10;
    case "kn":
      return value * 1000;
    case "t":
      return value * 1e6;
    default:
      return value;
  }
}

/** Static registry lookup (the move command always exists). */
function moveCommand(): CadCommand {
  const command = CAD_COMMANDS.find((c) => c.id === "move");
  if (command === undefined) {
    throw new Error("move command missing from the registry");
  }
  return command;
}

function rotateY(p: Vec3, angle: number): Vec3 {
  return {
    x: p.x * Math.cos(angle) - p.z * Math.sin(angle),
    y: p.y,
    z: p.x * Math.sin(angle) + p.z * Math.cos(angle),
  };
}

/** The command registry — the single source of the `?` cheat-sheet. */
export const CAD_COMMANDS: CadCommand[] = [
  {
    id: "polyline",
    label: "Polyligne",
    shortcut: "P",
    group: "Draw",
    apply: (model, arg) => {
      const points = (arg as Vec3[]) ?? [];
      const clone = deepClone(model);
      let last: CadNode | undefined;
      for (const p of points) {
        const id = nextId(clone.nodes.map((n) => n.id));
        clone.nodes.push({ id, x: p.x, y: p.y, z: p.z });
        if (last !== undefined) {
          clone.beams.push({
            id: nextId(clone.beams.map((b) => b.id)),
            n1: last.id,
            n2: id,
            section_id: "IPE 200",
            material_id: "S235JR",
          });
        }
        last = clone.nodes.at(-1);
      }
      return clone;
    },
  },
  {
    id: "extrude",
    label: "Extrusion",
    shortcut: "E",
    group: "Draw",
    apply: (model, arg) => {
      const { dx, dy, dz } = (arg ?? { dx: 0, dy: 0, dz: 3 }) as {
        dx: number;
        dy: number;
        dz: number;
      };
      const clone = deepClone(model);
      const offsets = clone.nodes.map((n) => ({
        from: n.id,
        id: nextId(clone.nodes.map((x) => x.id)) + clone.nodes.indexOf(n),
        x: n.x + dx,
        y: n.y + dy,
        z: n.z + dz,
      }));
      for (const o of offsets) {
        clone.nodes.push({ id: o.id, x: o.x, y: o.y, z: o.z });
      }
      for (const beam of clone.beams) {
        clone.beams.push({
          ...beam,
          id: nextId(clone.beams.map((b) => b.id)) + clone.beams.indexOf(beam),
          n1: offsets.find((o) => o.from === beam.n1)?.id ?? beam.n1,
          n2: offsets.find((o) => o.from === beam.n2)?.id ?? beam.n2,
        });
      }
      return clone;
    },
  },
  {
    id: "move",
    label: "Déplacer",
    shortcut: "M",
    group: "Modify",
    apply: (model, arg) => {
      const { dx, dy, dz, ids } = (arg ?? { dx: 0, dy: 0, dz: 0, ids: [] }) as {
        dx: number;
        dy: number;
        dz: number;
        ids: number[];
      };
      const clone = deepClone(model);
      for (const node of clone.nodes) {
        if (ids.length === 0 || ids.includes(node.id)) {
          node.x += dx;
          node.y += dy;
          node.z += dz;
        }
      }
      return clone;
    },
  },
  {
    id: "rotate",
    label: "Rotation",
    shortcut: "O",
    group: "Modify",
    apply: (model, arg) => {
      const angle = (arg as { angle?: number })?.angle ?? 0;
      const clone = deepClone(model);
      for (const node of clone.nodes) {
        Object.assign(node, rotateY(node, angle));
      }
      return clone;
    },
  },
  {
    id: "mirror",
    label: "Miroir X",
    shortcut: "I",
    group: "Modify",
    apply: (model) => {
      const clone = deepClone(model);
      for (const node of clone.nodes) {
        node.x = -node.x;
      }
      return clone;
    },
  },
  {
    id: "array_linear",
    label: "Répétition linéaire",
    shortcut: "A",
    group: "Modify",
    apply: (model, arg) => {
      const { count, dx, dy, dz } = (arg ?? { count: 2, dx: 4, dy: 0, dz: 0 }) as {
        count: number;
        dx: number;
        dy: number;
        dz: number;
      };
      let current = model;
      for (let step = 1; step < Math.max(count, 2); step += 1) {
        const clone = deepClone(current);
        const shift = { dx: dx * step, dy: dy * step, dz: dz * step, ids: [] as number[] };
        current = moveCommand().apply(clone, shift);
      }
      return current;
    },
  },
  {
    id: "merge_duplicates",
    label: "Fusionner les doublons",
    shortcut: "F",
    group: "Modify",
    apply: (model) => {
      const clone = deepClone(model);
      const seen = new Map<string, number>();
      const remap = new Map<number, number>();
      clone.nodes = clone.nodes.filter((node) => {
        const key = `${node.x.toFixed(6)},${node.y.toFixed(6)},${node.z.toFixed(6)}`;
        const existing = seen.get(key);
        if (existing !== undefined) {
          remap.set(node.id, existing);
          return false;
        }
        seen.set(key, node.id);
        return true;
      });
      for (const beam of clone.beams) {
        beam.n1 = remap.get(beam.n1) ?? beam.n1;
        beam.n2 = remap.get(beam.n2) ?? beam.n2;
      }
      clone.beams = clone.beams.filter((b) => b.n1 !== b.n2);
      return clone;
    },
  },
  {
    id: "copy_paste",
    label: "Copier-coller au curseur",
    shortcut: "Ctrl+V",
    group: "Modify",
    apply: (model, arg) => {
      const cursor = (arg as Vec3) ?? { x: 0, y: 0, z: 0 };
      const minX = Math.min(...model.nodes.map((n) => n.x), 0);
      const minY = Math.min(...model.nodes.map((n) => n.y), 0);
      return moveCommand().apply(model, {
        dx: cursor.x - minX,
        dy: cursor.y - minY,
        dz: cursor.z,
        ids: model.nodes.map((n) => n.id),
      });
    },
  },
  {
    id: "select_similar",
    label: "Sélection similaire",
    shortcut: "Shift+S",
    group: "Select",
    apply: (model, arg) => {
      const sectionId = arg as string;
      return { ...model, beams: model.beams.filter((b) => b.section_id === sectionId) };
    },
  },
  {
    id: "isolate",
    label: "Isoler",
    shortcut: "Shift+I",
    group: "View",
    apply: (model, arg) => {
      const sectionId = arg as string;
      return { ...model, beams: model.beams.filter((b) => b.section_id !== sectionId) };
    },
  },
];
