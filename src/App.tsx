import { type ChangeEvent, type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Button, ScrollShadow, Spinner } from "@heroui/react";
import { ClaudeCode, Cline, Codex, Cursor, GithubCopilot, Windsurf } from "@lobehub/icons";
import noSkillsIllustration from "./assets/no-skills.svg";
import noSkillsIllustrationDark from "./assets/no-skills-dark.svg";
import {
  ArrowLeft,
  ArrowRight,
  ArrowsClockwise,
  BugBeetle,
  CaretRight,
  Check,
  Code,
  Cpu,
  Database,
  Eye,
  FolderOpen,
  FolderSimple,
  FolderSimpleStar,
  GlobeHemisphereWest,
  Hammer,
  IconContext,
  Plus,
  PencilSimple,
  RocketLaunch,
  Sparkle,
  SquaresFour,
  Star,
  TerminalWindow,
  Trash,
  Wrench,
} from "@phosphor-icons/react";
import MarkdownPreview from "@uiw/react-markdown-preview";
import { deriveSkillListHierarchy, type GroupedSkillGroup } from "./skillListHierarchy";

type SkillSummary = {
  id: string;
  name: string;
  description: string;
  version?: string;
  tool: string;
  path: string;
  relativePath: string;
  sourceRoot: string;
  modifiedUnix?: number;
};

type SkillSourceSummary = {
  tool: string;
  rootPath: string;
  exists: boolean;
  skillCount: number;
};

type ListSkillsResponse = {
  skills: SkillSummary[];
  sources: SkillSourceSummary[];
};

type SkillDetail = {
  path: string;
  content: string;
};

type UpdateResult = {
  target: string;
  repoRoot?: string;
  updated: boolean;
  message: string;
  output: string;
};

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

type CollectionIconKey =
  | "folder"
  | "star"
  | "code"
  | "terminal"
  | "database"
  | "wrench"
  | "rocket"
  | "sparkle"
  | "cpu"
  | "globe"
  | "bug"
  | "hammer";

type CollectionItem = {
  id: string;
  name: string;
  icon: CollectionIconKey;
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

type PersistedAppState = {
  favorites: string[];
  collections: CollectionItem[];
  skillCollections: Record<string, string>;
};

type AppTheme = "light" | "dark";

type SkillSiteTabKey = "openclaw" | "skills";

type SkillSite = {
  label: string;
  url: string;
};

type SkillSiteTab = {
  key: SkillSiteTabKey;
  label: string;
  sites: SkillSite[];
};

const FAVORITES_KEY = "skillskr.favorites.v1";
const COLLECTIONS_KEY = "skillskr.collections.v1";
const SKILL_COLLECTIONS_KEY = "skillskr.skillCollections.v1";
const SKILL_GROUP_COLLAPSE_KEY = "skillskr.skillGroupCollapse.v1";
const TOOL_ORDER = ["Claude Code", "Cursor", "Windsurf", "Codex", "Agents", "Continue"];
const LEFT_PANE_KEY = "skillskr.leftPaneWidth.v1";
const MIDDLE_PANE_KEY = "skillskr.middlePaneWidth.v1";
const LEFT_SPLITTER_WIDTH = 8;
const LEFT_MIN = 180;
const LEFT_MAX = 420;
const MIDDLE_MIN = 260;
const MIDDLE_MAX = 520;
const DETAIL_MIN = 360;
const SKILL_SITE_TABS: SkillSiteTab[] = [
  {
    key: "skills",
    label: "Skills",
    sites: [
      { label: "ComposioHQ/awesome-claude-skills", url: "https://github.com/ComposioHQ/awesome-claude-skills" },
      { label: "JimLiu/baoyu-skills", url: "https://github.com/JimLiu/baoyu-skills" },
      { label: "anthropics/skills", url: "https://github.com/anthropics/skills" },
      { label: "stellarlinkco/myclaude", url: "https://github.com/stellarlinkco/myclaude" },
      { label: "pbakaus/impeccable", url: "https://github.com/pbakaus/impeccable" },
      { label: "vercel-labs/skills", url: "https://github.com/vercel-labs/skills" },
    ],
  },
  {
    key: "openclaw",
    label: "OpenClaw",
    sites: [
      { label: "SkillHub", url: "https://skillhub.tencent.com/" },
      { label: "ClawHub", url: "https://clawhub.ai/" },
    ],
  },
];

const COLLECTION_ICON_OPTIONS: Array<{ key: CollectionIconKey; label: string }> = [
  { key: "folder", label: "Folder" },
  { key: "star", label: "Star" },
  { key: "code", label: "Code" },
  { key: "terminal", label: "Terminal" },
  { key: "database", label: "Database" },
  { key: "wrench", label: "Wrench" },
  { key: "rocket", label: "Rocket" },
  { key: "sparkle", label: "Sparkle" },
  { key: "cpu", label: "CPU" },
  { key: "globe", label: "Globe" },
  { key: "bug", label: "Bug" },
  { key: "hammer", label: "Hammer" },
];
const TOOL_ICON_GRADIENTS: Record<string, string> = {
  claude: "linear-gradient(135deg, #f6b084 0%, #d97757 100%)",
  cursor: "linear-gradient(135deg, #67e8f9 0%, #3b82f6 100%)",
  codex: "linear-gradient(180deg, #b1a7ff 0%, #7a9dff 52%, #3941ff 100%)",
  windsurf: "linear-gradient(135deg, #5eead4 0%, #0ea5e9 56%, #2563eb 100%)",
  continue: "linear-gradient(135deg, #86efac 0%, #22c55e 48%, #0284c7 100%)",
  agents: "linear-gradient(135deg, #f59e0b 0%, #ef4444 52%, #8b5cf6 100%)",
  generic: "linear-gradient(135deg, #94a3b8 0%, #64748b 100%)",
};

function formatBytes(content: string): string {
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

function formatModified(unix?: number): string {
  if (!unix) {
    return "Unknown";
  }
  const date = new Date(unix * 1000);
  return date.toLocaleString();
}

function resolveToolKey(tool: string): string {
  const lower = tool.toLowerCase();
  if (lower.includes("claude")) return "claude";
  if (lower.includes("cursor")) return "cursor";
  if (lower.includes("codex")) return "codex";
  if (lower.includes("windsurf")) return "windsurf";
  if (lower.includes("continue")) return "continue";
  if (lower.includes("agent")) return "agents";
  return "generic";
}

type ToolIconStyle = CSSProperties & { "--tool-gradient"?: string };

function toolIconStyle(tool: string): ToolIconStyle {
  const key = resolveToolKey(tool);
  return { "--tool-gradient": TOOL_ICON_GRADIENTS[key] ?? TOOL_ICON_GRADIENTS.generic };
}

function renderToolIcon(tool: string): ReactNode {
  const key = resolveToolKey(tool);
  const size = 12;
  if (key === "claude") return <ClaudeCode size={size} />;
  if (key === "cursor") return <Cursor size={size} />;
  if (key === "codex") return <Codex size={size} />;
  if (key === "windsurf") return <Windsurf size={size} />;
  if (key === "continue") return <GithubCopilot size={size} />;
  if (key === "agents") return <Cline size={size} />;

  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M3.75 2.5a.75.75 0 0 0-.75.75v9.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-9.5a.75.75 0 0 0-.75-.75zm-2.25.75A2.25 2.25 0 0 1 3.75 1h8.5a2.25 2.25 0 0 1 2.25 2.25v9.5A2.25 2.25 0 0 1 12.25 15h-8.5A2.25 2.25 0 0 1 1.5 12.75zm3 1.5a.75.75 0 0 1 .75-.75h5.5a.75.75 0 0 1 0 1.5h-5.5a.75.75 0 0 1-.75-.75m0 2.5a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 0 1.5h-3.5a.75.75 0 0 1-.75-.75m0 2.5a.75.75 0 0 1 .75-.75h5.5a.75.75 0 0 1 0 1.5h-5.5a.75.75 0 0 1-.75-.75"
        clipRule="evenodd"
      />
    </svg>
  );
}

function renderCollectionIcon(icon: CollectionIconKey, size = 16): ReactNode {
  if (icon === "folder") return <FolderSimple size={size} />;
  if (icon === "star") return <FolderSimpleStar size={size} />;
  if (icon === "code") return <Code size={size} />;
  if (icon === "terminal") return <TerminalWindow size={size} />;
  if (icon === "database") return <Database size={size} />;
  if (icon === "wrench") return <Wrench size={size} />;
  if (icon === "rocket") return <RocketLaunch size={size} />;
  if (icon === "sparkle") return <Sparkle size={size} />;
  if (icon === "cpu") return <Cpu size={size} />;
  if (icon === "globe") return <GlobeHemisphereWest size={size} />;
  if (icon === "bug") return <BugBeetle size={size} />;
  return <Hammer size={size} />;
}

function loadCollections(): CollectionItem[] {
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
        icon: COLLECTION_ICON_OPTIONS.some((option) => option.key === item.icon)
          ? (item.icon as CollectionIconKey)
          : "folder",
      }))
      .filter((item) => item.name.length > 0);
  } catch {
    return [];
  }
}

function loadSkillCollections(): Record<string, string> {
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

function loadSkillGroupCollapse(): Record<string, boolean> {
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

function createCollectionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `collection-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadFavorites(): string[] {
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

function loadPaneWidth(storageKey: string, fallback: number): number {
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

function loadLocalAppState(): PersistedAppState {
  return {
    favorites: loadFavorites(),
    collections: loadCollections(),
    skillCollections: loadSkillCollections(),
  };
}

function resolvePreferredTheme(): AppTheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function clampFloatingMenuPosition(x: number, y: number, width: number, height: number) {
  const viewportPadding = 8;
  return {
    x: Math.min(Math.max(x, viewportPadding), Math.max(viewportPadding, window.innerWidth - width - viewportPadding)),
    y: Math.min(Math.max(y, viewportPadding), Math.max(viewportPadding, window.innerHeight - height - viewportPadding)),
  };
}

function hasPersistedAppState(state: PersistedAppState): boolean {
  return state.favorites.length > 0 || state.collections.length > 0 || Object.keys(state.skillCollections).length > 0;
}

function stripFrontMatterForPreview(content: string): string {
  const frontMatterPattern = /^\uFEFF?(?:\s*\r?\n)*---\r?\n[\s\S]*?\r?\n---(?:\r?\n)?/;
  return content.replace(frontMatterPattern, "");
}

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
    () => `${sidebarKey}-${search}-${loadingSkills ? "loading" : skillListHierarchy.items.length}`,
    [loadingSkills, search, sidebarKey, skillListHierarchy.items.length],
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
    if (!selectedPath) {
      return;
    }
    const existsInCurrentList = filteredSkills.some((skill) => skill.path === selectedPath);
    if (!existsInCurrentList) {
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
    if (!selectedPath) {
      return;
    }
    const existsInCurrentList = visibleNavigableSkills.some((skill) => skill.path === selectedPath);
    if (!existsInCurrentList) {
      return;
    }
    const sidebarChanged = lastScrolledSidebarKeyRef.current !== sidebarKey;
    const frameId = window.requestAnimationFrame(() => {
      skillRowRefs.current[selectedPath]?.scrollIntoView({
        block: sidebarChanged ? "center" : "nearest",
        inline: "nearest",
      });
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

  async function readSkill(path: string) {
    setLoadingDetail(true);
    try {
      const detail = await invoke<SkillDetail>("read_skill", { path });
      setOriginContent(detail.content);
      setEditContent(detail.content);
      setStatusText("Ready.");
    } catch (error) {
      setStatusText(`Read failed: ${String(error)}`);
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
        setSelectedPath(fallbackPath);
        await readSkill(fallbackPath);
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
    if (path === selectedPath) {
      return;
    }
    if (isDirty && !window.confirm("Unsaved changes will be discarded. Continue?")) {
      return;
    }
    setSelectedPath(path);
    await readSkill(path);
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
    if (targetSkill.path === selectedPath) {
      return;
    }
    await handleSelectSkill(targetSkill.path);
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
    setFavorites((prev) =>
      prev.includes(selectedPath) ? prev.filter((path) => path !== selectedPath) : [...prev, selectedPath],
    );
  }

  function handleSkillRowFavoriteClick(event: React.MouseEvent<HTMLSpanElement>, path: string) {
    event.preventDefault();
    event.stopPropagation();

    const alreadyFavorite = favorites.includes(path);
    setFavorites((prev) => (alreadyFavorite ? prev.filter((item) => item !== path) : [...prev, path]));
  }

  function handleSkillRowFavoriteKeyDown(event: React.KeyboardEvent<HTMLSpanElement>, path: string) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    const alreadyFavorite = favorites.includes(path);
    setFavorites((prev) => (alreadyFavorite ? prev.filter((item) => item !== path) : [...prev, path]));
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

  function renderSelectableSkillRow(
    skill: SkillSummary,
    options?: {
      rowClassName?: string;
      showParentBadge?: boolean;
      groupCount?: number;
      groupExpanded?: boolean;
      onToggleGroup?: (event: React.MouseEvent<HTMLButtonElement>) => void;
    },
  ) {
    const isFavorite = favorites.includes(skill.path);
    const isActive = selectedPath === skill.path;

    return (
      <div className={`skill-row ${isActive ? "active shadow-sm" : ""} ${options?.rowClassName ?? ""}`.trim()}>
        <button
          className="skill-row-main"
          onClick={() => void handleSelectSkill(skill.path)}
          onContextMenu={(event) => handleSkillContextMenu(event, skill)}
          ref={(element) => {
            skillRowRefs.current[skill.path] = element;
          }}
        >
          <span className="tool-badge" aria-hidden="true">
            <span className="tool-badge-icon" style={toolIconStyle(skill.tool)}>
              {renderToolIcon(skill.tool)}
            </span>
          </span>
          <span className="mail-main">
            <span className="mail-name-row">
              <span className="mail-name">{skill.name}</span>
              {options?.showParentBadge ? <span className="skill-parent-chip">Parent</span> : null}
            </span>
          </span>
        </button>
        <div className="skill-row-side">
          {typeof options?.groupCount === "number" ? <span className="skill-group-count">{options.groupCount}</span> : null}
          <span
            className={`mail-star ${isFavorite ? "on" : ""}`}
            role="button"
            tabIndex={0}
            aria-label={isFavorite ? "Unfavorite skill" : "Favorite skill"}
            onClick={(event) => handleSkillRowFavoriteClick(event, skill.path)}
            onKeyDown={(event) => handleSkillRowFavoriteKeyDown(event, skill.path)}
          >
            <Star size={16} weight={isFavorite ? "fill" : "bold"} />
          </span>
          {options?.onToggleGroup ? (
            <button
              type="button"
              className={`skill-group-toggle ${options.groupExpanded ? "is-expanded" : ""}`}
              aria-label={options.groupExpanded ? "Collapse skill group" : "Expand skill group"}
              aria-expanded={options.groupExpanded}
              onClick={options.onToggleGroup}
            >
              <CaretRight size={14} />
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  function renderGroupHeader(group: GroupedSkillGroup) {
    const tool = group.parentSkill?.tool ?? group.childSkills[0]?.tool ?? "generic";

    return (
      <div className="skill-row skill-row-group-only">
        <button
          type="button"
          className="skill-row-main skill-row-group-main"
          aria-label={group.isExpanded ? "Collapse skill group" : "Expand skill group"}
          aria-expanded={group.isExpanded}
          onClick={() => toggleSkillGroup(group.groupKey)}
        >
          <span className="tool-badge" aria-hidden="true">
            <span className="tool-badge-icon" style={toolIconStyle(tool)}>
              {renderToolIcon(tool)}
            </span>
          </span>
          <span className="mail-main">
            <span className="mail-name-row">
              <span className="mail-name">{group.groupLabel}</span>
            </span>
          </span>
        </button>
        <div className="skill-row-side">
          <span className="skill-group-count">{group.childCount}</span>
          <button
            type="button"
            className={`skill-group-toggle ${group.isExpanded ? "is-expanded" : ""}`}
            aria-label={group.isExpanded ? "Collapse skill group" : "Expand skill group"}
            aria-expanded={group.isExpanded}
            onClick={() => toggleSkillGroup(group.groupKey)}
          >
            <CaretRight size={14} />
          </button>
        </div>
      </div>
    );
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
        <aside className="left-sidebar">
          <ScrollShadow
            key={sidebarScrollShadowKey}
            className="sidebar-scroll"
            hideScrollBar
            orientation="vertical"
            variant="fade"
            size={40}
            offset={10}
          >
            <div className="sidebar-section">
              <h3 className="left-title">Library</h3>
              <button
                className={`nav-row ${sidebarKey === "library:all" ? "active" : ""}`}
                onClick={() => void handleSidebarKeyChange("library:all")}
              >
                <span className="nav-main">
                  <span className="nav-icon">
                    <SquaresFour size={16} />
                  </span>
                  <span>All Skills</span>
                </span>
                <span className="nav-count">{skills.length}</span>
              </button>
              <button
                className={`nav-row ${sidebarKey === "library:favorites" ? "active" : ""}`}
                onClick={() => void handleSidebarKeyChange("library:favorites")}
              >
                <span className="nav-main">
                  <span className="nav-icon">
                    <Star size={16} />
                  </span>
                  <span>Favorites</span>
                </span>
                <span className="nav-count">{favorites.length}</span>
              </button>
            </div>

            <div className="sidebar-section">
              <h3 className="left-title section-gap">Tools</h3>
              {visibleTools.map((tool) => (
                <button
                  key={tool}
                  className={`nav-row ${sidebarKey === `tool:${tool}` ? "active" : ""}`}
                  onClick={() => void handleSidebarKeyChange(`tool:${tool}`)}
                >
                  <span className="nav-main">
                    <span className="nav-tool-icon" style={toolIconStyle(tool)}>
                      {renderToolIcon(tool)}
                    </span>
                    <span>{tool}</span>
                  </span>
                  <span className="nav-count">{toolCounts.get(tool) ?? 0}</span>
                </button>
              ))}
            </div>

            <div className="sidebar-section">
              <div className="left-section-heading section-gap">
                <h3 className="left-title">Collections</h3>
                <button
                  className="collection-add-btn"
                  aria-label="Create collection"
                  onClick={() => setCollectionsPopupOpen(true)}
                >
                  <Plus size={14} />
                </button>
              </div>
              {collections.map((collection) => (
                <button
                  key={collection.id}
                  className={`nav-row ${sidebarKey === `collection:${collection.id}` ? "active" : ""}`}
                  onClick={() => void handleSidebarKeyChange(`collection:${collection.id}`)}
                  onContextMenu={(event) => handleCollectionContextMenu(event, collection)}
                >
                  <span className="nav-main">
                    <span className="nav-icon">{renderCollectionIcon(collection.icon, 16)}</span>
                    <span>{collection.name}</span>
                  </span>
                  <span className="nav-count">{collectionCounts.get(collection.id) ?? 0}</span>
                </button>
              ))}
            </div>

          </ScrollShadow>
          <div className="left-bottom-actions" ref={newSkillActionsRef}>
            {newSkillLinksOpen ? (
              <div className="new-skill-links shadow-sm" aria-label="New skill websites">
                <div className="new-skill-tabs" role="tablist" aria-label="Skill source groups">
                  {SKILL_SITE_TABS.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      aria-selected={newSkillTab === tab.key}
                      className={`new-skill-tab-btn ${newSkillTab === tab.key ? "active" : ""}`}
                      onClick={() => setNewSkillTab(tab.key)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div className="new-skill-links-list" role="menu" aria-label={`${activeSkillSiteTab.label} skill websites`}>
                  {activeSkillSiteTab.sites.map((site) => (
                    <button
                      key={site.url}
                      type="button"
                      className="new-skill-link-btn"
                      role="menuitem"
                      onClick={() => void handleOpenSkillSite(site.url)}
                    >
                      <span className="new-skill-link-label">{site.label}</span>
                      <span className="new-skill-link-url">{site.url}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <button className="left-action-btn" aria-label="Refresh" onClick={() => void handleRefreshSkills()}>
              <ArrowsClockwise size={16} />
            </button>
            <button
              className="left-action-btn"
              aria-expanded={newSkillLinksOpen}
              aria-label="New Skill"
              onClick={handleToggleNewSkillLinks}
            >
              <Plus size={16} />
            </button>
          </div>
        </aside>
        <div
          className={`pane-resizer ${resizingPane === "left" ? "is-active" : ""}`}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize left panel"
          onMouseDown={(event) => handleResizeStart("left", event)}
        />

        <section className="skill-list-pane">
          <div className="skill-list-header">
            <div className="mail-search-field shadow-sm">
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path
                  fill="currentColor"
                  fillRule="evenodd"
                  d="M11.5 7a4.5 4.5 0 1 1-9 0a4.5 4.5 0 0 1 9 0m-.82 4.74a6 6 0 1 1 1.06-1.06l2.79 2.79a.75.75 0 1 1-1.06 1.06z"
                  clipRule="evenodd"
                />
              </svg>
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(event) => {
                  const target = event.target as HTMLInputElement | null;
                  if (!target) return;
                  setSearch(target.value);
                }}
                aria-label="Search skills"
              />
              {search ? (
                <button aria-label="Clear search" onClick={() => setSearch("")}>
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path
                      fill="currentColor"
                      fillRule="evenodd"
                      d="M3.47 3.47a.75.75 0 0 1 1.06 0L8 6.94l3.47-3.47a.75.75 0 1 1 1.06 1.06L9.06 8l3.47 3.47a.75.75 0 1 1-1.06 1.06L8 9.06l-3.47 3.47a.75.75 0 0 1-1.06-1.06L6.94 8 3.47 4.53a.75.75 0 0 1 0-1.06Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              ) : null}
            </div>
          </div>

          <ScrollShadow
            key={skillListScrollShadowKey}
            className="pane-scroll"
            hideScrollBar
            orientation="vertical"
            variant="fade"
            size={40}
            offset={10}
          >
            {loadingSkills ? (
              <div className="loading-wrap">
                <Spinner />
              </div>
            ) : filteredSkills.length === 0 ? (
              <div className="skills-empty" aria-live="polite">
                <img
                  src={themeMode === "dark" ? noSkillsIllustrationDark : noSkillsIllustration}
                  alt="No skills"
                  className="skills-empty-image"
                />
                <p className="skills-empty-title">No Skills</p>
              </div>
            ) : (
              <div className="skill-list">
                {skillListHierarchy.items.map((item) => {
                  if (item.type === "skill") {
                    return <div key={item.skill.path}>{renderSelectableSkillRow(item.skill)}</div>;
                  }

                  return (
                    <div key={item.group.groupKey} className="skill-group">
                      {item.group.parentSkill
                        ? renderSelectableSkillRow(item.group.parentSkill, {
                            rowClassName: "skill-row-parent",
                            showParentBadge: true,
                            groupCount: item.group.childCount,
                            groupExpanded: item.group.isExpanded,
                            onToggleGroup: (event) => {
                              event.stopPropagation();
                              toggleSkillGroup(item.group.groupKey);
                            },
                          })
                        : renderGroupHeader(item.group)}
                      {item.group.isExpanded ? (
                        <div className="skill-group-children">
                          {item.group.childSkills.map((skill) => (
                            <div key={skill.path}>{renderSelectableSkillRow(skill, { rowClassName: "child" })}</div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollShadow>
        </section>

        <section className="detail-pane">
          <div
            className={`detail-pane-resize-hit ${resizingPane === "middle" ? "is-active" : ""}`}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize detail panel"
            onMouseDown={handleDetailPaneResizeStart}
          />
          <div className="detail-card shadow-sm">
            <header className="detail-toolbar">
              <div className="toolbar-actions">
                <div className="view-toggle" role="tablist" aria-label="Markdown mode">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeView === "edit"}
                    aria-label="Edit mode"
                    className={`view-toggle-btn ${activeView === "edit" ? "is-active shadow-sm" : ""}`}
                    onClick={() => setActiveView("edit")}
                  >
                    <PencilSimple size={16} />
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeView === "preview"}
                    aria-label="Preview mode"
                    className={`view-toggle-btn ${activeView === "preview" ? "is-active shadow-sm" : ""}`}
                    onClick={() => setActiveView("preview")}
                  >
                    <Eye size={16} />
                  </button>
                </div>
                <Button
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  className={favorites.includes(selectedPath) ? "is-active" : undefined}
                  aria-label="Favorite / Unfavorite"
                  onPress={toggleFavorite}
                  isDisabled={!selectedPath}
                >
                  <Star size={16} weight={favorites.includes(selectedPath) ? "fill" : "bold"} />
                </Button>
                <div className="toolbar-collection-wrap" ref={detailCollectionPickerRef}>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="ghost"
                    className={selectedCollection ? "is-active" : undefined}
                    aria-label="Assign collection"
                    onPress={() => setDetailCollectionPickerOpen((prev) => !prev)}
                    isDisabled={!selectedPath || collections.length === 0}
                  >
                    {selectedCollection ? renderCollectionIcon(selectedCollection.icon, 16) : <FolderSimple size={16} />}
                  </Button>
                  {detailCollectionPickerOpen && selectedPath ? (
                    <div className="toolbar-collection-menu shadow-sm" role="menu" aria-label="Select collection">
                      {collections.map((collection) => {
                        const isSelected = selectedCollectionId === collection.id;
                        return (
                          <button
                            key={collection.id}
                            className={`toolbar-collection-item ${isSelected ? "active" : ""}`}
                            role="menuitemcheckbox"
                            aria-checked={isSelected}
                            onClick={() => toggleCollectionForSelectedSkill(collection.id)}
                          >
                            <span className="toolbar-collection-item-icon">{renderCollectionIcon(collection.icon, 14)}</span>
                            <span className="toolbar-collection-item-name">{collection.name}</span>
                            <span className="toolbar-collection-item-check">
                              {isSelected ? <Check size={14} weight="bold" /> : null}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
                <Button
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  aria-label="Reveal in Finder"
                  onPress={() => void revealSelectedSkill()}
                  isDisabled={!selectedPath}
                >
                  <FolderOpen size={16} />
                </Button>
                <Button
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  aria-label="Delete selected skill"
                  onPress={handleToolbarDeleteSkill}
                  isDisabled={!selectedPath}
                >
                  <Trash size={16} />
                </Button>
              </div>
              <div className="detail-sequence-controls" aria-label="Skill sequence navigation">
                <span className="detail-sequence-count">{filteredPositionText}</span>
                <div className="detail-sequence-buttons">
                  <Button
                    isIconOnly
                    size="sm"
                    variant="ghost"
                    className="detail-sequence-btn"
                    aria-label="Previous skill"
                    onPress={() => void handleStepSkill(-1)}
                    isDisabled={visibleNavigableSkills.length === 0 || selectedFilteredIndex <= 0}
                  >
                    <ArrowLeft size={16} />
                  </Button>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="ghost"
                    className="detail-sequence-btn"
                    aria-label="Next skill"
                    onPress={() => void handleStepSkill(1)}
                    isDisabled={
                      visibleNavigableSkills.length === 0 ||
                      selectedFilteredIndex === -1 ||
                      selectedFilteredIndex === visibleNavigableSkills.length - 1
                    }
                  >
                    <ArrowRight size={16} />
                  </Button>
                </div>
              </div>
            </header>

            <section className="detail-content">
              {loadingDetail ? (
                <div className="loading-wrap">
                  <Spinner />
                </div>
              ) : activeView === "preview" ? (
                <ScrollShadow
                  className="markdown-scroll"
                  hideScrollBar
                  orientation="vertical"
                  variant="fade"
                  size={44}
                  offset={10}
                >
                  <MarkdownPreview
                    className="markdown-body"
                    source={previewContent}
                    wrapperElement={{ "data-color-mode": themeMode }}
                  />
                </ScrollShadow>
              ) : (
                <textarea
                  aria-label="Skill markdown editor"
                  className="editor-area"
                  value={editContent}
                  onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
                    const target = event.target as HTMLTextAreaElement | null;
                    if (!target) return;
                    setEditContent(target.value);
                  }}
                />
              )}
            </section>

            <footer className="detail-footer">
              <span>{selectedMeta}</span>
              <span>{isSaving ? "Saving..." : isDirty ? "Unsaved · ⌘S Save" : statusText}</span>
            </footer>
          </div>
        </section>
        </section>

        {collectionsPopupOpen ? (
          <div
            className="collection-modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Create collection"
            onClick={() => setCollectionsPopupOpen(false)}
          >
            <div className="collection-modal-card shadow-sm" onClick={(event) => event.stopPropagation()}>
              <label htmlFor="collection-name-input" className="collection-create-label">
                Collection Name
              </label>
              <input
                id="collection-name-input"
                className="collection-create-input"
                value={collectionDraftName}
                onChange={(event) => {
                  const target = event.target as HTMLInputElement | null;
                  if (!target) return;
                  setCollectionDraftName(target.value);
                }}
                placeholder="e.g. Design"
                maxLength={40}
                autoFocus
              />
              <div className="collection-icon-picker" role="listbox" aria-label="Collection icon">
                {COLLECTION_ICON_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={`collection-icon-option ${collectionDraftIcon === option.key ? "active" : ""}`}
                    role="option"
                    aria-selected={collectionDraftIcon === option.key}
                    onClick={() => setCollectionDraftIcon(option.key)}
                    title={option.label}
                  >
                    {renderCollectionIcon(option.key, 14)}
                  </button>
                ))}
              </div>
              <div className="confirm-actions">
                <button className="confirm-btn ghost" onClick={() => setCollectionsPopupOpen(false)}>
                  Cancel
                </button>
                <button
                  className="confirm-btn primary"
                  disabled={!collectionDraftName.trim()}
                  onClick={handleCreateCollection}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {skillContextMenu ? (
          <div
            ref={skillContextMenuRef}
            className="skill-context-menu shadow-sm"
            style={{ left: `${skillContextMenu.x}px`, top: `${skillContextMenu.y}px` }}
            role="menu"
            aria-label="Skill actions"
          >
            <button className="skill-context-item" role="menuitem" onClick={() => void handleContextShowInFolder()}>
              <FolderOpen size={16} />
              <span>Show in Finder</span>
            </button>
            <button
              className="skill-context-item danger"
              role="menuitem"
              onClick={() => void handleContextDeleteSkill()}
            >
              <Trash size={16} />
              <span>Delete</span>
            </button>
          </div>
        ) : null}

        {collectionContextMenu ? (
          <div
            ref={collectionsMenuRef}
            className="skill-context-menu shadow-sm"
            style={{ left: `${collectionContextMenu.x}px`, top: `${collectionContextMenu.y}px` }}
            role="menu"
            aria-label="Collection actions"
          >
            <button className="skill-context-item" role="menuitem" onClick={requestRenameCollection}>
              <PencilSimple size={16} />
              <span>Rename</span>
            </button>
            <button className="skill-context-item danger" role="menuitem" onClick={requestDeleteCollection}>
              <Trash size={16} />
              <span>Delete</span>
            </button>
          </div>
        ) : null}

        {deleteConfirm ? (
          <div className="confirm-overlay" role="dialog" aria-modal="true" aria-label="Delete skill confirmation">
            <div className="confirm-card shadow-sm">
              <h4>{deleteConfirm.step === 1 ? "Delete Skill?" : "Final Confirmation"}</h4>
              <p>
                {deleteConfirm.step === 1
                  ? `Delete "${deleteConfirm.name}" now?`
                  : "This action cannot be undone. Confirm delete again."}
              </p>
              <div className="confirm-actions">
                <button className="confirm-btn ghost" onClick={() => setDeleteConfirm(null)}>
                  Cancel
                </button>
                <button className="confirm-btn danger" onClick={() => void confirmDeleteSkill()}>
                  {deleteConfirm.step === 1 ? "Continue" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {collectionRename ? (
          <div className="confirm-overlay" role="dialog" aria-modal="true" aria-label="Rename collection">
            <div className="confirm-card shadow-sm">
              <h4>Rename Collection</h4>
              <p>Update the collection name.</p>
              <input
                className="confirm-input"
                value={collectionRename.name}
                onChange={(event) => {
                  const target = event.target as HTMLInputElement | null;
                  const nextName = target?.value ?? "";
                  setCollectionRename((prev) => (prev ? { ...prev, name: nextName } : prev));
                }}
                maxLength={40}
                autoFocus
              />
              <div className="confirm-actions">
                <button className="confirm-btn ghost" onClick={() => setCollectionRename(null)}>
                  Cancel
                </button>
                <button className="confirm-btn primary" onClick={confirmRenameCollection}>
                  Save
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {collectionDeleteId ? (
          <div className="confirm-overlay" role="dialog" aria-modal="true" aria-label="Delete collection confirmation">
            <div className="confirm-card shadow-sm">
              <h4>Delete Collection?</h4>
              <p>This only removes the category. Skills will not be deleted.</p>
              <div className="confirm-actions">
                <button className="confirm-btn ghost" onClick={() => setCollectionDeleteId(null)}>
                  Cancel
                </button>
                <button className="confirm-btn danger" onClick={confirmDeleteCollection}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </IconContext.Provider>
  );
}

export default App;
