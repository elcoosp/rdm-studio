import { describe, expect, it } from "vitest";
import { encodeProject, parseProject } from "./urlShare";
import { demoProject } from "@/state/projectStore";

describe("url share (.rdm via lz-string)", () => {
  it("round-trips the demo project", () => {
    const payload = encodeProject(demoProject());
    const parsed = parseProject(payload);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.project.name).toBe("Poutre démo");
      expect(parsed.project.structure.nodes).toHaveLength(3);
    }
  });
  it("rejects corrupted payloads with a clean error", () => {
    const parsed = parseProject("not-a-valid-payload!!!");
    expect(parsed.ok).toBe(false);
  });
});
