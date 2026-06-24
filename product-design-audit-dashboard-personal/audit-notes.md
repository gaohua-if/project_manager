# Dashboard Personal Module Detail Audit

Date: 2026-06-24
Scope: Desktop review of `http://localhost:5173/dashboard`, role switch set to personal.
Out of scope: Mobile/responsive behavior, per user instruction.

## Captured Evidence

- `01-dashboard-personal-viewport.png`: desktop top state.
- `03-dashboard-personal-bottom.png`: desktop lower state after scrolling the main content container.
- `dom-summary.json`: captured URL, viewport, and text summary.

## Step List

1. Dashboard entry, personal role selected: generally healthy, but the prototype role bar is visually prominent.
2. Today report and Token summary: generally healthy, with small hierarchy and duplication issues.
3. Pending risks table: usable, with some density and scannability concerns.
4. Followed object changes table: usable, but repeated action labels reduce clarity.

## Findings

1. The role switch bar reads as a production control but is labeled "prototype role".
   Evidence: `01-dashboard-personal-viewport.png`, top dashed bar.
   Impact: If this screen is no longer a prototype review surface, this weakens product confidence. If it must remain, it should feel like a temporary dev affordance rather than a first-class dashboard section.
   Small fix: Hide it in normal product mode, or reduce it to a compact toolbar affordance outside the main content rhythm.

2. The empty/dashed container treatment at the top creates a visual pause before the real content.
   Evidence: `01-dashboard-personal-viewport.png`, first content row.
   Impact: The dashboard's first meaningful content starts lower than expected, and the dashed border looks unfinished compared with the polished cards below.
   Small fix: Remove the dashed border style or convert it into a subtle inline role selector row with no large framed container.

3. "今日报告" repeats status and action copy in a tight area.
   Evidence: `01-dashboard-personal-viewport.png`, left card.
   Impact: "草稿待确认" and "确认日报草稿" are both correct, but the repeated "确认" wording competes with the body copy and makes the card feel slightly busy.
   Small fix: Keep the badge as "待确认", or change the button to a shorter verb phrase such as "确认草稿".

4. Token chart communicates trend direction but not the magnitude.
   Evidence: `01-dashboard-personal-viewport.png`, right card.
   Impact: Users can compare bar lengths, but cannot tell whether the values are token totals, percentages, or relative index values without reading the total card.
   Small fix: Add compact value labels at the end of each bar, or add a clearer caption such as "每日解析 Token".

5. Risk and follow tables are readable but very dense for a primary work surface.
   Evidence: `01-dashboard-personal-viewport.png` and `03-dashboard-personal-bottom.png`.
   Impact: The rows are efficient, but the combination of 6 columns, two-line titles, badges, dates, and link buttons makes scanning status vs action slower.
   Small fix: Increase row vertical breathing room slightly, or use stronger column grouping by muting repeated low-priority metadata.

6. Action labels are generic in the follow table.
   Evidence: `03-dashboard-personal-bottom.png`, three "详情" actions.
   Impact: Screen-reader and keyboard users get repeated indistinct actions, and sighted users have to read back across the row to know what "详情" opens.
   Small fix: Use row-specific accessible labels, for example visible "详情" plus `aria-label="查看补充日报生成验收标准详情"`.

7. Low-emphasis metadata is close to the contrast floor.
   Evidence: muted text and small tags in both screenshots.
   Impact: Text like secondary descriptions, captions, and pale status tags is readable on this monitor, but will be fragile under lower contrast displays or projector review.
   Small fix: Darken secondary text one step or reserve the lightest gray for non-essential captions only.

## Evidence Limits

- This audit is screenshot-based and DOM-inspection assisted. It does not prove full keyboard accessibility or WCAG compliance.
- Backend data freshness and real empty/error/loading states were not exercised.
- Mobile findings were intentionally excluded after the user clarified scope.
