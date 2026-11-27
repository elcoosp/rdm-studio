import { Trans } from "@lingui/react";
import { i18n } from "@lingui/core";
import { Breadcrumb, DocsHandoff, FaqList, Formula, SeoCta } from "../../components/seo";

/**
 * `/calcul-poutre-ipe` — programmatic Eurocode SEO landing page: flexion
 * simple d'une poutre IPE (EN 1993-1-1 §6.2), résistance en flexion et en
 * effort tranchant, flèche ELS. Exemple chiffré : IPE 300 S235 (catalogue
 * EN 10365 embarqué du moteur), L = 6,0 m, qELU = 15 kN/m, qELS = 10 kN/m.
 *
 * i18n: every string is a Lingui runtime call (`<Trans>` / `i18n._`,
 * explicit IDs) resolved at render time in the active locale. The FAQ is a
 * function (not a module constant) for the same reason. The page-level
 * `<meta>` export that used to live here was dead code (the worker only
 * evaluates `page.server.ts` `meta`); the live meta is in `page.server.ts`.
 */

function buildFaqIpe(): { q: string; a: string }[] {
  return [
    {
      q: i18n._({
        id: "site.calc.ipe.faq.wel.q",
        message: "Quelle différence entre Wel,y et Wpl,y pour une poutre IPE ?",
      }),
      a: i18n._({
        id: "site.calc.ipe.faq.wel.a",
        message:
          "Wel,y (module élastique) pilote la contrainte élastique σ = M/Wel, utilisée pour les classes 3 et 4 ou la vérification ELS. Wpl,y (module plastique) pilote Mc,Rd = Wpl,y·fy/γM0 pour les sections de classe 1 ou 2 — c'est le cas des IPE laminés en flexion forte axe : la fibre tendue peut plastifier, le moment résistant est d'environ 13 à 15 % supérieur.",
      }),
    },
    {
      q: i18n._({
        id: "site.calc.ipe.faq.deflection.q",
        message: "Comment vérifier la flèche d'une poutre IPE selon l'Eurocode 3 ?",
      }),
      a: i18n._({
        id: "site.calc.ipe.faq.deflection.a",
        message:
          "L'EN 1993-1-1 ne fixe pas de limite numérique : le tableau 7.2 de l'EN 1993-1-1 renvoie à l'Annexe nationale. En pratique courante en France, on retient w ≤ L/250 (éléments standard) à L/500 (éléments fragiles, matériaux de couverture sensibles) sous combinaison caractéristique ELS. RDM Studio affiche ces deux limites avec le rapport w/L calculé.",
      }),
    },
    {
      q: i18n._({
        id: "site.calc.ipe.faq.web.q",
        message: "Le voilement de l'âme doit-il être vérifié pour un IPE ?",
      }),
      a: i18n._({
        id: "site.calc.ipe.faq.web.a",
        message:
          "Pour un IPE laminé soumis à la flexion simple, les âmes restent dans le domaine non-voilé (limites de classe respectées pour fy ≤ 460 MPa) sauf charges localisées très élevées ou cisaillement dominant : la vérification VEd/Vpl,Rd et la ripage de l'âme (§6.2.7) restent néanmoins calculées par l'atelier.",
      }),
    },
    {
      q: i18n._({
        id: "site.calc.ipe.faq.ltb.q",
        message: "La poutre IPE doit-elle être vérifiée au déversement ?",
      }),
      a: i18n._({
        id: "site.calc.ipe.faq.ltb.a",
        message:
          "Oui dès que la compression n'est pas bridée latéralement : la vérification §6.3.2 avec χLT s'applique (LTB). Sur la poutre d'exemple, un pontage ou un béton de dallage connecté empêche le déversement ; sans bridage, RDM Studio calcule automatiquement Mcr, λ̄LT et χLT avec la méthode 1 ou 2 au choix.",
      }),
    },
  ];
}

export default function CalculPoutreIpePage(): React.ReactElement {
  return (
    <article className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <Breadcrumb page={i18n._({ id: "site.calc.ipe.breadcrumb", message: "Calcul de poutre IPE" })} />
      <div className="max-w-[76ch]">
        <h1 className="text-balance text-[clamp(1.7rem,3.5vw,2.4rem)] font-semibold leading-tight tracking-tight text-ink-primary">
          <Trans
            id="site.calc.ipe.h1"
            message="Calcul de poutre IPE selon l'Eurocode 3 — flexion, cisaillement et flèche"
          />
        </h1>
        <p className="mt-3 text-[15px] leading-6 text-ink-secondary">
          <Trans
            id="site.calc.ipe.intro"
            message="Méthode complète de vérification d'une poutre métallique IPE (catalogue EN 10365) en flexion simple : résistance plastique Mc,Rd, effort tranchant Vpl,Rd et flèche ELS, avec un exemple chiffré de bout en bout — exactement ce que reproduit RDM Studio sur votre poste, sans cloud."
          />
        </p>

        <SeoCta template="travees" />

        <h2 className="mt-10 text-[20px] font-semibold text-ink-primary">
          <Trans id="site.calc.ipe.s1.title" message="1. Données du problème" />
        </h2>
        <p className="mt-2 text-[14px] leading-6 text-ink-secondary">
          <Trans
            id="site.calc.ipe.s1.body"
            message="Poutre isostatique IPE 300 en S235JR (fy = 235 MPa, E = 210 GPa, catalogue EN 10365 : Wpl,y = 628,4 cm³, Iy = 8 356 cm⁴), portée L = 6,00 m, appuis simples, pontage latéral continu (pas de déversement). Charges réparties : ELU q = 15 kN/m, ELS caractéristique q = 10 kN/m."
          />
        </p>

        <h2 className="mt-10 text-[20px] font-semibold text-ink-primary">
          <Trans id="site.calc.ipe.s2.title" message="2. Efforts internes (ELU)" />
        </h2>
        <p className="mt-2 text-[14px] leading-6 text-ink-secondary">
          <Trans
            id="site.calc.ipe.s2.body"
            message="Poutre sur deux appuis sous charge uniforme — moment sur appui nul, moment maximal à mi-portée :"
          />
        </p>
        <Formula>
          <Trans id="site.calc.ipe.f1" message="MEd = q·L² / 8 = 15 × 6,00² / 8 = 67,50 kN·m" />
        </Formula>
        <Formula>
          <Trans id="site.calc.ipe.f2" message="VEd = q·L / 2 = 15 × 6,00 / 2 = 45,0 kN" />
        </Formula>

        <h2 className="mt-10 text-[20px] font-semibold text-ink-primary">
          <Trans
            id="site.calc.ipe.s3.title"
            message="3. Résistance en flexion — EN 1993-1-1 §6.2.5"
          />
        </h2>
        <p className="mt-2 text-[14px] leading-6 text-ink-secondary">
          <Trans
            id="site.calc.ipe.s3.body"
            message="L'IPE 300 laminé est de classe 1 en flexion forte axe : le moment résistant plastique s'applique (γM0 = 1,0) :"
          />
        </p>
        <Formula>
          <Trans
            id="site.calc.ipe.f3"
            message="Mc,Rd = Wpl,y · fy / γM0 = 628,4 cm³ × 235 MPa = 147,7 kN·m"
          />
        </Formula>
        <Formula>
          <Trans
            id="site.calc.ipe.f4"
            message="η flexion = MEd / Mc,Rd = 67,50 / 147,7 = 0,46 ≤ 1,00 → conforme"
          />
        </Formula>
        <p className="mt-2 text-[14px] leading-6 text-ink-secondary">
          <Trans
            id="site.calc.ipe.s3.body2"
            message="Le taux de travail de 46 % laisse une réserve confortable ; le passage au S275 ou l'IPE 240 deviennent des candidats d'optimisation — l'optimiseur Pareto de l'atelier les classe par masse et taux EC3 en un clic."
          />
        </p>

        <h2 className="mt-10 text-[20px] font-semibold text-ink-primary">
          <Trans
            id="site.calc.ipe.s4.title"
            message="4. Résistance en effort tranchant — §6.2.6"
          />
        </h2>
        <p className="mt-2 text-[14px] leading-6 text-ink-secondary">
          <Trans
            id="site.calc.ipe.s4.body"
            message="Aire de cisaillement de l'âme chargée (η = 1,2 en comparaison conservative), puis résistance plastique :"
          />
        </p>
        <Formula>
          <Trans
            id="site.calc.ipe.f5"
            message="Av = A − 2·b·tf + (tw + 2r)·tf = 2 568 mm² (≥ η·hw·tw)"
          />
        </Formula>
        <Formula>
          <Trans
            id="site.calc.ipe.f6"
            message="Vpl,Rd = Av · fy / (√3 · γM0) = 348,4 kN → η cisaillement = 0,13 ≤ 1,00"
          />
        </Formula>
        <p className="mt-2 text-[14px] leading-6 text-ink-secondary">
          <Trans
            id="site.calc.ipe.s4.body2"
            message="VEd = 45 kN < 0,5·Vpl,Rd : pas d'interaction flexion-cisaillement §6.2.8 à vérifier."
          />
        </p>

        <h2 className="mt-10 text-[20px] font-semibold text-ink-primary">
          <Trans id="site.calc.ipe.s5.title" message="5. Flèche ELS" />
        </h2>
        <p className="mt-2 text-[14px] leading-6 text-ink-secondary">
          <Trans
            id="site.calc.ipe.s5.body"
            message="Flèche élastique maximale à mi-portée sous la combinaison caractéristique :"
          />
        </p>
        <Formula>
          <Trans
            id="site.calc.ipe.f7"
            message="w = 5·q·L⁴ / (384·E·Iy) = 5 × 10 × 6,00⁴ / (384 × 210 000 × 8 356 cm⁴) = 9,62 mm"
          />
        </Formula>
        <Formula>
          <Trans id="site.calc.ipe.f8" message="w/L = 1/624 ≤ 1/500 → conforme (1/250 = 24,0 mm)" />
        </Formula>

        <h2 className="mt-10 text-[20px] font-semibold text-ink-primary">
          <Trans id="site.calc.ipe.recap.title" message="Récapitulatif" />
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
                  <Trans id="site.calc.ipe.row.bending" message="Flexion §6.61" />
                </td>
                <td className="py-2 pr-4">67,50 kN·m</td>
                <td className="py-2 pr-4">147,7 kN·m</td>
                <td className="py-2 text-pass-text">0,46</td>
              </tr>
              <tr className="border-b border-hairline">
                <td className="py-2 pr-4">
                  <Trans id="site.calc.ipe.row.shear" message="Cisaillement §6.62" />
                </td>
                <td className="py-2 pr-4">45,0 kN</td>
                <td className="py-2 pr-4">348,4 kN</td>
                <td className="py-2 text-pass-text">0,13</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">
                  <Trans id="site.calc.ipe.row.deflection" message="Flèche ELS (L/500)" />
                </td>
                <td className="py-2 pr-4">9,62 mm</td>
                <td className="py-2 pr-4">12,0 mm</td>
                <td className="py-2 text-pass-text">0,80</td>
              </tr>
            </tbody>
          </table>
        </div>

        <DocsHandoff path="/guides/ec3-check-and-optimizer/" />
        <h2 className="mt-10 text-[20px] font-semibold text-ink-primary">
          <Trans id="site.calc.faq.title" message="Questions fréquentes" />
        </h2>
        <FaqList items={buildFaqIpe()} />
      </div>
    </article>
  );
}
