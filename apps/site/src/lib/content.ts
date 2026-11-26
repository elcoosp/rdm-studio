/**
 * Shared landing copy (v2.2.0) — the v2.1.2 FAQ literals, kept in one
 * module so the FAQPage JSON-LD (`index/page.server.ts`) and the
 * FaqAccordion island render the exact same strings.
 */
import type { FaqItem } from "../islands/faq-accordion";

export function buildFaq(): FaqItem[] {
  return [
    {
      q: "RDM Studio fonctionne-t-il vraiment hors-ligne ?",
      a: "Oui. L'application est une PWA : le solveur Rust compilé en WASM, les catalogues de profilés et les polices d'impression sont mis en cache par le service worker. Une fois chargée, elle démarre et calcule sans aucune connexion — en bureau, en atelier comme sur site.",
    },
    {
      q: "Où sont stockés mes projets ?",
      a: "Dans IndexedDB, sur votre poste uniquement. Aucune base de données distante, aucun compte obligatoire. Le partage se fait par une URL contenant le modèle compressé (lz-string) revalidé par Valibot à la relecture, ou par fichier .rdm.",
    },
    {
      q: "Quelles normes sont couvertes ?",
      a: "EN 1990 (combinaisons), EN 1991 (actions), EN 1993-1-1 (acier, vérifications 6.61/6.62 + C1), EN 1992 / 1995 / 1998 / 1999 pour béton, bois, alu et mixte. Les 41 benchmarks analytiques intégrés vérifient le solveur à chaque mise à jour.",
    },
    {
      q: "La licence Pro expire-t-elle hors-ligne ?",
      a: "Non. La clé RDM-PRO- est vérifiée localement : une licence perpétuelle reste active sans connexion. L'édition Pro ajoute le branding du bureau d'études sur les notes de calcul, le multi-matériaux étendu et le BIM IFC4 / SAF.",
    },
    {
      q: "Puis-je importer mes plans DXF ou STEP ?",
      a: "Oui — glissez-déposez un .dxf, .step ou .igs dans l'atelier : la géométrie filaire devient nœuds et poutres, prête à être profilée et chargée. L'export .rdm est canonique et réimportable à l'identique.",
    },
    {
      q: "À quoi sert le Pass Projet 48 h ?",
      a: "C'est une journée de plein droit pour un besoin ponctuel : toutes les fonctions Pro (branding, multi-matériaux, BIM, exports) actives 48 h sur votre poste, sans abonnement ni compte. Idéal pour livrer une note de calcul signée ce week-end.",
    },
  ];
}
