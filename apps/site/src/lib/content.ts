/**
 * Shared landing copy (v2.2.0) — the v2.1.2 FAQ literals, kept in one
 * module so the FAQPage JSON-LD (`index/page.server.ts`) and the
 * FaqAccordion island render the exact same strings. Localized at render
 * time via `i18n._` (explicit IDs): the active locale is set by
 * `RootLayout` (or by the loader, for the JSON-LD) before this runs.
 */
import { i18n } from "@lingui/core";
import type { FaqItem } from "../islands/faq-accordion";

export function buildFaq(): FaqItem[] {
  return [
    {
      q: i18n._({ id: "site.faq.offline.q", message: "RDM Studio fonctionne-t-il vraiment hors-ligne ?" }),
      topic: i18n._({ id: "site.faq.offline.topic", message: "Hors-ligne" }),
      a: i18n._({
        id: "site.faq.offline.a",
        message:
          "Oui. L'application est une PWA : le solveur Rust compilé en WASM, les catalogues de profilés et les polices d'impression sont mis en cache par le service worker. Une fois chargée, elle démarre et calcule sans aucune connexion — en bureau, en atelier comme sur site.",
      }),
    },
    {
      q: i18n._({ id: "site.faq.storage.q", message: "Où sont stockés mes projets ?" }),
      topic: i18n._({ id: "site.faq.storage.topic", message: "Stockage" }),
      a: i18n._({
        id: "site.faq.storage.a",
        message:
          "Dans IndexedDB, sur votre poste uniquement. Aucune base de données distante, aucun compte obligatoire. Le partage se fait par une URL contenant le modèle compressé (lz-string) revalidé par Valibot à la relecture, ou par fichier .rdm.",
      }),
    },
    {
      q: i18n._({ id: "site.faq.standards.q", message: "Quelles normes sont couvertes ?" }),
      topic: i18n._({ id: "site.faq.standards.topic", message: "Normes" }),
      a: i18n._({
        id: "site.faq.standards.a",
        message:
          "EN 1990 (combinaisons), EN 1991 (actions), EN 1993-1-1 (acier, vérifications 6.61/6.62 + C1), EN 1992 / 1995 / 1998 / 1999 pour béton, bois, alu et mixte. Les 41 benchmarks analytiques intégrés vérifient le solveur à chaque mise à jour.",
      }),
    },
    {
      q: i18n._({ id: "site.faq.free.q", message: "RDM Studio est-il vraiment gratuit, sans limite ?" }),
      topic: i18n._({ id: "site.faq.free.topic", message: "Gratuit" }),
      a: i18n._({
        id: "site.faq.free.a",
        message:
          "Oui. L'édition Open Source est complète et gratuite à vie : solveur, Eurocodes, modèles et exports — aucun compte, aucun bridage, aucune donnée envoyée sur un serveur. Le projet est financé par le sponsoring des bureaux d'études (GitHub Sponsors) et par les prestations B2B / intranet fermé sur demande (déploiement sans internet, gabarits sur mesure, support ingénieur dédié).",
      }),
    },
    {
      q: i18n._({ id: "site.faq.import.q", message: "Puis-je importer mes plans DXF ou STEP ?" }),
      topic: i18n._({ id: "site.faq.import.topic", message: "Import" }),
      a: i18n._({
        id: "site.faq.import.a",
        message:
          "Oui — glissez-déposez un .dxf, .step ou .igs dans l’atelier : la géométrie filaire devient nœuds et poutres, prête à être profilée et chargée. L’export .rdm est canonique et réimportable à l’identique.",
      }),
    },
    {
      q: i18n._({ id: "site.faq.legacy.q", message: "À quoi sert le Pass Projet 48 h ?" }),
      topic: i18n._({ id: "site.faq.legacy.topic", message: "Ancien produit" }),
      a: i18n._({
        id: "site.faq.legacy.a",
        message:
          "Ce produit n’existe plus : l’édition Open Source couvre déjà tous les besoins, 100 % gratuitement. Pour un déploiement intranet fermé ou des vérifications métiers sur mesure (EN 13155, DNV-ST-N001), contactez-nous via la page de contact du projet.",
      }),
    },
  ];
}
