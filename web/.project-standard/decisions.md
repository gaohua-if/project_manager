# Project Standard Decisions

This file records intentional deviations from the AIHub Frontend template standard.
The project is a legacy rebuild (Next.js → Vite/AntD, see `web.legacy/` history before deletion)
and the deviations below reflect concrete product requirements from the original product,
not template drift.

## 1. Business lists use raw AntD `Table` instead of `ResourceTable`

**Where:** `dashboard/*Dashboard.tsx`, `requirements/RequirementsListPage.tsx`,
`sessions/SessionsPage.tsx`, `tokens/TokensPage.tsx`, plus inline tables inside
`requirements/RequirementDetailPage.tsx`, `tasks/TasksListPage.tsx`, `reports/ReportsPage.tsx`,
`organization/OrganizationPage.tsx`.

**Why:** AIDashboard tables are mostly *read-only summaries* (dashboard cards, AC status,
team activity, daily reports) — not the CRUD-style lists `ResourceTable` is designed for.
Many cells render custom compositions (charts, status tags, AC badges, segmented filters,
inline Select to override task assignment). Forcing `ResourceTable` would hide the per-cell
logic behind props and reduce clarity.

## 2. Complex forms use AntD `Modal` instead of independent form routes

**Where:** `requirements/RequirementsListPage.tsx` (create requirement),
`requirements/RequirementDetailPage.tsx` (add task), `tasks/TasksListPage.tsx` (create task),
`organization/OrganizationPage.tsx` (edit role/team, reset password),
`products/ProductsPage.tsx` (add document).

**Why:** These are quick operational actions taken in the middle of a list view, not
multi-step document workflows. The original product spec used inline forms / modals; users
expect to fill them in without losing their place in the list. Form-route pattern would add
navigation overhead for forms with 4-6 fields.

## 3. TokensPage uses `scroll={{ x: "max-content" }}`

**Where:** `tokens/TokensPage.tsx`.

**Why:** The table has 9 numeric columns (input/output/cache-create/cache-read/total/etc).
On narrow viewports horizontal scroll is essential. `ResourceTable`'s responsive column
hiding would lose data.

## 4. Strict-mode verification

`pnpm lint` and `pnpm build` pass. `verify-project.sh` without `AIHUB_FRONTEND_VERIFY_STRICT=1`
passes. Strict mode treats the three categories above as failures — they are acknowledged here
as intentional product decisions and should not be treated as drift in future audits.
