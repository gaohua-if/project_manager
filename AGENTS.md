# Repository Guidelines

## Project Structure & Module Organization

This repository contains Aida: a Go API, Go CLI daemon, PostgreSQL schema, and Next.js web dashboard.

- `api/`: Go HTTP API using `chi`; handlers are in `api/handler`, models in `api/model`, config in `api/config`, and migrations/seeds in `api/db/migrations`.
- `daemon/`: Go CLI for scanning and uploading Claude Code session data; packages live under `cmd`, `config`, `scanner`, and `uploader`.
- `web/`: Next.js 16 app using TypeScript, React 19, Tailwind CSS, and pnpm. Routes are in `web/src/app`, shared UI in `web/src/components`, and helpers in `web/src/lib`.
- `docker-compose.yml`: local PostgreSQL, API, and web orchestration.

## Build, Test, and Development Commands

- `docker compose up -d`: start PostgreSQL, API, and web services.
- `docker compose up -d db`: start only the database for API development.
- `cd api && go run main.go`: run the API locally. Set `DATABASE_URL`, `JWT_SECRET`, and `PORT` when needed.
- `cd daemon && go build -o aida .`: build the CLI binary.
- `cd web && pnpm dev`: run the web dashboard locally.
- `cd web && pnpm build`: build the production Next.js app.
- `cd web && pnpm lint`: run ESLint for the frontend.

## Coding Style & Naming Conventions

Format Go code with `gofmt`; keep package names short and lowercase. Export names only for cross-package API. Group handlers by resource, for example `RequirementHandler` and `TaskHandler`.

Frontend code uses TypeScript, two-space indentation, PascalCase component files, and Next.js `app` router routes. Before changing Next.js code, read `web/AGENTS.md`; this repo uses a newer Next.js version with documented breaking changes.

## Testing Guidelines

No test suite is currently committed. For backend behavior, add Go tests named `*_test.go` near the package under test and run `go test ./...` from `api/` or `daemon/`. For frontend changes, use the chosen framework once introduced; always run `pnpm lint` and `pnpm build` before PRs.

## Commit & Pull Request Guidelines

Recent commits use Conventional Commit-style prefixes such as `feat:`, `fix:`, and `docs:`. Keep messages imperative and scoped to one change, for example `fix: include sub-agent sessions in upload`.

Pull requests should include a summary, validation steps, linked issue or requirement, and screenshots for visible web changes. Call out database migrations, new environment variables, and changes to authentication or session uploads.

## Security & Configuration Tips

Do not commit real secrets. Development defaults are documented in `README.md`, but production must override `JWT_SECRET`, `DATABASE_URL`, CORS origin, and any AI provider credentials.
