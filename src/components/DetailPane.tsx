import type { ChangeEvent, RefObject } from "react";
import { Button, ScrollShadow, Spinner } from "@heroui/react";
import { ArrowLeft, ArrowRight, Check, Eye, FolderOpen, FolderSimple, PencilSimple, Star, Trash } from "@phosphor-icons/react";
import MarkdownPreview from "@uiw/react-markdown-preview";
import { renderCollectionIcon } from "../appIcons";
import type { AppTheme, CollectionItem } from "../appTypes";

type DetailPaneProps = {
  resizingPane: "left" | "middle" | null;
  activeView: "preview" | "edit";
  favoriteSelected: boolean;
  selectedPath: string;
  selectedCollection: CollectionItem | null;
  selectedCollectionId: string;
  collections: CollectionItem[];
  detailCollectionPickerOpen: boolean;
  detailCollectionPickerRef: RefObject<HTMLDivElement | null>;
  loadingDetail: boolean;
  previewContent: string;
  themeMode: AppTheme;
  editContent: string;
  selectedMeta: string;
  isSaving: boolean;
  isDirty: boolean;
  statusText: string;
  filteredPositionText: string;
  visibleNavigableSkillsLength: number;
  selectedFilteredIndex: number;
  onDetailPaneResizeStart(event: React.MouseEvent<HTMLDivElement>): void;
  onViewChange(nextView: "preview" | "edit"): void;
  onToggleFavorite(): void;
  onToggleCollectionPicker(): void;
  onToggleCollectionForSelectedSkill(collectionId: string): void;
  onRevealSelectedSkill(): void;
  onDeleteSelectedSkill(): void;
  onStepSkill(delta: -1 | 1): void;
  onEditContentChange(nextValue: string): void;
};

export function DetailPane({
  resizingPane,
  activeView,
  favoriteSelected,
  selectedPath,
  selectedCollection,
  selectedCollectionId,
  collections,
  detailCollectionPickerOpen,
  detailCollectionPickerRef,
  loadingDetail,
  previewContent,
  themeMode,
  editContent,
  selectedMeta,
  isSaving,
  isDirty,
  statusText,
  filteredPositionText,
  visibleNavigableSkillsLength,
  selectedFilteredIndex,
  onDetailPaneResizeStart,
  onViewChange,
  onToggleFavorite,
  onToggleCollectionPicker,
  onToggleCollectionForSelectedSkill,
  onRevealSelectedSkill,
  onDeleteSelectedSkill,
  onStepSkill,
  onEditContentChange,
}: DetailPaneProps) {
  const canStepBackward = visibleNavigableSkillsLength > 0 && selectedFilteredIndex > 0;
  const canStepForward =
    visibleNavigableSkillsLength > 0 &&
    selectedFilteredIndex !== -1 &&
    selectedFilteredIndex < visibleNavigableSkillsLength - 1;

  return (
    <section className="detail-pane">
      <div
        className={`detail-pane-resize-hit ${resizingPane === "middle" ? "is-active" : ""}`}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize detail panel"
        onMouseDown={onDetailPaneResizeStart}
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
                onClick={() => onViewChange("edit")}
              >
                <PencilSimple size={16} />
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeView === "preview"}
                aria-label="Preview mode"
                className={`view-toggle-btn ${activeView === "preview" ? "is-active shadow-sm" : ""}`}
                onClick={() => onViewChange("preview")}
              >
                <Eye size={16} />
              </button>
            </div>
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              className={favoriteSelected ? "is-active" : undefined}
              aria-label="Favorite / Unfavorite"
              onPress={onToggleFavorite}
              isDisabled={!selectedPath}
            >
              <Star size={16} weight={favoriteSelected ? "fill" : "bold"} />
            </Button>
            <div className="toolbar-collection-wrap" ref={detailCollectionPickerRef}>
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                className={selectedCollection ? "is-active" : undefined}
                aria-label="Assign collection"
                onPress={onToggleCollectionPicker}
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
                        onClick={() => onToggleCollectionForSelectedSkill(collection.id)}
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
              onPress={onRevealSelectedSkill}
              isDisabled={!selectedPath}
            >
              <FolderOpen size={16} />
            </Button>
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              aria-label="Delete selected skill"
              onPress={onDeleteSelectedSkill}
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
                onPress={() => onStepSkill(-1)}
                isDisabled={!canStepBackward}
              >
                <ArrowLeft size={16} />
              </Button>
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                className="detail-sequence-btn"
                aria-label="Next skill"
                onPress={() => onStepSkill(1)}
                isDisabled={!canStepForward}
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
                onEditContentChange(target.value);
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
  );
}
