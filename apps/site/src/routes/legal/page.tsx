import { Trans } from "@lingui/react";
import { i18n } from "@lingui/core";
import { docsHref } from "../../lib/env";
import { currentSiteLocale } from "../../i18n/i18n";

/**
 * `/legal` (v2.2.0) — the v2.1.0 legal page ported verbatim: Mentions
 * légales (LCEN), CGU/CGV, Politique de Confidentialité RGPD (100 % local —
 * aucune donnée envoyée sur un serveur) et Clause de Responsabilité
 * Technique Ingénieur.
 *
 * Reader-mode surface (impeccable): stable 65–75ch measure, section anchors
 * shared with the footer, and honest copy — the editor's legal coordinates
 * are NOT invented; they are published here once the publishing entity
 * exists. There is no storefront and no sale: the software is free and
 * open source.
 *
 * i18n (v2.3.0): every string is a Lingui runtime call (`<Trans>` /
 * `i18n._`, explicit IDs) resolved at render time in the active locale.
 * The page-level `<meta>` export that used to live here was dead code (the
 * worker only evaluates `page.server.ts` `meta`); the live meta is in
 * `page.server.ts`.
 */

function buildSections(): { id: string; label: string }[] {
  return [
    { id: "editeur", label: i18n._({ id: "site.legal.nav.editeur", message: "Mentions légales (LCEN)" }) },
    { id: "cgu", label: i18n._({ id: "site.legal.nav.cgu", message: "CGU & CGV" }) },
    { id: "rgpd", label: i18n._({ id: "site.legal.nav.rgpd", message: "Confidentialité RGPD" }) },
    {
      id: "responsabilite",
      label: i18n._({ id: "site.legal.nav.liability", message: "Responsabilité de l'ingénieur" }),
    },
  ];
}

export default function LegalPage(): React.ReactElement {
  const home = currentSiteLocale() === "en" ? "/en" : "/";
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="grid gap-8 md:grid-cols-[220px_1fr]">
        {/* Section nav (anchor-synced with the footer links). */}
        <nav
          className="top-20 hidden self-start md:sticky md:block"
          aria-label={i18n._({ id: "site.legal.nav.aria", message: "Sections légales" })}
        >
          <p className="font-data mb-2 text-[11px] text-ink-muted">
            <Trans id="site.legal.nav.title" message="Sur cette page" />
          </p>
          <ul className="space-y-1">
            {buildSections().map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="block rounded px-2 py-1 text-[13px] text-ink-secondary hover:bg-accent-tint hover:text-accent"
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
          <a href={home} className="mt-4 block rounded px-2 py-1 text-[13px] text-accent hover:bg-accent-tint">
            <Trans id="site.legal.nav.backHome" message="← Retour à l'accueil" />
          </a>
          <a
            href={docsHref("/")}
            target="_blank"
            rel="noreferrer"
            className="mt-1 block rounded px-2 py-1 text-[13px] text-ink-secondary hover:bg-accent-tint hover:text-accent"
          >
            <Trans id="site.header.nav.docs" message="Documentation" /> <span aria-hidden>↗</span>
          </a>
        </nav>

        <div className="max-w-[72ch] space-y-10">
          <header>
            <h1 className="text-balance text-[24px] font-semibold leading-8 tracking-tight text-ink-primary">
              <Trans id="site.legal.h1" message="Informations légales & confidentialité" />
            </h1>
            <p className="mt-2 text-[14px] leading-6 text-ink-secondary">
              <Trans
                id="site.legal.intro"
                message="RDM Studio est un logiciel d'ingénierie local-first : cette page décrit le cadre juridique de son édition unique, gratuite et open source, et la manière dont vos données de calcul — qui ne quittent jamais votre poste — sont traitées."
              />
            </p>
          </header>

          {/* Mentions légales (LCEN art. 6 III 1°). */}
          <section id="editeur" className="scroll-mt-20">
            <h2 className="text-[18px] font-semibold leading-6 text-ink-primary">
              <Trans id="site.legal.editeur.title" message="Mentions légales (LCEN)" />
            </h2>
            <div className="mt-3 space-y-3 text-[14px] leading-6 text-ink-secondary">
              <p>
                <Trans
                  id="site.legal.editeur.p1"
                  message="Ce site et le logiciel RDM Studio sont édités dans le cadre d'un projet open source. Le logiciel est gratuit et libre : il n'y a ni boutique, ni vente, ni abonnement. Les coordonnées complètes de l'éditeur — raison sociale, siège, numéro d'immatriculation et adresse de courrier électronique — seront publiées sur la présente page dès la création de la structure éditrice, conformément à l'article 6 III 1° de la LCEN."
                />
              </p>
              <p>
                <Trans
                  id="site.legal.editeur.p2"
                  message="Directeur de la publication : le responsable éditorial du projet RDM Studio. Hébergeur du site et de la documentation : l'hébergeur statique du projet, dont les coordonnées seront publiées à la même date. Le logiciel lui-même, une fois installé comme PWA, s'exécute intégralement sur votre poste et n'est plus hébergé par qui que ce soit."
                />
              </p>
              <p>
                <Trans
                  id="site.legal.editeur.p3"
                  message="Signalement d'un contenu illicite : un courrier électronique de contact sera publié sur la présente page ; les demandes reçoivent une réponse dans un délai raisonnable conformément à la LCEN."
                />
              </p>
            </div>
          </section>

          {/* CGU / CGV. */}
          <section id="cgu" className="scroll-mt-20">
            <h2 className="text-[18px] font-semibold leading-6 text-ink-primary">
              <Trans id="site.legal.cgu.title" message="Conditions Générales d'Utilisation & de Vente" />
            </h2>
            <div className="mt-3 space-y-3 text-[14px] leading-6 text-ink-secondary">
              <p>
                <Trans
                  id="site.legal.cgu.p1"
                  message="Licence d'utilisation. RDM Studio est un logiciel libre, fourni gratuitement — pour un usage professionnel ou pédagogique — sous les termes de sa licence open source. Une seule édition, complète, gratuite à vie, sans compte, sans bridage et sans clé d'activation : il n'existe ni édition Pro payante, ni abonnement, ni licence perpétuelle à acheter."
                />
              </p>
              <p>
                <Trans
                  id="site.legal.cgu.p2"
                  message="Vente. Le logiciel étant gratuit et libre, aucune commande ni aucun paiement n'est requis pour l'utiliser. Les seules prestations facturées sont les services optionnels proposés sur demande — déploiement sur réseau interne fermé, gabarits et vérifications métiers sur mesure, support ingénieur dédié — qui font l'objet d'un devis ; leurs conditions (prix, délai, rétractation) figurent dans le devis accepté par le client."
                />
              </p>
              <p>
                <Trans
                  id="site.legal.cgu.p3"
                  message="Disponibilité. Le service étant local-first, aucune disponibilité serveur n'est requise pour calculer : les mises à jour, la documentation et le support sont les seuls services en ligne. L'éditeur s'engage à publier chaque version avec son journal de modifications et ses 41 benchmarks de validation."
                />
              </p>
            </div>
          </section>

          {/* RGPD — the zero-cloud stance IS the policy. */}
          <section id="rgpd" className="scroll-mt-20">
            <h2 className="text-[18px] font-semibold leading-6 text-ink-primary">
              <Trans id="site.legal.rgpd.title" message="Politique de Confidentialité RGPD" />
            </h2>
            <div className="mt-3 space-y-3 text-[14px] leading-6 text-ink-secondary">
              <p>
                <Trans
                  id="site.legal.rgpd.p1"
                  message="Aucune donnée envoyée sur un serveur. Vos modèles, sections, charges, résultats et notes de calcul sont traités et stockés exclusivement dans votre navigateur (IndexedDB, localStorage). RDM Studio ne comporte aucun outil de mesure télémétrique, aucun traceur tiers et aucun transfert vers un pays tiers : le responsable de traitement de vos données d'ingénierie, c'est vous."
                />
              </p>
              <p>
                <Trans
                  id="site.legal.rgpd.p2"
                  message="Données traitées localement : le projet courant (géométrie, profilés, charges, résultats), vos préférences d'affichage (perspective, calques, accrochage — conservées dans l'URL), votre préférence de langue et, si vous les saisissez, les métadonnées de branding de la couverture de rapport. Effacer les données du navigateur efface définitivement l'ensemble — aucune copie existe ailleurs."
                />
              </p>
              <p>
                <Trans
                  id="site.legal.rgpd.p3"
                  message="Partage par URL : si vous utilisez le lien de partage, le modèle est compressé dans l'URL elle-même. Ne transmettez ce lien qu'aux destinataires visés ; il ne transite par aucun serveur de RDM Studio, mais il figure dans l'historique de votre navigateur et celui de vos correspondants."
                />
              </p>
              <p>
                <Trans
                  id="site.legal.rgpd.p4"
                  message="Vos droits (accès, rectification, effacement, portabilité) s'exercent directement sur votre poste : export .rdm pour la portabilité, suppression du stockage local pour l'effacement. Pour toute question relative à cette page, les coordonnées de contact publiées aux mentions légales s'appliquent."
                />
              </p>
            </div>
          </section>

          {/* Engineer responsibility clause. */}
          <section id="responsabilite" className="scroll-mt-20">
            <h2 className="text-[18px] font-semibold leading-6 text-ink-primary">
              <Trans
                id="site.legal.liability.title"
                message="Clause de Responsabilité Technique Ingénieur"
              />
            </h2>
            <div className="mt-3 space-y-3 text-[14px] leading-6 text-ink-secondary">
              <p>
                <Trans
                  id="site.legal.liability.p1"
                  message="RDM Studio est un outil d'aide au calcul : les hypothèses, le dimensionnement des sections, les charges introduites et l'interprétation des résultats relèvent de la responsabilité professionnelle de l'ingénieur qui signe la note de calcul. Le logiciel reproduit les formules des normes citées, y compris leurs limites d'application ; hors de ces limites (élancement excessif, assemblages non modélisés, effets dynamiques non couverts), le résultat doit être invalidé par une expertise."
                />
              </p>
              <p>
                <Trans
                  id="site.legal.liability.p2"
                  message="Vérification croisée. Les 41 benchmarks analytiques embarqués vérifient le solveur à chaque version, et chaque note de calcul porte l'empreinte SHA-256 du modèle calculé. L'éditeur ne saurait être tenu responsable d'une utilisation hors du périmètre normatif, de données d'entrée erronées ou de l'omission des vérifications incombant au concepteur."
                />
              </p>
            </div>
          </section>

          <p className="font-data border-t border-hairline pt-4 text-[11px] text-ink-muted">
            <Trans id="site.legal.updated" message="Dernière mise à jour : novembre 2026 — v2.2.0." />
          </p>
        </div>
      </div>
    </div>
  );
}
