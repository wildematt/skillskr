type ConfirmDialogProps = {
  ariaLabel: string;
  title: string;
  description: string;
  cancelLabel: string;
  confirmLabel: string;
  confirmVariant: "primary" | "danger";
  onCancel(): void;
  onConfirm(): void;
  inputValue?: string;
  inputMaxLength?: number;
  inputAutoFocus?: boolean;
  inputPlaceholder?: string;
  onInputChange?: (nextValue: string) => void;
  confirmDisabled?: boolean;
};

export function ConfirmDialog({
  ariaLabel,
  title,
  description,
  cancelLabel,
  confirmLabel,
  confirmVariant,
  onCancel,
  onConfirm,
  inputValue,
  inputMaxLength,
  inputAutoFocus,
  inputPlaceholder,
  onInputChange,
  confirmDisabled,
}: ConfirmDialogProps) {
  return (
    <div className="confirm-overlay" role="dialog" aria-modal="true" aria-label={ariaLabel}>
      <div className="confirm-card shadow-sm">
        <h4>{title}</h4>
        <p>{description}</p>
        {typeof inputValue === "string" && onInputChange ? (
          <input
            className="confirm-input"
            value={inputValue}
            onChange={(event) => {
              const target = event.target as HTMLInputElement | null;
              onInputChange(target?.value ?? "");
            }}
            maxLength={inputMaxLength}
            autoFocus={inputAutoFocus}
            placeholder={inputPlaceholder}
          />
        ) : null}
        <div className="confirm-actions">
          <button className="confirm-btn ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className={`confirm-btn ${confirmVariant}`} disabled={confirmDisabled} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
