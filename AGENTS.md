# Repository Guidelines

## Project Structure

This repository contains the Aida platform.

- `api/`: Go HTTP API, handlers in `api/handler`, services in `api/service`, config in `api/config`, migrations in `api/db/migrations`
- `daemon/`: Go CLI and report generator service
- `web/`: Vite + React + TypeScript frontend
- `doc/`: product, rule, and validation documents
- `docker-compose.yml`: local integration stack

Do not assume old scaffold structure such as Next.js `app` router or separate frontend/backend template conventions. Check the actual code first.

## Build and Run

### Full local stack

```bash
docker compose up -d
```

### API only

```bash
docker compose up -d db minio
cd api && go run main.go
```

### Web only

```bash
cd web
pnpm install
pnpm dev
```

### Daemon / consumer

```bash
cd daemon
go build -o aida .
./aida serve
```

## Validation Commands

### Backend

```bash
cd api && go test ./...
cd daemon && go test ./...
```

When the user asks to run Go tests with Docker, do not pull Go images or guess
patch-version tags. First use a locally available Go image tag, and run Docker
with `--pull=never` so a missing tag fails fast instead of downloading. If no
local Go image works, stop and report that the local Docker image is missing.

### Frontend

```bash
cd web && pnpm lint && pnpm typecheck && pnpm build
```

There are also workflow scripts in `web/package.json`, including `pnpm test`.

## Key Business Constraints

### Optimistic lock

Requirements and tasks use `version` optimistic locking.

When changing related code:

- requests must carry `base_version`
- final update must still rely on `WHERE id AND version`
- write conflicts must distinguish `404` from `409 EDIT_CONFLICT`
- all list/detail/dashboard queries that hydrate requirement/task data must include `version`

### Task done semantics

Any path that updates task status or progress must keep `done`, `progress`, and `completed_at` consistent. A successful write should increment `version` once.

### Frontend sync

Mutations on requirement/task/follow/dashboard pages must refresh every impacted query, not only the current component state.

### Validation policy

Current requirement/task field validation is intentionally loose. Treat it as safety validation, not heavy product gating.

## Coding Style

### Go

- use `gofmt`
- keep packages small and lowercase
- add focused `*_test.go` tests next to the package under change

### Frontend

- TypeScript with existing project patterns
- Ant Design components first, custom UI second
- keep edits scoped; avoid rewriting unrelated page structures
- prefer stable class names and page-local CSS for business page polish

## Migrations and Data

- migrations are under `api/db/migrations`
- API startup applies migrations automatically
- use forward migrations for schema fixes

Important existing migrations:

- `005_user_auth.sql`
- `007_requirements_p0.sql`
- `016_requirement_task_versions.sql`

## Release Notes

CLI packaging commands:

```bash
make release-test-dir
make release-prod-dir
```

Use the test package only for the fixed internal test distribution path. Do not reuse it for production.

## Documentation

Business documents, validation cases, rollout notes, and deployment instructions are maintained under [doc/](/home/intellif/dev/project_manager/doc).
