import { Trans } from "@lingui/react";
import { i18n } from "@lingui/core";
import { Breadcrumb, DocsHandoff, FaqList, Formula, SeoCta } from "../../components/seo";

/**
 * `/calcul-poutre-bois-eurocode-5` — programmatic SEO landing page: poutre
 * en bois lamellé-collé GL24h (EN 1995-1-1), kmod/γM, résistance fm,d,
 * cisaillement fv,d et flèches winst/ufin. Exemple chiffré : section
 * 160 × 320 mm, L = 6,0 m, qELU = 6 kN/m, qSLS = 4 kN/m.
 *
 * i18n: every string is a Lingui runtime call (`<Trans>` / `i18n._`,
 * explicit IDs) resolved at render time in the active locale. The FAQ is a
 * function (not a module constant) for the same reason. The page-level
 * `<meta>` export that used to live here was dead code (the worker only
 * evaluates `page.server.ts` `meta`); the live meta is in `page.server.ts`.
 */

function buildFaqTimber(): { q: string; a: string }[] {
  return [
    {
      q: i18n._({
        id: "site.calc.timber.faq.kmod.q",
        message: "À quoi servent kmod et γM dans l'Eurocode 5 ?",
      }),
      a: i18n._({
        id: "site.calc.timber.faq.kmod.a",
        message:
          "kmod (EN 1995-1-1 §3.1.3, tableau 3.1) réduit la résistance selon la classe de service (humidité) et la durée de charge : 0,8 pour du GL24h en classe 1 à charge moyenne-terme. γM (tableau 2.3) vaut 1,3 pour le bois lamellé-collé. La résistance de calcul devient fm,d = kmod·fm,k/γM = 0,8 × 24 / 1,3 = 14,8 MPa — deux poutres identiques en classe 1 ou classe 3 n'ont pas la même résistance.",
      }),
    },
    {
      q: i18n._({
        id: "site.calc.timber.faq.deflection.q",
        message: "Quelles limites de flèche pour une poutre en bois ?",
      }),
      a: i18n._({
        id: "site.calc.timber.faq.deflection.a",
        message:
          "L'EN 1995-1-1 tableau 7.2 recommande (valeurs indicatives de l'Annexe Nationale) : winst ≤ L/300 à L/500, et wnet,fin ≤ L/150 à L/250 selon la sensibilité des finitions. La flèche finale ufin intègre le fluage via kdef (0,8 pour le GL en classe 1) appliqué aux parts quasi-permanentes des charges.",
      }),
    },
    {
      q: i18n._({
        id: "site.calc.timber.faq.solver.q",
        message: "Comment le solveur vérifie-t-il le bois ?",
      }),
      a: i18n._({
        id: "site.calc.timber.faq.solver.a",
        message:
          "Le solveur calcule les efforts internes (N, V, M) indépendamment du matériau ; la vérification applique ensuite les formules EN 1995-1-1 (6.11 σm,d ≤ fm,d, 6.13 τd ≤ fv.d) avec les propriétés du GL24h/GL28h/GL32h intégrées au catalogue. Le même modèle peut mélanger barreaux acier (EC3), poutres bois (EC5) et poteaux béton (EC2).",
      }),
    },
  ];
}

export default function CalculPoutreBoisPage(): React.ReactElement {
  return (
    <article className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <Breadcrumb
        page={i18n._({ id: "site.calc.timber.breadcrumb", message: "Calcul de poutre bois Eurocode 5" })}
      />
      <div className="max-w-[76ch]">
        <h1 className="text-balance text-[clamp(1.7rem,3.5vw,2.4rem)] font-semibold leading-tight tracking-tight text-ink-primary">
          <Trans
            id="site.calc.timber.h1"
            message="Calcul de poutre bois selon l'Eurocode 5 — GL24h, kmod, flèches et fluage"
          />
        </h1>
        <p className="mt-3 text-[15px] leading-6 text-ink-secondary">
          <Trans
            id="site.calc.timber.intro"
            message="Vérifier une poutre en lamellé-collé GL24h selon l'EN 1995-1-1 : résistance en flexion fm,d (kmod × fm,k / γM), cisaillement fv,d, flèches instantanée winst et finale ufin avec fluage kdef. Exemple chiffré complet — le multi-matériaux que RDM Studio vérifie dans le même modèle que l'acier et le béton."
          />
        </p>

        <SeoCta
          template="travees"
          label={i18n._({
            id: "site.calc.timber.ctaLabel",
            message:
              "Reproduisez ce modèle dans l'atelier : poutre GL24h, kmod et γM, vérifications EN 1995-1-1 (flexion §6.11, cisaillement §6.13) et flèches winst/ufin avec fluage kdef, prêtes à calculer, 100 % sur votre poste.",
          })}
        />

        <h2 className="mt-10 text-[20px] font-semibold text-ink-primary">
          <Trans id="site.calc.timber.s1.title" message="1. Données" />
        </h2>
        <p className="mt-2 text-[14px] leading-6 text-ink-secondary">
          <Trans
            id="site.calc.timber.s1.body"
            message="Poutre isostatique GL24h (fm,k = 24 MPa, fvk = 3,5 MPa, E0,mean = 11 500 MPa) section 160 × 320 mm, portée L = 6,00 m, classe de service 1 (couvert, chauffé), charge moyenne-terme (kmod = 0,8, γM = 1,3, kdef = 0,8). ELU q = 6,0 kN/m, ELS caractéristique q = 4,0 kN/m."
          />
        </p>
        <Formula>
          <Trans
            id="site.calc.timber.f1"
            message="fm,d = kmod · fm,k / γM = 0,8 × 24 / 1,3 = 14,77 MPa"
          />
        </Formula>
        <Formula>
          <Trans
            id="site.calc.timber.f2"
            message="fvd = kmod · fvk / γM = 0,8 × 3,5 / 1,3 = 2,15 MPa"
          />
        </Formula>

        <h2 className="mt-10 text-[20px] font-semibold text-ink-primary">
          <Trans
            id="site.calc.timber.s2.title"
            message="2. Sollicitations et résistances (ELU)"
          />
        </h2>
        <p className="mt-2 text-[14px] leading-6 text-ink-secondary">
          <Trans
            id="site.calc.timber.s2.body"
            message="Module de flexion Wel = b·h²/6 = 2 731 cm³, effort tranchant sur appui, contraintes de calcul :"
          />
        </p>
        <Formula>
          <Trans
            id="site.calc.timber.f3"
            message="MEd = q·L²/8 = 6,0 × 6,00²/8 = 27,0 kN·m → σm,d = MEd/Wel = 9,89 MPa"
          />
        </Formula>
        <Formula>
          <Trans
            id="site.calc.timber.f4"
            message="σm,d ≤ fm,d : 9,89 ≤ 14,77 MPa → η = 0,67 ≤ 1,00 → conforme (§6.11)"
          />
        </Formula>
        <Formula>
          <Trans
            id="site.calc.timber.f5"
            message="VEd = q·L/2 = 18,0 kN → τd = 1,5·VEd/(b·h) = 0,53 MPa ≤ fv,d = 2,15 MPa (§6.13)"
          />
        </Formula>

        <h2 className="mt-10 text-[20px] font-semibold text-ink-primary">
          <Trans
            id="site.calc.timber.s3.title"
            message="3. Flèches ELS — instantanée et finale (fluage kdef)"
          />
        </h2>
        <p className="mt-2 text-[14px] leading-6 text-ink-secondary">
          <Trans
            id="site.calc.timber.s3.body"
            message="Inertie I = b·h³/12 = 4 369 cm⁴, flèche instantanée sous combinaison caractéristique, puis flèche finale intégrant le fluage (kdef = 0,8 sur la part quasi-permanente) :"
          />
        </p>
        <Formula>
          <Trans
            id="site.calc.timber.f6"
            message="winst = 5·q·L⁴/(384·E0,mean·I) = 13,4 mm ≤ L/300 = 20,0 mm → conforme"
          />
        </Formula>
        <Formula>
          <Trans
            id="site.calc.timber.f7"
            message="ufin ≈ winst × (1 + kdef) = 24,2 mm ≈ L/250 = 24,0 mm — en limite, à arbitrer"
          />
        </Formula>
        <p className="mt-2 text-[14px] leading-6 text-ink-secondary">
          <Trans
            id="site.calc.timber.s3.body2"
            message="L'arbitrage final se joue sur la part quasi-permanente réelle des charges (la formule exacte sépare G·(1 + kdef) et Q·(1 + ψ2·kdef)) : c'est précisément le genre de vérification où le CalcTrace de l'atelier affiche chaque coefficient source."
          />
        </p>

        <h2 className="mt-10 text-[20px] font-semibold text-ink-primary">
          <Trans id="site.calc.timber.recap.title" message="Récapitulatif" />
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
                  <Trans id="site.calc.timber.row.bending" message="Flexion §6.11" />
                </td>
                <td className="py-2 pr-4">9,89 MPa</td>
                <td className="py-2 pr-4">14,77 MPa</td>
                <td className="py-2 text-pass-text">0,67</td>
              </tr>
              <tr className="border-b border-hairline">
                <td className="py-2 pr-4">
                  <Trans id="site.calc.timber.row.shear" message="Cisaillement §6.13" />
                </td>
                <td className="py-2 pr-4">0,53 MPa</td>
                <td className="py-2 pr-4">2,15 MPa</td>
                <td className="py-2 text-pass-text">0,25</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">
                  <Trans id="site.calc.timber.row.deflection" message="Flèche winst (L/300)" />
                </td>
                <td className="py-2 pr-4">13,4 mm</td>
                <td className="py-2 pr-4">20,0 mm</td>
                <td className="py-2 text-pass-text">0,67</td>
              </tr>
            </tbody>
          </table>
        </div>

        <DocsHandoff path="/guides/advanced-analyses/" />
        <h2 className="mt-10 text-[20px] font-semibold text-ink-primary">
          <Trans id="site.calc.faq.title" message="Questions fréquentes" />
        </h2>
        <FaqList items={buildFaqTimber()} />
      </div>
    </article>
  );
}
