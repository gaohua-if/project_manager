# CLAUDE.md

This file is for Claude Code and similar coding agents working in this repository.

## Project Summary

Aida is an internal AI department platform for:

- requirements and tasks
- session upload from local AI coding tools
- token analytics
- daily / weekly report generation

The repository has three runtime applications plus infra:

- `api/` — Go API
- `daemon/` — Go CLI and report generator service
- `web/` — Vite + React + Ant Design SPA
- `docker-compose.yml` — local stack

## Actual Stack

Do not assume old scaffold defaults.

- Backend: Go `1.26.3`, `chi`, PostgreSQL
- Frontend: Vite `8`, React `18`, TypeScript `5`, Ant Design `6`
- State/query: TanStack Query
- Router: React Router `7`

This is **not** a Next.js app.

## Working Commands

### Local dev

```bash
docker compose up -d db minio

cd api
go run main.go

cd web
pnpm dev

cd daemon
go build -o aida .
./aida serve
```

### Full stack

```bash
docker compose up -d
docker compose down -v
```

### Validation

```bash
cd api && go test ./...
cd daemon && go test ./...
cd web && pnpm lint && pnpm typecheck && pnpm build
```

Go 1.26.3 is installed on the host at `~/sdk/go1.26.3` and on `PATH` in any
fresh shell (`GOTOOLCHAIN=local`). Call `go`, `gofmt`, `go test` directly on
the host — do not bring up a Docker container just to run Go tests.

## Architecture Notes

### 1. `daemon` has two roles

Same codebase, different commands:

- CLI for end users: login, scan sessions, upload sessions
- Consumer service: generate daily / weekly report drafts

Do not split assumptions by folder name only. Check the invoked subcommand.

### 2. Optimistic lock is part of the core contract

Requirements and tasks use `version` for optimistic locking.

When editing:

- request carries `base_version`
- final write must use `WHERE id = ? AND version = ?`
- `RowsAffected=0` must distinguish:
  - `404` not found
  - `409 EDIT_CONFLICT`

If you touch list/detail/query code, confirm `version` is included in both `SELECT` and scan targets.

### 3. Task completion logic must stay unified

Any update path that sets task `status` and/or `progress` must reuse the same completion rules:

- `done` means progress/completed_at are consistent
- version increments once per successful write

This is especially important for Dashboard quick actions.

### 4. Frontend consistency is query-driven

This frontend has many cross-view dependencies:

- requirement list
- requirement detail
- task detail
- dashboard cards
- follow/unfollow state

After mutations, do not only patch local component state. Invalidate or refresh all affected queries.

### 5. Public register is configurable

`ENABLE_PUBLIC_REGISTER=false` by default. Do not document public registration as always enabled.

### 6. MinIO is optional

If MinIO config is absent, the app still runs. Raw object storage features degrade, but core requirement/task/report flows still work.

## Important Paths

- API routes and setup: [api/main.go](/home/intellif/dev/project_manager/api/main.go)
- API config: [api/config/config.go](/home/intellif/dev/project_manager/api/config/config.go)
- Requirement handler: [api/handler/requirement.go](/home/intellif/dev/project_manager/api/handler/requirement.go)
- Task handler: [api/handler/task.go](/home/intellif/dev/project_manager/api/handler/task.go)
- Dashboard handler: [api/handler/dashboard.go](/home/intellif/dev/project_manager/api/handler/dashboard.go)
- Follow handler: [api/handler/follow.go](/home/intellif/dev/project_manager/api/handler/follow.go)
- Web requirement page: [web/src/features/aidashboard/requirements/pages/RequirementsListPage.tsx](/home/intellif/dev/project_manager/web/src/features/aidashboard/requirements/pages/RequirementsListPage.tsx)
- Web requirement styles: [web/src/features/aidashboard/requirements/pages/RequirementsBoard.css](/home/intellif/dev/project_manager/web/src/features/aidashboard/requirements/pages/RequirementsBoard.css)
- Query client: [web/src/shared/query/queryClientInstance.ts](/home/intellif/dev/project_manager/web/src/shared/query/queryClientInstance.ts)

## Coding Conventions

### Go

- run `gofmt`
- keep package names short and lowercase
- add focused tests near the package
- prefer forward migrations instead of editing old migrations unless the file is clearly still unshipped

### Frontend

- use existing Ant Design and local page patterns
- prefer targeted UI changes over broad rewrites
- keep business logic in hooks/query/mutation flows, not scattered across render branches
- when changing table/detail interactions, test both list refresh and cross-page refresh behavior

## Documentation

Project-level documentation is maintained in [doc/](/home/intellif/dev/project_manager/doc). Start there when you need business rules, rollout plans, test cases, or deployment notes.
