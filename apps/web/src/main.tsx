import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { activateLocale, initialLocale } from "@/i18n/i18n";
import { parseProject } from "@/lib/urlShare";
import { useProjectStore } from "@/state/projectStore";
import { routeTree } from "./routeTree.gen";
import "./app.css";

const router = createRouter({ routeTree });

const root = document.getElementById("root");
if (root === null) {
  throw new Error("missing #root mount point");
}

// v1.0.0 bug 4: deep links hydrate the shared model BEFORE the first
// render — `/report?p=...` restores arbitrary non-demo projects on load.
{
  const params = new URLSearchParams(window.location.search);
  const payload = params.get("p");
  if (payload !== null && payload.length > 0) {
    const parsed = parseProject(payload);
    if (parsed.ok) {
      const input = parsed.project as never;
      useProjectStore.getState().loadProject(input);
    } else {
      console.warn("deep link rejected:", parsed.error);
    }
  }
}

// Activate the persisted locale BEFORE the first render so the stepper and
// page headings come up translated (no flash of source strings).
void activateLocale(initialLocale()).finally(() => {
  createRoot(root).render(
    <StrictMode>
      <I18nProvider i18n={i18n}>
        <RouterProvider router={router} />
      </I18nProvider>
    </StrictMode>,
  );
});
