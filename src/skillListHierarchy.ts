export type SkillSummaryLike = {
  id: string;
  name: string;
  description: string;
  tool: string;
  path: string;
  relativePath: string;
  sourceRoot: string;
  version?: string;
  modifiedUnix?: number;
};

export type GroupedSkillItem =
  | {
      type: "skill";
      skill: SkillSummaryLike;
    }
  | {
      type: "group";
      group: GroupedSkillGroup;
    };

export type GroupedSkillGroup = {
  groupKey: string;
  groupLabel: string;
  directoryName: string;
  parentSkill: SkillSummaryLike | null;
  childSkills: SkillSummaryLike[];
  childCount: number;
  isCollapsible: true;
  isExpanded: boolean;
};

type DeriveSkillListHierarchyInput = {
  skills: SkillSummaryLike[];
  collapsedGroups: Record<string, boolean>;
  search: string;
};

export type DeriveSkillListHierarchyResult = {
  items: GroupedSkillItem[];
  visibleNavigableSkills: SkillSummaryLike[];
};

type ParsedSkillPath =
  | {
      kind: "root";
      topLevelDirectory: string;
    }
  | {
      kind: "child";
      topLevelDirectory: string;
    }
  | {
      kind: "unknown";
    };

export function createSkillGroupKey(tool: string, topLevelDirectory: string): string {
  return `${tool}::${topLevelDirectory}`;
}

function parseSkillPath(relativePath: string): ParsedSkillPath {
  const segments = relativePath.split("/").filter(Boolean);
  if (segments[segments.length - 1] !== "SKILL.md") {
    return { kind: "unknown" };
  }

  const skillSegments = segments.slice(0, -1);
  if (skillSegments.length === 1) {
    return {
      kind: "root",
      topLevelDirectory: skillSegments[0] ?? "",
    };
  }

  if (skillSegments.length >= 2) {
    return {
      kind: "child",
      topLevelDirectory: skillSegments[0] ?? "",
    };
  }

  return { kind: "unknown" };
}

export function deriveSkillListHierarchy({
  skills,
  collapsedGroups,
  search,
}: DeriveSkillListHierarchyInput): DeriveSkillListHierarchyResult {
  const searchActive = search.trim().length > 0;
  const groupedEntries = new Map<
    string,
    {
      groupKey: string;
      directoryName: string;
      members: SkillSummaryLike[];
      childSkills: SkillSummaryLike[];
      parentSkill: SkillSummaryLike | null;
    }
  >();

  skills.forEach((skill) => {
    const parsed = parseSkillPath(skill.relativePath);
    if (parsed.kind === "unknown") {
      return;
    }

    const groupKey = createSkillGroupKey(skill.tool, parsed.topLevelDirectory);
    const entry = groupedEntries.get(groupKey) ?? {
      groupKey,
      directoryName: parsed.topLevelDirectory,
      members: [],
      childSkills: [],
      parentSkill: null,
    };

    entry.members.push(skill);
    if (parsed.kind === "root") {
      entry.parentSkill = skill;
    } else {
      entry.childSkills.push(skill);
    }

    groupedEntries.set(groupKey, entry);
  });

  const renderableGroups = new Map<string, GroupedSkillGroup>();
  groupedEntries.forEach((entry) => {
    const shouldRenderGroup = entry.childSkills.length >= 2 || (entry.childSkills.length === 1 && entry.parentSkill !== null);
    if (!shouldRenderGroup) {
      return;
    }

    const isExpanded = searchActive ? true : !collapsedGroups[entry.groupKey];
    renderableGroups.set(entry.groupKey, {
      groupKey: entry.groupKey,
      groupLabel: entry.parentSkill?.name ?? entry.directoryName,
      directoryName: entry.directoryName,
      parentSkill: entry.parentSkill,
      childSkills: entry.childSkills,
      childCount: entry.childSkills.length,
      isCollapsible: true,
      isExpanded,
    });
  });

  const emittedGroupKeys = new Set<string>();
  const items: GroupedSkillItem[] = [];

  skills.forEach((skill) => {
    const parsed = parseSkillPath(skill.relativePath);
    if (parsed.kind === "unknown") {
      items.push({
        type: "skill",
        skill,
      });
      return;
    }

    const groupKey = createSkillGroupKey(skill.tool, parsed.topLevelDirectory);
    const group = renderableGroups.get(groupKey);
    if (!group) {
      items.push({
        type: "skill",
        skill,
      });
      return;
    }

    if (emittedGroupKeys.has(groupKey)) {
      return;
    }

    emittedGroupKeys.add(groupKey);
    items.push({
      type: "group",
      group,
    });
  });

  const visibleNavigableSkills = items.flatMap((item) => {
    if (item.type === "skill") {
      return [item.skill];
    }

    const parentSkills = item.group.parentSkill ? [item.group.parentSkill] : [];
    const childSkills = item.group.isExpanded ? item.group.childSkills : [];
    return [...parentSkills, ...childSkills];
  });

  return {
    items,
    visibleNavigableSkills,
  };
}
