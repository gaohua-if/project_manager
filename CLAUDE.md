# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AIDashboard is the AI department's internal platform for tracking Claude Code (and similar agent) usage: requirements → tasks → sessions → token usage → daily reports. Three Go/TS components deploy together via `docker-compose.yml`:

- `api/` — Go HTTP API (chi v5) backed by PostgreSQL, optional MinIO for raw session logs.
- `daemon/` — Single Go binary that is BOTH the user-facing CLI (`aidashboard upload`) AND the server-side report-generator microservice (`aidashboard serve`, container name `consumer`). Same code path, different subcommand.
- `web/` — Next.js 16 app (App Router, React 19, Tailwind v4, pnpm).

## Common Commands

### Local development
```bash
docker compose up -d db           # just Postgres (+ MinIO if you want raw logs)
cd api && go run main.go          # API on :8080, runs migrations on boot
cd web && pnpm dev                # Next.js on :3000
cd daemon && go build -o aidashboard . && ./aidashboard serve   # report-generator on :8090
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
- `aidashboard login|sessions|upload|status` — user-facing CLI that reads `~/.claude/projects/*/*.jsonl` and posts to `/api/v1/sessions/batch`. Config in `~/.aidashboard.yaml`.
- `aidashboard serve` — the server-side report-generator container (compose service `consumer`). Listens on `:8090`, calls `claude -p` to turn a user's same-day sessions into a Markdown daily report. The API talks to it via `REPORT_GENERATOR_URL` (`http://consumer:8090` in compose). The container mounts `${HOME}/.claude` to reuse server-side Claude login; it never reads users' local session logs.

Both modes share `daemon/main.go` (single package, ~1300 lines) — the command dispatcher is the `switch` at the top of `main()`.

### MinIO is optional
If `MINIO_ENDPOINT` / `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` are unset, `cfg.MinioConfigured()` returns false and raw log upload/download is silently disabled. The session metadata still lands in Postgres.

### Web: role-switched dashboards, App Router with a route group
- `(app)/layout.tsx` wraps every authenticated route in `AppShell` (sidebar + session reset on `/login`).
- `(app)/dashboard/page.tsx` switches on `user.role` and renders `DirectorDashboard` / `PMDashboard` / `TLDashboard` / `EmployeeDashboard`. New role-specific dashboards go here.
- `lib/api.ts` is a singleton `ApiClient` that reads the JWT from `localStorage`; on `401` it hard-redirects to `/login`.

### Next.js version warning
`web/` runs Next.js 16.2.9 — this is NOT the Next.js from training data. Before writing or modifying any Next.js code, read the relevant guide under `web/node_modules/next/dist/docs/`. Do not rely on memorized APIs (e.g. params handling, route handlers, caching primitives) — verify against the bundled docs first. The repo's `web/AGENTS.md` reiterates this.

### AI integration via `claude -p`
Both AC generation (`RequirementHandler.RegenerateAC` → `AIClient.GenerateAcceptanceCriteria`) and session-to-task matching shell out to the `claude` CLI with a prompt and parse JSON from stdout. `service/ai.go` strips code fences and falls back to a hard-coded AC list on any failure — callers should not assume AI always succeeds.

## Configuration

API env vars (see `api/config/config.go`): `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, `PORT`, `AI_API_URL`/`AI_API_KEY`/`AI_MODEL` (currently unused; real AI calls go through `claude`), `REPORT_GENERATOR_URL`, `MINIO_*`, `TZ`.

Daemon `serve` env vars: `DATABASE_URL`, `AIDASHBOARD_CLAUDE_BIN`, `AIDASHBOARD_CLAUDE_TIMEOUT`, `PORT`, `TZ`.

Web: `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8080/api/v1`).

Default users and teams live in `api/db/migrations/002_seed.sql` — names are Chinese (`张三`, `刘TL`, etc.) and the frontend login screen is a name picker, not a credential form.

## Conventions

- Go: `gofmt`, short package names, handlers grouped by resource (`RequirementHandler`, `TaskHandler`, …). Constructor `NewXHandler(deps...) *XHandler`, registered in `api/main.go`.
- Frontend: TypeScript, 2-space indent, PascalCase component files, App Router. Functional components with hooks; no Redux — local state + `ApiClient` singleton.
- Commit prefixes: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`. Keep messages imperative.
- When touching sessions, tokens, or reports, run through the upload → match → report loop mentally — these three tables are coupled and re-upload semantics are destructive (see above).
