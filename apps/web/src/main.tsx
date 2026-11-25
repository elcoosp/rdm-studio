import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { activateLocale, initialLocale } from "@/i18n/i18n";
import { routeTree } from "./routeTree.gen";
import "./app.css";

const router = createRouter({ routeTree });

const root = document.getElementById("root");
if (root === null) {
  throw new Error("missing #root mount point");
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
