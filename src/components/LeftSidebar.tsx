import type { RefObject } from "react";
import { ScrollShadow } from "@heroui/react";
import { ArrowsClockwise, Plus, SquaresFour, Star } from "@phosphor-icons/react";
import { renderCollectionIcon, renderToolIcon, SKILL_SITE_TABS, toolIconStyle } from "../appIcons";
import type { CollectionItem, SkillSiteTabKey } from "../appTypes";

type LeftSidebarProps = {
  sidebarScrollShadowKey: string;
  sidebarKey: string;
  skillsCount: number;
  favoritesCount: number;
  visibleTools: string[];
  toolCounts: Map<string, number>;
  collections: CollectionItem[];
  collectionCounts: Map<string, number>;
  newSkillActionsRef: RefObject<HTMLDivElement | null>;
  newSkillLinksOpen: boolean;
  newSkillTab: SkillSiteTabKey;
  activeSkillSiteTab: (typeof SKILL_SITE_TABS)[number];
  onSidebarKeyChange(nextSidebarKey: string): void;
  onOpenCollectionCreate(): void;
  onCollectionContextMenu(event: React.MouseEvent<HTMLButtonElement>, collection: CollectionItem): void;
  onNewSkillTabChange(tab: SkillSiteTabKey): void;
  onOpenSkillSite(url: string): void;
  onRefreshSkills(): void;
  onToggleNewSkillLinks(): void;
};

export function LeftSidebar({
  sidebarScrollShadowKey,
  sidebarKey,
  skillsCount,
  favoritesCount,
  visibleTools,
  toolCounts,
  collections,
  collectionCounts,
  newSkillActionsRef,
  newSkillLinksOpen,
  newSkillTab,
  activeSkillSiteTab,
  onSidebarKeyChange,
  onOpenCollectionCreate,
  onCollectionContextMenu,
  onNewSkillTabChange,
  onOpenSkillSite,
  onRefreshSkills,
  onToggleNewSkillLinks,
}: LeftSidebarProps) {
  return (
    <aside className="left-sidebar">
      <ScrollShadow
        key={sidebarScrollShadowKey}
        className="sidebar-scroll"
        hideScrollBar
        orientation="vertical"
        variant="fade"
        size={40}
        offset={10}
      >
        <div className="sidebar-section">
          <h3 className="left-title">Library</h3>
          <button
            className={`nav-row ${sidebarKey === "library:all" ? "active" : ""}`}
            onClick={() => onSidebarKeyChange("library:all")}
          >
            <span className="nav-main">
              <span className="nav-icon">
                <SquaresFour size={16} />
              </span>
              <span>All Skills</span>
            </span>
            <span className="nav-count">{skillsCount}</span>
          </button>
          <button
            className={`nav-row ${sidebarKey === "library:favorites" ? "active" : ""}`}
            onClick={() => onSidebarKeyChange("library:favorites")}
          >
            <span className="nav-main">
              <span className="nav-icon">
                <Star size={16} />
              </span>
              <span>Favorites</span>
            </span>
            <span className="nav-count">{favoritesCount}</span>
          </button>
        </div>

        <div className="sidebar-section">
          <h3 className="left-title section-gap">Tools</h3>
          {visibleTools.map((tool) => (
            <button
              key={tool}
              className={`nav-row ${sidebarKey === `tool:${tool}` ? "active" : ""}`}
              onClick={() => onSidebarKeyChange(`tool:${tool}`)}
            >
              <span className="nav-main">
                <span className="nav-tool-icon" style={toolIconStyle(tool)}>
                  {renderToolIcon(tool)}
                </span>
                <span>{tool}</span>
              </span>
              <span className="nav-count">{toolCounts.get(tool) ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="sidebar-section">
          <div className="left-section-heading section-gap">
            <h3 className="left-title">Collections</h3>
            <button className="collection-add-btn" aria-label="Create collection" onClick={onOpenCollectionCreate}>
              <Plus size={14} />
            </button>
          </div>
          {collections.map((collection) => (
            <button
              key={collection.id}
              className={`nav-row ${sidebarKey === `collection:${collection.id}` ? "active" : ""}`}
              onClick={() => onSidebarKeyChange(`collection:${collection.id}`)}
              onContextMenu={(event) => onCollectionContextMenu(event, collection)}
            >
              <span className="nav-main">
                <span className="nav-icon">{renderCollectionIcon(collection.icon, 16)}</span>
                <span>{collection.name}</span>
              </span>
              <span className="nav-count">{collectionCounts.get(collection.id) ?? 0}</span>
            </button>
          ))}
        </div>
      </ScrollShadow>

      <div className="left-bottom-actions" ref={newSkillActionsRef}>
        {newSkillLinksOpen ? (
          <div className="new-skill-links shadow-sm" aria-label="New skill websites">
            <div className="new-skill-tabs" role="tablist" aria-label="Skill source groups">
              {SKILL_SITE_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={newSkillTab === tab.key}
                  className={`new-skill-tab-btn ${newSkillTab === tab.key ? "active" : ""}`}
                  onClick={() => onNewSkillTabChange(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="new-skill-links-list" role="menu" aria-label={`${activeSkillSiteTab.label} skill websites`}>
              {activeSkillSiteTab.sites.map((site) => (
                <button
                  key={site.url}
                  type="button"
                  className="new-skill-link-btn"
                  role="menuitem"
                  onClick={() => onOpenSkillSite(site.url)}
                >
                  <span className="new-skill-link-label">{site.label}</span>
                  <span className="new-skill-link-url">{site.url}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <button className="left-action-btn" aria-label="Refresh" onClick={onRefreshSkills}>
          <ArrowsClockwise size={16} />
        </button>
        <button
          className="left-action-btn"
          aria-expanded={newSkillLinksOpen}
          aria-label="New Skill"
          onClick={onToggleNewSkillLinks}
        >
          <Plus size={16} />
        </button>
      </div>
    </aside>
  );
}
