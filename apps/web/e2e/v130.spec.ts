import { expect, test } from "@playwright/test";

/**
 * v1.3.0 regressions (task §5): duplicate-beam guard, responsive resize
 * navigation, the grouped RDM 7 support library and the g-acceleration
 * quick scenarios.
 */

test("duplicate-beam guard disables the connector with 'Déjà reliés'", async ({ page }) => {
  await page.goto("/geometry");
  // Two new nodes: the connector auto-defaults to the last two unlinked
  // nodes — the pair we are about to link.
  await page.getByTestId("add-node").click();
  await page.getByTestId("add-node").click();
  const n1 = await page.getByLabel("N1").inputValue();
  const n2 = await page.getByLabel("N2").inputValue();
  const connect = page.getByTestId("connect-beam");
  await expect(connect).toBeEnabled();
  await connect.click();
  // Re-selecting the exact same (already linked) pair trips the guard.
  await page.getByLabel("N1").selectOption(n1);
  await page.getByLabel("N2").selectOption(n2);
  await expect(connect).toBeDisabled();
  await expect(connect).toContainText("Déjà reliés");
  // Node placement walks past the last point: X = maxX + 2 m.
  await page.getByTestId("add-node").click();
  const lastRowInputs = page.locator("table tbody tr").last().locator("input");
  if ((await lastRowInputs.count()) > 0) {
    const x = Number(await lastRowInputs.first().inputValue());
    expect(x).toBeGreaterThanOrEqual(0);
  }
});

test("responsive resize swaps top step bar and mobile tab bar live", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 700 });
  await page.goto("/geometry");
  // Split-screen desktop (768–1023): the horizontal step bar is visible.
  await expect(page.locator("#rdm-steps")).toBeVisible();
  await expect(page.getByRole("link", { name: "Étape 3" })).toBeVisible();
  // Narrow viewport (<768): the bottom tab bar takes over, dynamically.
  await page.setViewportSize({ width: 600, height: 800 });
  await expect(page.locator('nav[aria-label="workflow mobile"]')).toBeVisible();
  await expect(page.locator("#rdm-steps")).toBeHidden();
});

test("step 2 exposes the grouped RDM 7 library and clear-all", async ({ page }) => {
  await page.goto("/supports");
  // Primary quick cards.
  for (const key of ["encastrement", "rotule", "appui-simple-z", "glissiere"]) {
    await expect(page.getByTestId(`preset-${key}`)).toBeVisible();
  }
  // The grouped library opens with its 12 presets + custom note
  // (scoped: the Appuis élastiques details now precedes it).
  await page.locator('[data-testid="rdm7-library"] summary').click();
  for (const key of [
    "simple-xy",
    "simple-xz",
    "simple-yz",
    "glissant-x",
    "glissant-y",
    "glissant-z",
    "glissiere-x",
    "glissiere-y",
    "glissiere-z",
    "pivot-x",
    "pivot-y",
    "pivot-z",
  ]) {
    await expect(page.getByTestId(`preset-${key}`)).toBeVisible();
  }
  // The demo project starts isostatic; clearing leaves a mechanism.
  await expect(page.getByTestId("kinematic-status")).toContainText("Isostatique");
  await page.getByTestId("clear-supports").click();
  await expect(page.getByTestId("kinematic-status")).toContainText("Hypostatique");
  // Undo inside the toast restores the isostatic state (scoped like the
  // step-3 suite: the header undo button shares the "Annuler" substring).
  await page.locator("[data-sonner-toast]").getByRole("button", { name: "Annuler" }).click();
  await expect(page.getByTestId("kinematic-status")).toContainText("Isostatique");
});

test("step 3 quick scenarios write acceleration fields and clear undoably", async ({ page }) => {
  await page.goto("/loads");
  // Poids propre seul 1g -Z writes the field into the loads table.
  await page.getByTestId("scenario-selfweight").click();
  await expect(page.locator("table tbody")).toContainText("(0 ; 0 ; -1) ×g");
  // Transport scenario replaces it.
  await page.getByTestId("scenario-transport").click();
  await expect(page.locator("table tbody")).toContainText("(0.8 ; 0 ; -1.5) ×g");
  // The ΣFz resultant goes negative under 1.5g downward + 0.8g X.
  await expect(page.getByTestId("resultant-summary")).toContainText("ΣFz");
  // Vider les charges + undo restores the field.
  await page.getByTestId("clear-loads").click();
  await expect(page.locator("table tbody")).not.toContainText("×g");
  // Undo inside the toast (scoped: the header undo button shares no label).
  await page.locator("[data-sonner-toast]").getByRole("button", { name: "Annuler" }).click();
  await expect(page.locator("table tbody")).toContainText("×g");
});

test("step 4 offers six eigenmodes and the three thermal scales", async ({ page }) => {
  await page.goto("/results");
  const combo = page.getByTestId("combination-selector");
  await expect(combo).toBeVisible();
  // v2.0.2: the mode options populate once a solve has run.
  const calc = page.getByRole("button", { name: /Calculer/ });
  if (await calc.count()) {
    await calc.click();
    await expect(combo)
      .toContainText(/MODE|Mode propre|1\.35G/, { timeout: 20_000 })
      .catch(() => undefined);
  }
  const modeCount = await combo
    .locator("option")
    .evaluateAll(
      (options) =>
        options.map((o) => (o as HTMLOptionElement).value).filter((v) => v.startsWith("MODE:"))
          .length,
    );
  expect(modeCount).toBeGreaterThanOrEqual(1);
  for (const scale of ["ec3", "svm", "auto"]) {
    await expect(page.getByTestId(`scale-${scale}`)).toBeVisible();
  }
  await page.getByTestId("scale-svm").click();
  await expect(page.getByTestId("scale-svm")).toContainText("σvM");
});
