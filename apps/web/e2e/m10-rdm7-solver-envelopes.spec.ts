import { expect, test, type Page } from "@playwright/test";

/**
 * M10 — RDM7 solver contracts (Session 2/3 follow-up): elastic springs,
 * imposed settlements, tension-only axial behaviour, the 49/49
 * analytical benchmark certificate (RDM6/RDM7 filter) and the EN 1990
 * Min/Max envelope views. Runs on chromium + firefox.
 */

/** Expands an ExpandablePanel contract block (`data-open` attribute). */
async function expandPanel(page: Page, testId: string): Promise<void> {
  const panel = page.getByTestId(testId);
  const trigger = panel.locator("button[aria-expanded]").first();
  if ((await trigger.getAttribute("aria-expanded")) !== "true") {
    await trigger.click();
  }
  await expect(panel).toHaveAttribute("data-open", "true");
}

test("elastic spring support: kz preset reaches the support row", async ({ page }) => {
  await page.goto("/supports?node=1");
  await expect(page.getByTestId("spring-section")).toBeVisible();
  await expandPanel(page, "elastic-springs-panel");
  // 1-click preset seeds kz = 1000 kN/m, then the explicit apply commits it.
  await page.getByTestId("preset-elastic").click();
  await page.getByTestId("apply-springs-1").click();
  await expect(page.getByTestId("support-row-1")).toBeVisible();
});

test("imposed settlement applies on the locked DOFs (Δ badge)", async ({ page }) => {
  await page.goto("/supports?node=1");
  await expect(page.getByTestId("settlement-section")).toBeVisible();
  await expandPanel(page, "support-settlement-panel");
  // Node 1 locks Ux / Uz / Ry in the demo model: Δuz is editable.
  const uzField = page.getByTestId("settlement-fields-1").locator("label").nth(2).locator("input");
  await expect(uzField).toBeEditable();
  await uzField.fill("5");
  await page.getByTestId("apply-settlement-1").click();
  await expect(page.getByTestId("settlement-badge-1")).toBeVisible();
});

test("tension-only / compression-only axial behaviour toggle", async ({ page }) => {
  await page.goto("/geometry?beam=1");
  const control = page.getByTestId("beam-axial-behavior");
  await expect(control).toBeVisible();
  // SegmentedControl exposes overlaid role=radio buttons (aria-checked).
  await control.getByRole("radio", { name: "Tirant" }).click();
  await expect(control.getByRole("radio", { name: "Tirant" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  // Back to the standard frame element: the model still solves.
  await control.getByRole("radio", { name: "Standard" }).click();
  await expect(control.getByRole("radio", { name: "Standard" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.goto("/results");
  await expect(page.getByTestId("combination-selector")).toBeVisible();
});

test("validation certificate shows 49/49 with the RDM6/RDM7 filter pill", async ({ page }) => {
  await page.goto("/results");
  await expect(page.getByTestId("combination-selector")).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("rdm-open-validation")));
  const modal = page.getByTestId("validation-modal");
  await expect(modal).toBeVisible();
  // The 8 Debard RDM6/RDM7 closed-form benchmarks join the 41 legacy ones.
  await expect(modal.getByText("49/49")).toBeVisible();
  await modal.getByTestId("filter-rdm6").click();
  await expect(modal.getByText("8 / 49")).toBeVisible();
  await expect(modal.getByText("RDM6 / RDM7 (Debard)")).toBeVisible();
});

test("EN 1990 Min/Max envelope view renders the callout overlays", async ({ page }) => {
  await page.goto("/results");
  const selector = page.getByTestId("combination-selector");
  await expect(selector).toBeVisible();
  await selector.click();
  await page.getByText("Enveloppe ELU (Min/Max)").click();
  // Floating extremum pills pin the members under the envelope view.
  await expect(page.locator('[data-testid^="envelope-callout-"]').first()).toBeVisible();
});

test("load-case manager adds an elementary case and generates combinations", async ({ page }) => {
  await page.goto("/loads");
  await expect(page.getByTestId("load-case-manager")).toBeVisible();
  await expandPanel(page, "load-case-manager-panel");
  await page.getByTestId("add-load-case").click();
  // The default new-case code is Q2 (EN 1990 Annex A1 ψ presets).
  await expect(page.getByTestId("load-case-manager")).toContainText("Q2");
  await page.getByTestId("generate-combinations").click();
  await expect(page.getByTestId("load-case-manager")).toContainText("1.35G + 1.50Q");
});

test("beam-theory toggle switches Timoshenko / Bernoulli", async ({ page }) => {
  await page.goto("/results");
  await page.evaluate(() => window.dispatchEvent(new Event("rdm-open-settings")));
  const toggle = page.getByTestId("shear-deformation-toggle");
  await expect(toggle).toBeVisible();
  await toggle.getByRole("radio", { name: "Bernoulli" }).click();
  await expect(toggle.getByRole("radio", { name: "Bernoulli" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await toggle.getByRole("radio", { name: "Timoshenko" }).click();
  await expect(toggle.getByRole("radio", { name: "Timoshenko" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
});
