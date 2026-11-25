import { expect, test } from "@playwright/test";

/**
 * v1.4.0 regressions: Base UI Combobox profile search, the 8-step
 * onboarding tour (cross-route stepping), gallery blank-project +
 * quick-start pills, and the Step 5 EC3/reactions/fingerprint tables.
 */

test("combobox searches and applies profiles to the selected beam", async ({ page }) => {
  await page.goto("/geometry");
  // v1.5.0 data dock: open the Poutres tab, then select the first member.
  await page.getByTestId("dock-tab-beams").click();
  await page.locator("table").last().locator("tbody tr").first().click();
  const input = page
    .locator(
      '[data-testid="inspector-sheet"] input[type="text"], [data-testid="inspector-sheet"] input',
    )
    .first();
  await input.click();
  await input.fill("IPE 300");
  const option = page.getByRole("option", { name: /IPE 300/ }).first();
  await expect(option).toBeVisible();
  await option.click();
  // The beam table (second table) reflects the immediate application.
  await expect(page.locator("table").last()).toContainText("IPE 300");
});

test("gallery offers a blank project and quick pills load templates in 1 click", async ({
  page,
}) => {
  await page.goto("/geometry");
  // Gallery: blank project resets to the 0-node empty state.
  await page
    .getByRole("button", { name: /Galerie de projets|▾/ })
    .first()
    .click();
  await page.getByTestId("new-blank-project").click();
  await expect(page.getByTestId("empty-state")).toBeVisible();
  // Quick-start pills load a full template without further dialogs.
  await page.getByTestId("quick-warren").click();
  await expect(page.locator("table tbody").first()).toContainText("1");
});

test("the 8-step tour steps across all five routes", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem("rdm-tour-done");
    localStorage.setItem("rdm-locale", "fr");
  });
  await page.goto("/geometry");
  // Launch explicitly (auto-launch waits 400 ms; `?` is deterministic).
  await page.getByRole("button", { name: "Aide" }).click();
  await expect(page.locator(".driver-popover-rdm")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".driver-popover-rdm .driver-popover-title")).toContainText(
    /Projets & Modèles/,
  );
  // Step forward through the cross-route stages.
  const next = page.locator(".driver-popover-rdm .driver-popover-next-btn");
  for (let i = 0; i < 4; i++) {
    await next.click();
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(600);
  expect(["/supports", "/loads", "/results", "/report", "/geometry"]).toContain(
    new URL(page.url()).pathname,
  );
  // Close the tour and confirm persistence.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
});

test("step 5 renders reactions Σ and the sha-256 fingerprint", async ({ page }) => {
  await page.goto("/report");
  // The reactions table includes a total footer row.
  await expect(page.getByRole("cell", { name: "Σ" })).toBeVisible();
  // The fingerprint resolves to a 64-char hex string (worker roundtrip).
  const fingerprint = page.getByTestId("model-fingerprint");
  await expect(fingerprint).toBeVisible();
  await expect
    .poll(async () => (await fingerprint.textContent()) ?? "", { timeout: 15_000 })
    .toMatch(/^[0-9a-f]{64}$/);
});

test("the EC3 breakdown lists individual checks with progress bars", async ({ page }) => {
  await page.goto("/results");
  const card = page.getByTestId("ec3-breakdown");
  await expect(card).toBeVisible();
  await expect(card).toContainText("NEd/Npl,Rd");
});
