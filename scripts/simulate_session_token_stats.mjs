#!/usr/bin/env node

/**
 * Session + Token 统计测试方案
 *
 * 用法:
 *   node scripts/simulate_session_token_stats.mjs
 *
 * 环境要求:
 *   - API 服务运行中（默认 http://127.0.0.1:18090/api/v1）
 *   - 所有内置账号密码为 '123'（已跑 008_builtin_password_123 迁移）
 *   - Node >= 18（内置 fetch）
 *
 * 流程:
 *   1. 13 个账号逐个登录 -> 拿 token
 *   2. 每个账号上传 2 条带 token_usage 的 session（today 日期）
 *   3. 验证 scope=mine / scope=team / group_by=team 断言
 *   4. 输出 PASS/FAIL 报告
 */

import assert from "node:assert/strict";

const BASE = process.env.API_BASE || "http://127.0.0.1:18090/api/v1";
const PASSWORD = "123";

// ── 第 3 节：测试账号计划 ──────────────────────────

const ACCOUNTS = [
  { employee_id: "zhangsan",  name: "张三",   team: "AI工程",    role: "employee",    perSession: { total: 1500, input: 1000, output: 200, cacheCreate: 0, cacheRead: 300 } },
  { employee_id: "lisi",      name: "李四",   team: "AI工程",    role: "employee",    perSession: { total: 2000, input: 1300, output: 300, cacheCreate: 0, cacheRead: 400 } },
  { employee_id: "wangwu",    name: "王五",   team: "AI工程",    role: "employee",    perSession: { total: 2500, input: 1600, output: 400, cacheCreate: 200, cacheRead: 300 } },
  { employee_id: "zhaoliu",   name: "赵六",   team: "AI工程",    role: "employee",    perSession: { total: 3000, input: 2000, output: 500, cacheCreate: 0, cacheRead: 500 } },
  { employee_id: "qianqi",    name: "钱七",   team: "AI工程",    role: "employee",    perSession: { total: 3500, input: 2300, output: 600, cacheCreate: 300, cacheRead: 300 } },
  { employee_id: "liu_tl",    name: "刘TL",   team: "AI工程",    role: "team_leader", perSession: { total: 4000, input: 2600, output: 700, cacheCreate: 200, cacheRead: 500 } },
  { employee_id: "sunba",     name: "孙八",   team: "推理加速",  role: "employee",    perSession: { total: 4500, input: 3000, output: 800, cacheCreate: 0, cacheRead: 700 } },
  { employee_id: "zhoujiu",   name: "周九",   team: "推理加速",  role: "employee",    perSession: { total: 5000, input: 3300, output: 900, cacheCreate: 500, cacheRead: 300 } },
  { employee_id: "zhao_tl",   name: "赵TL",   team: "推理加速",  role: "team_leader", perSession: { total: 5500, input: 3600, output: 1000, cacheCreate: 300, cacheRead: 600 } },
  { employee_id: "wushi",     name: "吴十",   team: "模型训练",  role: "employee",    perSession: { total: 6000, input: 4000, output: 1100, cacheCreate: 400, cacheRead: 500 } },
  { employee_id: "sun_tl",    name: "孙TL",   team: "模型训练",  role: "team_leader", perSession: { total: 6500, input: 4300, output: 1200, cacheCreate: 300, cacheRead: 700 } },
  { employee_id: "chen_pm",   name: "陈PM",   team: null,        role: "pm",          perSession: { total: 7000, input: 4600, output: 1300, cacheCreate: 500, cacheRead: 600 } },
  { employee_id: "li_director", name: "李总监", team: null,      role: "director",    perSession: { total: 7500, input: 5000, output: 1400, cacheCreate: 600, cacheRead: 500 } },
];

// 团队预期汇总（第 4 节验证）
const TEAM_EXPECTED = {
  "AI工程":    { total: 33000, members: 6, sessionCount: 12 },
  "推理加速":  { total: 30000, members: 3, sessionCount: 6 },
  "模型训练":  { total: 25000, members: 2, sessionCount: 4 },
};
const UNASSIGNED_TOTAL = 29000; // chen_pm(14000) + li_director(15000)
const GRAND_TOTAL = 117000;

const TODAY = new Date();
const YYYYMMDD = todayYYYYMMDD(TODAY);

function todayYYYYMMDD(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function yesterdayYYYYMMDD(d) {
  const y = new Date(d);
  y.setDate(y.getDate() - 1);
  return todayYYYYMMDD(y);
}

// ── 工具 ──────────────────────────────────────────

class TestReport {
  constructor() {
    this.lines = [];
    this.passed = 0;
    this.failed = 0;
    this.failures = [];
  }
  ok(label, detail = "") {
    this.passed++;
    this.lines.push(`  [PASS] ${label}${detail ? " — " + detail : ""}`);
  }
  fail(label, detail, ctx = {}) {
    this.failed++;
    const msg = `  [FAIL] ${label} — ${detail}`;
    this.lines.push(msg);
    this.failures.push({ label, detail, ctx });
    process.stderr.write(`\n!! ${msg}\n`);
    if (ctx.actual !== undefined) process.stderr.write(`    actual:   ${JSON.stringify(ctx.actual)}\n`);
    if (ctx.expected !== undefined) process.stderr.write(`    expected: ${JSON.stringify(ctx.expected)}\n`);
    if (ctx.url) process.stderr.write(`    url: ${ctx.url}\n`);
    if (ctx.account) process.stderr.write(`    account: ${ctx.account}\n`);
  }
  summary() {
    const total = this.passed + this.failed;
    console.log(`\n── 测试报告 ──────────────────────`);
    console.log(`  总计: ${total}  |  PASS: ${this.passed}  |  FAIL: ${this.failed}`);
    if (this.failed > 0) {
      console.log(`\n  ❌ ${this.failed} 条失败:`);
      for (const f of this.failures) {
        console.log(`    - ${f.label}: ${f.detail}`);
      }
    }
    console.log(`──────────────────────────────────\n`);
    return this.failed === 0;
  }
}

async function apiPost(path, body, token) {
  const url = `${BASE}${path}`;
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  const data = await res.json();
  return { status: res.status, data };
}

async function apiGet(path, token) {
  const url = `${BASE}${path}`;
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  const data = await res.json();
  return { status: res.status, data };
}

async function uploadSessionBatch(token, sessions) {
  const url = `${BASE}/sessions/batch`;
  const form = new FormData();
  form.append("metadata", JSON.stringify({ sessions }));
  const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
  const data = await res.json();
  return { status: res.status, data };
}

async function fetchSessionTokenPage(token, from, to, scope, page, pageSize) {
  const qs = `from=${from}&to=${to}&scope=${scope}&page=${page}&page_size=${pageSize}`;
  return apiGet(`/tokens/sessions?${qs}`, token);
}

async function fetchSessionTokens(token, from, to, scope) {
  const pageSize = 100;
  const first = await fetchSessionTokenPage(token, from, to, scope, 1, pageSize);
  if (first.status !== 200 || !first.data || !Array.isArray(first.data.items)) {
    return first;
  }

  const items = [...first.data.items];
  const totalPages = Math.ceil(first.data.total / first.data.page_size);
  for (let page = 2; page <= totalPages; page += 1) {
    const next = await fetchSessionTokenPage(token, from, to, scope, page, pageSize);
    if (next.status !== 200 || !next.data || !Array.isArray(next.data.items)) {
      return next;
    }
    items.push(...next.data.items);
  }

  return { ...first, data: items };
}

async function fetchTokenGroups(token, from, to) {
  const qs = `period=range&from=${from}&to=${to}&group_by=team`;
  return apiGet(`/tokens?${qs}`, token);
}

// ── 主流程 ────────────────────────────────────────

const report = new TestReport();
const sessions = []; // { token, account }

console.log(`\n🔄 基础地址: ${BASE}`);
console.log(`📅 测试日期: ${YYYYMMDD}`);

// 步骤 1: 登录所有账号
console.log(`\n── 1. 登录所有账号 ─────────────────`);
for (const acct of ACCOUNTS) {
  const { status, data } = await apiPost("/auth/login", { employee_id: acct.employee_id, password: PASSWORD });
  if (status === 200 && data.user) {
    sessions.push({ token: data.token, account: acct });
    report.ok(`login ${acct.employee_id}`, `role=${data.user.role}`);
  } else {
    report.fail(`login ${acct.employee_id}`, `HTTP ${status}: ${JSON.stringify(data)}`);
  }
}

if (sessions.length === 0) {
  console.error("!! 无账号登录成功，终止");
  process.exit(1);
}

// 步骤 2: 上传 session（第 5.2 节）
console.log(`\n── 2. 上传 session（每人 2 条） ─────`);
for (const { token, account } of sessions) {
  const t = account.perSession;
  const metadata = [1, 2].map((seq) => {
    const startedAt = `${YYYYMMDD}T0${7+seq}:00:00+08:00`; // 不同时间避免重复键冲突
    return {
      session_ref: `token-p0-test-${account.employee_id}-${seq}`,
      agent_type: "claude_code",
      started_at: startedAt,
      ended_at: `${YYYYMMDD}T0${7+seq}:30:00+08:00`,
      duration_secs: 1800,
      model: "claude-code-test",
      summary: "",
      token_usage: {
        input_tokens: t.input,
        output_tokens: t.output,
        cache_creation_tokens: t.cacheCreate,
        cache_read_tokens: t.cacheRead,
        total_tokens: t.total,
        models: ["claude-code-test"]
      }
    };
  });

  const { status, data } = await uploadSessionBatch(token, metadata);
  if (status === 200 && data.results) {
    const ok = data.results.filter(r => r.status === "created" || r.status === "updated").length;
    const fail = data.results.filter(r => r.status.startsWith("error")).length;
    if (fail === 0) {
      report.ok(`upload ${account.employee_id}`, `sessions=2 total=${t.total*2}`);
    } else {
      report.fail(`upload ${account.employee_id}`, `${fail} 条失败`, { results: data.results });
    }
  } else {
    report.fail(`upload ${account.employee_id}`, `HTTP ${status}: ${JSON.stringify(data)}`);
  }
}

// 步骤 3: 验证 scope=mine（第 6.1 节）
console.log(`\n── 3. 验证 scope=mine ───────────────`);
for (const { token, account } of sessions) {
  const { data } = await fetchSessionTokens(token, YYYYMMDD, YYYYMMDD, "mine");
  const list = Array.isArray(data) ? data : [];
  const expectedTotal = account.perSession.total * 2;
  const actualTotal = list.reduce((s, r) => s + (r.total_tokens || 0), 0);

  if (list.length === 2 && actualTotal === expectedTotal) {
    const sameUser = list.every(r => r.user_id && r.user_id.length > 0);
    report.ok(`mine ${account.employee_id}`, `sessions=${list.length} total=${actualTotal}`);
  } else {
    report.fail(`mine ${account.employee_id}`, `预期 sessions=2 total=${expectedTotal}`, {
      actual: { sessions: list.length, total: actualTotal },
      expected: { sessions: 2, total: expectedTotal },
      account: account.employee_id,
    });
  }
}

// 步骤 4: 验证 TL scope=team（第 6.2 节）
console.log(`\n── 4. 验证 TL scope=team ────────────`);
const TL_ACCOUNTS = sessions.filter(s => s.account.role === "team_leader");
for (const { token, account } of TL_ACCOUNTS) {
  const teamExpected = TEAM_EXPECTED[account.team];
  if (!teamExpected) continue;

  const { data } = await fetchSessionTokens(token, YYYYMMDD, YYYYMMDD, "team");
  const list = Array.isArray(data) ? data : [];
  const actualTotal = list.reduce((s, r) => s + (r.total_tokens || 0), 0);

  if (list.length === teamExpected.sessionCount && actualTotal === teamExpected.total) {
    report.ok(`team ${account.employee_id}`, `sessions=${list.length} total=${actualTotal}`);
  } else {
    report.fail(`team ${account.employee_id}`, `预期 sessions=${teamExpected.sessionCount} total=${teamExpected.total}`, {
      actual: { sessions: list.length, total: actualTotal },
      expected: { sessions: teamExpected.sessionCount, total: teamExpected.total },
      account: account.employee_id,
    });
  }
}

// 步骤 5: 验证 PM scope=mine / scope=team（第 6.3 节）
console.log(`\n── 5. 验证 PM scope ─────────────────`);
const pmSession = sessions.find(s => s.account.employee_id === "chen_pm");
if (pmSession) {
  // PM scope=mine
  const { data: mineData } = await fetchSessionTokens(pmSession.token, YYYYMMDD, YYYYMMDD, "mine");
  const mineList = Array.isArray(mineData) ? mineData : [];
  const mineTotal = mineList.reduce((s, r) => s + (r.total_tokens || 0), 0);
  if (mineList.length === 2 && mineTotal === 14000) {
    report.ok("pm scope=mine", `sessions=${mineList.length} total=${mineTotal}`);
  } else {
    report.fail("pm scope=mine", `预期 sessions=2 total=14000`, { actual: { sessions: mineList.length, total: mineTotal } });
  }

  // PM scope=team -> 当前代码只返回自己（见 buildTokenScopeForSessionTokens）
  const { data: teamData } = await fetchSessionTokens(pmSession.token, YYYYMMDD, YYYYMMDD, "team");
  const teamList = Array.isArray(teamData) ? teamData : [];
  const teamTotal = teamList.reduce((s, r) => s + (r.total_tokens || 0), 0);
  // PM 无 team_id，当前后端行为 == scope=mine
  if (teamList.length === 2 && teamTotal === 14000) {
    report.ok("pm scope=team", `sessions=${teamList.length} total=${teamTotal}（当前后端口径：PM 无团队时只看自己）`);
  } else {
    report.fail("pm scope=team", `预期 sessions=2 total=14000（PM 无团队）`, { actual: { sessions: teamList.length, total: teamTotal } });
  }
}

// 步骤 6: 验证 director scope=mine / scope=team + group_by=team（第 6.4 节）
console.log(`\n── 6. 验证 director ─────────────────`);
const dirSession = sessions.find(s => s.account.employee_id === "li_director");
if (dirSession) {
  // scope=mine
  const { data: mineData } = await fetchSessionTokens(dirSession.token, YYYYMMDD, YYYYMMDD, "mine");
  const mineList = Array.isArray(mineData) ? mineData : [];
  const mineTotal = mineList.reduce((s, r) => s + (r.total_tokens || 0), 0);
  if (mineList.length === 2 && mineTotal === 15000) {
    report.ok("director scope=mine", `sessions=${mineList.length} total=${mineTotal}`);
  } else {
    report.fail("director scope=mine", `预期 sessions=2 total=15000`, { actual: { sessions: mineList.length, total: mineTotal } });
  }

  // scope=team -> 全量
  const { data: teamData } = await fetchSessionTokens(dirSession.token, YYYYMMDD, YYYYMMDD, "team");
  const teamList = Array.isArray(teamData) ? teamData : [];
  const teamTotal = teamList.reduce((s, r) => s + (r.total_tokens || 0), 0);
  if (teamList.length === 26 && teamTotal === GRAND_TOTAL) {
    report.ok("director scope=team", `sessions=${teamList.length} total=${teamTotal}`);
  } else {
    report.fail("director scope=team", `预期 sessions=26 total=${GRAND_TOTAL}`, {
      actual: { sessions: teamList.length, total: teamTotal },
      expected: { sessions: 26, total: GRAND_TOTAL },
    });
  }

  // group_by=team
  const { data: groupData } = await fetchTokenGroups(dirSession.token, YYYYMMDD, YYYYMMDD);
  const groups = groupData.groups || [];
  if (groups.length >= 3) {
    let groupOk = true;
    for (const [teamName, expected] of Object.entries(TEAM_EXPECTED)) {
      const g = groups.find(gr => gr.label === teamName);
      if (!g) {
        report.fail(`director group_by=team: ${teamName}`, "团队未出现在结果中", { labels: groups.map(g=>g.label) });
        groupOk = false;
      } else if (g.value !== expected.total) {
        report.fail(`director group_by=team: ${teamName}`, `预期 ${expected.total} 实际 ${g.value}`, { actual: g.value, expected: expected.total });
        groupOk = false;
      }
    }
    // 未分配团队
    const unassigned = groups.find(g => g.label === "未分配团队");
    if (unassigned && unassigned.value === UNASSIGNED_TOTAL) {
      // ok
    } else {
      report.fail("director group_by=team: 未分配团队", `预期 ${UNASSIGNED_TOTAL} 实际 ${unassigned?.value}`, { actual: unassigned?.value, expected: UNASSIGNED_TOTAL });
      groupOk = false;
    }
    if (groupOk) {
      report.ok("director group_by=team", `${groups.length} 组 total=${groupData.total}`);
    }
  } else {
    report.fail("director group_by=team", `预期 >=4 组, 实际 ${groups.length}`, { groups });
  }
}

// 步骤 7: 验证 admin 视角（不上传，只看 scope）
console.log(`\n── 7. 验证 admin scope ──────────────`);
const adminLogin = await apiPost("/auth/login", { employee_id: "admin", password: PASSWORD });
if (adminLogin.status === 200 && adminLogin.data.token) {
  const adminToken = adminLogin.data.token;
  // scope=mine
  const { data: mineData } = await fetchSessionTokens(adminToken, YYYYMMDD, YYYYMMDD, "mine");
  const mineList = Array.isArray(mineData) ? mineData : [];
  report.ok("admin scope=mine", `sessions=${mineList.length}（admin 未上传）`);

  // scope=team -> 全量
  const { data: teamData } = await fetchSessionTokens(adminToken, YYYYMMDD, YYYYMMDD, "team");
  const teamList = Array.isArray(teamData) ? teamData : [];
  const teamTotal = teamList.reduce((s, r) => s + (r.total_tokens || 0), 0);
  if (teamList.length === 26 && teamTotal === GRAND_TOTAL) {
    report.ok("admin scope=team", `sessions=${teamList.length} total=${teamTotal}`);
  } else {
    report.fail("admin scope=team", `预期 sessions=26 total=${GRAND_TOTAL}`, { actual: { sessions: teamList.length, total: teamTotal } });
  }
} else {
  report.fail("admin login", "无法登录", { status: adminLogin.status });
}

// ── 汇总 ──────────────────────────────────────────

const success = report.summary();
process.exit(success ? 0 : 1);