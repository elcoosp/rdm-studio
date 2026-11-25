import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * v1.6.0: the EN catalog must be 100% translated (0 untranslated
 * `msgstr ""` entries outside the PO file header).
 */
describe("i18n en.po completeness", () => {
  it("has zero untranslated msgstr entries", () => {
    const po = readFileSync(resolve(__dirname, "locales/en.po"), "utf8");
    const entries = po
      .split("\n\n")
      .filter(
        (block) =>
          (block.startsWith("msgid ") || block.startsWith("#:")) &&
          block.includes("msgid ") &&
          !block.includes('msgid ""'),
      );
    expect(entries.length).toBeGreaterThan(50);
    const untranslated = entries.filter(
      (block) => /msgstr ""(\n|$)/.test(block) && !block.includes("msgstr["),
    );
    expect(
      untranslated,
      `untranslated EN entries:\n${untranslated.join("\n---\n").slice(0, 2000)}`,
    ).toHaveLength(0);
  });
});
