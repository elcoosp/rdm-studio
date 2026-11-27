import { Trans } from "@lingui/react";
import { i18n } from "@lingui/core";
import { Breadcrumb, DocsHandoff, FaqList, Formula, SeoCta } from "../../components/seo";

/**
 * `/calcul-berceau-levage-naval` — programmatic SEO landing page: berceau
 * de levage / transport naval sous champs d'accélération (ax, ay, az) × g,
 * transverses IPE 200 en S355, EN 1990 combinaisons + EN 1993-1-1.
 * Exemple chiffré : colis 12 t, az = 1,3 g, ay = 0,4 g.
 *
 * i18n: every string is a Lingui runtime call (`<Trans>` / `i18n._`,
 * explicit IDs) resolved at render time in the active locale. The FAQ is a
 * function (not a module constant) for the same reason. The page-level
 * `<meta>` export that used to live here was dead code (the worker only
 * evaluates `page.server.ts` `meta`); the live meta is in `page.server.ts`.
 */

function buildFaqNaval(): { q: string; a: string }[] {
  return [
    {
      q: i18n._({
        id: "site.calc.naval.faq.accel.q",
        message: "Quelles accélérations retenir pour un transport naval ou un levage ?",
      }),
      a: i18n._({
        id: "site.calc.naval.faq.accel.a",
        message:
          "Pour le levage, l'EN 13001 ou les coefficients d'amplification dynamique du manutentionnaire (φ = 1,2 à 1,4 selon la grue et le marnage) majorent g selon l'axe vertical. Pour le transport maritime, les règles de transport (DNV-ST-N001, Cargo Resistance) donnent (ax, ay, az) en fraction de g selon la zone de mer. RDM Studio modélise ces champs comme des accélérations volumiques (ax, ay, az) × g appliquées à toute la structure, puis génère les combinaisons EN 1990 associées.",
      }),
    },
    {
      q: i18n._({
        id: "site.calc.naval.faq.combine.q",
        message: "Comment combiner les accélérations entre elles ?",
      }),
      a: i18n._({
        id: "site.calc.naval.faq.combine.a",
        message:
          "Chaque accélération devient une action variable : la combinaison fondamentale type devient G + az·g + ψ0,1·ay·g (+ ψ0,2·ax·g), avec les ψ0 issus des règles de transport ou fixés par l'ingénieur. L'atelier les traite comme des cas de charge classiques : 6.10, 6.10a/b avec groupes d'actions, y compris l'inversion de signe (deux gisements par accélération).",
      }),
    },
    {
      q: i18n._({
        id: "site.calc.naval.faq.material.q",
        message: "S355 ou aluminium 6082-T6 pour un berceau de levage ?",
      }),
      a: i18n._({
        id: "site.calc.naval.faq.material.a",
        message:
          "L'acier S355 offre une limite élastique de 355 MPa et une bonne résilience à froid (J2/K2) ; l'alu 6082-T6 (EN 1999-1-1, fo = 250 MPa, fu = 290 MPa) s'impose quand la masse embarquée prime (pont, structure soudable TIG/MIG). RDM Studio vérifie les deux dans le même modèle : EN 1993-1-1 pour l'acier, EN 1999-1-1 (sections classes, soudabilité, facteurs ω) pour l'aluminium.",
      }),
    },
  ];
}

export default function CalculBerceauNavalPage(): React.ReactElement {
  return (
    <article className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <Breadcrumb
        page={i18n._({ id: "site.calc.naval.breadcrumb", message: "Calcul de berceau de levage naval" })}
      />
      <div className="max-w-[76ch]">
        <h1 className="text-balance text-[clamp(1.7rem,3.5vw,2.4rem)] font-semibold leading-tight tracking-tight text-ink-primary">
          <Trans
            id="site.calc.naval.h1"
            message="Calcul de berceau de levage naval — accélérations (ax, ay, az) × g et S355"
          />
        </h1>
        <p className="mt-3 text-[15px] leading-6 text-ink-secondary">
          <Trans
            id="site.calc.naval.intro"
            message="Dimensionner un berceau de transport/levage, c'est transformer un champ d'accélération en charges ELU puis vérifier les transverses en flexion. Méthode EN 1990 + EN 1993-1-1 avec l'exemple chiffré d'un colis de 12 t levé à az = 1,3 g — le type de modèle que RDM Studio résout localement, accélération volumique comprise."
          />
        </p>

        <SeoCta />

        <h2 className="mt-10 text-[20px] font-semibold text-ink-primary">
          <Trans
            id="site.calc.naval.s1.title"
            message="1. Du champ d'accélération aux actions ELU"
          />
        </h2>
        <p className="mt-2 text-[14px] leading-6 text-ink-secondary">
          <Trans
            id="site.calc.naval.s1.body"
            message="Colis de m = 12 t posé sur deux transverses (un berceau = 2 appuis linéiques), levage avec coefficient dynamique az = 1,3 g et roulis de manutention ay = 0,4 g. Chaque transverse reprend la moitié du poids colis, amplifiée :"
          />
        </p>
        <Formula>
          <Trans id="site.calc.naval.f1" message="Fd = (m/2) · az = 6 000 × 1,3 × 9,81 = 76,5 kN" />
        </Formula>
        <Formula>
          <Trans
            id="site.calc.naval.f2"
            message="Fy = (m/2) · ay = 6 000 × 0,4 × 9,81 = 23,5 kN (cisaillement / roulis)"
          />
        </Formula>
        <p className="mt-2 text-[14px] leading-6 text-ink-secondary">
          <Trans
            id="site.calc.naval.s1.body2"
            message="Dans l'atelier, ces mêmes valeurs naissent du champ volumique : (0 ; 0,4 ; 1,3) × g appliqué au berceau complet — la masse propre des profilés est donc automatiquement majorée elle aussi, sans charge fictive."
          />
        </p>

        <h2 className="mt-10 text-[20px] font-semibold text-ink-primary">
          <Trans
            id="site.calc.naval.s2.title"
            message="2. Sollicitations du transverse (IPE 200 S355, L = 2,40 m)"
          />
        </h2>
        <p className="mt-2 text-[14px] leading-6 text-ink-secondary">
          <Trans
            id="site.calc.naval.s2.body"
            message="Charge concentrée Fd au milieu d'un transverse isostatique de 2,40 m :"
          />
        </p>
        <Formula>
          <Trans id="site.calc.naval.f3" message="MEd = Fd · L / 4 = 76,5 × 2,40 / 4 = 45,9 kN·m" />
        </Formula>
        <Formula>
          <Trans
            id="site.calc.naval.f4"
            message="VEd = Fd / 2 = 38,3 kN (+ 23,5 kN suivant l'axe de roulis)"
          />
        </Formula>

        <h2 className="mt-10 text-[20px] font-semibold text-ink-primary">
          <Trans
            id="site.calc.naval.s3.title"
            message="3. Vérification EN 1993-1-1 (S355J2, γM0 = 1,0)"
          />
        </h2>
        <p className="mt-2 text-[14px] leading-6 text-ink-secondary">
          <Trans
            id="site.calc.naval.s3.body"
            message="IPE 200 (Wpl,y = 220,6 cm³) en S355, section de classe 1 en flexion forte axe (semelle c/t = 10,5 ≤ 33ε, âme c/t = 23 ≤ 72ε avec ε = √(235/355)) :"
          />
        </p>
        <Formula>
          <Trans
            id="site.calc.naval.f5"
            message="Mc,Rd = Wpl,y · fy / γM0 = 220,6 cm³ × 355 MPa = 78,3 kN·m"
          />
        </Formula>
        <Formula>
          <Trans id="site.calc.naval.f6" message="η flexion = 45,9 / 78,3 = 0,59 ≤ 1,00 → conforme" />
        </Formula>
        <Formula>
          <Trans
            id="site.calc.naval.f7"
            message="Av = 1 400 mm² → Vpl,Rd = 286,9 kN → η cisaillement = 0,13 ≤ 1,00"
          />
        </Formula>
        <p className="mt-2 text-[14px] leading-6 text-ink-secondary">
          <Trans
            id="site.calc.naval.s3.body2"
            message="Le déversement est ici empêché par les longerons du berceau ; sur un transverse libre, la vérification χLT (§6.3.2) s'ajoute automatiquement. En aluminium 6082-T6, la même géométrie serait vérifiée selon l'EN 1999-1-1 avec les propriétés fo = 250 MPa."
          />
        </p>

        <h2 className="mt-10 text-[20px] font-semibold text-ink-primary">
          <Trans id="site.calc.naval.recap.title" message="Récapitulatif" />
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="font-data w-full min-w-[420px] border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-hairline text-left text-ink-secondary">
                <th className="py-2 pr-4">
                  <Trans id="site.calc.table.check" message="Vérification" />
                </th>
                <th className="py-2 pr-4">
                  <Trans id="site.calc.table.demand" message="Sollicitation" />
                </th>
                <th className="py-2 pr-4">
                  <Trans id="site.calc.table.resistance" message="Résistance" />
                </th>
                <th className="py-2">
                  <Trans id="site.calc.table.rate" message="Taux η" />
                </th>
              </tr>
            </thead>
            <tbody className="text-ink-primary">
              <tr className="border-b border-hairline">
                <td className="py-2 pr-4">
                  <Trans id="site.calc.naval.row.bending" message="Flexion §6.61 (az = 1,3 g)" />
                </td>
                <td className="py-2 pr-4">45,9 kN·m</td>
                <td className="py-2 pr-4">78,3 kN·m</td>
                <td className="py-2 text-pass-text">0,59</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">
                  <Trans id="site.calc.naval.row.shear" message="Cisaillement §6.62 (ay = 0,4 g)" />
                </td>
                <td className="py-2 pr-4">23,5 kN</td>
                <td className="py-2 pr-4">286,9 kN</td>
                <td className="py-2 text-pass-text">0,08</td>
              </tr>
            </tbody>
          </table>
        </div>

        <DocsHandoff path="/tutorials/naval-cradle-verification/" />
        <h2 className="mt-10 text-[20px] font-semibold text-ink-primary">
          <Trans id="site.calc.faq.title" message="Questions fréquentes" />
        </h2>
        <FaqList items={buildFaqNaval()} />
      </div>
    </article>
  );
}
