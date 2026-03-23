import { describe, expect, it } from "vitest";
import { shouldPersistSidebarSelection } from "./sidebarSelectionMemory";

describe("shouldPersistSidebarSelection", () => {
  it("persists the selection when it belongs to the current sidebar list", () => {
    expect(
      shouldPersistSidebarSelection({
        sidebarKey: "library:all",
        selectedPath: "/skills/current",
        visiblePaths: ["/skills/current", "/skills/next"],
        pendingSidebarSelectionRestore: null,
      }),
    ).toBe(true);
  });

  it("does not persist a selection that is not in the current sidebar list", () => {
    expect(
      shouldPersistSidebarSelection({
        sidebarKey: "tool:Codex",
        selectedPath: "/skills/outside",
        visiblePaths: ["/skills/current", "/skills/next"],
        pendingSidebarSelectionRestore: null,
      }),
    ).toBe(false);
  });

  it("does not overwrite remembered selection during sidebar restore with an old selected path", () => {
    expect(
      shouldPersistSidebarSelection({
        sidebarKey: "library:all",
        selectedPath: "/skills/old-tool-selection",
        visiblePaths: ["/skills/old-tool-selection", "/skills/remembered-all-selection"],
        pendingSidebarSelectionRestore: {
          sidebarKey: "library:all",
          targetPath: "/skills/remembered-all-selection",
        },
      }),
    ).toBe(false);
  });

  it("persists once the restored sidebar selection matches the target path", () => {
    expect(
      shouldPersistSidebarSelection({
        sidebarKey: "library:all",
        selectedPath: "/skills/remembered-all-selection",
        visiblePaths: ["/skills/old-tool-selection", "/skills/remembered-all-selection"],
        pendingSidebarSelectionRestore: {
          sidebarKey: "library:all",
          targetPath: "/skills/remembered-all-selection",
        },
      }),
    ).toBe(true);
  });
});
