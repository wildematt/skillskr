# Middle Skill List Hierarchy Design

Date: 2026-03-23
Status: Draft for review

## Context

The middle skill list currently renders `filteredSkills` as a flat list in [src/App.tsx](/Users/mattshan/Documents/skillskr/src/App.tsx). This works for standalone skills, but it loses an important relationship when multiple skills belong to a larger parent pack or directory. In practice, entries like `superpowers/brainstorming/SKILL.md` and `superpowers/test-driven-development/SKILL.md` appear as unrelated siblings even though they clearly belong to the same parent package.

The goal of this change is to make that parent-child relationship visible in the middle list without disrupting the current browsing speed, selection model, or detail panel behavior.

## Goals

- Show parent-child ownership in the middle skill list when multiple skills belong to the same parent directory.
- Preserve current list scanning speed and keep the visual rhythm close to the existing list.
- Allow parent entries to remain selectable when the parent directory itself has a real `SKILL.md`.
- Support default-expanded groups with user-controlled collapse.
- Keep all skill-level actions attached to real skills, not abstract group containers.
- Avoid backend API changes if the relationship can be derived from existing frontend data.

## Non-Goals

- No change to the left sidebar filtering model.
- No drag-and-drop or manual reordering.
- No batch actions at the group level.
- No backend changes to `list_skills` or `read_skill` for this iteration.
- No change to how the detail pane loads, edits, saves, or updates real skills.

## Current Inputs

The frontend already receives enough information to derive hierarchy:

- `path`
- `relativePath`
- `name`
- `tool`
- `description`
- `modifiedUnix`

Example:

- `superpowers/SKILL.md`
- `superpowers/brainstorming/SKILL.md`
- `superpowers/test-driven-development/SKILL.md`

From this, the frontend can infer:

- `superpowers` is a parent directory
- `brainstorming` and `test-driven-development` are children of that directory
- `superpowers/SKILL.md`, when present, is the parent skill itself

## Proposed Model

Introduce a frontend-only derived structure for the middle list. The raw `skills` array remains unchanged and continues to be the source of truth for reading and selecting actual skills.

### Derived List Concepts

`GroupedSkillListItem`

- `type: "skill"` for standalone skills that should render as a normal row
- `type: "group"` for parent directories that should render a parent row plus child rows

`GroupedSkillGroup`

- `groupKey`: stable key derived from `tool + parent directory path`
- `groupLabel`: parent skill name when available, otherwise the directory name
- `directoryName`: raw parent directory segment
- `parentSkill`: optional real skill for `parentDir/SKILL.md`
- `childSkills`: real skills that live under `parentDir/<child>/SKILL.md`
- `childCount`
- `isCollapsible`: true when the item is rendered as a group

## Grouping Rules

These rules define when the flat skill list becomes a grouped list.

### 1. Relationship detection

For each `filteredSkills` entry:

- Split `relativePath` by `/`
- Ignore the trailing `SKILL.md`
- If the remaining path has:
  - 1 segment: the skill is a root-level standalone candidate
  - 2 segments: the skill is a child of the first segment
  - more than 2 segments: group by the first segment for this iteration

This intentionally treats the top-level directory as the visible parent group. The first version does not attempt to surface deeper nesting levels in the middle column.

### 2. Parent skill detection

If a skill has `relativePath` equal to `<dir>/SKILL.md`, treat it as the real parent skill for that directory.

### 3. Group creation threshold

A visible group is created when either of the following is true:

- the directory has 2 or more child skills
- the directory has 1 child skill and also has a real parent skill

Otherwise, the lone child skill renders as a normal standalone row to avoid unnecessary visual noise.

### 4. Group label resolution

The parent row label is resolved in this order:

1. `parentSkill.name` when a real parent skill exists
2. directory name derived from `relativePath`

The directory name remains available as secondary metadata if needed later, but it is not required in the first UI pass.

### 5. Filtering and search interaction

Filtering still happens on the raw skills first, using the existing logic for:

- favorites
- collection filters
- tool filters
- search

Grouping happens after filtering. This keeps the semantics stable and avoids introducing separate filter behavior for groups.

Implications:

- if a child skill matches search, its group appears in results
- groups containing matches should render expanded by default for that result set
- pure group containers are never searchable on their own unless a real parent skill is present and matched as a normal skill

## Interaction Design

The chosen direction is the visual behavior represented by option B during brainstorming.

### Parent row

The parent row should feel like a normal list row, not a different card system.

- reuse the current `skill-row` structure as much as possible
- keep the existing icon position and row rhythm
- add a collapse/expand affordance on the right side
- show a subtle child count on the right side
- when the parent is a real skill, allow the row to be selected like any other skill
- when the parent is not a real skill, the row acts as a group header and only controls collapse/expand

### Child rows

Children render immediately under the parent row when expanded.

- nested under the parent with one level of horizontal indentation
- visually connected with a faint vertical hierarchy rail
- slightly more compact than parent rows
- still selectable as real skills
- keep favorite interaction available on real child skills

### Expanded and collapsed states

- groups are expanded by default
- clicking the chevron toggles collapse without changing selection
- clicking a selectable parent row selects that parent skill
- collapsing a group hides its children entirely

### Selection behavior

Selection remains skill-based, not group-based.

- if a child skill is selected, highlight the child row only
- if a parent skill is selected, highlight the parent row only
- an expanded group with no selected item does not receive selected styling

### Keyboard and navigation expectations

Existing previous/next skill navigation should continue to move through real skills only.

That means:

- pure group headers do not count as steps in sequence navigation
- parent skills count as steps only when they are real skills
- child skills count normally

## State Management

Add a new local storage entry for collapse state.

Suggested key:

- `skillskr.skillGroupCollapse.v1`

Suggested shape:

```json
{
  "Codex::superpowers": true,
  "Agents::gstack": false
}
```

Where:

- `true` means collapsed
- `false` or missing means expanded

Rules:

- default state is expanded
- user toggles persist per group key
- when search is active, any group containing visible matches renders expanded for that filtered view even if its stored state is collapsed
- once search is cleared, persisted collapse state resumes

## Rendering Strategy

Keep the existing `filteredSkills` computation intact, then derive grouped list items in a new memoized selector.

Suggested flow:

1. compute `filteredSkills` exactly as today
2. derive `groupedSkillListItems` from `filteredSkills`
3. render `groupedSkillListItems` instead of directly mapping `filteredSkills`
4. preserve `selectedFilteredIndex` and sequence navigation against a flat list of visible real skills, not rendered group containers

This keeps the data ownership clean:

- raw skill behavior stays on `skills` / `filteredSkills`
- UI hierarchy stays in a view-model layer

## Styling Direction

Reuse existing middle-column styling and add only the pieces needed for hierarchy.

### New style needs

- parent row chevron
- child count badge or text
- child-list container
- indentation
- faint hierarchy rail
- slightly denser child-row spacing
- optional parent marker such as `Parent` or `Main` when the parent is a real skill

### Visual constraints

- do not convert the list into large stacked cards
- do not overpower the current selected-row styling
- keep dark-mode behavior aligned with current color tokens
- preserve row density close to the current experience

## Edge Cases

### Standalone skills

A skill like `writing/SKILL.md` with no sibling children remains a plain row.

### Parent-only skills

If a directory has only `<dir>/SKILL.md` and no child skills, it remains a plain row.

### Child-only group with multiple children

If a directory has no parent `SKILL.md` but has multiple child skills, render a group header using the directory name. That header is not selectable as a skill.

### Search within collapsed groups

Matching groups render expanded while search is active so matched children remain visible.

### Mixed tools

The group key must include the tool name so unrelated sources using the same top-level directory name do not share collapse state.

## Accessibility

- collapse affordance must have an accessible label
- non-selectable group headers should not pretend to be a selectable skill button
- selectable parent rows and child rows should remain keyboard reachable
- favorite controls on child rows should continue to stop propagation correctly

## Testing Strategy

### Unit-level behavior tests

Add tests around the grouping derivation logic, covering at least:

- standalone root skill remains standalone
- parent plus multiple children forms a group
- multiple children without parent still form a group
- single child without parent remains standalone
- single child with parent remains a group
- group label prefers parent skill name over directory name
- deeper nested paths still group by first directory segment
- search-result grouping preserves visible matching skills

### Verification

At minimum:

- run the relevant frontend test target if present
- run the frontend build to confirm TypeScript and render changes compile
- manually verify the middle column behavior in the app:
  - expand/collapse
  - parent selection
  - child selection
  - search results
  - favorites
  - previous/next navigation

## Implementation Notes

- Prefer extracting hierarchy derivation into a pure helper instead of embedding the full algorithm inline in JSX.
- Do not modify backend Rust commands in this iteration unless the frontend derivation proves insufficient.
- Keep detail pane reads keyed to actual skill paths only.

## Open Questions

None blocking for implementation planning. The current scope is focused and specific enough to move into implementation planning after spec review and user review.
