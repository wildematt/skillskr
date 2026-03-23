import { describe, expect, it } from "vitest";
import { clampFloatingMenuPosition, formatBytes, formatModified, stripFrontMatterForPreview } from "./appUtils";

describe("appUtils", () => {
  it("formats byte sizes across thresholds", () => {
    expect(formatBytes("a".repeat(12))).toBe("12 B");
    expect(formatBytes("a".repeat(2048))).toBe("2.0 KB");
  });

  it("returns unknown when modified time is missing", () => {
    expect(formatModified()).toBe("Unknown");
  });

  it("removes front matter before preview rendering", () => {
    expect(stripFrontMatterForPreview("---\ntitle: Test\n---\n\nHello")).toBe("\nHello");
  });

  it("clamps floating menus into the viewport", () => {
    const originalWindow = globalThis.window;

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { innerWidth: 300, innerHeight: 200 },
    });

    expect(clampFloatingMenuPosition(280, 190, 80, 60)).toEqual({ x: 212, y: 132 });

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
  });
});
