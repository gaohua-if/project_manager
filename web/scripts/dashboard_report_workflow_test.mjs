/* global console, process */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const root = process.cwd();
const dashboard = readFileSync(
  resolve(root, "src/features/aidashboard/dashboard/DashboardPage.tsx"),
  "utf8"
);
const client = readFileSync(resolve(root, "src/features/aidashboard/api/client.ts"), "utf8");
const types = readFileSync(resolve(root, "src/features/aidashboard/api/types.ts"), "utf8");

assert.match(client, /generateTodayReportDraft/, "API client should expose generateTodayReportDraft");
assert.match(client, /\/reports\/today\/draft/, "draft API path should be /reports/today/draft");
assert.match(client, /session_ids\?: string\[\]/, "updateReport should accept session_ids");

assert.match(types, /GenerateReportDraftPayload/, "draft payload type should exist");
assert.match(types, /GenerateReportDraftResponse/, "draft response type should exist");
assert.match(types, /TaskProgressSuggestion/, "task progress suggestion type should exist");

assert.doesNotMatch(dashboard, /const SESSION_OPTIONS\s*=/, "Dashboard must not use fixed mock SESSION_OPTIONS");
assert.match(dashboard, /fetchReports\(\{\s*from:\s*reportDate,\s*to:\s*reportDate\s*\}\)/s, "Dashboard should query today's reports without creating a report");
assert.match(dashboard, /findCurrentUserDailyReport/, "Dashboard should select the current user's daily report from the reports list");
assert.match(dashboard, /applyTodayDailyReportState/, "Dashboard should map today's real daily report to existing UI states");
assert.match(dashboard, /status:\s*"待生成"/, "Dashboard should map missing daily report to existing pending status");
assert.match(dashboard, /status:\s*"草稿待确认"/, "Dashboard should map existing daily report to existing confirm status");
assert.match(dashboard, /fetchSessions\(/, "Dashboard should fetch real sessions");
assert.match(dashboard, /started_from/, "Dashboard should query sessions by start-of-day range");
assert.match(dashboard, /generateTodayReportDraft/, "Dashboard should call draft API");
assert.match(dashboard, /skill_content/, "Dashboard should pass uploaded skill content to draft API");
assert.match(dashboard, /updateDailyReport/, "Dashboard should save final report through updateReport API");
assert.match(dashboard, /session_ids:/, "Dashboard should save selected session IDs");
assert.match(dashboard, /applyTaskSuggestionMutation/, "Dashboard should update tasks only through explicit suggestion confirmation");
assert.match(dashboard, /Popconfirm/, "Task suggestion application should require user confirmation");

console.log("dashboard report workflow contract checks passed");
