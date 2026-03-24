import { describe, expect, it } from "vitest";
import { BOOT_OVERLAY_ID, dismissBootOverlay } from "./bootOverlay";

function createFakeOverlay() {
  const classes = new Set<string>();

  return {
    removed: false,
    attrs: new Map<string, string>(),
    classList: {
      add(token: string) {
        classes.add(token);
      },
      contains(token: string) {
        return classes.has(token);
      },
    },
    setAttribute(name: string, value: string) {
      this.attrs.set(name, value);
    },
    remove() {
      this.removed = true;
    },
  };
}

describe("bootOverlay", () => {
  it("marks the startup overlay as exiting and removes it after the timeout", () => {
    const overlay = createFakeOverlay();
    let scheduledTimeout = -1;
    let scheduledHandler: (() => void) | null = null;

    const dismissed = dismissBootOverlay(
      {
        getElementById(id) {
          return id === BOOT_OVERLAY_ID ? overlay : null;
        },
      },
      (handler, timeout) => {
        scheduledHandler = handler;
        scheduledTimeout = timeout;
        return 1;
      },
    );

    expect(dismissed).toBe(true);
    expect(overlay.attrs.get("aria-hidden")).toBe("true");
    expect(overlay.classList.contains("is-exiting")).toBe(true);
    expect(scheduledTimeout).toBe(180);
    expect(overlay.removed).toBe(false);

    expect(scheduledHandler).not.toBeNull();
    if (!scheduledHandler) {
      throw new Error("Expected a scheduled handler");
    }
    const handler = scheduledHandler as () => void;
    handler();

    expect(overlay.removed).toBe(true);
  });

  it("does nothing when the startup overlay is missing", () => {
    const dismissed = dismissBootOverlay(
      {
        getElementById() {
          return null;
        },
      },
      () => 1,
    );

    expect(dismissed).toBe(false);
  });

  it("does not schedule removal twice once the overlay is already exiting", () => {
    const overlay = createFakeOverlay();
    dismissBootOverlay(
      {
        getElementById() {
          return overlay;
        },
      },
      () => 1,
    );

    let scheduled = false;
    const dismissedAgain = dismissBootOverlay(
      {
        getElementById() {
          return overlay;
        },
      },
      () => {
        scheduled = true;
        return 1;
      },
    );

    expect(dismissedAgain).toBe(false);
    expect(scheduled).toBe(false);
  });
});
