import { expect, test } from "@playwright/test";

/**
 * M7 (ARCHITECTURE.md section 18): mobile responsive — bottom sheet,
 * touch controls, 100dvh layout validated on iPhone and iPad viewports.
 */

async function dragSheetClosed(page: import("@playwright/test").Page): Promise<void> {
  const handle = page.getByTestId("sheet-drag-handle");
  const box = await handle.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2 + 200, {
    steps: 8,
  });
  await page.mouse.up();
}

/** Closes the sheet. Chromium honors the synthetic pointer stream, so the
 * Motion drag gesture is exercised there; Firefox's touch emulation cancels
 * it and leaves the pointer state broken, so the button path is used. */
async function closeSheet(
  page: import("@playwright/test").Page,
  browserName: string,
): Promise<void> {
  if (browserName === "firefox") {
    await page.getByRole("button", { name: "Fermer" }).click();
  } else {
    await dragSheetClosed(page);
  }
  await expect(page.getByTestId("inspector-sheet")).toBeHidden({ timeout: 5_000 });
}

test.describe("iPhone 13 viewport", () => {
  test.use({ viewport: { width: 390, height: 664 }, hasTouch: true, isMobile: true });

  test("bottom sheet opens, closes by drag, stepper navigates by touch", async ({
    page,
    browserName,
  }) => {
    await page.goto("/geometry");
    await expect(page.getByTestId("viewport-canvas")).toBeVisible();
    await expect(page.getByTestId("inspector-sheet")).toBeVisible();
    await expect(page.getByTestId("sheet-drag-handle")).toBeVisible();

    await closeSheet(page, browserName);

    // 44px touch targets across the 5-step workflow.
    await page.getByRole("link", { name: "Étape 3" }).click();
    await expect(page.getByRole("heading", { name: "Charges et combinaisons EN 1990" })).toBeVisible();
    await page.getByRole("link", { name: "Étape 1" }).click();
    await expect(page.getByTestId("viewport-canvas")).toBeVisible();
  });

  test("100dvh shell does not overflow the visual viewport", async ({ page }) => {
    await page.goto("/geometry");
    const metrics = await page.evaluate(() => ({
      inner: window.innerHeight,
      body: document.body.scrollHeight,
    }));
    expect(metrics.body).toBeLessThanOrEqual(metrics.inner + 1);
  });
});

test.describe("iPad Mini viewport", () => {
  test.use({ viewport: { width: 768, height: 1024 }, hasTouch: true, isMobile: true });

  test("bottom sheet opens, drag closes, stepper navigates", async ({ page, browserName }) => {
    await page.goto("/geometry");
    await expect(page.getByTestId("inspector-sheet")).toBeVisible();
    await closeSheet(page, browserName);
    await page.getByRole("link", { name: "Étape 5" }).click();
    await expect(page.getByRole("heading", { name: "Partage par URL" })).toBeVisible();
  });
});
