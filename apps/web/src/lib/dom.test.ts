import { describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";

/** DOM smoke test with linkedom (vitest harness, section 14 level 4). */
describe("linkedom dom harness", () => {
  it("parses and queries an engineering table snippet", () => {
    const { document } = parseHTML(
      '<table id="t"><tr class="row"><td>B1</td><td>1.10</td></tr></table>',
    );
    const first = document.querySelector("#t .row td");
    expect(first?.textContent).toBe("B1");
    expect(document.querySelectorAll(".row")).toHaveLength(1);
  });
});
