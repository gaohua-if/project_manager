# Requirements Board Card Layer Review

Date: 2026-06-25
Scope: `http://localhost:5173/requirements?view=board`
Screenshot: `01-requirements-board-review.png`

## Evidence

- The board loaded successfully in the current local app.
- The viewport screenshot shows the top metric cards, the board workspace, filters, and four kanban lanes.
- Visual nesting around the content area is currently:
  1. `RequirementMetricCard` row: separate cards above the work area.
  2. `requirements-board__workspace`: white card with border, radius, and shadow.
  3. `requirements-board__workspace-head`: header and toolbar inside the white card.
  4. `requirements-board__content`: gray padded surface.
  5. `requirements-board__column`: light gray bordered lane card.
  6. `requirements-board__card`: white bordered requirement card.

## Main Finding

The page feels heavy because the interface treats almost every semantic group as a card. The board is already a dense operational surface, so repeated white cards, gray cards, borders, radii, padding, and shadows make the user parse containers before they parse work.

This is most visible under `requirements-board__content`: the content is not just wrapped for layout, it also introduces a gray background and padding, then the lanes introduce another card layer, then individual requirements introduce a final card layer.

## Recommended Direction

Use fewer visual containers while keeping useful structural DOM nodes.

1. Keep `requirements-board__workspace` as a layout section, but remove its card treatment.
   - Suggested visual role: full-width workbench section.
   - Remove or reduce: border, shadow, heavy radius, hidden overflow.
   - Keep: spacing, title, actions, filters.

2. Merge the workspace header and toolbar into one lighter control band.
   - The title, view switch, filters, refresh, and create action are all controls for the same work surface.
   - A single sticky or flat toolbar would feel lighter than a card header plus nested toolbar.
   - Consider one row for title/actions and one compact row for filters only when width requires it.

3. Make `requirements-board__content` transparent or nearly transparent.
   - It should be layout padding, not a visible panel.
   - If the page background is already light gray, the extra gray rectangle is unnecessary.
   - Reduce padding from `14px` to `8-10px` or move spacing to the lane grid gap.

4. Turn lanes into columns, not cards.
   - Remove lane border and radius by default.
   - Use a subtle lane header, light vertical separation, or just background tint.
   - Keep drag-over state as the main moment when the lane becomes visibly boxed.

5. Keep only requirement items as true cards.
   - The requirement card is the unit the user acts on, so it deserves the strongest container.
   - Simplify cards internally: title/status, progress, risk/due date. Move secondary evidence such as Token/session details lower or behind expansion.

6. Reduce the top metric row's visual competition.
   - Current metrics are large cards before the user reaches the board.
   - For this page, metrics can become a compact KPI strip or inline summary above the toolbar.
   - Keep only action-driving metrics prominent: pending review, blocked tasks, due soon. Total count can be quieter.

## Concrete CSS Targets

- `RequirementsBoard.css`
  - `.requirements-board__workspace`: reduce card styling.
  - `.requirements-board__workspace-head`: flatten into control band.
  - `.requirements-board__content`: remove visible gray panel treatment.
  - `.requirements-board__column`: remove default card border/radius, keep drag state.
  - `.requirements-board__columns`: use lane grid gap as the main separation.
  - `.requirements-board__card`: keep as the primary card surface.

- `RequirementMetricCard.css`
  - `.requirements-metric-card`: reduce height, shadow, and icon prominence if metrics remain above the board.

## Suggested Information Hierarchy

1. Page header: "需求推进" from the app header/breadcrumb.
2. Compact health summary: review, active, blocked, due soon.
3. Controls: board/list switch, search, filters, follow toggle, refresh, create.
4. Board lanes: stage headers and counts.
5. Requirement cards: the only strong repeated card unit.

## Accessibility And Usability Risks

- The card click area is large, but the action is not explicit enough. Add a visible details affordance or clearer hover/focus state.
- There is a horizontal board inside a vertically scrolling page; on 1280px width the right lane is visually cropped. Users may miss content unless horizontal scroll affordance is clear.
- Too many same-weight containers can hurt scan order for keyboard and screen reader users because every section appears equally important visually.

## Evidence Limits

- This review is based on the loaded board viewport and DOM/CSS inspection.
- It does not verify all responsive breakpoints, drag-and-drop behavior, or keyboard navigation.
