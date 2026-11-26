import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { activateLocale, initialLocale } from "@/i18n/i18n";
import { router } from "./router";
import "./app.css";

const root = document.getElementById("root");
if (root === null) {
  throw new Error("missing #root mount point");
}

// v2.1.0: the legacy `main.tsx` deep-link hydration moved into
// `_studio.tsx`'s `beforeLoad` — `?p=` / `?template=` are now validated by
// the Valibot search schema, hydrated BEFORE the first studio render and
// stripped from the URL, so every entry path (`/geometry?p=…`,
// `/results?template=warren`, a PWA launchQueue file) behaves identically.

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
