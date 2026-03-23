import { describe, expect, it } from "vitest";
import { deriveSkillListHierarchy } from "./skillListHierarchy";

function baseSkill(relativePath: string, name = relativePath, tool = "Codex") {
  return {
    id: `${tool}::${relativePath}`,
    name,
    description: "",
    tool,
    path: `/tmp/${relativePath}`,
    relativePath,
    sourceRoot: "/tmp",
  };
}

describe("deriveSkillListHierarchy", () => {
  it("keeps a standalone root skill as a plain row", () => {
    const result = deriveSkillListHierarchy({
      skills: [baseSkill("writing/SKILL.md", "writing")],
      collapsedGroups: {},
      search: "",
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      type: "skill",
      skill: { name: "writing" },
    });
    expect(result.visibleNavigableSkills.map((skill) => skill.name)).toEqual(["writing"]);
  });

  it("creates a group when a parent skill has one child", () => {
    const result = deriveSkillListHierarchy({
      skills: [
        baseSkill("superpowers/SKILL.md", "Superpowers"),
        baseSkill("superpowers/brainstorming/SKILL.md", "brainstorming"),
      ],
      collapsedGroups: {},
      search: "",
    });

    expect(result.items[0]).toMatchObject({
      type: "group",
      group: {
        groupKey: "Codex::superpowers",
        groupLabel: "Superpowers",
        isExpanded: true,
      },
    });
    expect(result.visibleNavigableSkills.map((skill) => skill.name)).toEqual(["Superpowers", "brainstorming"]);
  });

  it("keeps a single child without a real parent as a standalone row", () => {
    const result = deriveSkillListHierarchy({
      skills: [baseSkill("superpowers/brainstorming/SKILL.md", "brainstorming")],
      collapsedGroups: {},
      search: "",
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      type: "skill",
      skill: { name: "brainstorming" },
    });
  });

  it("creates a group for multiple children even without a real parent skill", () => {
    const result = deriveSkillListHierarchy({
      skills: [
        baseSkill("superpowers/brainstorming/SKILL.md", "brainstorming"),
        baseSkill("superpowers/test-driven-development/SKILL.md", "tdd"),
      ],
      collapsedGroups: {},
      search: "",
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      type: "group",
      group: {
        groupLabel: "superpowers",
        parentSkill: null,
      },
    });
    expect(result.visibleNavigableSkills.map((skill) => skill.name)).toEqual(["brainstorming", "tdd"]);
  });

  it("groups deeper nested skills by the first directory segment", () => {
    const result = deriveSkillListHierarchy({
      skills: [
        baseSkill("pack/SKILL.md", "Pack"),
        baseSkill("pack/subpack/child-a/SKILL.md", "child-a"),
        baseSkill("pack/subpack/child-b/SKILL.md", "child-b"),
      ],
      collapsedGroups: {},
      search: "",
    });

    expect(result.items[0]).toMatchObject({
      type: "group",
      group: { groupKey: "Codex::pack", groupLabel: "Pack" },
    });
  });

  it("renders a group at the first member position and preserves relative order around it", () => {
    const result = deriveSkillListHierarchy({
      skills: [
        baseSkill("alpha/SKILL.md", "alpha"),
        baseSkill("superpowers/test-driven-development/SKILL.md", "tdd"),
        baseSkill("beta/SKILL.md", "beta"),
        baseSkill("superpowers/brainstorming/SKILL.md", "brainstorming"),
      ],
      collapsedGroups: {},
      search: "",
    });

    expect(result.items.map((item) => ("skill" in item ? item.skill.name : item.group.groupLabel))).toEqual([
      "alpha",
      "superpowers",
      "beta",
    ]);
    expect(result.items[1]).toMatchObject({
      type: "group",
      group: {
        childSkills: [{ name: "tdd" }, { name: "brainstorming" }],
      },
    });
  });

  it("uses collapsed state for groups and removes hidden children from visible navigation", () => {
    const result = deriveSkillListHierarchy({
      skills: [
        baseSkill("superpowers/SKILL.md", "Superpowers"),
        baseSkill("superpowers/brainstorming/SKILL.md", "brainstorming"),
        baseSkill("superpowers/test-driven-development/SKILL.md", "tdd"),
      ],
      collapsedGroups: {
        "Codex::superpowers": true,
      },
      search: "",
    });

    expect(result.items[0]).toMatchObject({
      type: "group",
      group: { isExpanded: false },
    });
    expect(result.visibleNavigableSkills.map((skill) => skill.name)).toEqual(["Superpowers"]);
  });

  it("forces matching groups open while search is active", () => {
    const result = deriveSkillListHierarchy({
      skills: [
        baseSkill("superpowers/SKILL.md", "Superpowers"),
        baseSkill("superpowers/brainstorming/SKILL.md", "brainstorming"),
      ],
      collapsedGroups: {
        "Codex::superpowers": true,
      },
      search: "brain",
    });

    expect(result.items[0]).toMatchObject({
      type: "group",
      group: { isExpanded: true },
    });
    expect(result.visibleNavigableSkills.map((skill) => skill.name)).toEqual(["Superpowers", "brainstorming"]);
  });

  it("keeps groups independent across tools", () => {
    const result = deriveSkillListHierarchy({
      skills: [
        baseSkill("superpowers/SKILL.md", "Codex Superpowers", "Codex"),
        baseSkill("superpowers/brainstorming/SKILL.md", "brainstorming", "Codex"),
        baseSkill("superpowers/SKILL.md", "Agents Superpowers", "Agents"),
        baseSkill("superpowers/brainstorming/SKILL.md", "brainstorming", "Agents"),
      ],
      collapsedGroups: {
        "Codex::superpowers": true,
      },
      search: "",
    });

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      type: "group",
      group: { groupKey: "Codex::superpowers", isExpanded: false },
    });
    expect(result.items[1]).toMatchObject({
      type: "group",
      group: { groupKey: "Agents::superpowers", isExpanded: true },
    });
  });
});
