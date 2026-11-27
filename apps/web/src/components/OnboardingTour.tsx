import { useEffect } from "react";
import { driver, type Driver } from "driver.js";
import { useLingui } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useNavigate } from "@tanstack/react-router";
import "driver.js/dist/driver.css";
import "@/app-tour.css";
import { trackProductEvent } from "@/lib/productTelemetry";

const TOUR_DONE_KEY = "rdm-tour-done";

/**
 * Flagship bilingual illustrated 9-step onboarding (v2.1.2): a
 * custom-styled `driver.js` tour that navigates across all 5 studio
 * routes. EVERY popover card embeds its Stitch illustration
 * (`/illustrations/*.png`), all copy and navigation controls
 * (Suivant / Next, Précédent / Back, Terminer / Finish) come from the
 * Lingui `t` macros through the SUBSCRIBING `useLingui()` hook so the
 * FR ↔ EN header switch re-renders the tour seamlessly, and a dedicated
 * stage covers the Normative Settings (EN 1990 6.10 / 6.10a-b, P-Δ,
 * Annexe FR) & the 41-Benchmark Validation Suite. Auto-launches once
 * (persisted), skipping `?p=` deep links and webdriver sessions;
 * re-launchable via the header `?` button (`rdm-start-tour` event).
 */

/** Cross-route stage plan: each step navigates, waits for DOM, highlights. */
type Stage = {
  to: string;
  element: string;
  illustration: string;
  title: string;
  description: string;
};

function buildStages(): Stage[] {
  return [
    {
      to: "/geometry",
      element: '#rdm-logo ~ button, button[aria-label="Galerie de projets"]',
      illustration: "/illustrations/tour-cad-import.png",
      title: t`Projets & Modèles paramétriques`,
      description: t`Ouvrez la galerie, chargez un modèle type ou importez une CAO .dxf / .step / .igs — le titre du projet est éditable en place (Entrée pour enregistrer).`,
    },
    {
      to: "/geometry",
      element: '[data-testid="viewport-canvas"]',
      illustration: "/illustrations/tour-viewport-snap.png",
      title: t`Scène 3D métrologique`,
      description: t`Orbite librement, basculez les vues Iso / XY / XZ / YZ, profitez de l'accrochage aimanté sur nœuds et milieux — et clic droit sur une poutre pour le menu contextuel.`,
    },
    {
      to: "/geometry",
      element: '[data-testid="inspector-sheet"]',
      illustration: "/illustrations/bento-multimaterial.png",
      title: t`Bibliothèque normalisée EN 10365`,
      description: t`Recherche instantanée de profilés (IPE, HEA, CHS…), inerties Iy/Iz, relâchements et flambement ky/kz — chaque ligne affiche sa masse kg/m et sa hauteur h.`,
    },
    {
      to: "/supports",
      element: '[data-testid="inspector-sheet"]',
      illustration: "/illustrations/tour-supports-rdm7.png",
      title: t`Conditions aux limites RDM 7`,
      description: t`15 liaisons normalisées, matrice 6 DDL et contrôle d'isostaticité en temps réel — appuis élastiques kx..krz inclus.`,
    },
    {
      to: "/loads",
      element: '[data-testid="inspector-sheet"]',
      illustration: "/illustrations/tour-loads-en1990.png",
      title: t`Actions & Combinaisons EN 1990`,
      description: t`Cas G / Q / W / S / Acc, générateurs EN 1991 (imposée, neige, vent, ΔT) et résultante globale en direct.`,
    },
    {
      to: "/results",
      element: '[data-testid="kpi-strip"]',
      illustration: "/illustrations/tour-results-sectioncut.png",
      title: t`Calcul 3D & Vérification Eurocode 3`,
      description: t`Déformée amplifiée, diagnostic de flambement/déversement, coupe 2D σvM, curseur x ∈ [0, L] à crans aimantés et diagrammes synchronisés.`,
    },
    {
      to: "/results",
      element: '[aria-label="Réglages"]',
      illustration: "/illustrations/tour-settings-benchmarks.png",
      title: t`Réglages normatifs & 41 benchmarks`,
      description: t`Annexe nationale (FR / BE / DE / UK / EN), méthode EN 1990 6.10 ou 6.10a/b, cisaillement Timoshenko, P-Δ second ordre — et la suite de validation 41 / 41 benchmarks analytiques vérifie le solveur.`,
    },
    {
      to: "/report",
      element: ".print-sheet",
      illustration: "/illustrations/bento-report-bim.png",
      title: t`Note de calcul A4 & Exports`,
      description: t`PDF vectoriel Takumi, .docx structuré, CSV Excel, maquette 3D HTML autonome, BIM IFC4 / SAF et empreinte SHA-256.`,
    },
    {
      to: "/geometry",
      element: "#rdm-cmdk",
      illustration: "/illustrations/bento-solver-pdelta.png",
      title: t`Productivité clavier ⌘K`,
      description: t`Palette de commandes contextuelle, ⌘Entrée pour calculer, ⌘P pour le rapport, Alt pour les raccourcis — tout tourne en moins de 20 ms, hors-ligne.`,
    },
  ];
}

export function OnboardingTour(): null {
  const navigate = useNavigate();
  // Subscribing useLingui(): the stage list is rebuilt with the ACTIVE
  // locale every render — switching FR ↔ EN re-creates the tour copy.
  const { i18n } = useLingui();
  void i18n.locale;

  useEffect(() => {
    let driverInstance: Driver | null = null;
    let index = 0;
    let cancelled = false;

    const go = (stage: Stage, done: () => void) => {
      const pathname = window.location.pathname;
      if (pathname !== stage.to) {
        void navigate({ to: stage.to });
        window.setTimeout(done, 150);
      } else {
        done();
      }
    };

    const start = () => {
      const stages = buildStages();
      index = 0;
      void trackProductEvent("tour_started");
      driverInstance = driver({
        popoverClass: "driver-popover-rdm",
        showProgress: true,
        allowClose: true,
        overlayOpacity: 0.55,
        nextBtnText: t`Suivant`,
        prevBtnText: t`Précédent`,
        doneBtnText: t`Terminer`,
        progressText: "{{current}} / 9",
        onDestroyed: () => {
          localStorage.setItem(TOUR_DONE_KEY, "1");
          if (index >= stages.length - 1) {
            void trackProductEvent("tour_completed");
          } else {
            void trackProductEvent("tour_skipped");
          }
        },
        steps: stages.map((stage) => ({
          element: stage.element,
          popover: {
            title: `${stage.title}`,
            description: `<img src="${stage.illustration}" alt="" class="rdm-tour-illustration" />${stage.description}`,
            onNextClick: () => {
              index += 1;
              const next = stages[index];
              if (next === undefined) {
                driverInstance?.destroy();
                return;
              }
              go(next, () => driverInstance?.moveNext());
            },
            onPrevClick: () => {
              index = Math.max(0, index - 1);
              go(stages[index] ?? stage, () => driverInstance?.movePrevious());
            },
          },
        })),
      });
      // Ensure the first stage's DOM is mounted before highlighting.
      const first = stages[0];
      if (first !== undefined) {
        go(first, () => {
          if (!cancelled) {
            driverInstance?.drive();
          }
        });
      }
    };

    const shouldAutoStart = (): boolean => {
      if (localStorage.getItem(TOUR_DONE_KEY) === "1") {
        return false;
      }
      // Deep links (shared projects) and E2E sessions skip the tour.
      if (window.location.search.includes("?p=")) {
        return false;
      }
      if (navigator.webdriver === true) {
        return false;
      }
      return true;
    };

    const onStartEvent = () => start();
    window.addEventListener("rdm-start-tour", onStartEvent);
    if (shouldAutoStart()) {
      // Let the first paint settle before the stage highlight.
      window.setTimeout(() => {
        if (!cancelled) {
          start();
        }
      }, 400);
    }
    return () => {
      cancelled = true;
      window.removeEventListener("rdm-start-tour", onStartEvent);
      driverInstance?.destroy();
    };
  }, [navigate]);

  return null;
}
