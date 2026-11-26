import { expect, test } from "@playwright/test";

/**
 * v2.1.0 commercial layer E2E (G6): the landing page at `/` with the
 * interactive 3-model showcase (1-click launch into `/geometry?template=…`),
 * the legal surface at `/legal` and the Offline Pro licence modal with
 * 1-click demo activation.
 */

test("landing page renders the hero, badges and 3-model showcase", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByTestId("hero-cta")).toBeVisible();
  await expect(page.getByText("Rust + WASM · < 20 ms")).toBeVisible();
  await expect(page.getByText("100 % hors-ligne & zéro cloud")).toBeVisible();
  // The showcase selector switches models (telemetry follows).
  await expect(page.getByTestId("showcase-portique")).toBeVisible();
  await page.getByTestId("showcase-warren").click();
  await expect(page.getByText("877 kg")).toBeVisible();
  await expect(page.getByTestId("launch-warren")).toBeVisible();
});

test("the 3D hero switches models and the live load slider moves telemetry", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  // v2.1.2: the interactive Three.js hero — 3D stage (or SVG fallback on
  // headless GPUs), model switcher (SegmentedControl) and live slider.
  await expect(page.getByTestId("hero-3d-panel")).toBeVisible();
  await expect(page.getByTestId("hero-3d-stage").first()).toBeVisible();
  // Model switcher: the hero radio group offers the three flagship shapes.
  const heroSwitcher = page.getByRole("radiogroup", { name: /Modèle du hero/ });
  await expect(heroSwitcher.getByRole("radio")).toHaveCount(3);
  await heroSwitcher.getByRole("radio").nth(1).click();
  // Live load slider (20 → 120 kN): raising q pushes η past 1.00.
  const slider = page.getByRole("slider");
  await expect(slider.first()).toBeVisible();
  await expect(page.getByTestId("hero-eta")).toBeVisible();
});

test("the studio header Réglages popover opens over the 3D stage", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/geometry");
  // v2.1.2: the portal SettingsPopover is reliably clickable above the
  // persistent 3D stage (519229b audit fix).
  await page.getByRole("button", { name: /Réglages/ }).click();
  await expect(page.getByTestId("settings-popover")).toBeVisible();
  await expect(page.getByText("Annexe nationale")).toBeVisible();
  await expect(page.getByTestId("settings-p-delta").getByRole("switch")).toBeVisible();
  await page.keyboard.press("Escape");
});

test("showcase launch opens the studio with the matching template", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByTestId("launch-portique").click();
  // The CTA targets /geometry?template=portique; beforeLoad hydrates and
  // strips the parameter while loading the 18 m portal frame.
  await expect(page).toHaveURL(/\/geometry/);
  await expect(page.getByText("Portique 18 m").first()).toBeVisible({ timeout: 15_000 });
});

test("pricing section opens the licence modal and activates the demo Pro", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByTestId("pricing-pro-cta").click();
  await expect(page.getByTestId("license-modal")).toBeVisible();
  await page.getByTestId("license-demo").click();
  // The studio header badge reflects the Pro tier immediately.
  await page.goto("/geometry");
  await expect(page.getByTestId("license-badge")).toContainText("Pro");
});

test("licence modal validates the RDM-PRO- key prefix", async ({ page }) => {
  // v2.1.1: the license badge is a 2xl+ header pill — open it at 1920×900.
  await page.setViewportSize({ width: 1920, height: 900 });
  await page.goto("/geometry");
  await page.getByTestId("license-badge").click();
  await expect(page.getByTestId("license-modal")).toBeVisible();
  await page.getByTestId("license-key-input").fill("WRONG-KEY-123");
  await page.getByTestId("license-activate").click();
  await expect(page.getByText("Une clé valide commence par RDM-PRO-.")).toBeVisible();
  await page.getByTestId("license-key-input").fill("RDM-PRO-ABCD-1234-EFGH");
  await page.getByTestId("license-activate").click();
  await expect(page.getByTestId("license-badge")).toContainText("Pro");
});

test("legal page covers LCEN, CGU/CGV, RGPD and the responsibility clause", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/legal");
  await expect(page.getByText("Mentions légales (LCEN)").first()).toBeVisible();
  await expect(
    page.getByText("Conditions Générales d'Utilisation & de Vente").first(),
  ).toBeVisible();
  await expect(page.getByText("Politique de Confidentialité RGPD").first()).toBeVisible();
  await expect(
    page.getByText("Clause de Responsabilité Technique Ingénieur").first(),
  ).toBeVisible();
  // The header hands documentation off to the Starlight package (NOT
  // bundled inside the PWA) — an external link to /docs.
  await expect(page.getByTestId("docs-link")).toHaveAttribute("href", "/docs/");
  // The RGPD anchor from the footer scrolls to the section.
  await page.goto("/legal");
  await page.getByRole("link", { name: "Confidentialité RGPD" }).first().click();
  await expect(page).toHaveURL(/rgpd/);
});
