import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn class composer", () => {
  it("merges tailwind classes", () => {
    expect(cn("px-2", "text-sm")).toContain("px-2");
  });
  it("lets later classes win on conflicts", () => {
    const merged = cn("p-2", "p-4");
    expect(merged).toContain("p-4");
    expect(merged).not.toContain("p-2 ");
  });
  it("drops falsy inputs", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });
});
