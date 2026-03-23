import { beforeEach, describe, expect, it } from "vitest";
import { loadCollections, loadFavorites, loadLocalAppState, loadSkillCollections, loadSkillGroupCollapse } from "./appStorage";

function createStorage() {
  const store = new Map<string, string>();

  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

describe("appStorage", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: createStorage(),
    });
  });

  it("loads sanitized collections", () => {
    localStorage.setItem(
      "skillskr.collections.v1",
      JSON.stringify([
        { id: "a", name: " Design ", icon: "folder" },
        { id: "b", name: "", icon: "unknown" },
      ]),
    );

    expect(loadCollections()).toEqual([{ id: "a", name: "Design", icon: "folder" }]);
  });

  it("loads path-to-collection assignments", () => {
    localStorage.setItem(
      "skillskr.skillCollections.v1",
      JSON.stringify({
        "/skills/a": "collection-1",
        "/skills/b": 5,
      }),
    );

    expect(loadSkillCollections()).toEqual({ "/skills/a": "collection-1" });
  });

  it("loads favorite paths and collapsed groups", () => {
    localStorage.setItem("skillskr.favorites.v1", JSON.stringify(["/skills/a", 1]));
    localStorage.setItem("skillskr.skillGroupCollapse.v1", JSON.stringify({ "Codex::parent": true, bad: "nope" }));

    expect(loadFavorites()).toEqual(["/skills/a"]);
    expect(loadSkillGroupCollapse()).toEqual({ "Codex::parent": true });
  });

  it("loads the combined local app state", () => {
    localStorage.setItem("skillskr.favorites.v1", JSON.stringify(["/skills/favorite"]));

    expect(loadLocalAppState()).toEqual({
      favorites: ["/skills/favorite"],
      collections: [],
      skillCollections: {},
    });
  });
});
