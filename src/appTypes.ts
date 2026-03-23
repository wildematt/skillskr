export type SkillSummary = {
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

export type SkillSourceSummary = {
  tool: string;
  rootPath: string;
  exists: boolean;
  skillCount: number;
};

export type ListSkillsResponse = {
  skills: SkillSummary[];
  sources: SkillSourceSummary[];
};

export type SkillDetail = {
  path: string;
  content: string;
};

export type UpdateResult = {
  target: string;
  repoRoot?: string;
  updated: boolean;
  message: string;
  output: string;
};

export type CollectionIconKey =
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

export const COLLECTION_ICON_KEYS: CollectionIconKey[] = [
  "folder",
  "star",
  "code",
  "terminal",
  "database",
  "wrench",
  "rocket",
  "sparkle",
  "cpu",
  "globe",
  "bug",
  "hammer",
];

export type CollectionItem = {
  id: string;
  name: string;
  icon: CollectionIconKey;
};

export type PersistedAppState = {
  favorites: string[];
  collections: CollectionItem[];
  skillCollections: Record<string, string>;
};

export type AppTheme = "light" | "dark";

export type SkillSiteTabKey = "openclaw" | "skills";

export type SkillSite = {
  label: string;
  url: string;
};

export type SkillSiteTab = {
  key: SkillSiteTabKey;
  label: string;
  sites: SkillSite[];
};
