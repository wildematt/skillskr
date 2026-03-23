import { describe, expect, it } from "vitest";
import { toggleFavoritePath } from "./toggleFavoritePath";

describe("toggleFavoritePath", () => {
  it("adds a path when it is not already favorited", () => {
    expect(toggleFavoritePath(["/skills/a"], "/skills/b")).toEqual(["/skills/a", "/skills/b"]);
  });

  it("removes a path when it is already favorited", () => {
    expect(toggleFavoritePath(["/skills/a", "/skills/b"], "/skills/b")).toEqual(["/skills/a"]);
  });
});
