# API Query Adapter Guidance

Business pages should keep UI query state stable even when backend API parameter names differ.

## Standard Layering

Use this split for table-first and module-first pages:

- Page layer: owns UI query model and URL search params.
- Query hook layer: passes UI query model into TanStack Query keys.
- model API layer: converts UI query model to backend params.
- Response adapter: converts backend pagination response into the shape consumed by `ResourceTable`.

The outer API envelope is stable:

```ts
interface ApiResponse<T> {
  code: number;
  msg: string;
  data: T;
}
```

The inner `data` shape is endpoint-specific. Do not assume the paginated array is always named `items`, `list`, `records`, or `rows`.

## UI Query Model

The page layer may use a consistent UI model:

- `page_num`
- `page_size`
- `keyword`
- `status`
- `order_by`
- `order_type`

This model is optimized for frontend routing and starter conventions.

## Backend Params

A backend may use different names:

- `page`
- `pageSize`
- `search`
- `state`
- `orderBy`
- `sortDirection`

Do not leak those names across the UI.

## Correct Pattern

Keep mapping in `modelApi` or a small query adapter:

`toBackendParams(query)` maps UI names to backend names.

`toPageResult(response)` maps backend pagination into `{ page_num, page_size, total, data }`.

`toPageResult(response, query)` may use the current UI query model when the backend does not echo page metadata. Do not hard-code `page_num: 1` or `page_size: 10` in adapters; generated pages will show stale pagination after users change pages.

Reference implementation:

Use `normalizePageResult` from `src/shared/request/pageResult` unless the endpoint has a documented custom response shape:

```ts
const response = await api.get<unknown>("/resources", toBackendParams(query));
return { ...response, data: normalizePageResult<ResourceRecord>(response.data, query) };
```

`normalizePageResult(response, query)` handles common array fields such as `list`, `items`, `records`, `rows`, and `data`; it falls back to an empty array when the backend returns malformed or empty data. It also reads `page_num`, `pageNum`, `page`, `page_size`, `pageSize`, `size`, `total`, `count`, or `totalCount` when present, otherwise it uses the current UI query.

The page component should only call `updateQuery({ page_num, page_size, keyword })`; it should not know whether the backend uses `page` or `pageSize`.

## Endpoint-specific Business Codes

Do not use the default `api.get` / `api.post` path for endpoints whose non-zero `code` values are defined by the PRD as normal business states.

Example: a quota endpoint may define:

- `code = 0`: quota data is available;
- `code = 1`: the model does not support quota lookup;
- `code = 2`: private deployment has unlimited quota.

These are endpoint states, not global request failures. The endpoint adapter must preserve the raw code and map it into a page-friendly result:

```ts
export type QuotaUsageResult =
  | { status: "success"; remain: number; total: number; rawCode: 0; rawMessage?: string }
  | { status: "unsupported"; rawCode: 1; rawMessage?: string }
  | { status: "unlimited"; rawCode: 2; rawMessage?: string }
  | { status: "failed"; rawCode?: number; rawMessage?: string };

export async function fetchApiKeyUsage(id: number): Promise<QuotaUsageResult> {
  const response = await rawApi.get<UsagePayload>(`/api-keys/${id}/usage`);

  if (response.code === 0) {
    return {
      status: "success",
      remain: response.data.remain,
      total: response.data.total,
      rawCode: 0,
      rawMessage: response.msg
    };
  }

  if (response.code === 1) {
    return { status: "unsupported", rawCode: 1, rawMessage: response.msg };
  }

  if (response.code === 2) {
    return { status: "unlimited", rawCode: 2, rawMessage: response.msg };
  }

  return { status: "failed", rawCode: response.code, rawMessage: response.msg };
}
```

`rawApi` means a project-local request helper that still handles network errors, timeout, 401, and 403, but does not throw solely because an endpoint returned a non-zero business code. If the project does not have such a helper, add the smallest request helper needed for endpoint adapters in the new generated project.

The page should render `result.status`. It should not inspect the raw response envelope and should not collapse all non-zero states into "查询失败".

## Defensive Rendering

Generated pages must not crash when backend rows are incomplete or temporarily inconsistent.

- Treat optional backend fields as optional in UI rendering.
- Use fallback display values such as `"-"` for missing text.
- Guard derived values before calling string or array methods.
- Use adapter functions to map backend row names into UI row names when the backend contract differs.
- Keep malformed list payloads contained in the response adapter; `ResourceTable` should receive an array.

## Forbidden

- Do not build backend params inside JSX.
- Do not repeat `page_num -> page` or `page_size -> pageSize` mapping in multiple components.
- Do not leak backend field names into all UI components.
- Do not change shared component props just to match one backend API.
- Do not store backend response shape directly in Zustand.
- Do not hard-code normalized pagination values such as `page_num: 1` or `page_size: 10` unless the API is truly non-paginated.
- Do not hard-code `data: response.items` or `data: response.list` in generated page APIs unless the endpoint contract is explicitly known.
- Do not call `.split`, `.map`, `.join`, `.toLocaleString`, or date formatting helpers on nullable backend fields without a fallback.
- Do not let the global request helper throw endpoint-specific business codes before the endpoint adapter can map them.
- Do not return `response.data` from an endpoint adapter when the page needs raw `code` to distinguish business states.
- Do not handle endpoint business states only in React component `catch` blocks.

## Self-check

Before accepting a generated list page:

- Search the page component for backend-only params such as `pageSize`, `search`, `state`, `orderBy`.
- Confirm the feature has a model API or adapter function.
- Confirm the query key contains the UI query model.
- Confirm pagination response is normalized before it reaches `ResourceTable`.
- Confirm normalized `page_num` and `page_size` come from the backend response or current query, not fixed literals.
- Confirm the response adapter tolerates both `list` and `items`.
- Confirm empty, missing, or malformed list payloads render an empty table plus normal error/loading states instead of crashing.

Before accepting an endpoint with business codes:

- Confirm the PRD-defined non-zero codes are listed in the endpoint adapter.
- Confirm the adapter preserves raw code/message.
- Confirm the page renders a discriminated `status` or equivalent page-friendly state.
- Confirm the global request helper does not swallow these states.
