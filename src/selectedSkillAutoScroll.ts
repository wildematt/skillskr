type ShouldAutoScrollSelectedSkillInput = {
  selectedPath: string;
  previousSelectedPath: string;
  sidebarKey: string;
  lastScrolledSidebarKey: string;
  wasSelectedVisible: boolean;
  isSelectedVisible: boolean;
  isRestoringScrollPosition: boolean;
};

export function shouldAutoScrollSelectedSkill({
  selectedPath,
  previousSelectedPath,
  sidebarKey,
  lastScrolledSidebarKey,
  wasSelectedVisible,
  isSelectedVisible,
  isRestoringScrollPosition,
}: ShouldAutoScrollSelectedSkillInput): boolean {
  if (!selectedPath || !isSelectedVisible || isRestoringScrollPosition) {
    return false;
  }

  return previousSelectedPath !== selectedPath || lastScrolledSidebarKey !== sidebarKey || !wasSelectedVisible;
}
