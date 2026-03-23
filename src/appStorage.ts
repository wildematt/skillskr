import { COLLECTION_ICON_KEYS, type CollectionIconKey, type CollectionItem, type PersistedAppState } from "./appTypes";

export const FAVORITES_KEY = "skillskr.favorites.v1";
export const COLLECTIONS_KEY = "skillskr.collections.v1";
export const SKILL_COLLECTIONS_KEY = "skillskr.skillCollections.v1";
export const SKILL_GROUP_COLLAPSE_KEY = "skillskr.skillGroupCollapse.v1";
export const LEFT_PANE_KEY = "skillskr.leftPaneWidth.v1";
export const MIDDLE_PANE_KEY = "skillskr.middlePaneWidth.v1";

function isCollectionIconKey(value: unknown): value is CollectionIconKey {
  return typeof value === "string" && COLLECTION_ICON_KEYS.includes(value as CollectionIconKey);
}

export function loadCollections(): CollectionItem[] {
  try {
    const raw = localStorage.getItem(COLLECTIONS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((item) => item && typeof item.id === "string" && typeof item.name === "string")
      .map((item) => ({
        id: item.id as string,
        name: (item.name as string).trim(),
        icon: isCollectionIconKey(item.icon) ? item.icon : "folder",
      }))
      .filter((item) => item.name.length > 0);
  } catch {
    return [];
  }
}

export function loadSkillCollections(): Record<string, string> {
  try {
    const raw = localStorage.getItem(SKILL_COLLECTIONS_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return Object.entries(parsed).reduce<Record<string, string>>((acc, [path, collectionId]) => {
      if (typeof path === "string" && typeof collectionId === "string") {
        acc[path] = collectionId;
      }
      return acc;
    }, {});
  } catch {
    return {};
  }
}

export function loadSkillGroupCollapse(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(SKILL_GROUP_COLLAPSE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return Object.entries(parsed).reduce<Record<string, boolean>>((acc, [groupKey, isCollapsed]) => {
      if (typeof groupKey === "string" && typeof isCollapsed === "boolean") {
        acc[groupKey] = isCollapsed;
      }
      return acc;
    }, {});
  } catch {
    return {};
  }
}

export function createCollectionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `collection-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function loadFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function loadPaneWidth(storageKey: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return fallback;
    }
    const value = Number.parseInt(raw, 10);
    return Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

export function loadLocalAppState(): PersistedAppState {
  return {
    favorites: loadFavorites(),
    collections: loadCollections(),
    skillCollections: loadSkillCollections(),
  };
}

export function hasPersistedAppState(state: PersistedAppState): boolean {
  return state.favorites.length > 0 || state.collections.length > 0 || Object.keys(state.skillCollections).length > 0;
}
