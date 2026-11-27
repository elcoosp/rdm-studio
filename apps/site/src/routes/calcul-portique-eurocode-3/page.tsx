import { Trans } from "@lingui/react";
import { i18n } from "@lingui/core";
import { Breadcrumb, DocsHandoff, FaqList, Formula, SeoCta } from "../../components/seo";

/**
 * `/calcul-portique-eurocode-3` — programmatic SEO landing page: portique
 * plane en acier, poteau HEA 200 en flexion-compression (EN 1993-1-1
 * §6.3.1 flambement + §6.61/6.62 interaction). Exemple chiffré issu du
 * catalogue EN 10365 du moteur.
 *
 * i18n: every string is a Lingui runtime call (`<Trans>` / `i18n._`,
 * explicit IDs) resolved at render time in the active locale. The FAQ is a
 * function (not a module constant) for the same reason. The page-level
 * `<meta>` export that used to live here was dead code (the worker only
 * evaluates `page.server.ts` `meta`); the live meta is in `page.server.ts`.
 */

function buildFaqPortal(): { q: string; a: string }[] {
  return [
    {
      q: i18n._({
        id: "site.calc.portal.faq.interaction.q",
        message: "Quand l'interaction 6.61 ou 6.62 s'applique-t-elle ?",
      }),
      a: i18n._({
        id: "site.calc.portal.faq.interaction.a",
        message:
          "L'équation 6.61 (NEd/MEd, profilés laminés, torsion négligeable) couvre le déversement pour sections bi-symétriques en flexion simple axe, la 6.62 la flexion bi-axiale. On choisit la plus défavorable des deux ; RDM Studio calcule les deux taux et retient le maximum, avec le détail kyy/kyz et les facteurs d'équivalence Cmy,C0 traçables dans le CalcTrace.",
      }),
    },
    {
      q: i18n._({
        id: "site.calc.portal.faq.pdelta.q",
        message: "Comment le P-Δ est-il pris en compte dans un portique ?",
      }),
      a: i18n._({
        id: "site.calc.portal.faq.pdelta.a",
        message:
          "Par le coefficient αcr = Fcr/FEd (EN 1993-1-1 §5.2.1) : si αcr ≥ 10 (portiques contreventés) l'analyse du 1er ordre suffit ; entre 3 et 10, l'EN 1990 §5.1.4 (H) ou une analyse du 2nd ordre s'impose. Le solveur RDM Studio calcule λcr (flambement linéaire global) et l'option P-Δ ajoute la raideur géométrique [Kg(N)] au système [Ke + Kg(N)]·u = F.",
      }),
    },
    {
      q: i18n._({
        id: "site.calc.portal.faq.curve.q",
        message: "Quelle courbe de flambement pour un HEA laminé ?",
      }),
      a: i18n._({
        id: "site.calc.portal.faq.curve.a",
        message:
          "Pour le flambement d'axe fort (y-y) d'un laminé en S235 avec h/b ≤ 1,2 (cas du HEA 200 : 190/200), l'annexe tabulaire du §6.3.1.2 donne la courbe b (αimp = 0,34) pour t ≤ 100 mm ; l'axe faible (z-z) prend la courbe c. RDM Studio sélectionne la courbe automatiquement selon h/b, tf et l'acier.",
      }),
    },
  ];
}

export default function CalculPortiquePage(): React.ReactElement {
  return (
    <article className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <Breadcrumb
        page={i18n._({ id: "site.calc.portal.breadcrumb", message: "Calcul de portique Eurocode 3" })}
      />
      <div className="max-w-[76ch]">
        <h1 className="text-balance text-[clamp(1.7rem,3.5vw,2.4rem)] font-semibold leading-tight tracking-tight text-ink-primary">
          <Trans
            id="site.calc.portal.h1"
            message="Calcul de portique selon l'Eurocode 3 — poteau en flexion-compression (6.61/6.62)"
          />
        </h1>
        <p className="mt-3 text-[15px] leading-6 text-ink-secondary">
          <Trans
            id="site.calc.portal.intro"
            message="Méthode de vérification d'un poteau de portique HEA 200 en compression et flexion : flambement χy (§6.3.1), résistance plastique Mc,Rd, interaction 6.61, sensibilité P-Δ (αcr) — avec l'exemple chiffré complet que l'atelier RDM Studio recalcule en moins de 20 ms dans votre navigateur."
          />
        </p>

        <SeoCta template="portique" />

        <h2 className="mt-10 text-[20px] font-semibold text-ink-primary">
          <Trans id="site.calc.portal.s1.title" message="1. Modèle et charges" />
        </h2>
        <p className="mt-2 text-[14px] leading-6 text-ink-secondary">
          <Trans
            id="site.calc.portal.s1.body"
            message="Portique 18 m encastré-articulé : traverse IPE 300, poteaux HEA 200 (S235JR, catalogue EN 10365 : A = 53,8 cm², Iy = 3 690 cm⁴, Wpl,y = 430 cm³). Élancement effectif du poteau Lcr,y = 4,00 m (vent brisé par le panneau rigide). Sollicitations ELU au pied de poteau encastré : NEd = 180 kN (compression), MEd = 45 kN·m en tête."
          />
        </p>

        <h2 className="mt-10 text-[20px] font-semibold text-ink-primary">
          <Trans
            id="site.calc.portal.s2.title"
            message="2. Flambement d'axe fort — §6.3.1"
          />
        </h2>
        <p className="mt-2 text-[14px] leading-6 text-ink-secondary">
          <Trans
            id="site.calc.portal.s2.body"
            message="Force critique d'Euler, élancement normalisé (courbe b, α = 0,34), puis abaque de Perry :"
          />
        </p>
        <Formula>
          <Trans
            id="site.calc.portal.f1"
            message="Ncr,y = π²·E·Iy / Lcr² = π² × 210 000 × 3 690 cm⁴ / 4,00² = 4 778 kN"
          />
        </Formula>
        <Formula>
          <Trans
            id="site.calc.portal.f2"
            message="λ̄y = √(A·fy / Ncr,y) = √(53,8 × 23 500 / 4 778 000) ≈ 0,51"
          />
        </Formula>
        <Formula>
          <Trans
            id="site.calc.portal.f3"
            message="χy = 0,878 (courbe b) → Nb,Rd = χy·A·fy/γM1 = 1 109,8 kN → ηN = 180 / 1 110 = 0,16"
          />
        </Formula>

        <h2 className="mt-10 text-[20px] font-semibold text-ink-primary">
          <Trans
            id="site.calc.portal.s3.title"
            message="3. Interaction flexion-compression — équation 6.61"
          />
        </h2>
        <p className="mt-2 text-[14px] leading-6 text-ink-secondary">
          <Trans
            id="site.calc.portal.s3.body"
            message="Résistance plastique de traverse/poteau et interaction simplifiée (facteur d'équivalence et moment du 2nd ordre pris à kyy = 1,0 par prudence ; le CalcTrace détaille la valeur exacte de Cmy,C0 et kyy) :"
          />
        </p>
        <Formula>
          <Trans
            id="site.calc.portal.f4"
            message="Mc,Rd = Wpl,y · fy / γM0 = 430 cm³ × 235 MPa = 101,1 kN·m"
          />
        </Formula>
        <Formula>
          <Trans
            id="site.calc.portal.f5"
            message="NEd / Nb,Rd + kyy · MEd / Mc,Rd = 0,16 + 1,0 × 45 / 101,1 = 0,61 ≤ 1,00 → conforme"
          />
        </Formula>

        <h2 className="mt-10 text-[20px] font-semibold text-ink-primary">
          <Trans id="site.calc.portal.s4.title" message="4. Sensibilité au 2nd ordre (P-Δ)" />
        </h2>
        <p className="mt-2 text-[14px] leading-6 text-ink-secondary">
          <Trans
            id="site.calc.portal.s4.body"
            message="Le portique contreventé en encastré-articulé doit montrer αcr ≥ 10 pour s'affranchir du 2nd ordre :"
          />
        </p>
        <Formula>
          <Trans
            id="site.calc.portal.f6"
            message="αcr = Fcr / FEd — si αcr ≥ 10 : analyse 1er ordre ; si 3 ≤ αcr < 10 : P-Δ requis"
          />
        </Formula>
        <p className="mt-2 text-[14px] leading-6 text-ink-secondary">
          <Trans
            id="site.calc.portal.s4.body2"
            message="Le solveur calcule le flambement linéaire global λcr (premier mode du système complet : poteaux + traverse) et, si nécessaire, reformule la raideur en [Ke + Kg(N)] pour intégrer le 2nd ordre géométrique directement dans la matrice."
          />
        </p>

        <h2 className="mt-10 text-[20px] font-semibold text-ink-primary">
          <Trans id="site.calc.portal.recap.title" message="Récapitulatif" />
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
                  <Trans id="site.calc.portal.row.buckling" message="Flambement §6.3.1" />
                </td>
                <td className="py-2 pr-4">180 kN</td>
                <td className="py-2 pr-4">1 109,8 kN</td>
                <td className="py-2 text-pass-text">0,16</td>
              </tr>
              <tr className="border-b border-hairline">
                <td className="py-2 pr-4">
                  <Trans id="site.calc.portal.row.bending" message="Flexion §6.2.5" />
                </td>
                <td className="py-2 pr-4">45,0 kN·m</td>
                <td className="py-2 pr-4">101,1 kN·m</td>
                <td className="py-2 text-pass-text">0,45</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">
                  <Trans id="site.calc.portal.row.interaction" message="Interaction 6.61 (kyy = 1,0)" />
                </td>
                <td className="py-2 pr-4">—</td>
                <td className="py-2 pr-4">—</td>
                <td className="py-2 text-pass-text">0,61</td>
              </tr>
            </tbody>
          </table>
        </div>

        <DocsHandoff path="/guides/ec3-check-and-optimizer/" />
        <h2 className="mt-10 text-[20px] font-semibold text-ink-primary">
          <Trans id="site.calc.faq.title" message="Questions fréquentes" />
        </h2>
        <FaqList items={buildFaqPortal()} />
      </div>
    </article>
  );
}
