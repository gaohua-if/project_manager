# Starter Blueprints

These files are reference blueprints for AI agents.

They are not runtime features, are not registered in routes, and should not be imported by business code. Copy the pattern, not the mock data.

When `.project-standard/snapshot` exists, use that complete locked snapshot as
the exact code baseline first. This directory remains the concise blueprint
index. Neither location may be imported by runtime business code.

`auth-current-user/` documents the starter's real login, current-user, and non-blocking auth-restoration loading boundary. It is infrastructure reference rather than a business administration module.

## Relationship To Runtime Examples

- `src/features/*` contains executable starter examples used by this repository.
- `references/starter-blueprints/*` contains stable copyable patterns for agents.
- Runtime examples may be kept, hidden from the menu, or removed.
- This `references/` directory remains the stable implementation source in every case.

## Agent Usage Order

Before generating a business page:

1. Read `docs/business-module-blueprints.md`.
2. Read `docs/anti-patterns.md`.
3. Read the matching blueprint under this directory.
4. Read relevant component usage from `references/component-blueprints`.
5. Generate runtime code under `src/features/<resource>`.
6. Do not register files from `references/` in runtime routes.

## Available Blueprints

- `table-crud/`: complete table-first pattern with list-page visual CSS, create/edit variants (`simple`, `standard`, `steps`, `advanced`), responsive detail hero, types, and API adapter. Copy `list-page.tsx` and `list-pattern.css` together; shared `TableLayout` defaults do not replace the page-level list treatment.
- `module-crud/`: category/sidebar + card browse/detail/edit pattern, types, and model API adapter pattern. It does not provide a default standalone create page; use Table CRUD form variants for creation unless the product needs a category-first create workflow.
- `dashboard/`: complete copyable Dashboard pattern package with page assembly, stable metric/chart components, gradients, states, and responsive CSS.
