import { describe, expect, it } from "vitest";
import { shouldAutoScrollSelectedSkill } from "./selectedSkillAutoScroll";

describe("shouldAutoScrollSelectedSkill", () => {
  it("scrolls when the selected skill changes", () => {
    expect(
      shouldAutoScrollSelectedSkill({
        selectedPath: "/skills/b",
        previousSelectedPath: "/skills/a",
        sidebarKey: "library:all",
        lastScrolledSidebarKey: "library:all",
        wasSelectedVisible: true,
        isSelectedVisible: true,
        isRestoringScrollPosition: false,
      }),
    ).toBe(true);
  });

  it("scrolls when the sidebar changes", () => {
    expect(
      shouldAutoScrollSelectedSkill({
        selectedPath: "/skills/a",
        previousSelectedPath: "/skills/a",
        sidebarKey: "tool:Codex",
        lastScrolledSidebarKey: "library:all",
        wasSelectedVisible: true,
        isSelectedVisible: true,
        isRestoringScrollPosition: false,
      }),
    ).toBe(true);
  });

  it("does not scroll on list-only rerenders like favorite toggles", () => {
    expect(
      shouldAutoScrollSelectedSkill({
        selectedPath: "/skills/a",
        previousSelectedPath: "/skills/a",
        sidebarKey: "library:all",
        lastScrolledSidebarKey: "library:all",
        wasSelectedVisible: true,
        isSelectedVisible: true,
        isRestoringScrollPosition: false,
      }),
    ).toBe(false);
  });

  it("scrolls when the selected skill becomes visible again", () => {
    expect(
      shouldAutoScrollSelectedSkill({
        selectedPath: "/skills/a",
        previousSelectedPath: "/skills/a",
        sidebarKey: "library:all",
        lastScrolledSidebarKey: "library:all",
        wasSelectedVisible: false,
        isSelectedVisible: true,
        isRestoringScrollPosition: false,
      }),
    ).toBe(true);
  });

  it("does not scroll when the selected skill is not visible", () => {
    expect(
      shouldAutoScrollSelectedSkill({
        selectedPath: "/skills/a",
        previousSelectedPath: "/skills/a",
        sidebarKey: "library:all",
        lastScrolledSidebarKey: "library:all",
        wasSelectedVisible: false,
        isSelectedVisible: false,
        isRestoringScrollPosition: false,
      }),
    ).toBe(false);
  });

  it("does not scroll while restoring a saved sidebar scroll position", () => {
    expect(
      shouldAutoScrollSelectedSkill({
        selectedPath: "/skills/a",
        previousSelectedPath: "/skills/b",
        sidebarKey: "library:all",
        lastScrolledSidebarKey: "tool:Codex",
        wasSelectedVisible: true,
        isSelectedVisible: true,
        isRestoringScrollPosition: true,
      }),
    ).toBe(false);
  });
});
