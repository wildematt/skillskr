import type { CSSProperties, ReactNode } from "react";
import { ClaudeCode, Cline, Codex, Cursor, GithubCopilot, Windsurf } from "@lobehub/icons";
import {
  BugBeetle,
  Code,
  Cpu,
  Database,
  FolderSimple,
  FolderSimpleStar,
  GlobeHemisphereWest,
  Hammer,
  RocketLaunch,
  Sparkle,
  TerminalWindow,
  Wrench,
} from "@phosphor-icons/react";
import type { CollectionIconKey, SkillSiteTab } from "./appTypes";

export const SKILL_SITE_TABS: SkillSiteTab[] = [
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

export const COLLECTION_ICON_OPTIONS: Array<{ key: CollectionIconKey; label: string }> = [
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

export type ToolIconStyle = CSSProperties & { "--tool-gradient"?: string };

export function toolIconStyle(tool: string): ToolIconStyle {
  const key = resolveToolKey(tool);
  return { "--tool-gradient": TOOL_ICON_GRADIENTS[key] ?? TOOL_ICON_GRADIENTS.generic };
}

export function renderToolIcon(tool: string): ReactNode {
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

export function renderCollectionIcon(icon: CollectionIconKey, size = 16): ReactNode {
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
