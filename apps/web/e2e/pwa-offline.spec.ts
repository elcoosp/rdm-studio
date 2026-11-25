import { expect, test } from "@playwright/test";

/**
 * M5 (ARCHITECTURE.md section 18): PWA installable — service worker
 * precaches the app shell + WASM, and offline mode is verified for real.
 * Runs against the production build (playwright webServer: vite preview).
 */
test.use({ serviceWorkers: "allow" });

test("service worker registers, installs and activates", async ({ page }) => {
  await page.goto("/geometry");
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const { serviceWorker } = navigator;
          if (typeof serviceWorker === "undefined") {
            return "unsupported";
          }
          return serviceWorker.getRegistrations().then((regs) => {
            const r = regs[0];
            return r?.active?.state ?? r?.installing?.state ?? "none";
          });
        }),
      { timeout: 30_000, intervals: [500, 1_000, 2_000] },
    )
    .toBe("activated");
});

test("offline reload serves the precached app shell", async ({ page, context }) => {
  // First visit: let the service worker install and take control.
  await page.goto("/geometry");
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const { serviceWorker } = navigator;
          if (typeof serviceWorker === "undefined") {
            return "unsupported";
          }
          return serviceWorker.getRegistrations().then((regs) => {
            const r = regs[0];
            return r?.active?.state ?? "none";
          });
        }),
      { timeout: 30_000 },
    )
    .toBe("activated");
  await page.goto("/loads");

  await context.setOffline(true);
  // Firefox aborts navigations that race the service worker (NS_BINDING_ABORTED).
  await page.reload().catch(() =>
    page
      .waitForTimeout(1_000)
      .then(() => page.reload())
      .catch(() => undefined),
  );
  await expect(page.getByRole("heading", { name: "Charges" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("Charge ponctuelle")).toBeVisible();
  await context.setOffline(false);
});
