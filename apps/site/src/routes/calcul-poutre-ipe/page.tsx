import { defineMeta } from "@oxide-fw/core/server";
import { SITE_URL } from "../../lib/env";
import { Breadcrumb, DocsHandoff, FaqList, Formula, SeoCta } from "../../components/seo";

/**
 * `/calcul-poutre-ipe` — programmatic Eurocode SEO landing page: flexion
 * simple d'une poutre IPE (EN 1993-1-1 §6.2), résistance en flexion et en
 * effort tranchant, flèche ELS. Exemple chiffré : IPE 300 S235 (catalogue
 * EN 10365 embarqué du moteur), L = 6,0 m, qELU = 15 kN/m, qELS = 10 kN/m.
 */

const FAQ = [
  {
    q: "Quelle différence entre Wel,y et Wpl,y pour une poutre IPE ?",
    a: "Wel,y (module élastique) pilote la contrainte élastique σ = M/Wel, utilisée pour les classes 3 et 4 ou la vérification ELS. Wpl,y (module plastique) pilote Mc,Rd = Wpl,y·fy/γM0 pour les sections de classe 1 ou 2 — c'est le cas des IPE laminés en flexion forte axe : la fibre tendue peut plastifier, le moment résistant est d'environ 13 à 15 % supérieur.",
  },
  {
    q: "Comment vérifier la flèche d'une poutre IPE selon l'Eurocode 3 ?",
    a: "L'EN 1993-1-1 ne fixe pas de limite numérique : le tableau 7.2 de l'EN 1993-1-1 renvoie à l'Annexe nationale. En pratique courante en France, on retient w ≤ L/250 (éléments standard) à L/500 (éléments fragiles, matériaux de couverture sensibles) sous combinaison caractéristique ELS. RDM Studio affiche ces deux limites avec le rapport w/L calculé.",
  },
  {
    q: "Le voilement de l'âme doit-il être vérifié pour un IPE ?",
    a: "Pour un IPE laminé soumis à la flexion simple, les âmes restent dans le domaine non-voilé (limites de classe respectées pour fy ≤ 460 MPa) sauf charges localisées très élevées ou cisaillement dominant : la vérification VEd/Vpl,Rd et la ripage de l'âme (§6.2.7) restent néanmoins calculées par l'atelier.",
  },
  {
    q: "La poutre IPE doit-elle être vérifiée au déversement ?",
    a: "Oui dès que la compression n'est pas bridée latéralement : la vérification §6.3.2 avec χLT s'applique (LTB). Sur la poutre d'exemple, un pontage ou un béton de dallage connecté empêche le déversement ; sans bridage, RDM Studio calcule automatiquement Mcr, λ̄LT et χLT avec la méthode 1 ou 2 au choix.",
  },
];

export default function CalculPoutreIpePage(): React.ReactElement {
  return (
    <article className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <Breadcrumb page="Calcul de poutre IPE" />
      <div className="max-w-[76ch]">
        <h1 className="text-balance text-[clamp(1.7rem,3.5vw,2.4rem)] font-semibold leading-tight tracking-tight text-ink-primary">
          Calcul de poutre IPE selon l'Eurocode 3 — flexion, cisaillement et flèche
        </h1>
        <p className="mt-3 text-[15px] leading-6 text-ink-secondary">
          Méthode complète de vérification d'une poutre métallique IPE (catalogue EN 10365) en
          flexion simple : résistance plastique Mc,Rd, effort tranchant Vpl,Rd et flèche ELS,
          avec un exemple chiffré de bout en bout — exactement ce que reproduit RDM Studio sur
          votre poste, sans cloud.
        </p>

        <SeoCta template="travees" />

        <h2 className="mt-10 text-[20px] font-semibold text-ink-primary">1. Données du problème</h2>
        <p className="mt-2 text-[14px] leading-6 text-ink-secondary">
          Poutre isostatique IPE 300 en S235JR (fy = 235 MPa, E = 210 GPa, catalogue EN 10365 :
          Wpl,y = 628,4 cm³, Iy = 8 356 cm⁴), portée L = 6,00 m, appuis simples, pontage
          latéral continu (pas de déversement). Charges réparties : ELU q = 15 kN/m, ELS
          caractéristique q = 10 kN/m.
        </p>

        <h2 className="mt-10 text-[20px] font-semibold text-ink-primary">2. Efforts internes (ELU)</h2>
        <p className="mt-2 text-[14px] leading-6 text-ink-secondary">
          Poutre sur deux appuis sous charge uniforme — moment sur appui nul, moment maximal à
          mi-portée :
        </p>
        <Formula>MEd = q·L² / 8 = 15 × 6,00² / 8 = 67,50 kN·m</Formula>
        <Formula>VEd = q·L / 2 = 15 × 6,00 / 2 = 45,0 kN</Formula>

        <h2 className="mt-10 text-[20px] font-semibold text-ink-primary">
          3. Résistance en flexion — EN 1993-1-1 §6.2.5
        </h2>
        <p className="mt-2 text-[14px] leading-6 text-ink-secondary">
          L'IPE 300 laminé est de classe 1 en flexion forte axe : le moment résistant plastique
          s'applique (γM0 = 1,0) :
        </p>
        <Formula>Mc,Rd = Wpl,y · fy / γM0 = 628,4 cm³ × 235 MPa = 147,7 kN·m</Formula>
        <Formula>η flexion = MEd / Mc,Rd = 67,50 / 147,7 = 0,46 ≤ 1,00 → conforme</Formula>
        <p className="mt-2 text-[14px] leading-6 text-ink-secondary">
          Le taux de travail de 46 % laisse une réserve confortable ; le passage au S275 ou
          l'IPE 240 deviennent des candidats d'optimisation — l'optimiseur Pareto de l'atelier
          les classe par masse et taux EC3 en un clic.
        </p>

        <h2 className="mt-10 text-[20px] font-semibold text-ink-primary">
          4. Résistance en effort tranchant — §6.2.6
        </h2>
        <p className="mt-2 text-[14px] leading-6 text-ink-secondary">
          Aire de cisaillement de l'âme chargée (η = 1,2 en comparaison conservative), puis
          résistance plastique :
        </p>
        <Formula>Av = A − 2·b·tf + (tw + 2r)·tf = 2 568 mm² (≥ η·hw·tw)</Formula>
        <Formula>Vpl,Rd = Av · fy / (√3 · γM0) = 348,4 kN → η cisaillement = 0,13 ≤ 1,00</Formula>
        <p className="mt-2 text-[14px] leading-6 text-ink-secondary">
          VEd = 45 kN &lt; 0,5·Vpl,Rd : pas d'interaction flexion-cisaillement §6.2.8 à
          vérifier.
        </p>

        <h2 className="mt-10 text-[20px] font-semibold text-ink-primary">5. Flèche ELS</h2>
        <p className="mt-2 text-[14px] leading-6 text-ink-secondary">
          Flèche élastique maximale à mi-portée sous la combinaison caractéristique :
        </p>
        <Formula>w = 5·q·L⁴ / (384·E·Iy) = 5 × 10 × 6,00⁴ / (384 × 210 000 × 8 356 cm⁴) = 9,62 mm</Formula>
        <Formula>w/L = 1/624 ≤ 1/500 → conforme (1/250 = 24,0 mm)</Formula>

        <h2 className="mt-10 text-[20px] font-semibold text-ink-primary">Récapitulatif</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="font-data w-full min-w-[420px] border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-hairline text-left text-ink-secondary">
                <th className="py-2 pr-4">Vérification</th>
                <th className="py-2 pr-4">Sollicitation</th>
                <th className="py-2 pr-4">Résistance</th>
                <th className="py-2">Taux η</th>
              </tr>
            </thead>
            <tbody className="text-ink-primary">
              <tr className="border-b border-hairline">
                <td className="py-2 pr-4">Flexion §6.61</td>
                <td className="py-2 pr-4">67,50 kN·m</td>
                <td className="py-2 pr-4">147,7 kN·m</td>
                <td className="py-2 text-pass-text">0,46</td>
              </tr>
              <tr className="border-b border-hairline">
                <td className="py-2 pr-4">Cisaillement §6.62</td>
                <td className="py-2 pr-4">45,0 kN</td>
                <td className="py-2 pr-4">348,4 kN</td>
                <td className="py-2 text-pass-text">0,13</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">Flèche ELS (L/500)</td>
                <td className="py-2 pr-4">9,62 mm</td>
                <td className="py-2 pr-4">12,0 mm</td>
                <td className="py-2 text-pass-text">0,80</td>
              </tr>
            </tbody>
          </table>
        </div>

        <DocsHandoff path="/guides/ec3-check-and-optimizer/" />
        <h2 className="mt-10 text-[20px] font-semibold text-ink-primary">Questions fréquentes</h2>
        <FaqList items={FAQ} />
      </div>
    </article>
  );
}

export const meta = defineMeta(() => {
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
  const appLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "RDM Studio — calcul de poutre IPE Eurocode 3",
    applicationCategory: "EngineeringApplication",
    operatingSystem: "Web (PWA, local-first)",
    url: `${SITE_URL}/calcul-poutre-ipe`,
    softwareVersion: "2.2.0",
    description:
      "Vérification complète d'une poutre IPE selon EN 1993-1-1 : Mc,Rd, Vpl,Rd, flèche ELS, déversement χLT — exemple chiffré et calcul local-first.",
  };
  return {
    title: "Calcul de poutre IPE Eurocode 3 (Mc,Rd, Vpl,Rd, flèche) — RDM Studio",
    description:
      "Méthode EN 1993-1-1 pour une poutre IPE : résistance plastique Mc,Rd = Wpl,y·fy/γM0, cisaillement Vpl,Rd, flèche L/500, exemple chiffré IPE 300 S235 de 6 m — vérifiez-le gratuitement dans l'atelier local-first.",
    canonical: `${SITE_URL}/calcul-poutre-ipe`,
    openGraph: {
      title: "Calcul de poutre IPE Eurocode 3 — méthode et exemple chiffré",
      description:
        "Flexion Mc,Rd, cisaillement Vpl,Rd, flèche ELS : la vérification complète d'un IPE 300 S235 de 6 m pas à pas selon EN 1993-1-1.",
      url: `${SITE_URL}/calcul-poutre-ipe`,
      type: "article",
      siteName: "RDM Studio",
      locale: "fr_FR",
    },
    jsonLd: [JSON.stringify(faqLd), JSON.stringify(appLd)],
  };
});
