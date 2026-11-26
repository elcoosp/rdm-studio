import { createFileRoute, Link } from "@tanstack/react-router";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";

export const Route = createFileRoute("/_marketing/legal")({
  staticData: { surface: "marketing" },
  component: LegalPage,
});

/**
 * `/legal` (v2.1.0 commercial layer): Mentions légales (LCEN), CGU/CGV,
 * Politique de Confidentialité RGPD (100 % local — aucune donnée envoyée
 * sur un serveur) et Clause de Responsabilité Technique Ingénieur.
 *
 * Reader-mode surface (impeccable): stable 65–75ch measure, section anchors
 * shared with the footer, and honest copy — the editor's legal coordinates
 * are NOT invented, they are published at the storefront opening.
 */

function LegalPage() {
  const sections = [
    { id: "editeur", label: t`Mentions légales (LCEN)` },
    { id: "cgu", label: t`CGU & CGV` },
    { id: "rgpd", label: t`Confidentialité RGPD` },
    { id: "responsabilite", label: t`Responsabilité de l'ingénieur` },
  ] as const;
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="grid gap-8 md:grid-cols-[220px_1fr]">
        {/* Section nav (anchor-synced with the footer links). */}
        <nav
          className="top-20 hidden self-start md:sticky md:block"
          aria-label={t`Sections légales`}
        >
          <p className="font-data mb-2 text-[11px] text-ink-muted">
            <Trans>Sur cette page</Trans>
          </p>
          <ul className="space-y-1">
            {sections.map((section) => (
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
          <Link
            to="/"
            className="mt-4 block rounded px-2 py-1 text-[13px] text-accent hover:bg-accent-tint"
          >
            <Trans>← Retour à l'accueil</Trans>
          </Link>
        </nav>

        <div className="max-w-[72ch] space-y-10">
          <header>
            <h1 className="text-balance text-[24px] font-semibold leading-8 tracking-tight text-ink-primary">
              <Trans>Informations légales & confidentialité</Trans>
            </h1>
            <p className="mt-2 text-[14px] leading-6 text-ink-secondary">
              <Trans>
                RDM Studio est un logiciel d'ingénierie local-first : cette page décrit le cadre
                juridique de son édition commerciale et la manière dont vos données de calcul — qui
                ne quittent jamais votre poste — sont traitées.
              </Trans>
            </p>
          </header>

          {/* Mentions légales (LCEN art. 6 III 1°). */}
          <section id="editeur" className="scroll-mt-20">
            <h2 className="text-[18px] font-semibold leading-6 text-ink-primary">
              <Trans>Mentions légales (LCEN)</Trans>
            </h2>
            <div className="mt-3 space-y-3 text-[14px] leading-6 text-ink-secondary">
              <p>
                <Trans>
                  Ce site et le logiciel RDM Studio sont édités dans le cadre d'un projet open
                  source. Les coordonnées complètes de l'éditeur — raison sociale, siège, numéro
                  d'immatriculation et adresse de courrier électronique — sont publiées sur la
                  présente page à l'ouverture de la boutique commerciale, conformément à l'article 6
                  III 1° de la LCEN.
                </Trans>
              </p>
              <p>
                <Trans>
                  Directeur de la publication : le responsable éditorial du projet RDM Studio.
                  Hébergeur du site et de la documentation : l'héberge statique de l'édition, dont
                  les coordonnées sont publiées à la même date. Le logiciel lui-même, une fois
                  installé comme PWA, s'exécute intégralement sur votre poste et n'est plus hébergé
                  par qui que ce soit.
                </Trans>
              </p>
              <p>
                <Trans>
                  Signalement d'un contenu illicite : un courrier électronique de contact est publié
                  à l'ouverture de la boutique ; les demandes reçoivent une réponse dans un délai
                  raisonnable conformément à la LCEN.
                </Trans>
              </p>
            </div>
          </section>

          {/* CGU / CGV. */}
          <section id="cgu" className="scroll-mt-20">
            <h2 className="text-[18px] font-semibold leading-6 text-ink-primary">
              <Trans>Conditions Générales d'Utilisation & de Vente</Trans>
            </h2>
            <div className="mt-3 space-y-3 text-[14px] leading-6 text-ink-secondary">
              <p>
                <Trans>
                  Licence d'utilisation. L'édition Découverte est fournie gratuitement, pour un
                  usage professionnel ou pédagogique, sous les termes de la licence open source du
                  projet. L'édition Pro est concédée (non cédée) par clé RDM-PRO- : la clé d'essai
                  débloque les fonctions Pro sur un poste, la licence perpétuelle les débloque
                  durablement, l'abonnement mensuel tant qu'il est actif.
                </Trans>
              </p>
              <p>
                <Trans>
                  Vente. Les commandes d'abonnements ou de licences perpétuelles sont conclus
                  directement avec l'éditeur au moment de l'ouverture de la boutique ; le droit de
                  rétractation de 14 jours s'applique aux consommateurs pour tout contenu numérique
                  non encore activé, conformément aux articles L221-18 et suivants du Code de la
                  consommation. Les clés activées avant la rétractation donnent lieu à un
                  remboursement au prorata des fonctions déjà utilisées.
                </Trans>
              </p>
              <p>
                <Trans>
                  Disponibilité. Le service étant local-first, aucune disponibilité serveur n'est
                  requise pour calculer : les mises à jour, la documentation et le support sont les
                  seuls services en ligne. L'éditeur s'engage à publier chaque version avec son
                  journal de modifications et ses 41 benchmarks de validation.
                </Trans>
              </p>
            </div>
          </section>

          {/* RGPD — the zero-cloud stance IS the policy. */}
          <section id="rgpd" className="scroll-mt-20">
            <h2 className="text-[18px] font-semibold leading-6 text-ink-primary">
              <Trans>Politique de Confidentialité RGPD</Trans>
            </h2>
            <div className="mt-3 space-y-3 text-[14px] leading-6 text-ink-secondary">
              <p>
                <Trans>
                  Aucune donnée envoyée sur un serveur. Vos modèles, sections, charges, résultats et
                  notes de calcul sont traités et stockés exclusivement dans votre navigateur
                  (IndexedDB, localStorage). RDM Studio ne comporte aucun outil de mesure
                  télémétrique, aucun traceur tiers et aucun transfert vers un pays tiers : le
                  responsable de traitement de vos données d'ingénierie, c'est vous.
                </Trans>
              </p>
              <p>
                <Trans>
                  Données traitées localement : le projet courant (géométrie, profilés, charges,
                  résultats), vos préférences d'affichage (perspective, calques, accrochage —
                  conservées dans l'URL), votre préférence de langue et, si vous les saisissez, les
                  métadonnées de branding de la couverture de rapport. Effacer les données du
                  navigateur efface définitivement l'ensemble — aucune copie existe ailleurs.
                </Trans>
              </p>
              <p>
                <Trans>
                  Partage par URL : si vous utilisez le lien de partage, le modèle est compressé
                  dans l'URL elle-même. Ne transmettez ce lien qu'aux destinataires visés ; il ne
                  transite par aucun serveur de RDM Studio, mais il figure dans l'historique de
                  votre navigateur et celui de vos correspondants.
                </Trans>
              </p>
              <p>
                <Trans>
                  Vos droits (accès, rectification, effacement, portabilité) s'exercent directement
                  sur votre poste : export .rdm pour la portabilité, suppression du stockage local
                  pour l'effacement. Pour toute question relative à cette page, les coordonnées de
                  contact publiées aux mentions légales s'appliquent.
                </Trans>
              </p>
            </div>
          </section>

          {/* Engineer responsibility clause. */}
          <section id="responsabilite" className="scroll-mt-20">
            <h2 className="text-[18px] font-semibold leading-6 text-ink-primary">
              <Trans>Clause de Responsabilité Technique Ingénieur</Trans>
            </h2>
            <div className="mt-3 space-y-3 text-[14px] leading-6 text-ink-secondary">
              <p>
                <Trans>
                  RDM Studio est un outil d'aide au calcul : les hypothèses, le dimensionnement des
                  sections, les charges introduites et l'interprétation des résultats relèvent de la
                  responsabilité professionnelle de l'ingénieur qui signe la note de calcul. Le
                  logiciel reproduit les formules des normes citées, y compris leurs limites
                  d'application ; hors de ces limites (élancement excessif, assemblages non
                  modélisés, effets dynamiques non couverts), le résultat doit être invalidé par une
                  expertise.
                </Trans>
              </p>
              <p>
                <Trans>
                  Vérification croisée. Les 41 benchmarks analytiques embarqués vérifient le solveur
                  à chaque version, et chaque note de calcul porte l'empreinte SHA-256 du modèle
                  calculé. L'éditeur ne saurait être tenu responsable d'une utilisation hors du
                  périmètre normatif, de données d'entrée erronées ou de l'omission des
                  vérifications incombant au concepteur.
                </Trans>
              </p>
            </div>
          </section>

          <p className="font-data border-t border-hairline pt-4 text-[11px] text-ink-muted">
            <Trans>Dernière mise à jour : novembre 2026 — v2.1.0.</Trans>
          </p>
        </div>
      </div>
    </div>
  );
}
