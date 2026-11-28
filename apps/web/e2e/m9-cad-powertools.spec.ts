import { expect, test, type Page } from "@playwright/test";

/**
 * M9 — RDM7 CAD Power Tools E2E (G6): 1-click topological cleanup
 * (Compacter), beam subdivision into N tronçons, the RDM6/7 parametric
 * structure library (portal + Pratt truss) and the synchronized Nodes &
 * Beams metrology spreadsheet with spreadsheet paste — all through the
 * DOM contract (no canvas-picking brittleness), on the AGENTS.md §4
 * desktop viewport.
 */

async function openStudio(page: Page, url: string): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(url);
  await expect(page.getByTestId("geometry-stage-slot")).toBeVisible();
}

/** Counts shown in the drawer tab pills, e.g. "Nœuds (11)". */
async function dockCount(page: Page, tab: "nodes" | "beams"): Promise<number> {
  const text = (await page.getByTestId(`dock-tab-${tab}`).textContent()) ?? "";
  const match = /\((\d+)\)/.exec(text);
  return match === null ? -1 : Number(match[1]);
}

test.describe("M9 — CAD power tools", () => {
  test("Compacter merges duplicate nodes and splits a T-junction in one click", async ({
    page,
  }) => {
    await openStudio(page, "/geometry?template=travees");
    // 3-span beam: nodes N1..N4 on the X axis, beams B1..B3.
    expect(await dockCount(page, "nodes")).toBe(4);
    expect(await dockCount(page, "beams")).toBe(3);

    // Place N5 exactly INSIDE beam B2 (x = 6 m between N2 and N3).
    await page.getByLabel("Placement X (m)").fill("6");
    await page.getByLabel("Placement Y (m)").fill("0");
    await page.getByLabel("Placement Z (m)").fill("0");
    await page.getByTestId("add-node").click();
    // Relier N5 → N2 creates an unsplit T-junction topology (Base UI
    // Combobox: fill filters on the RAW id, options render "N{id} · (x…)").
    const n1Input = page.getByLabel("N1", { exact: true });
    const n2Input = page.getByLabel("N2", { exact: true });
    await n1Input.click();
    await n1Input.fill("2");
    await page.getByRole("option", { name: "N2" }).first().click();
    await n2Input.click();
    await n2Input.fill("5");
    await page.getByRole("option", { name: "N5" }).first().click();
    await page.getByTestId("connect-beam").click();
    expect(await dockCount(page, "beams")).toBe(4);

    // 1-click Compacter: cuts the host at N5 and reports the stats.
    await page.getByTestId("compact-model").click();
    await expect(page.getByText(/Modèle compacté/)).toBeVisible();
    await expect(page.getByText(/1 poutre\(s\) découpée\(s\)/)).toBeVisible();
    // The first split child duplicates the drawn N2→N5 member (same
    // unordered pair, section and material) — deduplicateBeams drops it:
    // 3 − 1 + 2 children + 1 drawn − 1 duplicate = 4 members, 5 nodes.
    await expect(page.getByText(/1 doublon\(s\) supprimé\(s\)/)).toBeVisible();
    expect(await dockCount(page, "beams")).toBe(4);
    expect(await dockCount(page, "nodes")).toBe(5);
  });

  test("Discrétiser (N tronçons) subdivides the selected member with presets", async ({ page }) => {
    await openStudio(page, "/geometry?template=travees");
    await page.getByTestId("dock-tab-beams").click();
    await page.locator('[data-testid="data-dock"] table tbody tr').first().click();
    await expect(page).toHaveURL(/beam=1/);

    // Quick preset 8 + confirm: beam B1 (4 m) becomes 8 collinear tronçons.
    await page.getByTestId("subdivide-preset-8").click();
    await page.getByTestId("subdivide-beam").click();
    await expect(page.getByText(/discrétisée en 8 tronçons/)).toBeVisible();
    expect(await dockCount(page, "nodes")).toBe(11); // 4 + 7 interior
    expect(await dockCount(page, "beams")).toBe(10); // 3 − 1 + 8 children
  });

  test("Parametric library generates a portal frame (replace project)", async ({ page }) => {
    await openStudio(page, "/geometry");
    await page.getByTestId("open-parametric-generator").click();
    await expect(page.getByTestId("parametric-generator-modal")).toBeVisible();
    await expect(page.getByTestId("generator-preview")).toBeVisible();

    await page.getByTestId("generator-replace").click();
    await expect(page.getByTestId("parametric-generator-modal")).not.toBeVisible();
    // Default portique: 2 columns + 1 apex = 5 nodes, 4 members, 2 bases.
    expect(await dockCount(page, "nodes")).toBe(5);
    expect(await dockCount(page, "beams")).toBe(4);
    await page.getByTestId("dock-tab-nodes").click();
    // Encastrement support badges on both base nodes (N1 and N3).
    await expect(page.getByTestId("node-support-1")).toContainText("Encastrement");
    await expect(page.getByTestId("node-support-3")).toContainText("Encastrement");
  });

  test("Parametric library generates a Pratt truss with live preview", async ({ page }) => {
    await openStudio(page, "/geometry");
    await page.getByTestId("open-parametric-generator").click();
    await page.getByTestId("generator-type-truss").click();
    await expect(page.getByTestId("generator-preview")).toContainText("nœuds");
    await page.getByTestId("generator-replace").click();
    // Pratt 24 m / 8 panels: 2 × 9 chord nodes, 33 members.
    expect(await dockCount(page, "nodes")).toBe(18);
    expect(await dockCount(page, "beams")).toBe(33);
    // The generated model stays ready to solve (supports present).
    await expect(page.getByTestId("next-supports")).toBeEnabled();
  });

  test("Synchronized metrology table: row click selects in 3D, 3D selection highlights the row", async ({
    page,
  }) => {
    await openStudio(page, "/geometry?template=travees");
    // Table → 3D: clicking a beam row writes the URL selection contract.
    await page.getByTestId("dock-tab-beams").click();
    await page.locator('[data-testid="data-dock"] table tbody tr').nth(1).click();
    await expect(page).toHaveURL(/beam=2/);
    await expect(page.getByTestId("beam-id-2")).toBeVisible();
    await expect(page.getByTestId("beam-length-2")).toContainText("4,00");

    // 3D → table: a ?beam= deep link highlights the matching row.
    await openStudio(page, "/geometry?template=travees&beam=3");
    await page.getByTestId("dock-tab-beams").click();
    await expect(page.getByTestId("beam-id-3").locator("xpath=ancestor::tr")).toHaveClass(
      /bg-accent-tint/,
    );

    // Nodes tab: support badge, inline coordinate editor, delete row.
    // N1 of the 3-span template is a partial clamp (Tx..Rx locked for the
    // collinear torsion guardrail — Ry/Rz free) → "Partiel" badge.
    await page.getByTestId("dock-tab-nodes").click();
    await expect(page.getByTestId("node-id-1")).toContainText("N1");
    await expect(page.getByTestId("node-support-1")).toContainText("Partiel");
    await expect(page.getByLabel("Nœud 2 · coordonnée x")).toHaveValue(/4/);
  });

  test("Spreadsheet paste batch-creates nodes from tab-separated rows", async ({ page }) => {
    await openStudio(page, "/geometry?template=travees");
    await page.getByTestId("nodes-paste-target").focus();
    await page.evaluate(() => {
      const target = document.querySelector('[data-testid="nodes-paste-target"]');
      if (target === null) {
        throw new Error("paste target missing");
      }
      // Cross-browser: Firefox drops ClipboardEventInit.clipboardData, so
      // attach the DataTransfer via defineProperty on a plain Event.
      const dt = new DataTransfer();
      dt.setData("text/plain", "20\t0\t0\n22\t0\t0\n24\t0\t0");
      const event = new Event("paste", { bubbles: true, cancelable: true });
      Object.defineProperty(event, "clipboardData", { value: dt });
      target.dispatchEvent(event);
    });
    await expect(page.getByText(/3 nœud\(s\) créé\(s\) depuis le presse-papiers/)).toBeVisible();
    expect(await dockCount(page, "nodes")).toBe(7);
  });

  test("Auto-Split on Draw toggle rides the beam tool row", async ({ page }) => {
    await openStudio(page, "/geometry?template=travees");
    await page.getByTestId("tool-beam").click();
    await expect(page.getByTestId("auto-split-toggle")).toBeVisible();
    await expect(page.getByTestId("auto-split-toggle")).toContainText("Auto-découpe");
  });
});
