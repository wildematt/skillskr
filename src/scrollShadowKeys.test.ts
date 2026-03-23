import { describe, expect, it } from "vitest";
import { createSkillListScrollShadowKey } from "./scrollShadowKeys";

describe("createSkillListScrollShadowKey", () => {
  it("stays stable when the visible item count changes", () => {
    const beforeFavoriteToggle = createSkillListScrollShadowKey({
      sidebarKey: "library:favorites",
      search: "",
      loadingSkills: false,
    });

    const afterFavoriteToggle = createSkillListScrollShadowKey({
      sidebarKey: "library:favorites",
      search: "",
      loadingSkills: false,
    });

    expect(afterFavoriteToggle).toBe(beforeFavoriteToggle);
  });

  it("changes when the navigation context changes", () => {
    const allSkills = createSkillListScrollShadowKey({
      sidebarKey: "library:all",
      search: "",
      loadingSkills: false,
    });

    const searchResults = createSkillListScrollShadowKey({
      sidebarKey: "library:all",
      search: "brainstorm",
      loadingSkills: false,
    });

    expect(searchResults).not.toBe(allSkills);
  });
});
