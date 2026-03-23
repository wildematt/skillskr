import type { AppTheme } from "./appTypes";

export function formatBytes(content: string): string {
  const bytes = new Blob([content]).size;
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function formatModified(unix?: number): string {
  if (!unix) {
    return "Unknown";
  }
  const date = new Date(unix * 1000);
  return date.toLocaleString();
}

export function resolvePreferredTheme(): AppTheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function clampFloatingMenuPosition(x: number, y: number, width: number, height: number) {
  const viewportPadding = 8;
  return {
    x: Math.min(Math.max(x, viewportPadding), Math.max(viewportPadding, window.innerWidth - width - viewportPadding)),
    y: Math.min(Math.max(y, viewportPadding), Math.max(viewportPadding, window.innerHeight - height - viewportPadding)),
  };
}

export function stripFrontMatterForPreview(content: string): string {
  const frontMatterPattern = /^\uFEFF?(?:\s*\r?\n)*---\r?\n[\s\S]*?\r?\n---(?:\r?\n)?/;
  return content.replace(frontMatterPattern, "");
}
