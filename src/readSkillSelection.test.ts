import { describe, expect, it } from "vitest";
import { resolveSelectedPathAfterRead } from "./readSkillSelection";

describe("resolveSelectedPathAfterRead", () => {
  it("selects the requested path when the read succeeds", () => {
    expect(
      resolveSelectedPathAfterRead({
        currentSelectedPath: "/skills/current",
        requestedPath: "/skills/next",
        readSucceeded: true,
        clearOnFailure: false,
      }),
    ).toBe("/skills/next");
  });

  it("keeps the current selection when a user-initiated read fails", () => {
    expect(
      resolveSelectedPathAfterRead({
        currentSelectedPath: "/skills/current",
        requestedPath: "/skills/next",
        readSucceeded: false,
        clearOnFailure: false,
      }),
    ).toBe("/skills/current");
  });

  it("clears selection when an initial fallback read fails", () => {
    expect(
      resolveSelectedPathAfterRead({
        currentSelectedPath: "/skills/current",
        requestedPath: "/skills/next",
        readSucceeded: false,
        clearOnFailure: true,
      }),
    ).toBe("");
  });
});
