type PendingSidebarSelectionRestore =
  | {
      sidebarKey: string;
      targetPath: string;
    }
  | null;

type ShouldPersistSidebarSelectionInput = {
  sidebarKey: string;
  selectedPath: string;
  visiblePaths: string[];
  pendingSidebarSelectionRestore: PendingSidebarSelectionRestore;
};

export function shouldPersistSidebarSelection({
  sidebarKey,
  selectedPath,
  visiblePaths,
  pendingSidebarSelectionRestore,
}: ShouldPersistSidebarSelectionInput): boolean {
  if (!selectedPath || !visiblePaths.includes(selectedPath)) {
    return false;
  }

  if (
    pendingSidebarSelectionRestore &&
    pendingSidebarSelectionRestore.sidebarKey === sidebarKey &&
    pendingSidebarSelectionRestore.targetPath !== selectedPath
  ) {
    return false;
  }

  return true;
}
