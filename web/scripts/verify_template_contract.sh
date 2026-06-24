#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RESOURCE_TABLE="$ROOT_DIR/src/shared/components/ResourceTable/ResourceTable.tsx"
HEADER="$ROOT_DIR/src/layouts/Header/Header.tsx"
PAGE_PANEL="$ROOT_DIR/src/shared/components/PagePanel/PagePanel.tsx"
NAV="$ROOT_DIR/src/shared/components/Nav/Nav.tsx"
TABLE_BLUEPRINT="$ROOT_DIR/references/starter-blueprints/table-crud/list-page.tsx"
MODULE_BLUEPRINT="$ROOT_DIR/references/starter-blueprints/module-crud/list-page.tsx"
TABLE_EXAMPLE="$ROOT_DIR/src/features/table-crud/pages/TableCrudListPage.tsx"
MODULE_EXAMPLE="$ROOT_DIR/src/features/module-crud/pages/ModuleCrudListPage.tsx"
RUNTIME_CONFIG="$ROOT_DIR/src/config/runtimeConfig.ts"
PUBLIC_CONFIG="$ROOT_DIR/public/config.js"
AUTH_BLUEPRINT="$ROOT_DIR/references/starter-blueprints/auth-current-user/auth-api.ts"
AUTH_API="$ROOT_DIR/src/shared/auth/authApi.ts"
METRIC_CARD="$ROOT_DIR/src/features/dashboard-example/components/MetricCard.tsx"
METRIC_CARD_CSS="$ROOT_DIR/src/features/dashboard-example/components/DashboardComponents.css"
DASHBOARD_BLUEPRINT="$ROOT_DIR/references/starter-blueprints/dashboard/dashboard-components.tsx"
DASHBOARD_BLUEPRINT_CSS="$ROOT_DIR/references/starter-blueprints/dashboard/dashboard-pattern.css"
VITE_CONFIG="$ROOT_DIR/vite.config.ts"
NGINX_CONFIG="$ROOT_DIR/docker/nginx.conf"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

assert_grep() {
  local pattern="$1"
  local file="$2"
  grep -qE "$pattern" "$file" || fail "Expected pattern '$pattern' in $file"
}

assert_no_grep() {
  local pattern="$1"
  local file="$2"
  if grep -qE "$pattern" "$file"; then
    fail "Unexpected pattern '$pattern' in $file"
  fi
}

assert_no_table_scroll_config() {
  local matches
  matches="$(
    grep -RInE \
      --include='*.ts' \
      --include='*.tsx' \
      'horizontalScroll|scroll[[:space:]]*=|scroll[[:space:]]*:|fixed[[:space:]]*:[[:space:]]*['"'"'"\"](left|right)' \
      "$ROOT_DIR/src/features" \
      "$ROOT_DIR/references/starter-blueprints" \
      "$ROOT_DIR/references/component-blueprints" \
      | grep -vE 'src/features/aidashboard/tokens/pages/TokensPage\.tsx' \
      || true
  )"
  [[ -z "$matches" ]] || fail "Table-internal scroll configuration is forbidden:\n$matches"
}

assert_grep 'extends Omit<TableProps<T>, "scroll">' "$RESOURCE_TABLE"
assert_no_grep 'horizontalScroll|scroll[[:space:]]*=' "$RESOURCE_TABLE"
assert_no_table_scroll_config

assert_grep 'variant="breadcrumb"' "$HEADER"
assert_no_grep 'description=' "$HEADER"
assert_grep '<Nav' "$PAGE_PANEL"
assert_grep 'navigate\(`\$\{path\}\$\{location\.search\}`\)' "$NAV"
assert_no_grep 'showNav=\{false\}|resource-list__heading' "$TABLE_BLUEPRINT"
assert_grep 'onSearch=\{submitKeyword\}' "$TABLE_BLUEPRINT"
assert_grep 'onSearch=\{submitKeyword\}' "$MODULE_BLUEPRINT"
assert_no_grep 'onChange=.*updateQuery.*keyword' "$TABLE_BLUEPRINT"
assert_no_grep 'onChange=.*updateQuery.*keyword' "$MODULE_BLUEPRINT"
assert_grep 'userApiBaseUrl: "/api/v1"' "$RUNTIME_CONFIG"
assert_grep 'userApiBaseUrl: "/api/v1"' "$PUBLIC_CONFIG"
assert_grep 'DEFAULT_USER_API_BASE_URL = "/api/v1"' "$AUTH_BLUEPRINT"
assert_grep 'getApiUrl\(runtimeConfig\.userApiBaseUrl, "/auth/me"\)' "$AUTH_API"
assert_grep '"/api/v1": \{' "$VITE_CONFIG"
grep -qF 'target: "http://127.0.0.1:18090"' "$VITE_CONFIG" \
  || fail "Vite local Aida API proxy target is missing"
assert_grep 'location \^~ /api/v1/ \{' "$NGINX_CONFIG"
grep -qF "proxy_pass http://api:8080;" "$NGINX_CONFIG" \
  || fail "Nginx Aida API proxy target is missing"
assert_grep 'business-metric-card__icon' "$DASHBOARD_BLUEPRINT"
assert_grep 'aria-hidden="true"' "$DASHBOARD_BLUEPRINT"
assert_no_grep '\.business-metric-card::before' "$DASHBOARD_BLUEPRINT_CSS"
assert_grep '\.business-metric-card__icon' "$DASHBOARD_BLUEPRINT_CSS"

external_host_matches="$(
  grep -RInE \
    --include='*.ts' \
    --include='*.tsx' \
    --include='*.js' \
    '192\.168\.11\.18|30054|30021' \
    "$ROOT_DIR/src" \
    "$ROOT_DIR/public" \
    "$ROOT_DIR/vite.config.ts" \
    || true
)"
[[ -z "$external_host_matches" ]] \
  || fail "External backend hosts must not appear in app source/runtime config:\n$external_host_matches"

if [[ -f "$TABLE_EXAMPLE" ]]; then
  assert_grep 'onSearch=\{submitKeyword\}' "$TABLE_EXAMPLE"
  assert_no_grep 'onChange=.*updateQuery.*keyword' "$TABLE_EXAMPLE"
fi

if [[ -f "$MODULE_EXAMPLE" ]]; then
  assert_grep 'onSearch=\{submitKeyword\}' "$MODULE_EXAMPLE"
  assert_no_grep 'onChange=.*updateQuery.*keyword' "$MODULE_EXAMPLE"
fi

if [[ -f "$METRIC_CARD" ]]; then
  assert_grep 'metric-card__icon' "$METRIC_CARD"
  assert_grep 'aria-hidden="true"' "$METRIC_CARD"
  assert_grep 'metric-card--tone-' "$METRIC_CARD"
  assert_no_grep '\.metric-card::before' "$METRIC_CARD_CSS"
  assert_grep '\.metric-card__icon' "$METRIC_CARD_CSS"
fi

echo "Template contracts passed."
