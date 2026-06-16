# AIHub Frontend Project

It includes:

- React 18, TypeScript, Vite, and Ant Design 6;
- real username/password authentication;
- JWT current-user restoration;
- routing, permission hooks, request adapters, and runtime configuration;
- shared list, form, detail, feedback, upload, and layout components;
- runnable Table CRUD, Module CRUD, Dashboard, and component examples;
- stable page and component blueprints;
- a locked `.project-standard/snapshot` used as the implementation baseline.

## Run

```bash
corepack enable
corepack prepare pnpm@10.18.3 --activate
pnpm install
pnpm dev
```

Default development URL: `http://localhost:5173`.

## Validate

```bash
pnpm validate
```

Validation runs the template contract, lint, type-check, and production build.

## Runtime Configuration

Runtime configuration lives in `public/config.js` and is loaded before the application bundle.

```js
window.__AIHUB_RUNTIME_CONFIG__ = {
  apiBaseUrl: "/api",
  authApiBaseUrl: "/api/v1",
  userApiBaseUrl: "/api/v1",
  appTitle: "AIHub Platform",
  enableMock: true,
  enableDebug: true
};
```

The default authentication flow uses:

- `POST /api/v1/auth/login`;
- JWT `uid`;
- `GET /api/v1/users/:id`;
- `Authorization: Bearer <token>`;
- login redirect-back, current-user restoration, logout, and 401 handling.

The browser uses same-origin paths. `vite.config.ts` and `docker/nginx.conf` route authentication and current-user requests to their real backend services; backend hosts are not stored in application source or runtime browser configuration.

Authentication does not imply user-management, role-management, registration, password-recovery, or profile-editing modules.

## Project Standard

Project-standard metadata:

```text
.project-standard/
├── manifest.json
├── decisions.md
└── snapshot/
```

- `manifest.json` records the project-standard version and baseline digest.
- `snapshot/` is the complete template baseline used to create or last update the project.
- `decisions.md` records intentional differences from the baseline.

Normal feature development reads the locked snapshot first. It does not switch to a newer baseline automatically. Only an explicit whole-project standard migration may replace it after runtime validation.

Runtime source must never import `.project-standard`.

## Development References

Read only what is relevant to the task:

- `docs/development-standards.md`: project architecture and implementation boundaries;
- `docs/business-module-blueprints.md`: Table CRUD, Module CRUD, and Dashboard mapping;
- `docs/anti-patterns.md`: known generation failures;
- `docs/api-query-adapter.md`: UI query and API response adaptation;
- `docs/crud-patterns.md`: CRUD interaction patterns;
- `docs/dashboard-patterns.md`: dashboard and report patterns;
- `references/starter-blueprints`: stable page implementations;
- `references/component-blueprints`: shared component usage.

The runnable examples under `src/features` are implementation references, not required business modules.

## Stable Interaction Rules

- Keyword search submits on Enter or search-icon click. Typing alone does not update URL query state or request data.
- Tables receive arrays and do not use internal scrolling without an explicit product requirement.
- TopHeader owns lightweight route context; Content PageHeader owns page title, description, and page actions.
- Detail Hero status and actions remain separate and responsive.
- Header controls must have implemented behavior.
- Form action areas retain safe bottom spacing.
- Loading, empty, error, forbidden, not-found, and malformed-data states are explicit.

## Docker

```bash
docker build -t aihub-frontend .
docker run --rm -p 8080:80 aihub-frontend
```

Or:

```bash
docker compose up --build
```
