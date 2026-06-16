# AIHub Frontend Development Standards

This project and its locked `.project-standard/snapshot` are the source of truth for its frontend implementation. Read only the documents and references relevant to the requested page or module.

## Repository Boundary

- Keep the project independent. Do not depend on other repositories for implementation rules.
- Runtime code, shared components, page patterns, mock APIs, route rules, docs, `references/starter-blueprints`, and `references/component-blueprints` in this repository are the canonical implementation reference.
- New project-specific standards belong in this project's `docs/` or `.project-standard/decisions.md`.
- Treat examples as reference implementations, not mandatory product pages.
- Keep `references/starter-blueprints` and `references/component-blueprints` even when runtime examples are removed.
- Keep the complete locked `.project-standard/snapshot` as the primary implementation baseline.
- Business source must never import `.project-standard`; lint, type-check, build, formatting, tests, and deployment must exclude it.
- Do not replace the project baseline during ordinary feature work or review.
- Explicit user instructions and PRD requirements are the product contract. Reference patterns provide defaults only where that contract is silent.

## Current Project Patterns

- `Login`: `/login`, implemented in `src/pages/LoginPage.tsx` and `src/pages/LoginPage.css`. It uses real authentication and current-user restoration and is not a removable starter example.
- `Component Gallery`: `/component-gallery`, implemented in `src/features/component-gallery`.
- `Table CRUD`: `/examples/table-crud`, implemented in `src/features/table-crud`.
- `Module CRUD`: `/examples/module-crud`, implemented in `src/features/module-crud`.
- `Dashboard`: `/examples/dashboard`, implemented in `src/features/dashboard-example`.

Use `references/starter-blueprints` as the stable page reference source and `references/component-blueprints` as the stable component usage source. Runtime example pages are executable demonstrations and may be hidden from the product menu. CRUD selection and implementation rules live in `docs/crud-patterns.md` and should not be reintroduced as a runtime page.

When `.project-standard/snapshot` exists, it takes precedence as the exact,
version-locked implementation baseline. The blueprints remain the concise
pattern index.

## Bootstrap Cleanup Rules

- Decide whether the product hides, removes, or keeps example pages before implementing business pages.
- Default to hiding examples so later page generation can still inspect runnable starter pages without showing them in the product menu.
- If examples are removed, remove their route imports and route entries together.
- Do not remove `references/starter-blueprints` or `references/component-blueprints`; agents need them after examples are removed.
- Do not remove or downgrade `/login` when removing starter examples. The login page validates real authentication, current-user restoration, auth guards, and protected-route redirects.
- When no visible business route exists because examples are hidden or removed, the authenticated index route must render an empty-project home state rather than `/403`.
- If examples are hidden, keep their route code consistent and document how developers can access them.
- Do not rewrite layout, router, auth, or shared request foundations just to remove examples.
- Keep the project README aligned with the routes and examples that remain.
- Example pages may remain available as implementation references while staying hidden from the product menu.

## Page Selection Rules

- Use Table CRUD for resource, task, quota, user, audit, model management, API key management, and other structured records that need column comparison, pagination, table sorting, or batch operations.
- Use Module CRUD for modules, templates, models, images, datasets, plugins, and other category-first resources that benefit from a tag sidebar and card grid.
- Use Dashboard for aggregated metrics, trends, rankings, utilization, and time-range filtering.
- Use Component Gallery when validating shared component behavior or adding reusable page primitives.
- When requirements leave the presentation open, a small Modal or Drawer is the default only when the record has 3 or fewer simple fields and does not require upload, permission configuration, quota, parameter groups, audit fields, or complex validation. Explicit product requirements override this default.
- Use independent create/edit/detail routes for anything larger than a tiny record. Preserve the source list query when entering and leaving these routes.
- Table-first create pages should choose one form pattern for the product workflow: `simple`, `standard`, `steps`, or `advanced`. Runtime examples may expose multiple variants for comparison; business list pages should not add a pattern picker unless product users genuinely need that choice.
- Use the `steps` form template when the workflow is naturally step-by-step. It must keep all step panels mounted and only toggle visibility so AntD Form state, uploads, and dynamic lists are not lost when moving forward or backward. Do not add a separate confirmation page by default; the last step's next action becomes submit.
- Use the `advanced` form template for large multi-section forms with clear section navigation. Use `simple` only for fast creation with a small core field set and safe defaults.
- Do not create product pages as raw AntD tables with page-level inline styles. Follow the closest starter pattern and move feature layout into CSS modules or feature CSS files.
- Use `PagePanel` as the root DOM shell for business list, create/edit, detail, dashboard, and gallery-style pages. TopHeader owns only breadcrumb context; Content PageHeader owns title, description, and page-level actions. Entity detail heroes must not repeat the same large title in Content PageHeader.
- Do not recreate starter-owned shell behavior inside business pages or Header. Sidebar collapse is owned by `src/layouts/Sidebar/Sidebar.tsx`.
- Keep the desktop Header compact at the starter `64px` baseline unless the product adds real controls that require more height. Keep Header, Sidebar brand, Content viewport, and full-height page calculations aligned.
- Do not override shared toolbar control heights in business page CSS. `TableLayout` owns alignment for `Input`, `Input.Search`, `Select`, `DatePicker`, `InputNumber`, and toolbar buttons.
- In list toolbars, prefer `TableLayout.SearchInput`, `TableLayout.TextFilter`, `TableLayout.SelectFilter`, and `TableLayout.DateRangeFilter` over raw AntD controls.
- Keep primary list toolbar controls at 36px. Dense multi-select filters should move to an advanced filter area rather than expanding the main toolbar height.
- Table row actions should use `ResourceActions`. Keep no more than 2 high-frequency actions inline; extra row actions belong under `更多`.
- Keep row actions text-first by default. Add icons only when they materially improve recognition.
- Detail navigation must be visually obvious through a visible name link and/or an inline `详情` action.
- Do not ship no-op buttons, hidden filters, or placeholder interactions.
- For business list pages, follow `docs/business-module-blueprints.md` and map the page to the canonical Table CRUD files before writing code.
- For backend naming differences, follow `docs/api-query-adapter.md` and keep API param conversion out of JSX.

## Form Rules

- AntD Form owns field state, field validation, dynamic `Form.List`, server field errors, and dirty state.
- Do not put form fields in Zustand or duplicate form data in local module stores.
- Use `PagePanel` with `FormPageWrap` and `FormSubmitButton` for independent create/edit pages.
- Use the Table CRUD flat form grid by default. It adapts to the form container: wide containers use two columns and narrow containers use one.
- Form responsiveness must be container-based, not only viewport-based. If the form card/content width is not enough, all Table CRUD form templates fall back to one `Form.Item` per row, including simple, standard, advanced, and steps variants.
- Let tags, uploads, descriptions, and other space-sensitive controls span the full row.
- Do not add decorative form sections or nested cards when the fields belong to one linear workflow.
- Use `TwoColumnFormLayout` only when the page has stable left/right responsibilities, such as basic information on the left and dynamic parameters, resource options, or storage on the right.
- Use `ParameterListField` for environment variables, input parameters, output parameters, and other key-value parameter groups.
- Use `FileUpload` or `BaseUpload` for starter-level upload flows. Business-specific upload flows should compose these components instead of modifying unrelated pages.
- Complex forms must use unsaved-change confirmation through the shared form leave-confirm hooks.
- Create success returns to the list's first page unless a product flow explicitly requires staying on the detail page.
- Edit success returns to the previous list query or the current detail page, depending on the route that opened the form.

## Data Flow Rules

- URL search params are the only source of truth for list filters, pagination, sorting, selected category, and time range.
- Server data belongs in TanStack Query. Lists, details, facets, enums, logs, and dashboards should use `useQuery`.
- Writes belong in `useMutation`.
- Mutation success must invalidate affected list, detail, facet, enum, dashboard, or log query keys.
- Do not copy server lists, detail records, or entity collections into Zustand.
- Zustand is limited to lightweight client UI state such as sidebar collapsed state, layout preference, and theme preference.
- Default `staleTime` is `0`. Returning to a page may show cached data briefly, but every entry should revalidate.
- Do not use optimistic updates unless rollback behavior is explicit and tested.
- Initial loading may block the page. Refetch with existing data should use local loading affordances without hiding current content.
- Auth restoration is not ordinary page loading: preserve the app shell, hide stale protected content, and use Content/user-menu skeletons instead of a fullscreen spinner.
- Sorting state must round-trip through URL query and be reflected back into table or order controls.

## API Integration Rules

- Feature modules should expose typed API functions, query hooks, and shared types from their own `api/` and `hooks/` folders.
- Business pages should call feature hooks or feature API modules, not `axios` directly.
- Use `src/shared/request/httpClient.ts` as the single request entry.
- Runtime API base URL comes from `public/config.js` through `src/config/runtimeConfig.ts`.
- API responses should normalize to `ApiResponse<T>`.
- The response envelope `code/msg/data` is stable, but inner pagination fields are endpoint-specific. Normalize paginated lists through `normalizePageResult` or an equivalent endpoint adapter.
- Keep request error handling centralized. Pages should consume normalized errors and field errors, not raw backend variants.
- `401` should clear session and send the user to `/login`.
- `403` should send the user to `/403`.
- Mock APIs must match real API contracts and cover pagination, filtering, sorting, detail not found, duplicate names, field errors, non-field errors, and loading delay.
- Main UI copy should not mention mock, sample, or demo data.

## Permission Rules

The starter provides real authentication/current-user loading and a permission skeleton. Business projects keep it by default and replace it only for an explicit product auth design or no-auth requirement.

When keeping this model, preserve the configured `GET <userApiBaseUrl>/users/:id` request and surface failures through the auth state. The default browser-facing base URL is same-origin `/api/v1`; real development and production hosts belong in Vite and Nginx proxy configuration, not React or runtime application source. Do not silently create a current user from login data or JWT claims unless the product contract explicitly defines that fallback.

If keeping the starter permission model:

- Route permission fields are defined in `src/router/types.ts` and consumed by `src/router/routeAccess.ts`.
- Prefer one canonical permission identifier per route. Keep `permission`, `access`, and `authName` aligned when all are present.
- Routes without `permission` or `access` are public after login.
- Routes with `permission` or `access` must be hidden from the menu and blocked by the guard when the user lacks permission.
- Menu filtering, default redirect, and page guard must use the same permission helper.
- Keep permission nodes compatible with AIHub menu data: `auth` and `authName`.
- After integrating a real permission API, flatten the returned menu tree and write it through the auth provider instead of adding page-local permission checks.

If replacing auth or permission logic:

- Replace `AuthProvider`, session storage, guards, route access helpers, and route metadata together.
- Remove obsolete permission stubs and docs from the project.
- Keep login redirects, forbidden states, and menu visibility intentional.
- Document the replacement boundary in the project README or docs.

Authentication/current-user work must not create account or role administration pages. Roles returned by the current-user endpoint are read-only identity data unless a separate product requirement defines otherwise.

## Project Validation

- Keep `pnpm validate` green after feature work.
- Do not replace `.project-standard/snapshot` during ordinary development or review.
- Record intentional product differences from the baseline in `.project-standard/decisions.md`.
- Perform a whole-project standard migration only when the user explicitly requests it.
