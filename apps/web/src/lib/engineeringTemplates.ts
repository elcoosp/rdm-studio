/**
 * 12 validated engineering templates (v2.0.0): id, node/member seed
 * data and the `"Pourquoi ce modèle"` engineering note shown in the
 * gallery. All dimensions in SI metres; loads in kN.
 */

export interface TemplateSeed {
  id: string;
  name: string;
  why: string;
  nodes: { id: number; x: number; y: number; z: number }[];
  beams: { id: number; n1: number; n2: number; section_id: string; material_id: string }[];
  loads: {
    case: "Permanent" | "Variable" | "Snow" | "Wind";
    kind: "Nodal" | "PointOnSpan" | "Trapezoid";
    beam_id?: number;
    node_id?: number;
    position_ratio?: number;
    q_start?: number;
    q_end?: number;
    fz?: number;
    /** v2.1.0: horizontal nodal actions (wind push on R+2 frames). */
    fx?: number;
    fy?: number;
    direction?: { x: number; y: number; z: number };
  }[];
  /** v2.0.2: canonical DOF-restraint set (locked_dofs per support node). */
  supports?: { node_id: number; locked_dofs: boolean[] }[];
}

/**
 * v2.0.2: the canonical minimal restraint set of a template, derived from
 * its ground geometry — encastre when the model touches the ground at a
 * single node (potence / poteau), otherwise a pin at the first ground
 * node and a vertical roller at the last one. Deterministic per template
 * so the gallery always loads stable, solvable models.
 */
export function canonicalSupports(
  seed: TemplateSeed,
): { node_id: number; locked_dofs: boolean[] }[] {
  const zMin = Math.min(...seed.nodes.map((n) => n.z));
  const ground = seed.nodes.filter((n) => Math.abs(n.z - zMin) < 1e-9);
  const first = ground[0];
  const last = ground[ground.length - 1];
  if (first === undefined || last === undefined || seed.nodes.length === 0) {
    return [];
  }
  const pin = ground.reduce((a, n) => (n.x < a.x ? n : a), first);
  const roller = ground.filter((n) => n.id !== pin.id).reduce((a, n) => (n.x > a.x ? n : a), pin);
  if (roller.id === pin.id) {
    // Cantilever / single-base poteau: full encastre.
    return [{ node_id: pin.id, locked_dofs: [true, true, true, true, true, true] }];
  }
  return [
    { node_id: pin.id, locked_dofs: [true, true, true, true, true, false] },
    { node_id: roller.id, locked_dofs: [false, false, true, false, false, false] },
  ];
}

const S235 = "S235JR";
const b = (id: number, n1: number, n2: number, s: string): TemplateSeed["beams"][number] => ({
  id,
  n1,
  n2,
  section_id: s,
  material_id: S235,
});
// v2.1.0 (22fd9fa audit): RDM Studio's canonical frame is Z-up (X-Z plane,
// gravity -Z) — every template now lives in the solver's own vertical axis
// so all 12 gallery models solve under vertical gravity out of the box.
const gravity = { x: 0, y: 0, z: -1 };

/** The canonical gallery, in pedagogical order. */
export const ENGINEERING_TEMPLATES: TemplateSeed[] = [
  {
    id: "poutre-isostatique",
    name: "Poutre isostatique",
    why: "Référence analytique : flèche 5qL⁴/384EI et moment qL²/8 vérifiables à la main — le premier modèle à résoudre après l'installation.",
    nodes: [
      { id: 1, x: 0, y: 0, z: 0 },
      { id: 2, x: 6, y: 0, z: 0 },
    ],
    beams: [b(1, 1, 2, "IPE 200")],
    loads: [
      {
        case: "Permanent",
        kind: "Trapezoid",
        beam_id: 1,
        q_start: -5000,
        q_end: -5000,
        direction: gravity,
      },
    ],
  },
  {
    id: "poutre-continue-3-travees",
    name: "Poutre continue 3 travées",
    why: "Montre l'influence des travées adjacentes : moments négatifs sur appuis et redistribution — comparer 6.10 et 6.10a/b ici.",
    nodes: [1, 2, 3, 4].map((id, i) => ({ id, x: i * 6, y: 0, z: 0 })),
    beams: [b(1, 1, 2, "IPE 300"), b(2, 2, 3, "IPE 300"), b(3, 3, 4, "IPE 300")],
    loads: [1, 2, 3].map((beam_id) => ({
      case: "Permanent" as const,
      kind: "Trapezoid" as const,
      beam_id,
      q_start: -8000,
      q_end: -8000,
      direction: gravity,
    })),
  },
  {
    id: "portique-simple",
    name: "Portique simple",
    why: "Portique encastré-articulé : le nœud rigide poutre-poteau illustre la transmission M/N — idéal pour tester les entretoisements.",
    nodes: [
      { id: 1, x: 0, y: 0, z: 0 },
      { id: 2, x: 0, y: 0, z: 4 },
      { id: 3, x: 8, y: 0, z: 4 },
      { id: 4, x: 8, y: 0, z: 0 },
    ],
    beams: [b(1, 1, 2, "HEA 200"), b(2, 2, 3, "IPE 240"), b(3, 3, 4, "HEA 200")],
    loads: [
      {
        case: "Variable",
        kind: "Trapezoid",
        beam_id: 2,
        q_start: -6000,
        q_end: -6000,
        direction: gravity,
      },
    ],
  },
  {
    id: "portique-2-versants",
    name: "Portique à 2 versants avec pannes",
    why: "Ferme classique de halle : pentes 10 %, pannes espacées — le vent (force horizontale) et la neige y sont lus ensemble.",
    nodes: [1, 2, 3, 4, 5].map((id, i) => ({
      id,
      x: i * 4,
      y: 0,
      z: i === 2 ? 6 : i === 1 || i === 3 ? 4 : 0,
    })),
    beams: [
      b(1, 1, 2, "IPE 240"),
      b(2, 2, 3, "IPE 240"),
      b(3, 3, 4, "IPE 240"),
      b(4, 4, 5, "IPE 240"),
    ],
    loads: [1, 2, 3, 4].map((beam_id) => ({
      case: "Snow" as const,
      kind: "Trapezoid" as const,
      beam_id,
      q_start: -4000,
      q_end: -4000,
      direction: gravity,
    })),
  },
  {
    id: "treillis-warren-24",
    name: "Treillis Warren 24 m",
    why: "Diagonales alternées sans montants : effort nul dans certains barreaux selon le chargement — activer « Barre articulée » et comparer.",
    nodes: [1, 2, 3, 4, 5].flatMap((id, i) => [
      { id, x: i * 6, y: 0, z: 4 },
      { id: id + 5, x: i * 6, y: 0, z: 0 },
    ]),
    beams: [
      b(1, 1, 6, "L 100x100x10"),
      b(2, 1, 2, "L 100x100x10"),
      b(3, 2, 3, "L 100x100x10"),
      b(4, 3, 4, "L 100x100x10"),
      b(5, 4, 5, "L 100x100x10"),
      b(6, 6, 7, "L 100x100x10"),
      b(7, 7, 8, "L 100x100x10"),
      b(8, 8, 9, "L 100x100x10"),
      b(9, 9, 10, "L 100x100x10"),
      b(10, 1, 7, "L 100x100x10"),
      b(11, 7, 2, "L 100x100x10"),
      b(12, 2, 8, "L 100x100x10"),
      b(13, 8, 3, "L 100x100x10"),
      b(14, 3, 9, "L 100x100x10"),
      b(15, 9, 4, "L 100x100x10"),
      b(16, 4, 10, "L 100x100x10"),
    ],
    loads: [
      { case: "Variable", kind: "Nodal", node_id: 7, fz: -30000 },
      { case: "Variable", kind: "Nodal", node_id: 9, fz: -30000 },
    ],
  },
  {
    id: "treillis-pratt",
    name: "Treillis Pratt",
    why: "Diagonales tendues vers le centre : les montants travaillent en compression — lecture directe du signe N dans le diagramme.",
    nodes: [1, 2, 3, 4, 5].flatMap((id, i) => [
      { id, x: i * 6, y: 0, z: 4 },
      { id: id + 5, x: i * 6, y: 0, z: 0 },
    ]),
    beams: [
      b(1, 1, 6, "L 100x100x10"),
      b(2, 2, 3, "L 100x100x10"),
      b(3, 3, 4, "L 100x100x10"),
      b(4, 6, 7, "L 100x100x10"),
      b(5, 7, 8, "L 100x100x10"),
      b(6, 8, 9, "L 100x100x10"),
      b(7, 9, 10, "L 100x100x10"),
      b(8, 1, 7, "L 100x100x10"),
      b(9, 2, 7, "L 100x100x10"),
      b(10, 2, 8, "L 100x100x10"),
      b(11, 3, 8, "L 100x100x10"),
      b(12, 3, 9, "L 100x100x10"),
      b(13, 4, 9, "L 100x100x10"),
    ],
    loads: [{ case: "Variable", kind: "Nodal", node_id: 8, fz: -40000 }],
  },
  {
    id: "treillis-howe",
    name: "Treillis Howe",
    why: "Contrefiguration du Pratt : diagonales comprimées, montants tendus — comparer les taux de flambement χ avec le Pratt.",
    nodes: [1, 2, 3, 4, 5].flatMap((id, i) => [
      { id, x: i * 6, y: 0, z: 4 },
      { id: id + 5, x: i * 6, y: 0, z: 0 },
    ]),
    beams: [
      b(1, 1, 6, "L 100x100x10"),
      b(2, 2, 3, "L 100x100x10"),
      b(3, 3, 4, "L 100x100x10"),
      b(4, 6, 7, "L 100x100x10"),
      b(5, 7, 8, "L 100x100x10"),
      b(6, 8, 9, "L 100x100x10"),
      b(7, 9, 10, "L 100x100x10"),
      b(8, 1, 7, "L 100x100x10"),
      b(9, 7, 3, "L 100x100x10"),
      b(10, 3, 8, "L 100x100x10"),
      b(11, 8, 4, "L 100x100x10"),
      b(12, 4, 9, "L 100x100x10"),
      b(13, 2, 7, "L 100x100x10"),
    ],
    loads: [{ case: "Variable", kind: "Nodal", node_id: 8, fz: -40000 }],
  },
  {
    id: "potence-encastree",
    name: "Potence encastrée",
    why: "Encastrement parfait vs semi-rigide : la potence montre le moment maximal à l'encastrement et l'effet P-Δ du pylône chargé.",
    nodes: [
      { id: 1, x: 0, y: 0, z: 0 },
      { id: 2, x: 3, y: 0, z: 0 },
    ],
    beams: [b(1, 1, 2, "IPE 180")],
    loads: [{ case: "Variable", kind: "Nodal", node_id: 2, fz: -15000 }],
  },
  {
    id: "ossature-r2",
    name: "Ossature R+2 contreventée",
    why: "Trois niveaux + croix de Saint-André : répartition des cisaillements d'étage et effet de soulèvement sur les poteaux d'angle.",
    nodes: [0, 1, 2, 3].flatMap((lvl) => [
      { id: lvl * 2 + 1, x: 0, y: 0, z: lvl * 3 },
      { id: lvl * 2 + 2, x: 6, y: 0, z: lvl * 3 },
    ]),
    beams: [
      b(1, 1, 2, "HEA 240"),
      b(2, 3, 4, "HEA 200"),
      b(3, 5, 6, "HEA 200"),
      b(4, 1, 3, "IPE 300"),
      b(5, 3, 5, "IPE 300"),
      b(6, 2, 4, "IPE 300"),
      b(7, 4, 6, "IPE 300"),
      b(8, 1, 4, "L 100x100x10"),
      b(9, 3, 2, "L 100x100x10"),
      b(10, 3, 6, "L 100x100x10"),
      b(11, 5, 4, "L 100x100x10"),
    ],
    loads: [
      { case: "Variable", kind: "Nodal", node_id: 4, fz: -20000 },
      { case: "Wind", kind: "Nodal", node_id: 6, fx: 12000, fy: 0, fz: 0 },
    ],
  },
  {
    id: "auvent-porte-a-faux",
    name: "Auvent porte-à-faux",
    why: "Console avalant le vent : moment en pied de poteau et flèche libre en bout — le cas d'école du SLS δ ≤ L/150.",
    nodes: [
      { id: 1, x: 0, y: 0, z: 0 },
      { id: 2, x: 0, y: 0, z: 3 },
      { id: 3, x: 4, y: 0, z: 3 },
    ],
    beams: [b(1, 1, 2, "HEA 200"), b(2, 2, 3, "IPE 200")],
    loads: [
      {
        case: "Wind",
        kind: "Trapezoid",
        beam_id: 2,
        q_start: -2000,
        q_end: -2000,
        direction: gravity,
      },
    ],
  },
  {
    id: "passerelle-pietonne",
    name: "Passerelle piétonne",
    why: "Fréquence propre > 3 Hz exigée par l'Eurocode piétons — lancer l'analyse modale après chaque modification d'IPE.",
    nodes: [1, 2, 3].map((id, i) => ({ id, x: i * 10, y: 0, z: 0 })),
    beams: [b(1, 1, 2, "IPE 300"), b(2, 2, 3, "IPE 300")],
    loads: [
      {
        case: "Variable",
        kind: "Trapezoid",
        beam_id: 1,
        q_start: -5000,
        q_end: -5000,
        direction: gravity,
      },
      {
        case: "Variable",
        kind: "Trapezoid",
        beam_id: 2,
        q_start: -5000,
        q_end: -5000,
        direction: gravity,
      },
    ],
  },
  {
    id: "poutre-gl24h",
    name: "Poutre bois lamellé-collé GL24h",
    why: "Matériau bois : kmod selon la classe de service et kdef pour le fluage — la vérification bascule sur l'EN 1995-1-1.",
    nodes: [
      { id: 1, x: 0, y: 0, z: 0 },
      { id: 2, x: 8, y: 0, z: 0 },
    ],
    beams: [{ id: 1, n1: 1, n2: 2, section_id: "BLC 200x600", material_id: "GL24h" }],
    loads: [
      {
        case: "Permanent",
        kind: "Trapezoid",
        beam_id: 1,
        q_start: -4000,
        q_end: -4000,
        direction: gravity,
      },
    ],
  },
];
