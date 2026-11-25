import { useEffect } from "react";
import { driver, type Driver } from "driver.js";
import { useNavigate } from "@tanstack/react-router";
import "driver.js/dist/driver.css";
import "@/app-tour.css";

const TOUR_DONE_KEY = "rdm-tour-done";

/** Cross-route stage plan: each step navigates, waits for DOM, highlights. */
type Stage = {
  to: string;
  element: string;
  title: string;
  description: string;
};

const STAGES: Stage[] = [
  {
    to: "/geometry",
    element: "#rdm-logo",
    title: "Projets & Modèles paramétriques",
    description:
      "Ouvrez la galerie, chargez un modèle type ou importez une CAO .dxf / .step / .igs.",
  },
  {
    to: "/geometry",
    element: '[data-testid="viewport-canvas"]',
    title: "Scène 3D métrologique",
    description:
      "Orbite librement, basculez les vues Iso / XY / XZ / YZ et profitez de l'accrochage aimanté sur nœuds et milieux.",
  },
  {
    to: "/geometry",
    element: '[data-testid="inspector-sheet"]',
    title: "Bibliothèque normalisée EN 10365",
    description:
      "Recherche instantanée de profilés (IPE, HEA, CHS…), inerties Iy/Iz, relâchements et flambement ky/kz.",
  },
  {
    to: "/supports",
    element: '[data-testid="inspector-sheet"]',
    title: "Conditions aux limites RDM 7",
    description: "15 liaisons normalisées, matrice 6 DDL et contrôle d'isostaticité en temps réel.",
  },
  {
    to: "/loads",
    element: '[data-testid="inspector-sheet"]',
    title: "Actions & Combinaisons EN 1990",
    description:
      "Cas G / Q / W / Acc, scénarios d'accélération 1g et résultante globale en direct.",
  },
  {
    to: "/results",
    element: '[data-testid="kpi-strip"]',
    title: "Calcul 3D & Vérification Eurocode 3",
    description:
      "Déformée amplifiée, diagnostic de flambement/déversement, coupe 2D σvM et diagrammes synchronisés.",
  },
  {
    to: "/report",
    element: ".print-sheet",
    title: "Note de calcul A4 & Exports",
    description: "PDF vectoriel Takumi, CSV Excel, maquette 3D HTML autonome et empreinte SHA-256.",
  },
  {
    to: "/geometry",
    element: "#rdm-cmdk",
    title: "Productivité clavier ⌘K",
    description:
      "Palette de commandes contextuelle, ⌘Entrée pour calculer, ⌘P pour le rapport, Alt pour les raccourcis.",
  },
];

/**
 * Flagship 8-step onboarding (v1.4.0): a custom-styled `driver.js` tour
 * that navigates across all 5 routes. Auto-launches once (persisted),
 * skipping `?p=` deep links and webdriver sessions; re-launchable via
 * the header `?` button (`rdm-start-tour` event).
 */
export function OnboardingTour(): null {
  const navigate = useNavigate();

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
      index = 0;
      driverInstance = driver({
        popoverClass: "driver-popover-rdm",
        showProgress: true,
        allowClose: true,
        overlayOpacity: 0.55,
        nextBtnText: "Suivant",
        prevBtnText: "Précédent",
        doneBtnText: "Commencer",
        progressText: "{{current}} / 8",
        onDestroyed: () => {
          localStorage.setItem(TOUR_DONE_KEY, "1");
        },
        steps: STAGES.map((stage) => ({
          element: stage.element,
          popover: {
            title: stage.title,
            description: stage.description,
            onNextClick: () => {
              index += 1;
              const next = STAGES[index];
              if (next === undefined) {
                driverInstance?.destroy();
                return;
              }
              go(next, () => driverInstance?.moveNext());
            },
            onPrevClick: () => {
              index = Math.max(0, index - 1);
              go(STAGES[index] ?? stage, () => driverInstance?.movePrevious());
            },
          },
        })),
      });
      // Ensure the first stage's DOM is mounted before highlighting.
      go(STAGES[0] ?? { to: "/geometry", element: "#rdm-logo", title: "", description: "" }, () => {
        if (!cancelled) {
          driverInstance?.drive();
        }
      });
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
