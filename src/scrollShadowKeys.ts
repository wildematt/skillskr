type SkillListScrollShadowKeyInput = {
  sidebarKey: string;
  search: string;
  loadingSkills: boolean;
};

export function createSkillListScrollShadowKey({
  sidebarKey,
  search,
  loadingSkills,
}: SkillListScrollShadowKeyInput): string {
  return `${sidebarKey}-${search}-${loadingSkills ? "loading" : "ready"}`;
}
