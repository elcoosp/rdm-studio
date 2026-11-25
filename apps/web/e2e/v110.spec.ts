import { expect, test } from "@playwright/test";

/**
 * v1.1.0 verification (task §5): mounts, presets, distributed loads and the
 * Step 4 KPI / selector / docked-inspector workspaces.
 */

test("supports mounts the 3D viewport and applies RDM 7 presets", async ({ page }) => {
  await page.goto("/supports");
  await expect(page.getByTestId("viewport-canvas")).toBeVisible();
  // Preset buttons exist for the four RDM 7 patterns.
  await expect(page.getByTestId("preset-encastrement")).toBeVisible();
  await expect(page.getByTestId("preset-rotule")).toBeVisible();
  await expect(page.getByTestId("preset-appui-simple-z")).toBeVisible();
  await expect(page.getByTestId("preset-glissiere")).toBeVisible();
  // The demo project starts isostatic: 2 supports x 3 locked DOFs = 6.
  await expect(page.getByTestId("kinematic-status")).toContainText(/Isostatique|Hyperstatique/);
  // Toggling any DOF flips the kinematic degree (6 is isostatic).
  const unchecked = page
    .locator('table tbody input[aria-checked="false"], table tbody input:not(:checked)')
    .first();
  const anyUnchecked = (await unchecked.count()) > 0 ? await unchecked.isVisible() : false;
  if (anyUnchecked) {
    await unchecked.check();
  } else {
    await page.locator("table tbody input").first().uncheck();
  }
  await expect(page.getByTestId("kinematic-status")).toContainText(/Hyperstatique|Hypostatique/);
});

test("loads mounts the viewport, distributed beam loads and resultants", async ({ page }) => {
  await page.goto("/loads");
  await expect(page.getByTestId("viewport-canvas")).toBeVisible();
  // Load-type tabs: nodal / uniform / trapezoidal / point-on-span.
  await expect(page.getByRole("button", { name: "Uniforme" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Trapézoïdale" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Ponctuelle \(a\/L\)/ })).toBeVisible();
  // G | Q | W | Acc case tabs are present.
  await expect(page.getByTestId("case-tabs")).toContainText("G");
  await expect(page.getByTestId("case-tabs")).toContainText("Acc");
  // Add a uniform load on the first member: the loads table gains a row
  // (v1.3.0 3-axis form defaults qz = -10 kN/m → magnitude 10).
  await page.getByRole("button", { name: "Uniforme" }).click();
  await page.getByRole("button", { name: "Ajouter la charge" }).click();
  await expect(page.getByRole("cell", { name: "10.00 → 10.00 kN/m" })).toBeVisible();
  // Live resultant summary renders ΣFz (rolling digits container).
  await expect(page.getByTestId("resultant-summary")).toContainText("ΣFz");
  // Primary cobalt CTA navigates to Step 4.
  await page.getByTestId("cta-solve").click();
  await expect(page).toHaveURL(/\/results/);
});

test("results renders the 4 KPI cards, mode selector and docked inspector", async ({ page }) => {
  await page.goto("/results");
  await expect(page.getByTestId("kpi-strip")).toBeVisible();
  await expect(page.getByTestId("kpi-mass")).toBeVisible();
  await expect(page.getByTestId("kpi-deflection")).toBeVisible();
  await expect(page.getByTestId("kpi-utilization")).toBeVisible();
  await expect(page.getByTestId("kpi-modal")).toBeVisible();
  // Combination / eigenmode selector with the modal play toggle.
  await expect(page.getByTestId("view-selector")).toBeVisible();
  await page.getByText("Mode 1 (", { exact: false }).click();
  await expect(page.getByTestId("modal-play")).toBeVisible();
  // Docked inspector: heatmap, synchronized cursor and forces plot.
  await expect(page.getByTestId("docked-inspector")).toBeVisible();
  await expect(page.getByTestId("forces-plot")).toBeVisible();
  await expect(page.getByTestId("uplot-cursor")).toBeVisible();
});
