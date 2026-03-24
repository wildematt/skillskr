import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { FolderOpen, IconContext, PencilSimple, Trash } from "@phosphor-icons/react";
import { CollectionModal } from "./components/CollectionModal";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { DetailPane } from "./components/DetailPane";
import { LeftSidebar } from "./components/LeftSidebar";
import { SkillListPane } from "./components/SkillListPane";
import { SKILL_SITE_TABS } from "./appIcons";
import { SkillContextMenu } from "./components/SkillContextMenu";
import {
  COLLECTIONS_KEY,
  createCollectionId,
  FAVORITES_KEY,
  hasPersistedAppState,
  LEFT_PANE_KEY,
  loadLocalAppState,
  loadPaneWidth,
  loadSkillGroupCollapse,
  MIDDLE_PANE_KEY,
  SKILL_COLLECTIONS_KEY,
  SKILL_GROUP_COLLAPSE_KEY,
} from "./appStorage";
import type {
  AppTheme,
  CollectionIconKey,
  CollectionItem,
  ListSkillsResponse,
  PersistedAppState,
  SkillDetail,
  SkillSourceSummary,
  SkillSummary,
  SkillSiteTabKey,
  UpdateResult,
} from "./appTypes";
import { clampFloatingMenuPosition, formatBytes, formatModified, resolvePreferredTheme, stripFrontMatterForPreview } from "./appUtils";
import { deriveSkillListHierarchy } from "./skillListHierarchy";
import { resolveSelectedPathAfterRead } from "./readSkillSelection";
import { createSkillListScrollShadowKey } from "./scrollShadowKeys";
import { shouldAutoScrollSelectedSkill } from "./selectedSkillAutoScroll";
import { shouldPersistSidebarSelection } from "./sidebarSelectionMemory";
import { toggleFavoritePath } from "./toggleFavoritePath";
import { dismissBootOverlay } from "./bootOverlay";

type SkillContextMenuState = {
  path: string;
  name: string;
  x: number;
  y: number;
};

type DeleteConfirmState = {
  path: string;
  name: string;
  step: 1 | 2;
};

type CollectionContextMenuState = {
  id: string;
  x: number;
  y: number;
};

type CollectionRenameState = {
  id: string;
  name: string;
};

const TOOL_ORDER = ["Claude Code", "Cursor", "Windsurf", "Codex", "Agents", "Continue"];
const LEFT_SPLITTER_WIDTH = 8;
const LEFT_MIN = 180;
const LEFT_MAX = 420;
const MIDDLE_MIN = 260;
const MIDDLE_MAX = 520;
const DETAIL_MIN = 360;

function App() {
  const appWindow = getCurrentWindow();
  const initialAppStateRef = useRef<PersistedAppState>(loadLocalAppState());
  const workspaceRef = useRef<HTMLElement | null>(null);
  const skillContextMenuRef = useRef<HTMLDivElement | null>(null);
  const newSkillActionsRef = useRef<HTMLDivElement | null>(null);
  const collectionsMenuRef = useRef<HTMLDivElement | null>(null);
  const detailCollectionPickerRef = useRef<HTMLDivElement | null>(null);
  const skillRowRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [sources, setSources] = useState<SkillSourceSummary[]>([]);
  const [favorites, setFavorites] = useState<string[]>(() => initialAppStateRef.current.favorites);
  const [collections, setCollections] = useState<CollectionItem[]>(() => initialAppStateRef.current.collections);
  const [skillCollections, setSkillCollections] = useState<Record<string, string>>(() => initialAppStateRef.current.skillCollections);
  const [collapsedSkillGroups, setCollapsedSkillGroups] = useState<Record<string, boolean>>(() => loadSkillGroupCollapse());
  const [selectedPath, setSelectedPath] = useState("");
  const [search, setSearch] = useState("");
  const [activeView, setActiveView] = useState<"preview" | "edit">("preview");
  const [sidebarKey, setSidebarKey] = useState("library:all");
  const lastScrolledSidebarKeyRef = useRef(sidebarKey);
  const previousSidebarKeyRef = useRef(sidebarKey);
  const skillListScrollPositionsRef = useRef<Record<string, number>>({});
  const isRestoringSkillListScrollRef = useRef(false);
  const pendingSidebarSelectionRestoreRef = useRef<{ sidebarKey: string; targetPath: string } | null>(null);
  const bootOverlayDismissedRef = useRef(false);

  const [loadingSkills, setLoadingSkills] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [originContent, setOriginContent] = useState("");
  const [editContent, setEditContent] = useState("");
  const [statusText, setStatusText] = useState("Ready.");
  const [leftPaneWidth, setLeftPaneWidth] = useState(() => loadPaneWidth(LEFT_PANE_KEY, 224));
  const [middlePaneWidth, setMiddlePaneWidth] = useState(() => loadPaneWidth(MIDDLE_PANE_KEY, 320));
  const [selectionBySidebarKey, setSelectionBySidebarKey] = useState<Record<string, string>>({});
  const [resizingPane, setResizingPane] = useState<"left" | "middle" | null>(null);
  const [skillContextMenu, setSkillContextMenu] = useState<SkillContextMenuState | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(null);
  const [newSkillLinksOpen, setNewSkillLinksOpen] = useState(false);
  const [newSkillTab, setNewSkillTab] = useState<SkillSiteTabKey>("skills");
  const [themeMode, setThemeMode] = useState<AppTheme>(() => resolvePreferredTheme());
  const [collectionsPopupOpen, setCollectionsPopupOpen] = useState(false);
  const [collectionDraftName, setCollectionDraftName] = useState("");
  const [collectionDraftIcon, setCollectionDraftIcon] = useState<CollectionIconKey>("folder");
  const [collectionContextMenu, setCollectionContextMenu] = useState<CollectionContextMenuState | null>(null);
  const [collectionRename, setCollectionRename] = useState<CollectionRenameState | null>(null);
  const [collectionDeleteId, setCollectionDeleteId] = useState<string | null>(null);
  const [detailCollectionPickerOpen, setDetailCollectionPickerOpen] = useState(false);
  const [appStateReady, setAppStateReady] = useState(false);
  const [skillsLoadedOnce, setSkillsLoadedOnce] = useState(false);
  const lastAutoScrolledSelectedPathRef = useRef("");
  const lastSelectedVisibilityRef = useRef(false);

  const selectedSkill = useMemo(
    () => skills.find((skill) => skill.path === selectedPath),
    [skills, selectedPath],
  );

  const toolCounts = useMemo(() => {
    const counter = new Map<string, number>();
    skills.forEach((skill) => {
      counter.set(skill.tool, (counter.get(skill.tool) ?? 0) + 1);
    });
    return counter;
  }, [skills]);

  const sortedTools = useMemo(() => {
    const sourceTools = Array.from(
      new Set([
        ...sources.map((source) => source.tool),
        ...skills.map((skill) => skill.tool),
      ]),
    );
    return sourceTools.sort((a, b) => {
      const aIndex = TOOL_ORDER.indexOf(a);
      const bIndex = TOOL_ORDER.indexOf(b);
      if (aIndex !== -1 || bIndex !== -1) {
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      }
      return a.localeCompare(b);
    });
  }, [skills, sources]);

  const visibleTools = useMemo(
    () => sortedTools.filter((tool) => (toolCounts.get(tool) ?? 0) > 0),
    [sortedTools, toolCounts],
  );

  const collectionCounts = useMemo(() => {
    const counter = new Map<string, number>();
    Object.values(skillCollections).forEach((collectionId) => {
      counter.set(collectionId, (counter.get(collectionId) ?? 0) + 1);
    });
    return counter;
  }, [skillCollections]);

  const selectedCollectionId = selectedPath ? skillCollections[selectedPath] ?? "" : "";
  const selectedCollection = useMemo(
    () => collections.find((collection) => collection.id === selectedCollectionId) ?? null,
    [collections, selectedCollectionId],
  );

  const filteredSkills = useMemo(() => {
    const q = search.trim().toLowerCase();
    return skills.filter((skill) => {
      if (sidebarKey === "library:favorites" && !favorites.includes(skill.path)) {
        return false;
      }
      if (sidebarKey.startsWith("collection:")) {
        const selectedCollectionIdValue = sidebarKey.replace("collection:", "");
        if (skillCollections[skill.path] !== selectedCollectionIdValue) {
          return false;
        }
      }
      if (sidebarKey.startsWith("tool:")) {
        const selectedTool = sidebarKey.replace("tool:", "");
        if (skill.tool !== selectedTool) {
          return false;
        }
      }
      if (!q) {
        return true;
      }
      return (
        skill.name.toLowerCase().includes(q) ||
        skill.description.toLowerCase().includes(q) ||
        skill.relativePath.toLowerCase().includes(q)
      );
    });
  }, [favorites, search, sidebarKey, skillCollections, skills]);

  const skillListHierarchy = useMemo(
    () =>
      deriveSkillListHierarchy({
        skills: filteredSkills,
        collapsedGroups: collapsedSkillGroups,
        search,
      }),
    [collapsedSkillGroups, filteredSkills, search],
  );

  const visibleNavigableSkills = skillListHierarchy.visibleNavigableSkills;

  const isDirty = originContent !== editContent;

  const selectedMeta = useMemo(() => {
    if (!selectedSkill) {
      return "No skill selected";
    }
    return `${selectedSkill.relativePath} · ${formatBytes(editContent)} · ${formatModified(selectedSkill.modifiedUnix)}`;
  }, [editContent, selectedSkill]);

  const selectedFilteredIndex = useMemo(
    () => visibleNavigableSkills.findIndex((skill) => skill.path === selectedPath),
    [selectedPath, visibleNavigableSkills],
  );

  const filteredPositionText = useMemo(() => {
    const total = visibleNavigableSkills.length;
    if (total === 0) {
      return "0 of 0";
    }
    if (selectedFilteredIndex < 0) {
      return `0 of ${total}`;
    }
    return `${selectedFilteredIndex + 1} of ${total}`;
  }, [selectedFilteredIndex, visibleNavigableSkills.length]);

  const previewContent = useMemo(() => {
    const stripped = stripFrontMatterForPreview(editContent).trimStart();
    return stripped || "*No content*";
  }, [editContent]);

  const sidebarScrollShadowKey = useMemo(
    () => `${skills.length}-${sources.length}`,
    [skills.length, sources.length],
  );

  const skillListScrollShadowKey = useMemo(
    () =>
      createSkillListScrollShadowKey({
        sidebarKey,
        search,
        loadingSkills,
      }),
    [loadingSkills, search, sidebarKey],
  );

  const activeSkillSiteTab = useMemo(
    () => SKILL_SITE_TABS.find((tab) => tab.key === newSkillTab) ?? SKILL_SITE_TABS[0],
    [newSkillTab],
  );

  function getFilteredSkillsBySidebarKey(nextSidebarKey: string, query = search): SkillSummary[] {
    const q = query.trim().toLowerCase();
    return skills.filter((skill) => {
      if (nextSidebarKey === "library:favorites" && !favorites.includes(skill.path)) {
        return false;
      }
      if (nextSidebarKey.startsWith("collection:")) {
        const selectedCollectionIdValue = nextSidebarKey.replace("collection:", "");
        if (skillCollections[skill.path] !== selectedCollectionIdValue) {
          return false;
        }
      }
      if (nextSidebarKey.startsWith("tool:")) {
        const selectedTool = nextSidebarKey.replace("tool:", "");
        if (skill.tool !== selectedTool) {
          return false;
        }
      }
      if (!q) {
        return true;
      }
      return (
        skill.name.toLowerCase().includes(q) ||
        skill.description.toLowerCase().includes(q) ||
        skill.relativePath.toLowerCase().includes(q)
      );
    });
  }

  useEffect(() => {
    const pendingSidebarSelectionRestore = pendingSidebarSelectionRestoreRef.current;
    const visiblePaths = filteredSkills.map((skill) => skill.path);
    if (
      !shouldPersistSidebarSelection({
        sidebarKey,
        selectedPath,
        visiblePaths,
        pendingSidebarSelectionRestore,
      })
    ) {
      return;
    }
    setSelectionBySidebarKey((prev) => {
      if (prev[sidebarKey] === selectedPath) {
        return prev;
      }
      return { ...prev, [sidebarKey]: selectedPath };
    });
  }, [filteredSkills, selectedPath, sidebarKey]);

  useEffect(() => {
    const scrollElement = workspaceRef.current?.querySelector<HTMLElement>(".skill-list-pane .pane-scroll");
    if (!scrollElement) {
      isRestoringSkillListScrollRef.current = false;
      previousSidebarKeyRef.current = sidebarKey;
      return;
    }

    const previousSidebarKey = previousSidebarKeyRef.current;
    previousSidebarKeyRef.current = sidebarKey;
    if (previousSidebarKey === sidebarKey) {
      isRestoringSkillListScrollRef.current = false;
      return;
    }

    const savedScrollTop = skillListScrollPositionsRef.current[sidebarKey];
    if (typeof savedScrollTop !== "number" || savedScrollTop <= 0) {
      isRestoringSkillListScrollRef.current = false;
      return;
    }

    isRestoringSkillListScrollRef.current = true;
    let releaseFrameId = 0;
    const restoreFrameId = window.requestAnimationFrame(() => {
      scrollElement.scrollTop = savedScrollTop;
      releaseFrameId = window.requestAnimationFrame(() => {
        skillListScrollPositionsRef.current[sidebarKey] = scrollElement.scrollTop;
        isRestoringSkillListScrollRef.current = false;
      });
    });

    return () => {
      window.cancelAnimationFrame(restoreFrameId);
      window.cancelAnimationFrame(releaseFrameId);
      isRestoringSkillListScrollRef.current = false;
    };
  }, [sidebarKey, skillListScrollShadowKey]);

  useEffect(() => {
    const scrollElement = workspaceRef.current?.querySelector<HTMLElement>(".skill-list-pane .pane-scroll");
    if (!scrollElement) {
      return;
    }

    const syncScrollTop = () => {
      skillListScrollPositionsRef.current[sidebarKey] = scrollElement.scrollTop;
    };

    scrollElement.addEventListener("scroll", syncScrollTop, { passive: true });
    return () => {
      syncScrollTop();
      scrollElement.removeEventListener("scroll", syncScrollTop);
    };
  }, [sidebarKey, skillListScrollShadowKey]);

  useEffect(() => {
    if (!selectedPath) {
      lastSelectedVisibilityRef.current = false;
      return;
    }
    const existsInCurrentList = visibleNavigableSkills.some((skill) => skill.path === selectedPath);
    const pendingSidebarSelectionRestore = pendingSidebarSelectionRestoreRef.current;
    const isRestoringScrollPosition =
      isRestoringSkillListScrollRef.current ||
      (pendingSidebarSelectionRestore?.sidebarKey === sidebarKey &&
        pendingSidebarSelectionRestore.targetPath === selectedPath);
    const shouldScroll = shouldAutoScrollSelectedSkill({
      selectedPath,
      previousSelectedPath: lastAutoScrolledSelectedPathRef.current,
      sidebarKey,
      lastScrolledSidebarKey: lastScrolledSidebarKeyRef.current,
      wasSelectedVisible: lastSelectedVisibilityRef.current,
      isSelectedVisible: existsInCurrentList,
      isRestoringScrollPosition,
    });
    if (!shouldScroll) {
      lastAutoScrolledSelectedPathRef.current = selectedPath;
      lastSelectedVisibilityRef.current = existsInCurrentList;
      if (isRestoringScrollPosition) {
        lastScrolledSidebarKeyRef.current = sidebarKey;
      }
      if (
        pendingSidebarSelectionRestore &&
        pendingSidebarSelectionRestore.sidebarKey === sidebarKey &&
        pendingSidebarSelectionRestore.targetPath === selectedPath
      ) {
        pendingSidebarSelectionRestoreRef.current = null;
      }
      return;
    }
    const sidebarChanged = lastScrolledSidebarKeyRef.current !== sidebarKey;
    const frameId = window.requestAnimationFrame(() => {
      skillRowRefs.current[selectedPath]?.scrollIntoView({
        block: sidebarChanged ? "center" : "nearest",
        inline: "nearest",
      });
      lastAutoScrolledSelectedPathRef.current = selectedPath;
      lastSelectedVisibilityRef.current = existsInCurrentList;
      lastScrolledSidebarKeyRef.current = sidebarKey;
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [selectedPath, sidebarKey, visibleNavigableSkills]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const syncTheme = (event?: MediaQueryList | MediaQueryListEvent) => {
      const matches = event ? event.matches : mediaQuery.matches;
      setThemeMode(matches ? "dark" : "light");
    };

    syncTheme(mediaQuery);
    mediaQuery.addEventListener("change", syncTheme);
    return () => mediaQuery.removeEventListener("change", syncTheme);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = themeMode;
    root.classList.toggle("dark", themeMode === "dark");
    root.classList.toggle("light", themeMode === "light");
  }, [themeMode]);

  useEffect(() => {
    if (bootOverlayDismissedRef.current || !appStateReady || loadingSkills || !skillsLoadedOnce) {
      return;
    }

    bootOverlayDismissedRef.current = dismissBootOverlay();
  }, [appStateReady, loadingSkills, skillsLoadedOnce]);

  useEffect(() => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    if (!appStateReady) {
      return;
    }
    const state: PersistedAppState = { favorites, collections, skillCollections };
    void invoke("save_app_state", { state }).catch((error) => {
      console.error("Failed to persist app state", error);
    });
  }, [appStateReady, collections, favorites, skillCollections]);

  useEffect(() => {
    localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections));
  }, [collections]);

  useEffect(() => {
    localStorage.setItem(SKILL_COLLECTIONS_KEY, JSON.stringify(skillCollections));
  }, [skillCollections]);

  useEffect(() => {
    localStorage.setItem(SKILL_GROUP_COLLAPSE_KEY, JSON.stringify(collapsedSkillGroups));
  }, [collapsedSkillGroups]);

  useEffect(() => {
    localStorage.setItem(LEFT_PANE_KEY, String(leftPaneWidth));
  }, [leftPaneWidth]);

  useEffect(() => {
    localStorage.setItem(MIDDLE_PANE_KEY, String(middlePaneWidth));
  }, [middlePaneWidth]);

  useEffect(() => {
    if (!skillsLoadedOnce) {
      return;
    }

    setSkillCollections((prev) => {
      const validPaths = new Set(skills.map((skill) => skill.path));
      const validCollectionIds = new Set(collections.map((collection) => collection.id));
      const nextEntries = Object.entries(prev).filter(
        ([path, collectionId]) => validPaths.has(path) && validCollectionIds.has(collectionId),
      );
      if (nextEntries.length === Object.keys(prev).length) {
        return prev;
      }
      return Object.fromEntries(nextEntries);
    });
  }, [collections, skills, skillsLoadedOnce]);

  useEffect(() => {
    if (!sidebarKey.startsWith("collection:")) {
      return;
    }
    const currentCollectionId = sidebarKey.replace("collection:", "");
    const exists = collections.some((collection) => collection.id === currentCollectionId);
    if (!exists) {
      setSidebarKey("library:all");
    }
  }, [collections, sidebarKey]);

  useEffect(() => {
    if (!sidebarKey.startsWith("tool:")) {
      return;
    }
    const currentTool = sidebarKey.replace("tool:", "");
    if ((toolCounts.get(currentTool) ?? 0) === 0) {
      setSidebarKey("library:all");
    }
  }, [sidebarKey, toolCounts]);

  async function readSkill(path: string): Promise<boolean> {
    setLoadingDetail(true);
    try {
      const detail = await invoke<SkillDetail>("read_skill", { path });
      setOriginContent(detail.content);
      setEditContent(detail.content);
      setStatusText("Ready.");
      return true;
    } catch (error) {
      setStatusText(`Read failed: ${String(error)}`);
      return false;
    } finally {
      setLoadingDetail(false);
    }
  }

  async function loadSkills(preferredPath?: string) {
    setLoadingSkills(true);
    try {
      const payload = await invoke<ListSkillsResponse>("list_skills");
      setSkills(payload.skills);
      setSources(payload.sources);

      const fallbackPath =
        preferredPath && payload.skills.some((skill) => skill.path === preferredPath)
          ? preferredPath
          : payload.skills[0]?.path ?? "";

      if (fallbackPath) {
        const readSucceeded = await readSkill(fallbackPath);
        const nextSelectedPath = resolveSelectedPathAfterRead({
          currentSelectedPath: selectedPath,
          requestedPath: fallbackPath,
          readSucceeded,
          clearOnFailure: true,
        });
        setSelectedPath(nextSelectedPath);
        if (!readSucceeded) {
          setOriginContent("");
          setEditContent("");
        }
      } else {
        setSelectedPath("");
        setOriginContent("");
        setEditContent("");
      }
    } catch (error) {
      setStatusText(`Load failed: ${String(error)}`);
    } finally {
      setLoadingSkills(false);
      setSkillsLoadedOnce(true);
    }
  }

  async function handleSelectSkill(path: string) {
    await selectSkillPath(path);
  }

  async function selectSkillPath(path: string, options?: { optimisticSelection?: boolean }) {
    const previousSelectedPath = selectedPath;
    if (path === previousSelectedPath && !options?.optimisticSelection) {
      return;
    }
    if (isDirty && !window.confirm("Unsaved changes will be discarded. Continue?")) {
      return;
    }
    if (options?.optimisticSelection && path !== previousSelectedPath) {
      setSelectedPath(path);
    }
    const readSucceeded = await readSkill(path);
    setSelectedPath(
      resolveSelectedPathAfterRead({
        currentSelectedPath: previousSelectedPath,
        requestedPath: path,
        readSucceeded,
        clearOnFailure: false,
      }),
    );
  }

  async function handleSidebarKeyChange(nextSidebarKey: string) {
    const hadSearchQuery = search.trim().length > 0;
    if (hadSearchQuery) {
      setSearch("");
    }
    setSidebarKey(nextSidebarKey);
    const nextFilteredSkills = getFilteredSkillsBySidebarKey(nextSidebarKey, hadSearchQuery ? "" : search);
    if (nextFilteredSkills.length === 0) {
      return;
    }
    const rememberedPath = selectionBySidebarKey[nextSidebarKey];
    const rememberedSkill = rememberedPath ? nextFilteredSkills.find((skill) => skill.path === rememberedPath) : null;
    const targetSkill = rememberedSkill ?? nextFilteredSkills[0];
    const savedScrollTop = skillListScrollPositionsRef.current[nextSidebarKey] ?? 0;
    pendingSidebarSelectionRestoreRef.current =
      savedScrollTop > 0 ? { sidebarKey: nextSidebarKey, targetPath: targetSkill.path } : null;
    if (targetSkill.path === selectedPath) {
      return;
    }
    await selectSkillPath(targetSkill.path, { optimisticSelection: true });
  }

  async function handleSave() {
    if (!selectedPath) {
      return;
    }
    setIsSaving(true);
    try {
      await invoke("save_skill", { path: selectedPath, content: editContent });
      setOriginContent(editContent);
      setStatusText("Saved.");
      await loadSkills(selectedPath);
    } catch (error) {
      setStatusText(`Save failed: ${String(error)}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdateCurrent() {
    if (!selectedPath) {
      return;
    }
    setIsUpdating(true);
    try {
      const result = await invoke<UpdateResult>("update_skill", { path: selectedPath });
      setStatusText(`${result.message}${result.output ? `\n${result.output}` : ""}`);
      await loadSkills(selectedPath);
    } catch (error) {
      setStatusText(`Update failed: ${String(error)}`);
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleRefreshSkills() {
    setNewSkillLinksOpen(false);
    await loadSkills(selectedPath || undefined);
    setStatusText("Refreshed.");
  }

  async function handleStepSkill(delta: -1 | 1) {
    if (visibleNavigableSkills.length === 0 || selectedFilteredIndex < 0) {
      return;
    }

    let targetIndex = selectedFilteredIndex + delta;
    const clampedIndex = Math.min(visibleNavigableSkills.length - 1, Math.max(0, targetIndex));
    const target = visibleNavigableSkills[clampedIndex];
    if (!target || target.path === selectedPath) {
      return;
    }
    await handleSelectSkill(target.path);
  }

  function toggleSkillGroup(groupKey: string) {
    setCollapsedSkillGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  }

  async function handleOpenSkillSite(url: string) {
    setNewSkillLinksOpen(false);
    try {
      await openUrl(url);
      setStatusText(`Opened: ${url}`);
    } catch (error) {
      setStatusText(`Open link failed: ${String(error)}`);
    }
  }

  function handleCreateCollection() {
    const name = collectionDraftName.trim();
    if (!name) {
      return;
    }
    const duplicated = collections.some((collection) => collection.name.toLowerCase() === name.toLowerCase());
    if (duplicated) {
      setStatusText(`Collection already exists: ${name}`);
      return;
    }

    const newCollection: CollectionItem = {
      id: createCollectionId(),
      name,
      icon: collectionDraftIcon,
    };

    setCollections((prev) => [...prev, newCollection]);
    setSidebarKey(`collection:${newCollection.id}`);
    setCollectionsPopupOpen(false);
    setCollectionDraftName("");
    setCollectionDraftIcon("folder");
    setStatusText(`Collection created: ${name}`);
  }

  function handleCollectionContextMenu(event: React.MouseEvent<HTMLButtonElement>, collection: CollectionItem) {
    event.preventDefault();
    event.stopPropagation();
    setSkillContextMenu(null);

    setCollectionContextMenu({ id: collection.id, x: event.clientX, y: event.clientY });
  }

  function requestRenameCollection() {
    if (!collectionContextMenu) {
      return;
    }
    const target = collections.find((collection) => collection.id === collectionContextMenu.id);
    if (!target) {
      setCollectionContextMenu(null);
      return;
    }
    setCollectionContextMenu(null);
    setCollectionRename({ id: target.id, name: target.name });
  }

  function confirmRenameCollection() {
    if (!collectionRename) {
      return;
    }
    const nextName = collectionRename.name.trim();
    if (!nextName) {
      return;
    }
    const duplicated = collections.some(
      (collection) =>
        collection.id !== collectionRename.id && collection.name.toLowerCase() === nextName.toLowerCase(),
    );
    if (duplicated) {
      setStatusText(`Collection already exists: ${nextName}`);
      return;
    }
    setCollections((prev) =>
      prev.map((collection) => (collection.id === collectionRename.id ? { ...collection, name: nextName } : collection)),
    );
    setCollectionRename(null);
    setStatusText(`Collection renamed: ${nextName}`);
  }

  function requestDeleteCollection() {
    if (!collectionContextMenu) {
      return;
    }
    setCollectionDeleteId(collectionContextMenu.id);
    setCollectionContextMenu(null);
  }

  function confirmDeleteCollection() {
    if (!collectionDeleteId) {
      return;
    }
    const target = collections.find((collection) => collection.id === collectionDeleteId);
    if (!target) {
      setCollectionDeleteId(null);
      return;
    }

    const targetSidebarKey = `collection:${collectionDeleteId}`;
    setCollections((prev) => prev.filter((collection) => collection.id !== collectionDeleteId));
    setSkillCollections((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([, collectionId]) => collectionId !== collectionDeleteId)),
    );
    if (sidebarKey === targetSidebarKey) {
      setSidebarKey("library:all");
    }
    setCollectionDeleteId(null);
    setStatusText(`Collection deleted: ${target.name}`);
  }

  function toggleCollectionForSelectedSkill(collectionId: string) {
    if (!selectedPath) {
      return;
    }
    setDetailCollectionPickerOpen(false);
    setSkillCollections((prev) => {
      const current = prev[selectedPath];
      if (current === collectionId) {
        const next = { ...prev };
        delete next[selectedPath];
        return next;
      }
      return { ...prev, [selectedPath]: collectionId };
    });
  }

  function toggleFavorite() {
    if (!selectedPath) {
      return;
    }
    setFavorites((prev) => toggleFavoritePath(prev, selectedPath));
  }

  function handleFavoritePathToggle(path: string) {
    setFavorites((prev) => toggleFavoritePath(prev, path));
  }

  async function revealSelectedSkill() {
    if (!selectedPath) {
      return;
    }
    try {
      await revealItemInDir(selectedPath);
    } catch (error) {
      setStatusText(`Reveal failed: ${String(error)}`);
    }
  }

  function requestDeleteSkill(path: string, name: string) {
    setSkillContextMenu(null);
    setDeleteConfirm({ path, name, step: 1 });
  }

  function handleToolbarDeleteSkill() {
    if (!selectedSkill) {
      return;
    }
    requestDeleteSkill(selectedSkill.path, selectedSkill.name);
  }

  function handleSkillContextMenu(event: React.MouseEvent<HTMLButtonElement>, skill: SkillSummary) {
    event.preventDefault();
    event.stopPropagation();
    setCollectionContextMenu(null);

    setSkillContextMenu({
      path: skill.path,
      name: skill.name,
      x: event.clientX,
      y: event.clientY,
    });
  }

  async function handleContextShowInFolder() {
    if (!skillContextMenu) {
      return;
    }
    const targetPath = skillContextMenu.path;
    setSkillContextMenu(null);

    try {
      await revealItemInDir(targetPath);
    } catch (error) {
      setStatusText(`Reveal failed: ${String(error)}`);
    }
  }

  async function handleContextDeleteSkill() {
    if (!skillContextMenu) {
      return;
    }
    const targetPath = skillContextMenu.path;
    const targetName = skillContextMenu.name;
    requestDeleteSkill(targetPath, targetName);
  }

  async function confirmDeleteSkill() {
    if (!deleteConfirm) {
      return;
    }
    if (deleteConfirm.step === 1) {
      setDeleteConfirm({ ...deleteConfirm, step: 2 });
      return;
    }

    const targetPath = deleteConfirm.path;
    const targetName = deleteConfirm.name;
    setDeleteConfirm(null);

    try {
      await invoke("delete_skill", { path: targetPath });
      setFavorites((prev) => prev.filter((item) => item !== targetPath));
      setStatusText(`Deleted: ${targetName}`);
      await loadSkills(selectedPath === targetPath ? undefined : selectedPath);
    } catch (error) {
      setStatusText(`Delete failed: ${String(error)}`);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function syncPersistedAppState() {
      const localState = initialAppStateRef.current;
      try {
        const persistedState = await invoke<PersistedAppState>("load_app_state");
        if (cancelled) {
          return;
        }

        if (hasPersistedAppState(persistedState)) {
          setFavorites(persistedState.favorites);
          setCollections(persistedState.collections);
          setSkillCollections(persistedState.skillCollections);
        } else if (hasPersistedAppState(localState)) {
          await invoke("save_app_state", { state: localState });
        }
      } catch (error) {
        console.error("Failed to load persisted app state", error);
      } finally {
        if (!cancelled) {
          setAppStateReady(true);
        }
      }
    }

    void syncPersistedAppState();
    loadSkills();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const disableDefaultContextMenu = (event: MouseEvent) => {
      const target = event.target;
      const isEditableTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable);

      if (isEditableTarget) {
        setSkillContextMenu(null);
        setCollectionContextMenu(null);
        return;
      }

      event.preventDefault();
      setSkillContextMenu(null);
      setCollectionContextMenu(null);
    };

    window.addEventListener("contextmenu", disableDefaultContextMenu, true);
    return () => window.removeEventListener("contextmenu", disableDefaultContextMenu, true);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const isEditingInput =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable);

      if (isEditingInput) {
        return;
      }

      if (event.key === "Escape" && deleteConfirm) {
        setDeleteConfirm(null);
        return;
      }
      if (event.key === "Escape" && collectionsPopupOpen) {
        setCollectionsPopupOpen(false);
        return;
      }
      if (event.key === "Escape" && collectionRename) {
        setCollectionRename(null);
        return;
      }
      if (event.key === "Escape" && collectionDeleteId) {
        setCollectionDeleteId(null);
        return;
      }
      const isMacCommand = event.metaKey || event.ctrlKey;
      if (isMacCommand && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (!isSaving && isDirty) {
          void handleSave();
        }
      }
      if (isMacCommand && event.key.toLowerCase() === "u") {
        event.preventDefault();
        if (!isUpdating) {
          void handleUpdateCurrent();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [collectionDeleteId, collectionRename, collectionsPopupOpen, deleteConfirm, isDirty, isSaving, isUpdating]);

  useEffect(() => {
    if (!skillContextMenu) {
      return;
    }

    const closeMenu = () => setSkillContextMenu(null);
    const onWindowClick = (event: MouseEvent) => {
      const menuEl = skillContextMenuRef.current;
      const target = event.target;
      if (menuEl && target instanceof Node && menuEl.contains(target)) {
        return;
      }
      closeMenu();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };

    window.addEventListener("click", onWindowClick);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    return () => {
      window.removeEventListener("click", onWindowClick);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, [skillContextMenu]);

  useEffect(() => {
    if (!newSkillLinksOpen) {
      return;
    }

    const closePanel = () => setNewSkillLinksOpen(false);
    const onWindowClick = (event: MouseEvent) => {
      const panelEl = newSkillActionsRef.current;
      const target = event.target;
      if (panelEl && target instanceof Node && panelEl.contains(target)) {
        return;
      }
      closePanel();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePanel();
      }
    };

    window.addEventListener("click", onWindowClick);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", closePanel);
    window.addEventListener("scroll", closePanel, true);
    return () => {
      window.removeEventListener("click", onWindowClick);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", closePanel);
      window.removeEventListener("scroll", closePanel, true);
    };
  }, [newSkillLinksOpen]);

  useEffect(() => {
    if (!skillContextMenu) {
      return;
    }
    const menuEl = skillContextMenuRef.current;
    if (!menuEl) {
      return;
    }
    const frameId = window.requestAnimationFrame(() => {
      const rect = menuEl.getBoundingClientRect();
      setSkillContextMenu((prev) => {
        if (!prev) {
          return prev;
        }
        const next = clampFloatingMenuPosition(prev.x, prev.y, rect.width, rect.height);
        if (next.x === prev.x && next.y === prev.y) {
          return prev;
        }
        return { ...prev, ...next };
      });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [skillContextMenu]);

  useEffect(() => {
    if (!collectionContextMenu) {
      return;
    }
    const menuEl = collectionsMenuRef.current;
    if (!menuEl) {
      return;
    }
    const frameId = window.requestAnimationFrame(() => {
      const rect = menuEl.getBoundingClientRect();
      setCollectionContextMenu((prev) => {
        if (!prev) {
          return prev;
        }
        const next = clampFloatingMenuPosition(prev.x, prev.y, rect.width, rect.height);
        if (next.x === prev.x && next.y === prev.y) {
          return prev;
        }
        return { ...prev, ...next };
      });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [collectionContextMenu]);

  useEffect(() => {
    if (!collectionContextMenu) {
      return;
    }

    const closeMenu = () => setCollectionContextMenu(null);
    const onWindowClick = (event: MouseEvent) => {
      const menuEl = collectionsMenuRef.current;
      const target = event.target;
      if (menuEl && target instanceof Node && menuEl.contains(target)) {
        return;
      }
      closeMenu();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };

    window.addEventListener("click", onWindowClick);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    return () => {
      window.removeEventListener("click", onWindowClick);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, [collectionContextMenu]);

  useEffect(() => {
    if (!detailCollectionPickerOpen) {
      return;
    }
    const closePanel = () => setDetailCollectionPickerOpen(false);
    const onWindowClick = (event: MouseEvent) => {
      const panelEl = detailCollectionPickerRef.current;
      const target = event.target;
      if (panelEl && target instanceof Node && panelEl.contains(target)) {
        return;
      }
      closePanel();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePanel();
      }
    };

    window.addEventListener("click", onWindowClick);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", closePanel);
    window.addEventListener("scroll", closePanel, true);
    return () => {
      window.removeEventListener("click", onWindowClick);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", closePanel);
      window.removeEventListener("scroll", closePanel, true);
    };
  }, [detailCollectionPickerOpen]);

  useEffect(() => {
    if (!resizingPane) {
      return;
    }

    const prevCursor = document.body.style.cursor;
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (event: MouseEvent) => {
      const workspace = workspaceRef.current;
      if (!workspace) {
        return;
      }
      const rect = workspace.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;

      if (resizingPane === "left") {
        const rawLeft = pointerX - LEFT_SPLITTER_WIDTH / 2;
        const dynamicMax = rect.width - middlePaneWidth - DETAIL_MIN - LEFT_SPLITTER_WIDTH;
        const maxLeft = Math.max(LEFT_MIN, Math.min(LEFT_MAX, dynamicMax));
        const nextLeft = Math.round(Math.min(maxLeft, Math.max(LEFT_MIN, rawLeft)));
        setLeftPaneWidth(nextLeft);
        return;
      }

      const rawMiddle = pointerX - leftPaneWidth - LEFT_SPLITTER_WIDTH;
      const dynamicMax = rect.width - leftPaneWidth - DETAIL_MIN - LEFT_SPLITTER_WIDTH;
      const maxMiddle = Math.max(MIDDLE_MIN, Math.min(MIDDLE_MAX, dynamicMax));
      const nextMiddle = Math.round(Math.min(maxMiddle, Math.max(MIDDLE_MIN, rawMiddle)));
      setMiddlePaneWidth(nextMiddle);
    };

    const onMouseUp = () => {
      setResizingPane(null);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevUserSelect;
    };
  }, [leftPaneWidth, middlePaneWidth, resizingPane]);

  async function handleWindowDragStart(event: React.MouseEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }
    try {
      await appWindow.startDragging();
    } catch {
      // fallback keeps data-tauri-drag-region behavior
    }
  }

  function handleResizeStart(pane: "left" | "middle", event: React.MouseEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    setResizingPane(pane);
  }

  function handleDetailPaneResizeStart(event: React.MouseEvent<HTMLDivElement>) {
    handleResizeStart("middle", event);
  }

  function handleToggleNewSkillLinks() {
    setNewSkillLinksOpen((prev) => {
      const next = !prev;
      if (next) {
        setNewSkillTab("skills");
      }
      return next;
    });
  }

  return (
    <IconContext.Provider value={{ weight: "bold", size: 16 }}>
      <main
        className="app-shell"
        style={
          {
            "--left-col-width": `${leftPaneWidth}px`,
            "--middle-col-width": `${middlePaneWidth}px`,
          } as CSSProperties
        }
      >
        <div className="window-drag-region" data-tauri-drag-region onMouseDown={handleWindowDragStart} />
        <section className="workspace" ref={workspaceRef}>
        <LeftSidebar
          sidebarScrollShadowKey={sidebarScrollShadowKey}
          sidebarKey={sidebarKey}
          skillsCount={skills.length}
          favoritesCount={favorites.length}
          visibleTools={visibleTools}
          toolCounts={toolCounts}
          collections={collections}
          collectionCounts={collectionCounts}
          newSkillActionsRef={newSkillActionsRef}
          newSkillLinksOpen={newSkillLinksOpen}
          newSkillTab={newSkillTab}
          activeSkillSiteTab={activeSkillSiteTab}
          onSidebarKeyChange={(nextSidebarKey) => void handleSidebarKeyChange(nextSidebarKey)}
          onOpenCollectionCreate={() => setCollectionsPopupOpen(true)}
          onCollectionContextMenu={handleCollectionContextMenu}
          onNewSkillTabChange={setNewSkillTab}
          onOpenSkillSite={(url) => void handleOpenSkillSite(url)}
          onRefreshSkills={() => void handleRefreshSkills()}
          onToggleNewSkillLinks={handleToggleNewSkillLinks}
        />
        <div
          className={`pane-resizer ${resizingPane === "left" ? "is-active" : ""}`}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize left panel"
          onMouseDown={(event) => handleResizeStart("left", event)}
        />

        <SkillListPane
          search={search}
          loadingSkills={loadingSkills}
          filteredSkills={filteredSkills}
          skillListHierarchy={skillListHierarchy}
          selectedPath={selectedPath}
          favorites={favorites}
          themeMode={themeMode}
          scrollShadowKey={skillListScrollShadowKey}
          onSearchChange={setSearch}
          onClearSearch={() => setSearch("")}
          onSelectSkill={(path) => void handleSelectSkill(path)}
          onToggleFavorite={handleFavoritePathToggle}
          onOpenSkillContextMenu={handleSkillContextMenu}
          onToggleGroup={toggleSkillGroup}
          registerSkillRow={(path, element) => {
            skillRowRefs.current[path] = element;
          }}
        />

        <DetailPane
          resizingPane={resizingPane}
          activeView={activeView}
          favoriteSelected={favorites.includes(selectedPath)}
          selectedPath={selectedPath}
          selectedCollection={selectedCollection}
          selectedCollectionId={selectedCollectionId}
          collections={collections}
          detailCollectionPickerOpen={detailCollectionPickerOpen}
          detailCollectionPickerRef={detailCollectionPickerRef}
          loadingDetail={loadingDetail}
          previewContent={previewContent}
          themeMode={themeMode}
          editContent={editContent}
          selectedMeta={selectedMeta}
          isSaving={isSaving}
          isDirty={isDirty}
          statusText={statusText}
          filteredPositionText={filteredPositionText}
          visibleNavigableSkillsLength={visibleNavigableSkills.length}
          selectedFilteredIndex={selectedFilteredIndex}
          onDetailPaneResizeStart={handleDetailPaneResizeStart}
          onViewChange={setActiveView}
          onToggleFavorite={toggleFavorite}
          onToggleCollectionPicker={() => setDetailCollectionPickerOpen((prev) => !prev)}
          onToggleCollectionForSelectedSkill={toggleCollectionForSelectedSkill}
          onRevealSelectedSkill={() => void revealSelectedSkill()}
          onDeleteSelectedSkill={handleToolbarDeleteSkill}
          onStepSkill={(delta) => void handleStepSkill(delta)}
          onEditContentChange={setEditContent}
        />
        </section>

        {collectionsPopupOpen ? (
          <CollectionModal
            draftName={collectionDraftName}
            draftIcon={collectionDraftIcon}
            onDraftNameChange={setCollectionDraftName}
            onDraftIconChange={setCollectionDraftIcon}
            onClose={() => setCollectionsPopupOpen(false)}
            onCreate={handleCreateCollection}
          />
        ) : null}

        {skillContextMenu ? (
          <SkillContextMenu
            menuRef={skillContextMenuRef}
            x={skillContextMenu.x}
            y={skillContextMenu.y}
            ariaLabel="Skill actions"
            items={[
              {
                label: "Show in Finder",
                icon: <FolderOpen size={16} />,
                onClick: () => void handleContextShowInFolder(),
              },
              {
                label: "Delete",
                icon: <Trash size={16} />,
                danger: true,
                onClick: () => void handleContextDeleteSkill(),
              },
            ]}
          />
        ) : null}

        {collectionContextMenu ? (
          <SkillContextMenu
            menuRef={collectionsMenuRef}
            x={collectionContextMenu.x}
            y={collectionContextMenu.y}
            ariaLabel="Collection actions"
            items={[
              {
                label: "Rename",
                icon: <PencilSimple size={16} />,
                onClick: requestRenameCollection,
              },
              {
                label: "Delete",
                icon: <Trash size={16} />,
                danger: true,
                onClick: requestDeleteCollection,
              },
            ]}
          />
        ) : null}

        {deleteConfirm ? (
          <ConfirmDialog
            ariaLabel="Delete skill confirmation"
            title={deleteConfirm.step === 1 ? "Delete Skill?" : "Final Confirmation"}
            description={
              deleteConfirm.step === 1
                ? `Delete "${deleteConfirm.name}" now?`
                : "This action cannot be undone. Confirm delete again."
            }
            cancelLabel="Cancel"
            confirmLabel={deleteConfirm.step === 1 ? "Continue" : "Delete"}
            confirmVariant="danger"
            onCancel={() => setDeleteConfirm(null)}
            onConfirm={() => void confirmDeleteSkill()}
          />
        ) : null}

        {collectionRename ? (
          <ConfirmDialog
            ariaLabel="Rename collection"
            title="Rename Collection"
            description="Update the collection name."
            cancelLabel="Cancel"
            confirmLabel="Save"
            confirmVariant="primary"
            inputValue={collectionRename.name}
            inputMaxLength={40}
            inputAutoFocus
            onInputChange={(nextName) => {
              setCollectionRename((prev) => (prev ? { ...prev, name: nextName } : prev));
            }}
            onCancel={() => setCollectionRename(null)}
            onConfirm={confirmRenameCollection}
          />
        ) : null}

        {collectionDeleteId ? (
          <ConfirmDialog
            ariaLabel="Delete collection confirmation"
            title="Delete Collection?"
            description="This only removes the category. Skills will not be deleted."
            cancelLabel="Cancel"
            confirmLabel="Delete"
            confirmVariant="danger"
            onCancel={() => setCollectionDeleteId(null)}
            onConfirm={confirmDeleteCollection}
          />
        ) : null}
      </main>
    </IconContext.Provider>
  );
}

export default App;
