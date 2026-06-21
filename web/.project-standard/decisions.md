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

## 4. `scripts/verify_template_contract.sh` rewritten for the Aida API contract

**Where:** `scripts/verify_template_contract.sh` (vs `.project-standard/snapshot/scripts/verify_template_contract.sh`).

**Why:** The starter template's contract script asserts a user-service host
(`/api/v1/users` proxy to `192.168.11.18:300`) that does not exist in this product.
Aida's only backend is the Aida API at `/api/v1` proxied to `localhost:8080` /
`api:8080`. The script was rewritten to (a) assert
`getApiUrl(runtimeConfig.userApiBaseUrl, "/auth/me")` and the `/api/v1` proxy targets
in Vite/Nginx, and (b) reject any external backend host (`192.168.11.18`, `30054`,
`30021`) appearing in app source / runtime config. The contract is stricter than the
starter because the starter's user-service host would be a leak here.

`pnpm validate:template-contract` (which runs this script) passes. `verify-project.sh`
without strict mode reports the managed-file diff against the snapshot — that diff is
acknowledged here as an intentional product-driven contract, not template drift.

## 5. Strict-mode verification

`pnpm lint` and `pnpm build` pass. `verify-project.sh` without `AIHUB_FRONTEND_VERIFY_STRICT=1`
passes. Strict mode treats the categories above as failures — they are acknowledged here
as intentional product decisions and should not be treated as drift in future audits.
