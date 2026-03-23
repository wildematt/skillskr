import { COLLECTION_ICON_OPTIONS, renderCollectionIcon } from "../appIcons";
import type { CollectionIconKey } from "../appTypes";

type CollectionModalProps = {
  draftName: string;
  draftIcon: CollectionIconKey;
  onDraftNameChange(nextValue: string): void;
  onDraftIconChange(nextIcon: CollectionIconKey): void;
  onClose(): void;
  onCreate(): void;
};

export function CollectionModal({
  draftName,
  draftIcon,
  onDraftNameChange,
  onDraftIconChange,
  onClose,
  onCreate,
}: CollectionModalProps) {
  return (
    <div
      className="collection-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Create collection"
      onClick={onClose}
    >
      <div className="collection-modal-card shadow-sm" onClick={(event) => event.stopPropagation()}>
        <label htmlFor="collection-name-input" className="collection-create-label">
          Collection Name
        </label>
        <input
          id="collection-name-input"
          className="collection-create-input"
          value={draftName}
          onChange={(event) => {
            const target = event.target as HTMLInputElement | null;
            if (!target) return;
            onDraftNameChange(target.value);
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
              className={`collection-icon-option ${draftIcon === option.key ? "active" : ""}`}
              role="option"
              aria-selected={draftIcon === option.key}
              onClick={() => onDraftIconChange(option.key)}
              title={option.label}
            >
              {renderCollectionIcon(option.key, 14)}
            </button>
          ))}
        </div>
        <div className="confirm-actions">
          <button className="confirm-btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="confirm-btn primary" disabled={!draftName.trim()} onClick={onCreate}>
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
