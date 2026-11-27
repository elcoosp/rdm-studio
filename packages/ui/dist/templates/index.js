/** All 15 canonical engineering models */
const ENGINEERING_CATALOG = [
	{
		slug: "portal-frame",
		title: "Steel Portal Frame 18 m",
		sector: "Building & Framing",
		description: "Portique à une travée avec poteaux HEA 200 et traverse IPE 300, bases encastrées-articulées. Flambement en flexion χy, interaction 6.61 et effets du second ordre P-Δ selon EN 1993-1-1.",
		previewSvg: `<svg viewBox="0 0 200 120" fill="none" stroke="#1D4ED8" stroke-width="1.5"><polyline points="20,100 20,30 180,30 180,100" /><circle cx="20" cy="30" r="5" fill="currentColor" /><circle cx="180" cy="30" r="5" fill="currentColor" /><line x1="10" y1="100" x2="30" y2="100" /><line x1="10" y1="105" x2="22" y2="100" /><line x1="25" y1="105" x2="37" y2="100" /><line x1="170" y1="100" x2="190" y2="100" /><line x1="178" y1="105" x2="190" y2="100" /><line x1="163" y1="105" x2="175" y2="100" /></svg>`,
		massKg: 2840,
		primarySection: "HEA 200 / IPE 300",
		aliases: ["portique", "portique-18m"],
		eurocodes: [
			"EN 1993-1-1",
			"EN 1990",
			"EN 1991-1-1"
		],
		tags: [
			"Portal",
			"HEA",
			"IPE",
			"P-Δ",
			"Interaction 6.61"
		]
	},
	{
		slug: "warren-truss",
		title: "Warren Truss 24 m",
		sector: "Building & Framing",
		description: "Treillis Warren simplement appuyé, 24 m de portée, 3 m de hauteur, diagonales CHS 139,7×5. Flambement des membrures χz, déversement χLT et répartition des charges nodales selon EN 1993-1-1.",
		previewSvg: `<svg viewBox="0 0 200 100" fill="none" stroke="#1D4ED8" stroke-width="1.5"><line x1="10" y1="20" x2="190" y2="20" /><line x1="10" y1="80" x2="190" y2="80" /><polyline points="10,20 40,80 70,20 100,80 130,20 160,80 190,20" stroke="#1D4ED8" /><circle cx="10" cy="20" r="4" fill="currentColor" /><circle cx="190" cy="20" r="4" fill="currentColor" /></svg>`,
		massKg: 1920,
		primarySection: "CHS 139.7×5 / CHS 114.3×4",
		aliases: ["warren", "treillis-warren"],
		eurocodes: [
			"EN 1993-1-1",
			"EN 1990",
			"EN 1991-1-1"
		],
		tags: [
			"Truss",
			"Warren",
			"CHS",
			"Buckling",
			"χLT"
		]
	},
	{
		slug: "continuous-beam",
		title: "3-Span Continuous Beam 18 m",
		sector: "Building & Framing",
		description: "Trois travées égales de 6 m, IPE 300 continue sur poteaux. Redistribution des moments, réactions d'appui et flèche ELS L/250 selon EN 1993-1-1.",
		previewSvg: `<svg viewBox="0 0 200 80" fill="none" stroke="#1D4ED8" stroke-width="1.5"><line x1="10" y1="30" x2="190" y2="30" /><polygon points="40,30 30,55 50,55" /><polygon points="100,30 90,55 110,55" /><polygon points="160,30 150,55 170,55" /><line x1="5" y1="60" x2="195" y2="60" /></svg>`,
		massKg: 1210,
		primarySection: "IPE 300",
		aliases: [
			"travees",
			"poutre-continue",
			"3-travees"
		],
		eurocodes: [
			"EN 1993-1-1",
			"EN 1990",
			"EN 1991-1-1"
		],
		tags: [
			"Continuous",
			"Redistribution",
			"IPE",
			"SLS"
		]
	},
	{
		slug: "cantilever",
		title: "Steel Cantilever HEA 200",
		sector: "Building & Framing",
		description: "Console de 6 m en HEA 200 encastrée en pied. Déversement χLT, flèche en extrémité et vérification du moment et de l'effort tranchant en encastrement selon EN 1993-1-1.",
		previewSvg: `<svg viewBox="0 0 160 100" fill="none" stroke="#1D4ED8" stroke-width="1.5"><polyline points="20,50 20,20 140,20 140,50" stroke="#1D4ED8" /><circle cx="20" cy="20" r="5" fill="currentColor" /><circle cx="140" cy="20" r="5" fill="currentColor" /><line x1="10" y1="50" x2="30" y2="50" /><line x1="15" y1="55" x2="21" y2="50" /><line x1="24" y1="55" x2="30" y2="50" /><polygon points="140,50 125,70 155,70" /></svg>`,
		massKg: 323,
		primarySection: "HEA 200",
		aliases: [
			"potence",
			"potence-hea",
			"cantilever-hea"
		],
		eurocodes: [
			"EN 1993-1-1",
			"EN 1990",
			"EN 1991-1-1"
		],
		tags: [
			"Cantilever",
			"HEA",
			"LTB",
			"χLT",
			"Tip deflection"
		]
	},
	{
		slug: "pitched-portal",
		title: "Pitched Roof Portal Frame 15 m",
		sector: "Building & Framing",
		description: "Portique à toit en pente, 15 m de portée, pente 15°, sections IPE variables. Neige EN 1991-1-3, vent EN 1991-1-4 et dimensionnement plastique classe 1 selon EC3.",
		previewSvg: `<svg viewBox="0 0 200 130" fill="none" stroke="#1D4ED8" stroke-width="1.5"><polyline points="20,100 20,40 100,15 180,40 180,100" stroke="#1D4ED8" /><circle cx="20" cy="40" r="5" fill="currentColor" /><circle cx="180" cy="40" r="5" fill="currentColor" /><line x1="10" y1="100" x2="30" y2="100" /><line x1="15" y1="105" x2="21" y2="100" /><line x1="24" y1="105" x2="30" y2="100" /><line x1="170" y1="100" x2="190" y2="100" /><line x1="175" y1="105" x2="181" y2="100" /><line x1="184" y1="105" x2="190" y2="100" /></svg>`,
		massKg: 2150,
		primarySection: "IPE 270 / IPE 300",
		aliases: ["portique-pente", "toiture-pente"],
		eurocodes: [
			"EN 1993-1-1",
			"EN 1991-1-3",
			"EN 1991-1-4"
		],
		tags: [
			"Pitched",
			"Snow",
			"Wind",
			"Plastic design"
		]
	},
	{
		slug: "pratt-truss",
		title: "Pratt Truss Bridge 30 m",
		sector: "Bridges & Frames",
		description: "Treillis Pratt de 30 m simplement appuyé pour passerelle piétonne et cyclable. Règles ponts EN 1993-2, vérification en fatigue et charge de trafic LM1 selon EN 1991-2.",
		previewSvg: `<svg viewBox="0 0 200 100" fill="none" stroke="#1D4ED8" stroke-width="1.5"><line x1="10" y1="20" x2="190" y2="20" /><line x1="10" y1="80" x2="190" y2="80" /><polyline points="10,20 40,80 70,20 100,80 130,20 160,80 190,20" /><line x1="40" y1="80" x2="70" y2="20" stroke="#1D4ED8" /><line x1="100" y1="80" x2="130" y2="20" stroke="#1D4ED8" /><line x1="160" y1="80" x2="190" y2="20" stroke="#1D4ED8" /><circle cx="10" cy="20" r="4" fill="currentColor" /><circle cx="190" cy="20" r="4" fill="currentColor" /></svg>`,
		massKg: 4850,
		primarySection: "HEA 240 / UPN 200",
		aliases: [
			"pratt",
			"pont-pratt",
			"pont-piéton"
		],
		eurocodes: [
			"EN 1993-2",
			"EN 1991-2",
			"EN 1990"
		],
		tags: [
			"Bridge",
			"Pratt",
			"Fatigue",
			"LM1",
			"EN 1993-2"
		]
	},
	{
		slug: "howe-truss",
		title: "Howe Truss Industrial 28 m",
		sector: "Bridges & Frames",
		description: "Treillis Howe de 28 m support de chemin de roulement. Structures porteuses de ponts roulants EN 1993-6, amplification dynamique φ et flambement latéral des membrures comprimées.",
		previewSvg: `<svg viewBox="0 0 200 100" fill="none" stroke="#1D4ED8" stroke-width="1.5"><line x1="10" y1="20" x2="190" y2="20" /><line x1="10" y1="80" x2="190" y2="80" /><polyline points="10,80 40,20 70,80 100,20 130,80 160,20 190,80" /><line x1="40" y1="20" x2="70" y2="80" stroke="#1D4ED8" /><line x1="100" y1="20" x2="130" y2="80" stroke="#1D4ED8" /><line x1="160" y1="20" x2="190" y2="80" stroke="#1D4ED8" /><circle cx="10" cy="80" r="4" fill="currentColor" /><circle cx="190" cy="80" r="4" fill="currentColor" /></svg>`,
		massKg: 3920,
		primarySection: "HEB 220 / IPE 240",
		aliases: [
			"howe",
			"pont-howe",
			"poutre-grue"
		],
		eurocodes: [
			"EN 1993-6",
			"EN 1991-3",
			"EN 1990"
		],
		tags: [
			"Crane",
			"Howe",
			"Dynamic",
			"EN 1993-6"
		]
	},
	{
		slug: "braced-frame",
		title: "3-Storey Braced Frame",
		sector: "Bridges & Frames",
		description: "Ossature acier de bureau de trois étages à contreventement concentrique. Sismique EN 1998-1 (CQC/SRSS), vent EN 1991-1-4, vérifications des barres EN 1993-1-1 et optimiseur Pareto en 1 clic.",
		previewSvg: `<svg viewBox="0 0 160 180" fill="none" stroke="#1D4ED8" stroke-width="1.5"><polyline points="20,160 20,120 140,120 140,160" /><polyline points="20,120 20,80 140,80 140,120" /><polyline points="20,80 20,40 140,40 140,80" /><line x1="20" y1="40" x2="140" y2="80" stroke="#1D4ED8" /><line x1="140" y1="40" x2="20" y2="80" stroke="#1D4ED8" /><line x1="20" y1="80" x2="140" y2="120" stroke="#1D4ED8" /><line x1="140" y1="80" x2="20" y2="120" stroke="#1D4ED8" /><line x1="20" y1="120" x2="140" y2="160" stroke="#1D4ED8" /><line x1="140" y1="120" x2="20" y2="160" stroke="#1D4ED8" /><circle cx="20" cy="40" r="4" fill="currentColor" /><circle cx="140" cy="40" r="4" fill="currentColor" /><line x1="10" y1="160" x2="30" y2="160" /><line x1="15" y1="165" x2="21" y2="160" /><line x1="24" y1="165" x2="30" y2="160" /><line x1="130" y1="160" x2="150" y2="160" /><line x1="135" y1="165" x2="141" y2="160" /><line x1="144" y1="165" x2="150" y2="160" /></svg>`,
		massKg: 8650,
		primarySection: "HEA 200 / IPE 300 / SHS 100",
		aliases: [
			"contreventement",
			"cadre-contrevente",
			"multi-etage"
		],
		eurocodes: [
			"EN 1993-1-1",
			"EN 1998-1",
			"EN 1991-1-4"
		],
		tags: [
			"Seismic",
			"CQC/SRSS",
			"Wind",
			"Braced",
			"Pareto"
		]
	},
	{
		slug: "cantilever-canopy",
		title: "Canopy Cantilever 8 m",
		sector: "Bridges & Frames",
		description: "Auvent architectural en porte-à-faux de 8 m, section CHS 219,1×8 à inertie variable. Succion du vent EN 1991-1-4, accumulation de neige et vibration ELS f₁ > 3 Hz.",
		previewSvg: `<svg viewBox="0 0 200 80" fill="none" stroke="#1D4ED8" stroke-width="1.5"><line x1="20" y1="50" x2="180" y2="20" stroke="#1D4ED8" stroke-width="3" /><circle cx="20" cy="50" r="5" fill="currentColor" /><line x1="10" y1="50" x2="30" y2="50" /><line x1="15" y1="55" x2="21" y2="50" /><line x1="24" y1="55" x2="30" y2="50" /></svg>`,
		massKg: 680,
		primarySection: "CHS 219.1×8 (tapered)",
		aliases: [
			"auvent",
			"canopée",
			"auvent-porte-à-faux"
		],
		eurocodes: [
			"EN 1993-1-1",
			"EN 1991-1-4",
			"EN 1991-1-3"
		],
		tags: [
			"Canopy",
			"Tapered",
			"Vibration",
			"Wind suction"
		]
	},
	{
		slug: "pedestrian-bridge",
		title: "Pedestrian Bridge 40 m",
		sector: "Bridges & Frames",
		description: "Passerelle en arc tirant de 40 m, S355 J2. Fatigue EN 1993-2, charge de foule EN 1991-2 et limite de confort en accélération verticale 0,5 m/s².",
		previewSvg: `<svg viewBox="0 0 200 120" fill="none" stroke="#1D4ED8" stroke-width="1.5"><path d="M10,100 Q100,20 190,100" stroke="#1D4ED8" stroke-width="3" /><line x1="10" y1="100" x2="190" y2="100" /><polyline points="10,100 40,65 70,85 100,60 130,80 160,65 190,100" stroke="#1D4ED8" /><circle cx="10" cy="100" r="5" fill="currentColor" /><circle cx="190" cy="100" r="5" fill="currentColor" /></svg>`,
		massKg: 12400,
		primarySection: "CHS 323.9×10 / CHS 168.3×6",
		aliases: [
			"pont-piéton",
			"pont-tire",
			"passerelle"
		],
		eurocodes: [
			"EN 1993-2",
			"EN 1991-2",
			"EN 1990"
		],
		tags: [
			"Tied-arch",
			"Fatigue",
			"Crowd",
			"Comfort"
		]
	},
	{
		slug: "naval-cradle",
		title: "Naval Launching Cradle 120 t",
		sector: "Naval & Lifting",
		description: "Berceau de mise à l'eau 120 t sur bogies à 3 essieux sur rails. Vérifications des barres EN 1993-1-1, charges sur rails EN 1991-2 et champ d'accélération (ax, ay, az) × g pour le transport.",
		previewSvg: `<svg viewBox="0 0 200 100" fill="none" stroke="#1D4ED8" stroke-width="1.5"><rect x="20" y="40" width="160" height="40" rx="3" stroke="#1D4ED8" /><circle cx="45" cy="85" r="10" /><circle cx="100" cy="85" r="10" /><circle cx="155" cy="85" r="10" /><line x1="20" y1="40" x2="20" y2="75" /><line x1="180" y1="40" x2="180" y2="75" /><polyline points="45,85 40,95 50,95" stroke="#1D4ED8" /><polyline points="100,85 95,95 105,95" stroke="#1D4ED8" /><polyline points="155,85 150,95 160,95" stroke="#1D4ED8" /></svg>`,
		massKg: 15600,
		primarySection: "HEB 300 / SHS 200",
		aliases: [
			"berceau",
			"berceau-naval",
			"mise-à-l'eau"
		],
		eurocodes: [
			"EN 1993-1-1",
			"EN 1991-2",
			"EN 1990"
		],
		tags: [
			"Naval",
			"Launching",
			"Transport",
			"Acceleration field"
		]
	},
	{
		slug: "lifting-beam",
		title: "20 t Lifting Beam",
		sector: "Naval & Lifting",
		description: "Palonnier de levage 20 t, portée 6 m, IPE 500 avec raidisseurs. Déversement χLT selon EN 1993-1-1, fréquences propres modales f₁..f₆ et amplification dynamique pour crochets de grue.",
		previewSvg: `<svg viewBox="0 0 200 100" fill="none" stroke="#1D4ED8" stroke-width="1.5"><rect x="20" y="35" width="160" height="30" rx="2" /><circle cx="100" cy="15" r="8" stroke="#1D4ED8" stroke-width="2" /><line x1="100" y1="7" x2="100" y2="23" stroke="#1D4ED8" stroke-width="2" /><polyline points="92,23 100,15 108,23" stroke="#1D4ED8" stroke-width="2" /><circle cx="40" cy="50" r="6" fill="currentColor" /><circle cx="160" cy="50" r="6" fill="currentColor" /><line x1="20" y1="65" x2="60" y2="65" /><line x1="140" y1="65" x2="180" y2="65" /></svg>`,
		massKg: 980,
		primarySection: "IPE 500",
		aliases: [
			"poutre-levage",
			"palonnier",
			"levage-20t"
		],
		eurocodes: [
			"EN 1993-1-1",
			"EN 1990",
			"EN 1991-3"
		],
		tags: [
			"Lifting",
			"Modal",
			"LTB",
			"Dynamic",
			"χLT"
		]
	},
	{
		slug: "offshore-skid",
		title: "Offshore Equipment Skid",
		sector: "Naval & Lifting",
		description: "Châssis de module offshore 12×6 m, multi-matériaux (acier + caillebotis). Inox 304L EN 1993-1-4, vent EN 1991-1-4, sismique EN 1998-1 et analyse modale.",
		previewSvg: `<svg viewBox="0 0 200 120" fill="none" stroke="#1D4ED8" stroke-width="1.5"><rect x="10" y="20" width="180" height="80" rx="3" /><rect x="20" y="30" width="160" height="60" stroke="#1D4ED8" stroke-dasharray="4 4" /><circle cx="40" cy="50" r="5" fill="#1D4ED8" stroke="#1D4ED8" /><circle cx="100" cy="50" r="5" fill="#1D4ED8" stroke="#1D4ED8" /><circle cx="160" cy="50" r="5" fill="#1D4ED8" stroke="#1D4ED8" /><circle cx="40" cy="90" r="5" fill="#1D4ED8" stroke="#1D4ED8" /><circle cx="100" cy="90" r="5" fill="#1D4ED8" stroke="#1D4ED8" /><circle cx="160" cy="90" r="5" fill="#1D4ED8" stroke="#1D4ED8" /></svg>`,
		massKg: 24500,
		primarySection: "HEA 240 / SHS 150 / 304L",
		aliases: [
			"skid",
			"skid-offshore",
			"module-offshore"
		],
		eurocodes: [
			"EN 1993-1-4",
			"EN 1998-1",
			"EN 1991-1-4"
		],
		tags: [
			"Offshore",
			"Stainless",
			"Seismic",
			"Multi-material"
		]
	},
	{
		slug: "glulam-beam",
		title: "Glulam Beam GL24h 12 m",
		sector: "Timber & Multi-Material",
		description: "Poutre en bois lamellé-collé GL24h de 12 m simplement appuyée. Flexion fm,k, cisaillement fv,k, vibration ELS et fluage kdef selon EN 1995-1-1.",
		previewSvg: `<svg viewBox="0 0 200 80" fill="none" stroke="#1D4ED8" stroke-width="1.5"><rect x="20" y="30" width="160" height="20" rx="2" /><line x1="20" y1="40" x2="180" y2="40" stroke="#1D4ED8" /><line x1="20" y1="46.67" x2="180" y2="46.67" stroke="#1D4ED8" /><line x1="20" y1="53.33" x2="180" y2="53.33" stroke="#1D4ED8" /><polygon points="20,30 10,55 30,55" /><polygon points="180,30 170,55 190,55" /></svg>`,
		massKg: 420,
		primarySection: "GL24h 200×600",
		aliases: [
			"lamellé-collé",
			"glulam",
			"poutre-bois"
		],
		eurocodes: [
			"EN 1995-1-1",
			"EN 1990",
			"EN 1991-1-1"
		],
		tags: [
			"Timber",
			"GL24h",
			"Creep",
			"Vibration",
			"EN 1995"
		]
	},
	{
		slug: "composite-beam",
		title: "Steel-Concrete Composite Beam",
		sector: "Timber & Multi-Material",
		description: "Poutre mixte IPE 300 + dalle béton 150 mm, goujons à tête. Connexion partielle, largeur efficace et phases de construction selon EN 1994-1-1.",
		previewSvg: `<svg viewBox="0 0 200 100" fill="none" stroke="#1D4ED8" stroke-width="1.5"><rect x="20" y="20" width="160" height="20" rx="1" fill="#EFF6FF" /><rect x="20" y="40" width="160" height="40" rx="1" stroke="#1D4ED8" /><line x1="40" y1="80" x2="50" y2="60" stroke="#1D4ED8" /><line x1="100" y1="80" x2="100" y2="60" stroke="#1D4ED8" /><line x1="160" y1="80" x2="150" y2="60" stroke="#1D4ED8" /><circle cx="45" cy="75" r="4" fill="#1D4ED8" stroke="#1D4ED8" /><circle cx="100" cy="75" r="4" fill="#1D4ED8" stroke="#1D4ED8" /><circle cx="155" cy="75" r="4" fill="#1D4ED8" stroke="#1D4ED8" /><polygon points="20,40 10,70 30,70" /><polygon points="180,40 170,70 190,70" /></svg>`,
		massKg: 1850,
		primarySection: "IPE 300 + C30/37",
		aliases: [
			"mixte",
			"poutre-mixte",
			"acier-béton"
		],
		eurocodes: [
			"EN 1994-1-1",
			"EN 1992-1-1",
			"EN 1993-1-1"
		],
		tags: [
			"Composite",
			"EN 1994",
			"Shear connection",
			"Construction stages"
		]
	}
];
/** Sector list for filter UI */
const SECTORS = [
	"Building & Framing",
	"Naval & Lifting",
	"Bridges & Frames",
	"Timber & Multi-Material"
];
/** Map of all slugs (canonical + aliases) to canonical slug */
const SLUG_ALIASES = (() => {
	const map = {};
	for (const model of ENGINEERING_CATALOG) {
		map[model.slug] = model.slug;
		for (const alias of model.aliases) map[alias] = model.slug;
	}
	return map;
})();
/** Resolve any slug/alias to canonical slug */
function resolveSlug(slug) {
	return SLUG_ALIASES[slug] ?? slug;
}
/** Get model by canonical slug */
function getModel(slug) {
	const canonical = resolveSlug(slug);
	return ENGINEERING_CATALOG.find((m) => m.slug === canonical);
}
/** Get models by sector */
function getModelsBySector(sector) {
	return ENGINEERING_CATALOG.filter((m) => m.sector === sector);
}
/** Get all unique tags */
function getAllTags() {
	const tags = /* @__PURE__ */ new Set();
	for (const model of ENGINEERING_CATALOG) for (const tag of model.tags) tags.add(tag);
	return [...tags].sort();
}
export { ENGINEERING_CATALOG, SECTORS, SLUG_ALIASES, getAllTags, getModel, getModelsBySector, resolveSlug };
