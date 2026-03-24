export const BOOT_OVERLAY_ID = "app-boot-overlay";
const BOOT_OVERLAY_EXIT_CLASS = "is-exiting";
const BOOT_OVERLAY_EXIT_DURATION_MS = 180;

type OverlayLike = {
  classList: {
    add: (token: string) => void;
    contains: (token: string) => boolean;
  };
  setAttribute: (name: string, value: string) => void;
  remove: () => void;
};

type DocumentLike = {
  getElementById: (id: string) => OverlayLike | null;
};

type TimeoutScheduler = (handler: () => void, timeout: number) => unknown;

export function dismissBootOverlay(
  doc: DocumentLike = document,
  scheduleTimeout: TimeoutScheduler = window.setTimeout.bind(window),
): boolean {
  const overlay = doc.getElementById(BOOT_OVERLAY_ID);
  if (!overlay || overlay.classList.contains(BOOT_OVERLAY_EXIT_CLASS)) {
    return false;
  }

  overlay.setAttribute("aria-hidden", "true");
  overlay.classList.add(BOOT_OVERLAY_EXIT_CLASS);
  scheduleTimeout(() => overlay.remove(), BOOT_OVERLAY_EXIT_DURATION_MS);
  return true;
}
