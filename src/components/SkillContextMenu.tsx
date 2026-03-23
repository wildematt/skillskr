import type { ReactNode, RefObject } from "react";

type ContextMenuItem = {
  label: string;
  icon: ReactNode;
  danger?: boolean;
  onClick(): void;
};

type SkillContextMenuProps = {
  menuRef: RefObject<HTMLDivElement | null>;
  x: number;
  y: number;
  ariaLabel: string;
  items: ContextMenuItem[];
};

export function SkillContextMenu({ menuRef, x, y, ariaLabel, items }: SkillContextMenuProps) {
  return (
    <div
      ref={menuRef}
      className="skill-context-menu shadow-sm"
      style={{ left: `${x}px`, top: `${y}px` }}
      role="menu"
      aria-label={ariaLabel}
    >
      {items.map((item) => (
        <button
          key={item.label}
          className={`skill-context-item ${item.danger ? "danger" : ""}`.trim()}
          role="menuitem"
          onClick={item.onClick}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
