# Auth And Current-user Blueprint

This blueprint mirrors the starter's real authentication boundary. Use the runtime implementation in `src/shared/auth` directly for new starter projects; use these files as stable reference when replacing mock/local authentication in another compatible project.

It covers login, token persistence, JWT `uid` extraction, current-user loading, initialization, logout, and session invalidation. During refresh restoration, preserve the app shell and use content/user-menu skeletons instead of a fullscreen spinner or stale protected content. It does not define administration pages or editable profile features.

Keep the current-user request real. A project may adapt the login endpoint to its documented backend contract without changing the current-user endpoint. Request failures must remain visible authentication/loading failures; do not synthesize a successful current user from the login response, username, or JWT claims unless the product requirements explicitly replace this contract.

Use `auth-loading-state.tsx` and `auth-loading-state.css` as the protected-route restoration pattern. The user-menu skeleton remains part of the project's existing Header/UserMenu implementation.

Default browser-facing endpoints:

```text
POST /api/v1/auth/login
GET /api/v1/users/:id
```

Keep backend hosts out of React and runtime application source. Development uses the route-specific upstreams in `vite.config.ts`; production uses the equivalent locations in `docker/nginx.conf`. Deployment-specific hosts belong in those proxy configurations, not in `userApiBaseUrl`.

Keep permission behavior separate. Roles returned by the user endpoint are read-only identity data.
