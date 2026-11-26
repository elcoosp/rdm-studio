import { expect, test } from "@playwright/test";
import LZString from "lz-string";

/**
 * v2.1.0 URL-first architecture E2E (G6): the URL is the SINGLE SOURCE OF
 * TRUTH — `?template=` / `?p=` hydration strips itself after loading, the
 * viewport/selection params survive step navigation through
 * `retainSearchParams`, selection writes land in the URL (zero Zustand
 * mirror) and the router-level 404 recovers cleanly.
 */

test("?template= hydrates the quick-start model then strips itself", async ({ page }) => {
  await page.goto("/geometry?template=warren");
  // The Warren quick-start model is loaded BEFORE the first studio render.
  await expect(page.getByText("Treillis Warren 24 m").first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("dock-tab-beams")).toContainText("11");
  // The hydration param is stripped, viewport params are preserved.
  await expect(page).not.toHaveURL(/template=/);
});

test("?p= deep link restores an arbitrary .rdm then strips itself", async ({ page }) => {
  const project = {
    version: 1,
    name: "Deep link portique",
    structure: {
      nodes: [
        { id: 1, x: 0, y: 0, z: 0 },
        { id: 2, x: 0, y: 0, z: 4 },
        { id: 3, x: 12, y: 0, z: 4 },
        { id: 4, x: 12, y: 0, z: 0 },
      ],
      beams: [
        {
          id: 1,
          n1: 1,
          n2: 2,
          section_id: "HEA 200",
          material_id: "S235JR",
          roll_angle_rad: 0,
          releases_start: [false, false, false, false, false, false],
          releases_end: [false, false, false, false, false, false],
          k_buckling_y: 1,
          k_buckling_z: 1,
        },
        {
          id: 2,
          n1: 2,
          n2: 3,
          section_id: "IPE 300",
          material_id: "S235JR",
          roll_angle_rad: 0,
          releases_start: [false, false, false, false, false, false],
          releases_end: [false, false, false, false, false, false],
          k_buckling_y: 1,
          k_buckling_z: 1,
        },
      ],
      supports: [],
      loads: [],
      sections: {},
      materials: {},
      self_weight_enabled: false,
    },
  };
  const payload = LZString.compressToEncodedURIComponent(JSON.stringify(project));
  await page.goto(`/geometry?p=${payload}`);
  await expect(page.getByText("Deep link portique").first()).toBeVisible({ timeout: 15_000 });
  await expect(page).not.toHaveURL(/p=/);
});

test("viewport params survive step navigation (retainSearchParams)", async ({ page }) => {
  await page.goto("/geometry?view=face-xz&render=wireframe&snap=10");
  await expect(page.getByTestId("view-face-xz")).toBeVisible();
  await page.getByRole("link", { name: /Étape 3/ }).click();
  await expect(page).toHaveURL(/view=face-xz/);
  await expect(page).toHaveURL(/render=wireframe/);
  await expect(page).toHaveURL(/snap=10/);
  await page.getByRole("link", { name: /Étape 1/ }).click();
  await expect(page).toHaveURL(/view=face-xz/);
});

test("layer + render toggles write the URL and restore on reload", async ({ page }) => {
  await page.goto("/geometry");
  await page.getByTestId("layer-loads").click();
  await page.getByTestId("render-wireframe").click();
  await expect(page).toHaveURL(/layers=/);
  await expect(page).toHaveURL(/render=wireframe/);
  // The full URL state replays after a cold reload.
  await page.reload();
  await expect(page.getByTestId("layer-loads")).not.toHaveClass(/bg-accent/);
  await expect(page).toHaveURL(/render=wireframe/);
});

test("selection writes ?beam= into the URL and Esc clears it", async ({ page }) => {
  await page.goto("/geometry");
  await page.getByTestId("dock-tab-beams").click();
  await page.getByTestId("data-dock").locator("tbody tr").first().click();
  await expect(page).toHaveURL(/beam=/);
  await page.keyboard.press("Escape");
  await expect(page).not.toHaveURL(/beam=/);
});

test("unknown routes render the studio 404 card with a working recovery link", async ({ page }) => {
  await page.goto("/page-inexistante");
  await expect(page.getByTestId("not-found-card")).toBeVisible();
  await expect(page.getByText("Retour à l'atelier 3D →")).toBeVisible();
  await page.getByText("Retour à l'atelier 3D →").click();
  await expect(page).toHaveURL(/\/geometry/);
});
