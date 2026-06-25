# Task Detail Drawer Audit

Date: 2026-06-25

## Scope

- Surface: Requirements list, requirement detail drawer, task detail drawer.
- Screenshot: `17-task-detail-drawer-audit.png`
- Goal: Check whether the task detail drawer matches the recently refined requirement detail drawer and identify UI design issues before implementation.

## Step 1 - Open Requirement Detail

Health: Mostly healthy.

- The parent requirement drawer now prioritizes the task tab and uses a cleaner title/action pattern.
- It provides enough context behind the task drawer, but the stacked drawer mask makes the left side visually heavy.

## Step 2 - Open Task Detail

Health: Needs refinement.

### Strengths

- The task drawer keeps a consistent right-side drawer interaction model.
- Task status, progress, dependencies, and session evidence are all available in one place.
- Destructive action is visually marked as danger.

### UX And Visual Risks

1. Title area does not match requirement drawer.
   - Evidence: task drawer title reads `任务详情 · TASK...`, while requirement drawer now only shows the entity name.
   - Risk: the task drawer feels like an older design layer, not the same component family.
   - Recommendation: use task title as the primary title only. If a type label is needed, move it into a subtle breadcrumb or omit it.

2. Header actions are too dense and command-heavy.
   - Evidence: `标记完成 / 开始任务 / 编辑任务 / 删除任务` all sit in the execution card.
   - Risk: primary, secondary, state transition, and destructive actions compete equally.
   - Recommendation: keep one primary action based on current status, keep `编辑` as secondary, move `删除` into a `更多` dropdown.

3. Progress control feels visually detached from the rest of the drawer.
   - Evidence: slider, numeric input, percent suffix, and save button occupy a wide row with mixed control heights.
   - Risk: looks more like a form debug panel than a polished workflow control.
   - Recommendation: use the same summary-strip style as requirement detail: status/progress/due date at top; expose slider only in an edit/update affordance or make the row compact.

4. Card hierarchy is heavier than the requirement drawer.
   - Evidence: each section is a full bordered card, while task data inside is sparse.
   - Risk: the user reads many containers before reaching content.
   - Recommendation: merge `任务信息` and execution summary into a single top summary block, then use lighter sections for dependencies and sessions.

5. Labels and values lack table-like alignment.
   - Evidence: `所属需求 / 负责人 / 截止日期 / 最近更新` are rendered as loose text rows.
   - Risk: scan speed is lower than the requirement drawer's summary strip and AntD description rhythm.
   - Recommendation: use `Descriptions` or a compact two-column metadata grid with fixed label width.

6. Empty states repeat too much.
   - Evidence: session section shows `暂无关联 session` in header and body.
   - Risk: repeated copy makes the section feel unfinished.
   - Recommendation: keep the header action and use a single quiet empty state in the body.

### Accessibility Risks

- Stacked drawers may create focus-management risk: visually there are two drawers open, and keyboard focus order needs verification.
- Icon-only favorite control in the task drawer appears small; target size and visible focus state should be checked.
- The progress slider plus numeric input needs clear labels for assistive technology; screenshot alone cannot verify aria labels.

### Evidence Limits

- This audit is based on screenshot and DOM state only.
- Keyboard navigation, focus trap behavior, screen reader labels, and contrast ratios were not fully measured.
