# Business Module Blueprints

Use this document when implementing business pages in this project.

The stable agent reference source is `references/starter-blueprints`. Runtime examples under `src/features/*` are executable demonstrations and may be absent from product routes.

Use `references/component-blueprints` for base component usage. It is intentionally separate from page blueprints so agents can copy correct Input, Select, Tag, TableLayout, ResourceTable, feedback, and form patterns without importing reference files into runtime.

Do not assemble enterprise pages from raw AntD `Table`, loose `Space`, and page-local toolbar CSS when a starter pattern exists.

Explicit user and PRD requirements override the defaults in this document. Use these blueprints to fill unspecified implementation decisions, not to replace a required Modal, Drawer, route, field, filter location, or workflow.

## Table Management Blueprint

Use this blueprint for models, users, API keys, quotas, tasks, audit records, and other table-first resources.

Stable reference files for agents:

- `references/starter-blueprints/table-crud/list-page.tsx`
- `references/starter-blueprints/table-crud/form-page.tsx`
- `references/starter-blueprints/table-crud/detail-page.tsx`
- `references/starter-blueprints/table-crud/model-api.ts`
- `references/starter-blueprints/table-crud/types.ts`
- `references/starter-blueprints/table-crud/page.css`
- `references/component-blueprints/table-controls.tsx`
- `references/component-blueprints/basic-controls.tsx`
- `references/component-blueprints/feedback-display.tsx`

Runtime implementation examples may also exist at `src/features/table-crud`.

Create/edit form variant selection:

- Standard route shape: `/resources/create`, `/resources/:id/edit`, and optional `/resources/:id`.
- The runtime example may expose `/create/simple`, `/create/steps`, and `/create/advanced` for comparison. Business pages should normally expose one create route that matches the product workflow, not a pattern picker in the list toolbar.
- `simple` is for quick creation with a small core field set and safe defaults.
- `standard` is the default flat create/edit form.
- `steps` is for wizard workflows. Keep every step panel mounted and hide inactive panels instead of unmounting them. Back/next must preserve entered data, uploaded files, and dynamic list rows. The final step's next action becomes submit; do not add a separate confirmation page unless the product explicitly requires one.
- `advanced` is for large multi-section forms with section navigation.
- All variants must use a container-responsive grid. If the form content width is too narrow, every field becomes one row, even on desktop.

Required generated structure:

- `src/features/<resource>/pages/<Resource>ListPage.tsx`
- `src/features/<resource>/pages/<Resource>FormPage.tsx` when create or edit uses an independent route.
- `src/features/<resource>/pages/<Resource>DetailPage.tsx` when row names link to a detail view.
- `src/features/<resource>/hooks/use<Resource>Queries.ts`
- `src/features/<resource>/api/<resource>Api.ts`
- `src/features/<resource>/api/<resource>Types.ts`
- `src/features/<resource>/pages/<Resource>.css`

## List Page Requirements

The list page must follow the Table CRUD composition:

- Use `PagePanel` as the page root. TopHeader renders only breadcrumb context; Content PageHeader owns the page title, description, and page-level actions.
- Use `TableLayout` for toolbar, operations, filters, and body spacing.
- Use `TableLayout.SearchGroup` with `TableLayout.SearchInput`, `TableLayout.TextFilter`, `TableLayout.SelectFilter`, or `TableLayout.DateRangeFilter` for search and filters.
- Use `TableLayout.SearchItem` and `TableLayout.SelectItem` only when a custom filter control is truly required.
- Use `ResourceTable` instead of AntD `Table` directly.
- Use `ResourceActions` for row actions.
- Keep row actions text-first by default. Add icons only when they materially improve recognition.
- Make the detail entry explicit. If the resource name links to detail, style it as a visible text link without an icon. Icons belong in the operation column. Also include a `详情` row action when the table has an operation column.
- For row actions, show at most 2 high-frequency actions inline. When a row has more than 2 actions, keep the first 2 actions inline and place the rest under `更多` through `ResourceActions`.
- Format timestamp columns through `formatDateTime` from `src/shared/utils/dateTime`; never show raw ISO strings in table cells or detail fields.
- Do not pass `scroll`, `horizontalScroll`, or fixed-column configuration to `ResourceTable`. Starter- and Skill-generated tables never use internal scrollbars.
- Use `confirmDangerAction` for destructive actions.
- Use `Alert` inside `TableLayout` for list query errors.
- Use URL search params as the source of truth for keyword, filters, pagination, and sorting.
- Keep unsubmitted keyword text in a local draft only. Update the URL and request when the user presses Enter or clicks the search icon; do not request on every keystroke.
- Use `page_num` and `page_size` as pagination params unless the backend contract explicitly requires different names.
- Reflect sorting state with `sortOrder`.
- Preserve the current `searchParams` when navigating to create, edit, or detail pages.
- Put first-level page actions such as refresh and export in the Content PageHeader through `PagePanel.actions`; keep create and filter workflow controls in `TableLayout`.
- For detail pages with a hero, place status indicators in one right-side row and refresh/edit actions in a separate row below them. Do not also pass those actions to PagePanel.
- Keep search and filter controls inside `TableLayout.SearchGroup` only. Do not place filter controls in table column filter dropdowns unless the product explicitly needs per-column filtering.
- Search placeholders should be concise noun phrases such as `搜索模型名称或路径`, not instruction sentences such as `请输入模型名称进行搜索`.
- Toolbar control height must come from `TableLayout`. Do not add page-local CSS that changes `Input`, `Input.Search`, `Select`, `DatePicker`, or button heights inside list toolbars.
- Prefer the starter filter components over raw AntD controls: `SearchInput` for keyword search, `TextFilter` for text filters, `SelectFilter` for enum filters, and `DateRangeFilter` for date ranges.
- Keep backend parameter mapping in the feature model API or query adapter. See `docs/api-query-adapter.md`.
- Normalize backend pagination through `normalizePageResult` unless the endpoint has a documented custom shape. Do not assume the backend list array is named `items` or `list`.

Do not:

- Use a top-level `<div className="<page>">`, fragment, or loose `Nav` wrapper instead of `PagePanel`.
- Render a page H1 in TopHeader or duplicate the Content PageHeader title inside the page body.
- Use AntD `Table` directly for the primary resource list.
- Use page-local width classes for search controls instead of `TableLayout.SearchItem`.
- Add page-local `height`, `line-height`, `padding`, or wrapper CSS to force toolbar control alignment.
- Put raw AntD `Input`, `Input.Search`, `Select`, `DatePicker.RangePicker`, or `Button` wrappers in the toolbar when a `TableLayout` filter component exists.
- Read backend pagination arrays directly in pages, such as `response.data.items` or `response.data.list`.
- Put `Select mode="multiple"` in the primary toolbar unless the product explicitly accepts multi-line toolbar height. Use an advanced filter area for dense multi-select filtering.
- Render `created_at`, `updated_at`, `createdAt`, `updatedAt`, or date range values directly without formatting.
- Add Table `scroll`, `horizontalScroll`, or `fixed` column configuration.
- Keep separate React state for the search input when the URL query is the source of truth.
- Put create/edit forms in a Modal when fields are complex or more than 3 simple fields unless the product explicitly requires that Modal workflow.
- Ship a visible search input whose behavior differs from the canonical Table CRUD search.
- Add a second sidebar collapse control in `Header`; the starter layout owns sidebar collapse through `Sidebar`.

## Model Management Example

For a model management page whose product contract does not specify create/edit presentation, generate it as a table management page:

- Route `/models` renders `ModelListPage`, not a generic `ModelManagementPage`.
- Create route `/models/create` renders `ModelFormPage`.
- Edit route `/models/:id/edit` renders `ModelFormPage`.
- Optional detail route `/models/:id` renders `ModelDetailPage`.
- The list search placeholder should be short and aligned with Table CRUD style, for example `搜索模型名称或路径`.
- The list page should use `TableLayout` and `ResourceTable`; it should not use raw AntD `Table`.
- Add model provider and status filters through `TableLayout.SelectFilter` when those fields exist.
- Add model rows actions through `ResourceActions`.
- Put lower-frequency actions such as copy, sharing, enable/disable, retry, export, and delete behind `更多` when the row already has 2 primary actions.

## API Key Management Example

By default, API Key management is not a tiny Modal form workflow. If the product contract explicitly requires a Modal, implement the Modal and retain its required fields, validation, and access-control behavior.

- `/api-keys` renders a list page using `TableLayout` and `ResourceTable`.
- `/api-keys/create` renders an independent form page.
- `/api-keys/:id/edit` renders an independent form page.
- Model selection, access mode, whitelist users, quotas, and key fields belong in `FormPageWrap`.
- Quota viewing can use a detail route, drawer, or focused modal, but list filtering and create/edit must remain visible and reachable.

## Visual Acceptance

Business pages must visually match the project patterns:

- Toolbar spacing, search width, filter grouping, table body, empty state, and error state should come from shared components.
- Feature CSS should be minimal and only cover resource-specific details.
- Primary list pages should not look like plain AntD examples.
- Primary toolbar buttons should use icons where the starter pattern uses icons, such as refresh and create actions.
- Long labels should fit without breaking toolbar alignment.
- `Select`, `Input.Search`, `Input`, `DatePicker`, and toolbar buttons should align to the same visual height when placed in `TableLayout.SearchGroup`.
- Primary toolbar controls should be 36px high. Form controls may use the AntD default unless the form pattern explicitly opts into a larger control size.
- TopHeader should contain only compact breadcrumb context and current-user controls. Do not add page H1, description, business actions, placeholder controls, or a second sidebar collapse control.
- First-level pages use Content PageHeader for title, description, and page-level actions.
- Secondary details with an entity Hero Card disable Content PageHeader so the entity title is not repeated.
- Detail heroes should keep status tags visually separate from action buttons and stack the status/action group below identity on narrow screens.
- Ordinary create/edit pages should use the flat container-responsive Table CRUD form grid. Wide containers may use two columns; narrow containers fall back to one.
- Tags, uploads, descriptions, and other space-sensitive fields should span the full row.
- Step forms should preserve form data across next/back by keeping panels mounted and toggling visibility.
- Do not stack nested form cards or section containers without a real business grouping requirement.
- Date/time values should use the stable project format, for example `YYYY-MM-DD HH:mm:ss`, rather than browser locale output or backend ISO strings.
- Primary resource tables must not have internal horizontal or vertical scrollbars. Use field selection, narrower formatted columns, `ellipsis`, fewer inline actions, and responsive layout.
- Business labels should use AntD preset colorful `Tag` colors or `getTagColor`. Do not globally force all normal tags into a neutral gray style. Status values still use `StatusTag`.

When in doubt, copy the matching `references/starter-blueprints` page shape first, then rename types, hooks, routes, query keys, columns, and labels.

## Module Management Blueprint

Use this blueprint for modules, templates, images, datasets, plugins, category-first model catalogs, and other resources that benefit from a sidebar/category or card-grid browsing model.

Stable reference files for agents:

- `references/starter-blueprints/module-crud/list-page.tsx`
- `references/starter-blueprints/module-crud/detail-page.tsx`
- `references/starter-blueprints/module-crud/model-api.ts`
- `references/starter-blueprints/module-crud/types.ts`
- `references/component-blueprints/form-patterns.tsx`
- `references/component-blueprints/basic-controls.tsx`

Runtime implementation examples may also exist at `src/features/module-crud`.

The default Module CRUD pattern is category/sidebar browsing with card list, detail, and edit. Do not add a standalone create route for Module CRUD by default. If a category-first resource needs creation, first try the Table CRUD form variants; only build a Module-specific create flow when the product has a real creation workflow that depends on the category browsing model.

## Dashboard Blueprint

Use this blueprint for aggregate metrics, time-range summaries, trends, rankings, usage distribution, and operational health pages.

Stable reference file for agents:

- `references/starter-blueprints/dashboard/dashboard-page.tsx`

Runtime implementation examples may also exist at `src/features/dashboard-example`.

## Self-review Checklist

Before accepting a business module, verify these items against the project source and references.

### Table Management Page Checklist

- [ ] Page root uses `PagePanel` or the current project's equivalent root container.
- [ ] TopHeader contains only breadcrumb context; page H1, description, and page-level actions render in Content PageHeader.
- [ ] Filter area uses `TableLayout.SearchGroup`.
- [ ] Keyword search uses `TableLayout.SearchInput`.
- [ ] Select/date/status filters use `TableLayout` filter components or existing project wrappers.
- [ ] Main table uses `ResourceTable`, not raw AntD `Table`.
- [ ] Row operations use `ResourceActions`.
- [ ] Inline row action count is controlled; overflow actions go under `更多`.
- [ ] Row actions are text-first by default; icons are used only when they improve recognition.
- [ ] Timestamp columns and detail fields use `formatDateTime` or the project equivalent; raw ISO strings are not shown to users.
- [ ] Table contains no `scroll`, `horizontalScroll`, or fixed-column configuration, including empty-data states.
- [ ] Business labels use colorful AntD `Tag` colors; status fields use `StatusTag`.
- [ ] Delete, disable, reset, offline, revoke, and other high-risk actions use confirmation.
- [ ] Loading, empty, and error states are covered.
- [ ] Pagination, filters, and sorting have one clear state source.
- [ ] Server list data is not stored in Zustand.
- [ ] API params have an explicit mapping layer in model API or query adapter.
- [ ] Backend pagination response is normalized with `normalizePageResult` or an endpoint-specific adapter.
- [ ] Adapter tolerates empty or malformed list payloads without crashing the page.
- [ ] `pnpm validate` or project-equivalent validation passes.

### Form Page Checklist

- [ ] Form page uses `PagePanel` or the standard page container.
- [ ] Form uses the current project form layout pattern instead of scattered bare `Form.Item` blocks.
- [ ] Ordinary forms use a flat container-responsive grid; narrow containers fall back to one column.
- [ ] Step forms keep all panels mounted and only toggle visibility, so next/back does not clear data.
- [ ] Step forms submit from the last step instead of adding a separate confirmation page by default.
- [ ] Space-sensitive fields such as tags, uploads, and descriptions span the full row.
- [ ] Nested form cards or sections exist only when the business grouping is real.
- [ ] Initial values, submit state, and error state are explicit.
- [ ] Edit page handles loading, not found, and failed states.
- [ ] Save button has loading state.
- [ ] Cancel and return behavior is clear and preserves source list query when needed.
- [ ] Field validation matches business semantics.
- [ ] The page does not stack meaningless cards for visual decoration.

### Detail Page Checklist

- [ ] Detail page has stable information groups.
- [ ] Detail page does not become a meaningless dashboard.
- [ ] Loading, not found, and error states are covered.
- [ ] Dangerous actions use confirmation.
- [ ] Return path is explicit.
- [ ] Status fields use the standard status display component or project equivalent.

### Dashboard Checklist

- [ ] Dashboard metrics have real business meaning.
- [ ] Page avoids demo-style decorative color blocks.
- [ ] Charts cover empty, loading, and error states.
- [ ] Chart containers are responsive and have stable dimensions.
- [ ] Metric cards have clear title, value, unit, and helper text.
- [ ] Page does not add charts only for visual density.

### Final Agent Checklist

- [ ] Read `references/starter-blueprints`.
- [ ] Read relevant files in `references/component-blueprints`.
- [ ] Read `docs/anti-patterns.md`.
- [ ] Did not use raw AntD `Table` instead of `ResourceTable`.
- [ ] Did not hand-write a `Space` toolbar instead of `TableLayout`.
- [ ] Did not put server list data into Zustand.
- [ ] Did not add a Header collapse button.
- [ ] Did not introduce an unrelated UI library.
- [ ] Did not register examples or references into formal business routes.
- [ ] Ran `pnpm validate` or the project-equivalent validation command.
