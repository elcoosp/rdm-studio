import { expect, test } from "@playwright/test";

/**
 * E2E of the 5-step workflow with the real WASM solver in the worker
 * (G6): navigation via the type-safe stepper, real calculation, results.
 */
test("5-step workflow runs a real FE calculation", async ({ page }) => {
  await page.goto("/geometry");
  await expect(page.getByRole("link", { name: /RDM Studio/ })).toBeVisible();

  // The demo project ships 3 nodes / 2 beams.
  await expect(page.getByRole("heading", { name: "Nœuds" })).toBeVisible();

  // Step navigation via <Link> (compile-time checked routes).
  await page.getByRole("link", { name: /Étape 4/ }).click();
  await expect(page).toHaveURL(/\/results/);
  await expect(page.getByRole("button", { name: /Calculer/ })).toBeVisible();

  // Run the calculation in the worker and wait for ULS/SLS results.
  await page.getByRole("button", { name: /Calculer/ }).click();
  await expect(page.getByRole("heading", { name: "1.35G + 1.50Q" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole("heading", { name: "1.00G + 1.00Q" })).toBeVisible();

  // Step 5: the report shows the model summary and a share URL.
  await page.getByRole("link", { name: /Étape 5/ }).click();
  await expect(page).toHaveURL(/\/report/);
  await expect(page.getByText("Poutre démo")).toBeVisible();
});
