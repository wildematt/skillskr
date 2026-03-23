import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from "react";
import { ScrollShadow, Spinner } from "@heroui/react";
import { CaretRight, Star } from "@phosphor-icons/react";
import noSkillsIllustration from "../assets/no-skills.svg";
import noSkillsIllustrationDark from "../assets/no-skills-dark.svg";
import { renderToolIcon, toolIconStyle } from "../appIcons";
import type { AppTheme, SkillSummary } from "../appTypes";
import { type GroupedSkillGroup, type DeriveSkillListHierarchyResult } from "../skillListHierarchy";

type SkillListPaneProps = {
  search: string;
  loadingSkills: boolean;
  filteredSkills: SkillSummary[];
  skillListHierarchy: DeriveSkillListHierarchyResult;
  selectedPath: string;
  favorites: string[];
  themeMode: AppTheme;
  scrollShadowKey: string;
  onSearchChange(nextValue: string): void;
  onClearSearch(): void;
  onSelectSkill(path: string): void;
  onToggleFavorite(path: string): void;
  onOpenSkillContextMenu(event: ReactMouseEvent<HTMLButtonElement>, skill: SkillSummary): void;
  onToggleGroup(groupKey: string): void;
  registerSkillRow(path: string, element: HTMLButtonElement | null): void;
};

export function SkillListPane({
  search,
  loadingSkills,
  filteredSkills,
  skillListHierarchy,
  selectedPath,
  favorites,
  themeMode,
  scrollShadowKey,
  onSearchChange,
  onClearSearch,
  onSelectSkill,
  onToggleFavorite,
  onOpenSkillContextMenu,
  onToggleGroup,
  registerSkillRow,
}: SkillListPaneProps) {
  function handleSkillFavoriteClick(event: ReactMouseEvent<HTMLSpanElement>, path: string) {
    event.preventDefault();
    event.stopPropagation();
    onToggleFavorite(path);
  }

  function handleSkillFavoriteKeyDown(event: ReactKeyboardEvent<HTMLSpanElement>, path: string) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    onToggleFavorite(path);
  }

  function renderSelectableSkillRow(
    skill: SkillSummary,
    options?: {
      rowClassName?: string;
      showParentBadge?: boolean;
      groupCount?: number;
      groupExpanded?: boolean;
      onToggleGroup?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
    },
  ) {
    const isFavorite = favorites.includes(skill.path);
    const isActive = selectedPath === skill.path;

    return (
      <div className={`skill-row ${isActive ? "active shadow-sm" : ""} ${options?.rowClassName ?? ""}`.trim()}>
        <button
          className="skill-row-main"
          onClick={() => onSelectSkill(skill.path)}
          onContextMenu={(event) => onOpenSkillContextMenu(event, skill)}
          ref={(element) => {
            registerSkillRow(skill.path, element);
          }}
        >
          <span className="tool-badge" aria-hidden="true">
            <span className="tool-badge-icon" style={toolIconStyle(skill.tool)}>
              {renderToolIcon(skill.tool)}
            </span>
          </span>
          <span className="mail-main">
            <span className="mail-name-row">
              <span className="mail-name">{skill.name}</span>
              {options?.showParentBadge ? <span className="skill-parent-chip">Parent</span> : null}
            </span>
          </span>
        </button>
        <div className="skill-row-side">
          {typeof options?.groupCount === "number" ? <span className="skill-group-count">{options.groupCount}</span> : null}
          <span
            className={`mail-star ${isFavorite ? "on" : ""}`}
            role="button"
            tabIndex={0}
            aria-label={isFavorite ? "Unfavorite skill" : "Favorite skill"}
            onClick={(event) => handleSkillFavoriteClick(event, skill.path)}
            onKeyDown={(event) => handleSkillFavoriteKeyDown(event, skill.path)}
          >
            <Star size={16} weight={isFavorite ? "fill" : "bold"} />
          </span>
          {options?.onToggleGroup ? (
            <button
              type="button"
              className={`skill-group-toggle ${options.groupExpanded ? "is-expanded" : ""}`}
              aria-label={options.groupExpanded ? "Collapse skill group" : "Expand skill group"}
              aria-expanded={options.groupExpanded}
              onClick={options.onToggleGroup}
            >
              <CaretRight size={14} />
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  function renderGroupHeader(group: GroupedSkillGroup) {
    const tool = group.parentSkill?.tool ?? group.childSkills[0]?.tool ?? "generic";

    return (
      <div className="skill-row skill-row-group-only">
        <button
          type="button"
          className="skill-row-main skill-row-group-main"
          aria-label={group.isExpanded ? "Collapse skill group" : "Expand skill group"}
          aria-expanded={group.isExpanded}
          onClick={() => onToggleGroup(group.groupKey)}
        >
          <span className="tool-badge" aria-hidden="true">
            <span className="tool-badge-icon" style={toolIconStyle(tool)}>
              {renderToolIcon(tool)}
            </span>
          </span>
          <span className="mail-main">
            <span className="mail-name-row">
              <span className="mail-name">{group.groupLabel}</span>
            </span>
          </span>
        </button>
        <div className="skill-row-side">
          <span className="skill-group-count">{group.childCount}</span>
          <button
            type="button"
            className={`skill-group-toggle ${group.isExpanded ? "is-expanded" : ""}`}
            aria-label={group.isExpanded ? "Collapse skill group" : "Expand skill group"}
            aria-expanded={group.isExpanded}
            onClick={() => onToggleGroup(group.groupKey)}
          >
            <CaretRight size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="skill-list-pane">
      <div className="skill-list-header">
        <div className="mail-search-field shadow-sm">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path
              fill="currentColor"
              fillRule="evenodd"
              d="M11.5 7a4.5 4.5 0 1 1-9 0a4.5 4.5 0 0 1 9 0m-.82 4.74a6 6 0 1 1 1.06-1.06l2.79 2.79a.75.75 0 1 1-1.06 1.06z"
              clipRule="evenodd"
            />
          </svg>
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(event) => {
              const target = event.target as HTMLInputElement | null;
              if (!target) return;
              onSearchChange(target.value);
            }}
            aria-label="Search skills"
          />
          {search ? (
            <button aria-label="Clear search" onClick={onClearSearch}>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path
                  fill="currentColor"
                  fillRule="evenodd"
                  d="M3.47 3.47a.75.75 0 0 1 1.06 0L8 6.94l3.47-3.47a.75.75 0 1 1 1.06 1.06L9.06 8l3.47 3.47a.75.75 0 1 1-1.06 1.06L8 9.06l-3.47 3.47a.75.75 0 0 1-1.06-1.06L6.94 8 3.47 4.53a.75.75 0 0 1 0-1.06Z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      <ScrollShadow
        key={scrollShadowKey}
        className="pane-scroll"
        hideScrollBar
        orientation="vertical"
        variant="fade"
        size={40}
        offset={10}
      >
        {loadingSkills ? (
          <div className="loading-wrap">
            <Spinner />
          </div>
        ) : filteredSkills.length === 0 ? (
          <div className="skills-empty" aria-live="polite">
            <img
              src={themeMode === "dark" ? noSkillsIllustrationDark : noSkillsIllustration}
              alt="No skills"
              className="skills-empty-image"
            />
            <p className="skills-empty-title">No Skills</p>
          </div>
        ) : (
          <div className="skill-list">
            {skillListHierarchy.items.map((item) => {
              if (item.type === "skill") {
                return <div key={item.skill.path}>{renderSelectableSkillRow(item.skill)}</div>;
              }

              return (
                <div key={item.group.groupKey} className="skill-group">
                  {item.group.parentSkill
                    ? renderSelectableSkillRow(item.group.parentSkill, {
                        rowClassName: "skill-row-parent",
                        showParentBadge: true,
                        groupCount: item.group.childCount,
                        groupExpanded: item.group.isExpanded,
                        onToggleGroup: (event) => {
                          event.stopPropagation();
                          onToggleGroup(item.group.groupKey);
                        },
                      })
                    : renderGroupHeader(item.group)}
                  {item.group.isExpanded ? (
                    <div className="skill-group-children">
                      {item.group.childSkills.map((skill) => (
                        <div key={skill.path}>{renderSelectableSkillRow(skill, { rowClassName: "child" })}</div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </ScrollShadow>
    </section>
  );
}
