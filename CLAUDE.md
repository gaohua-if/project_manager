# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Aida is the AI department's internal platform for tracking Claude Code (and similar agent) usage: requirements → tasks → sessions → token usage → daily reports. Three Go/TS components deploy together via `docker-compose.yml`:

- `api/` — Go HTTP API (chi v5) backed by PostgreSQL, optional MinIO for raw session logs.
- `daemon/` — Single Go binary that is BOTH the user-facing CLI (`aida upload`) AND the server-side report-generator microservice (`aida serve`, container name `consumer`). Same code path, different subcommand.
- `web/` — Vite + React 18 + Ant Design 6 SPA (pnpm). Migrated from Next.js via the AIHub Frontend Plugin (`v0.1.29`); the locked template snapshot lives in `web/.project-standard/snapshot` and intentional deviations are recorded in `web/.project-standard/decisions.md`.

## Common Commands

### Local development
```bash
docker compose up -d db           # just Postgres (+ MinIO if you want raw logs)
cd api && go run main.go          # API on :8080, runs migrations on boot
cd web && pnpm dev                # Vite dev server on :5173 (proxies /api/v1 to localhost:8080 via vite.config.ts)
cd daemon && go build -o aida . && ./aida serve   # report-generator on :8090
```

### Full stack (Docker)
```bash
docker compose up -d              # db + minio + api + web + consumer
docker compose down -v            # wipe volumes (re-seeds on next up)
```

### Build / lint
```bash
cd api && go build ./...          # or go vet ./...
cd daemon && go build .
cd web && pnpm build && pnpm lint
```

### Tests
No tests are committed. When adding tests: Go tests as `*_test.go` next to the package, run with `go test ./...`; for web, run `pnpm lint` and `pnpm build` before PRs.

### Resetting the database
Migrations run automatically on API startup. To re-seed: `docker compose down -v && docker compose up -d`.

## Architecture: things you need to know before editing

### Authentication is employee_id + bcrypt password
`POST /api/v1/auth/login` accepts `{"employee_id":"zhangsan","password":"..."}` and verifies the password against `users.password_hash` with `bcrypt.CompareHashAndPassword`. On success it returns a JWT containing `id`, `employee_id`, `name`, `role`, `team_id`. The frontend stores the token in `localStorage` under `token` and the decoded user under `user`.

Self-registration is open: `POST /api/v1/auth/register` takes `employee_id` / `name` / `email` / `password`, creates a user with `role='employee'` and `team_id=NULL`, and returns a token immediately. New users cannot see anything beyond their own data until an admin assigns them a team / promotes their role.

Migration `api/db/migrations/005_user_auth.sql` adds the `employee_id` / `email` / `password_hash` columns, expands the role CHECK to include `admin`, backfills the seeded users from `002_seed.sql` with default credentials (工号 = pinyin slug, password = `Changeme123!`), and idempotently inserts a fixed admin (`employee_id='admin'`, password `Admin@123!`).

The `admin` role bypasses all role-scoped filters — handlers branch on `u.Role` and let `admin` fall through to the unscoped default (same as `director`). Admin-only endpoints (`PUT /admin/users/{id}`, `POST /admin/users/{id}/reset-password`) are gated by `handler.AdminOnly` middleware in `api/main.go`.

### Authorization is enforced **inside SQL**, not just middleware
`api/handler/middleware.go` exposes `requireRoles` but most list endpoints do NOT use it. Instead, handlers like `RequirementHandler.List`, `SessionHandler.List`, and the token/report handlers branch on `u.Role` and append different `WHERE` clauses:
- `employee` → filtered to `user_id = $self`
- `team_leader` / `pm` → filtered to members of `u.TeamID`
- `director` → unscoped

When adding a new endpoint that returns user data, follow this pattern or you will leak data across teams. Dynamic SQL is built with positional `$N` args; keep `argIdx` incrementing when you append filters.

### Migrations are embedded and idempotent
`api/db/migrations/*.sql` are embedded via `//go:embed` and applied on every API boot in numeric order, tracked by the `schema_migrations` table. Adding a new migration = drop a new `NNN_*.sql` file. There is no down-migration support — write fixes as new forward migrations.

### Sessions are the central fact
A session row (`sessions` table) is upserted by `(session_ref, user_id)` (unique index). On every upload, `SessionHandler.replaceTokenUsage` **deletes and re-inserts** all `token_usage` rows for that session — never append. Sub-agent sessions are uploaded alongside the main session via `POST /api/v1/sessions/batch`. Withdraw = physical `DELETE` (cascade removes token rows); a withdrawn session can be re-uploaded.

Task matching is async: `SessionHandler.matchTaskAsync` calls `claude -p` through `service.AIClient.MatchSessionToTask` and writes back `task_id` / `match_confidence` after the response returns. Users can override via `PUT /sessions/{id}/task`.

### Requirement progress is derived, not stored as input
`requirement.progress = completed_ACs / total_ACs * 100`. An AC is "completed" when all tasks linking to that AC index are `done`. When any task status changes (`PUT /tasks/{id}/status`), the handler recomputes the parent requirement's progress and flips the requirement to `completed` at 100%. Do not write to `requirements.progress` from anywhere else.

### The `daemon` binary wears two hats
- `aida login|sessions|upload|status` — user-facing CLI that reads `~/.claude/projects/*/*.jsonl` and posts to `/api/v1/sessions/batch`. Config in `~/.aida.yaml`.
- `aida serve` — the server-side report-generator container (compose service `consumer`). Listens on `:8090`, calls `claude -p` to turn a user's same-day sessions into a Markdown daily report. The API talks to it via `REPORT_GENERATOR_URL` (`http://consumer:8090` in compose). The container mounts `${HOME}/.claude` to reuse server-side Claude login; it never reads users' local session logs.

Both modes share `daemon/main.go` (single package, ~1300 lines) — the command dispatcher is the `switch` at the top of `main()`.

### MinIO is optional
If `MINIO_ENDPOINT` / `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` are unset, `cfg.MinioConfigured()` returns false and raw log upload/download is silently disabled. The session metadata still lands in Postgres.

### Web: Vite + AntD SPA, role-switched dashboards
- `src/router/router.tsx` builds `createBrowserRouter`. `MainLayout` wraps authenticated routes; `LoginPage`/`RegisterPage` are public. `PermissionGuard` checks `user.role` against `route.roles` and redirects to `/403` if mismatched.
- `src/router/routes.tsx` defines all 10 business routes. Each route can carry a `roles: UserRole[]` whitelist; if omitted, any authenticated user can access. New role-restricted pages go here.
- `src/features/aidashboard/dashboard/DashboardPage.tsx` switches on `user.role` and renders `DirectorDashboard` / `PMDashboard` / `TLDashboard` / `EmployeeDashboard` (`admin` reuses `DirectorDashboard`).
- `src/shared/auth/AuthProvider.tsx` provides `{ user, login, logout, hasRole }`; JWT is stored in `localStorage` under `token`. The axios `httpClient` (`src/shared/request/httpClient.ts`) auto-injects the Bearer header; on `401` it clears the session and redirects to `/login`.
- API client: `src/features/aidashboard/api/client.ts` wraps all backend endpoints; `normalizeApiResponse` in `httpClient.ts` accepts both envelope `{code,msg,data}` responses and raw payloads (AIDashboard backend returns raw payloads).
- TanStack Query drives all reads/mutations; `queryClient` lives in `src/shared/query/queryClientInstance.ts`.
- `.project-standard/` holds the locked AIHub template snapshot + manifest + `decisions.md` (intentional deviations: raw `Table` over `ResourceTable`, `Modal`-based forms over route-based).

### AI integration via `claude -p`
Both AC generation (`RequirementHandler.RegenerateAC` → `AIClient.GenerateAcceptanceCriteria`) and session-to-task matching shell out to the `claude` CLI with a prompt and parse JSON from stdout. `service/ai.go` strips code fences and falls back to a hard-coded AC list on any failure — callers should not assume AI always succeeds.

## Configuration

API env vars (see `api/config/config.go`): `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, `PORT`, `AI_API_URL`/`AI_API_KEY`/`AI_MODEL` (currently unused; real AI calls go through `claude`), `REPORT_GENERATOR_URL`, `MINIO_*`, `TZ`.

Daemon `serve` env vars: `DATABASE_URL`, `AIDA_CLAUDE_BIN`, `AIDA_CLAUDE_TIMEOUT`, `PORT`, `TZ`.

Web: `window.__AIHUB_RUNTIME_CONFIG__` is set by `public/config.js` (served by nginx). Defaults: `apiBaseUrl`/`authApiBaseUrl`/`userApiBaseUrl` = `/api/v1`, `appTitle` = `AIDashboard`. The Vite dev server proxies `/api/v1` to `localhost:8080` (see `vite.config.ts`).

Default users and teams live in `api/db/migrations/002_seed.sql` — names are Chinese (`张三`, `刘TL`, etc.) and the frontend login screen is a name picker, not a credential form.

## Conventions

- Go: `gofmt`, short package names, handlers grouped by resource (`RequirementHandler`, `TaskHandler`, …). Constructor `NewXHandler(deps...) *XHandler`, registered in `api/main.go`.
- Frontend: TypeScript, Ant Design 6 components, functional hooks, TanStack Query for server state, Zustand for UI state. Feature modules live under `src/features/aidashboard/<module>/pages/`; shared UI helpers (StatCard / ProgressBar / status tags) in `src/features/aidashboard/dashboard/shared.tsx`.
- Commit prefixes: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`. Keep messages imperative.
- When touching sessions, tokens, or reports, run through the upload → match → report loop mentally — these three tables are coupled and re-upload semantics are destructive (see above).
