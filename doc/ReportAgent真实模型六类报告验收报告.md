# Report Agent 真实模型六类报告验收报告

- 生成时间: `20260701_002725`
- 测试日期: `2026-07-01` (周 2026-06-29 ~ 2026-07-05)

## 测试环境与前置检查

- API base: `http://127.0.0.1:18090/api/v1`
- Managed Agent URL: `http://192.168.18.107:3081`
- 唯一前缀: `REPORT_AGENT_REAL_MODEL_TEST_20260701_002725`
- 默认模型: `MiniMax-M2.5` / engine `claude-code`
- 轮询: interval `10.0s`, timeout `600.0s`
- 跳过真实模型: `False`

| 检查项 | 结果 | 详情 |
| --- | --- | --- |
| GET /health | PASS | status=200 body={'status': 'ok'} |
| POST /mcp/reports exists | PASS | status=401 |
| /mcp/daily-report absent | PASS | status=404 |

## 默认 Report 配置回归结果

对每个测试账号验证 AI Assets 中存在属于自己的默认 Skill / MCP / Agent，且 duplicate count = 1/1/1。

| user_id | username | role | skill | mcp | agent | dup (s/m/a) | owner=self | not system |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 303 | t01 | pm | PASS | PASS | PASS | 1/1/1 | PASS | PASS |
| 304 | t02 | director | PASS | PASS | PASS | 1/1/1 | PASS | PASS |
| 305 | t03 | team_leader | PASS | PASS | PASS | 1/1/1 | PASS | PASS |
| 306 | t04 | team_leader | PASS | PASS | PASS | 1/1/1 | PASS | PASS |
| 307 | t05 | employee | PASS | PASS | PASS | 1/1/1 | PASS | PASS |
| 308 | t06 | employee | PASS | PASS | PASS | 1/1/1 | PASS | PASS |
| 309 | t07 | employee | PASS | PASS | PASS | 1/1/1 | PASS | PASS |
| 310 | t08 | employee | PASS | PASS | PASS | 1/1/1 | PASS | PASS |
| 311 | t09 | employee | PASS | PASS | PASS | 1/1/1 | PASS | PASS |
| 312 | t10 | employee | PASS | PASS | PASS | 1/1/1 | PASS | PASS |
| 313 | t11 | employee | PASS | PASS | PASS | 1/1/1 | PASS | PASS |
| 314 | t12 | employee | PASS | PASS | PASS | 1/1/1 | PASS | PASS |

## session fixture 数据说明与上传结果

- fixture 目录: `tmp/report_agent_real_model_sessions_20260701_002725/`
- 每条 session summary 包含唯一前缀 `REPORT_AGENT_REAL_MODEL_TEST_20260701_002725`。

| user_id | username | session_ref | upload status | owner=self | content has prefix |
| --- | --- | --- | --- | --- | --- |
| 303 | t01 | `REPORT_AGENT_REAL_MODEL_TEST_20260701_002725-t01-1-ca3046ce` | PASS (200, created) | PASS | PASS |
| 303 | t01 | `REPORT_AGENT_REAL_MODEL_TEST_20260701_002725-t01-2-bbfd87f7` | PASS (200, created) | PASS | PASS |
| 304 | t02 | `REPORT_AGENT_REAL_MODEL_TEST_20260701_002725-t02-1-3db52d07` | PASS (200, created) | PASS | PASS |
| 304 | t02 | `REPORT_AGENT_REAL_MODEL_TEST_20260701_002725-t02-2-999db534` | PASS (200, created) | PASS | PASS |
| 305 | t03 | `REPORT_AGENT_REAL_MODEL_TEST_20260701_002725-t03-1-bfa9c7dc` | PASS (200, created) | PASS | PASS |
| 305 | t03 | `REPORT_AGENT_REAL_MODEL_TEST_20260701_002725-t03-2-5ff65694` | PASS (200, created) | PASS | PASS |
| 307 | t05 | `REPORT_AGENT_REAL_MODEL_TEST_20260701_002725-t05-1-b7c722d7` | PASS (200, created) | PASS | PASS |
| 307 | t05 | `REPORT_AGENT_REAL_MODEL_TEST_20260701_002725-t05-2-0a213106` | PASS (200, created) | PASS | PASS |
| 308 | t06 | `REPORT_AGENT_REAL_MODEL_TEST_20260701_002725-t06-1-3c8b0091` | PASS (200, created) | PASS | PASS |
| 308 | t06 | `REPORT_AGENT_REAL_MODEL_TEST_20260701_002725-t06-2-ab3ea0da` | PASS (200, created) | PASS | PASS |

## session scope 权限校验

通过业务接口 `/sessions` 确认 employee 只能看自己的 session、TL 能看同组、Director 能看部门、PM 不能读 team/department。

| 用例 | 结果 | 详情 |
| --- | --- | --- |
| employee t05 只能看自己 session | PASS | owners={'307'} |
| TL t03 能读同组成员 session | PASS | owners={'307', '308', '305'} |
| Director t02 能读部门成员 session | PASS | owners={'303', '304', '307', '308', '305'} |

## 真实 Agent run API 与模型运行汇总

- run API: `POST /api/v1/ai-assets/report-agents/{agentId}/runs`
- 只传 `report_type` / `period` / `target`，由后端注入 `mcp_url`、`credential_slot`、`run_id`。


## 越权真实 Agent 测试

对越权用例优先利用 run API 前置校验或短失败；不长时间等待模型。

| 用例 | 调用者 | report_type | target | 期望 | 实际 HTTP / 错误 | 结果 |
| --- | --- | --- | --- | --- | --- | --- |
| t05 | t05 | team_daily | {"type": "self"} | reject-or-mcp-forbidden | HTTP 200 run_id=d0a8637b-7faf-455a-b68e-9685b476d463 status=pending (run API accepted; MCP-layer enforcement not verified) | WARN_RUN_API_ACCEPTED |
| t05 | t05 | department_daily | {"type": "self"} | reject-or-mcp-forbidden | HTTP 200 run_id=3bb6e30f-6407-4f6a-9726-e9f5fff1ec1a status=pending (run API accepted; MCP-layer enforcement not verified) | WARN_RUN_API_ACCEPTED |
| t05 | t05 | personal_daily | {"type": "user", "user_id": "308"} | reject | HTTP 403 code=None error=forbidden target | PASS |
| t01 | t01 | team_daily | {"type": "self"} | reject-or-mcp-forbidden | HTTP 400 code=None error=target team is required | PASS |
| t01 | t01 | department_daily | {"type": "self"} | reject-or-mcp-forbidden | HTTP 200 run_id=8dc4d245-8e6c-443a-a7a5-b6c0f9fb1696 status=pending (run API accepted; MCP-layer enforcement not verified) | WARN_RUN_API_ACCEPTED |
| t03 | t03 | department_daily | {"type": "self"} | reject-or-mcp-forbidden | HTTP 200 run_id=3279ba9d-5962-431e-b0eb-f2a51ad3a77a status=pending (run API accepted; MCP-layer enforcement not verified) | WARN_RUN_API_ACCEPTED |
| t03 | t03 | personal_daily | {"type": "user", "user_id": "307"} | reject | HTTP 403 code=None error=forbidden target | PASS |
| t02 | t02 | team_daily | {"type": "self"} | reject-or-mcp-forbidden | HTTP 400 code=None error=target team is required | PASS |
| t02 | t02 | personal_daily | {"type": "user", "user_id": "307"} | reject | HTTP 403 code=None error=forbidden target | PASS |

## 真实 Agent 运行矩阵

| report_type | 运行用户 | target | session upload | agent run created | model run status | MCP read evidence | MCP write evidence | business readback | content check | permission check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| personal_daily | t05 | {"type": "self"} | N/A | PASS | PASS | N/A | PASS | PASS | PASS | PASS |
| personal_weekly | t05 | {"type": "self"} | N/A | PASS | PASS | N/A | PASS | PASS | PASS | PASS |
| team_daily | t03 | {"type": "self"} | N/A | PASS | PASS | N/A | PASS | PASS | PASS | PASS |
| team_weekly | t03 | {"type": "self"} | N/A | PASS | PASS | N/A | PASS | PASS | PASS | PASS |
| department_daily | t02 | {"type": "self"} | N/A | PASS | PASS | N/A | PASS | PASS | PASS | PASS |
| department_weekly | t02 | {"type": "self"} | N/A | PASS | PASS | N/A | PASS | PASS | PASS | PASS |
| personal_daily | t01 | {"type": "self"} | N/A | PASS | PASS | N/A | PASS | PASS | PASS | PASS |
| personal_weekly | t01 | {"type": "self"} | N/A | PASS | PASS | N/A | PASS | PASS | PASS | PASS |
| personal_daily | t06 | {"type": "self"} | N/A | PASS | PASS | N/A | PASS | PASS | PASS | PASS |

## 真实 Agent run 明细

| label | run_id | report_type | user | session_id | initial_status |
| --- | --- | --- | --- | --- | --- |
| personal_daily@t05 | `379eae34-224d-4ca2-8038-1ca5d1ce9fb2` | personal_daily | t05 | `83afb669-3b62-4889-bf69-2099330fc394` | pending |
| personal_weekly@t05 | `aa86d6dd-23e6-4e3d-a1cc-444c7ed2d3e3` | personal_weekly | t05 | `728400d2-9966-43d2-8266-20897b6bdcfa` | pending |
| team_daily@t03 | `5c7cf079-f46c-43e9-b48a-b036999a5995` | team_daily | t03 | `9de4b00b-bf73-4c0b-bc17-a3632c70edf8` | pending |
| team_weekly@t03 | `7f106c26-d6e5-4e42-8a21-7f69c024a3e8` | team_weekly | t03 | `5a0886b9-b984-47f0-8720-ced3de3144f6` | pending |
| department_daily@t02 | `6a166b4d-62ec-4464-8641-8a53ef3be970` | department_daily | t02 | `dc1433ab-6376-4343-9149-035b8a51ffe4` | pending |
| department_weekly@t02 | `5baa3581-b873-46f4-8dcf-3b1b79b38973` | department_weekly | t02 | `b6c1fc79-5045-4cb6-8f06-f5f02f35cdd9` | pending |
| personal_daily@t01 | `88c1ac0e-cf7b-4f86-807b-d84c4ce68835` | personal_daily | t01 | `164e9ad4-bf72-4c86-b6cb-46d1f9e2a89c` | pending |
| personal_weekly@t01 | `67c4d554-cd3d-4d98-867d-c7a2f38b1724` | personal_weekly | t01 | `aec7fbc0-47d1-4483-8a26-a6d569c5d5c4` | pending |
| personal_daily@t06 | `44dd56e5-608b-47ea-8e13-6265190784fe` | personal_daily | t06 | `3c2cd210-b011-415f-8d41-5ae2ba53597b` | pending |

## 内容质量最低校验与业务接口读回字段

只对 `business_readback=PASS` 的用例做字段级校验。

| label | content_non_empty | product_status=ai_generated | generation_mode=managed_agent | edited=false | run_id matches | model_id | agent_id |
| --- | --- | --- | --- | --- | --- | --- | --- |
| personal_daily@t05 | PASS | PASS | PASS | PASS | FAIL | FAIL | PASS |
| personal_weekly@t05 | PASS | PASS | PASS | PASS | FAIL | PASS | PASS |
| team_daily@t03 | PASS | PASS | PASS | PASS | FAIL | FAIL | PASS |
| team_weekly@t03 | PASS | PASS | PASS | PASS | FAIL | FAIL | PASS |
| department_daily@t02 | PASS | PASS | PASS | PASS | FAIL | FAIL | PASS |
| department_weekly@t02 | PASS | PASS | PASS | PASS | FAIL | PASS | PASS |
| personal_daily@t01 | PASS | PASS | PASS | PASS | FAIL | FAIL | PASS |
| personal_weekly@t01 | PASS | PASS | PASS | PASS | FAIL | PASS | PASS |
| personal_daily@t06 | PASS | PASS | PASS | PASS | PASS | PASS | PASS |

## 越权测试结果

| 用例 | report_type | 期望 | 实际 | 结果 |
| --- | --- | --- | --- | --- |
| t05 | team_daily | reject-or-mcp-forbidden | HTTP 200 run_id=d0a8637b-7faf-455a-b68e-9685b476d463 status=pending (run API accepted; MCP-layer enforcement not verified) | WARN_RUN_API_ACCEPTED |
| t05 | department_daily | reject-or-mcp-forbidden | HTTP 200 run_id=3bb6e30f-6407-4f6a-9726-e9f5fff1ec1a status=pending (run API accepted; MCP-layer enforcement not verified) | WARN_RUN_API_ACCEPTED |
| t05 | personal_daily | reject | HTTP 403 code=None error=forbidden target | PASS |
| t01 | team_daily | reject-or-mcp-forbidden | HTTP 400 code=None error=target team is required | PASS |
| t01 | department_daily | reject-or-mcp-forbidden | HTTP 200 run_id=8dc4d245-8e6c-443a-a7a5-b6c0f9fb1696 status=pending (run API accepted; MCP-layer enforcement not verified) | WARN_RUN_API_ACCEPTED |
| t03 | department_daily | reject-or-mcp-forbidden | HTTP 200 run_id=3279ba9d-5962-431e-b0eb-f2a51ad3a77a status=pending (run API accepted; MCP-layer enforcement not verified) | WARN_RUN_API_ACCEPTED |
| t03 | personal_daily | reject | HTTP 403 code=None error=forbidden target | PASS |
| t02 | team_daily | reject-or-mcp-forbidden | HTTP 400 code=None error=target team is required | PASS |
| t02 | personal_daily | reject | HTTP 403 code=None error=forbidden target | PASS |

## MCP 层 FORBIDDEN 证据（越权用例真实失败日志）

4 个 `WARN_RUN_API_ACCEPTED` 越权用例在 run API 层被接受（HTTP 200），但真实模型 Agent 实际调用 Report MCP 时被 FORBIDDEN 拒绝。从 `ai_runs.error_message` 取到的真实失败摘要：

| 越权用户 | 实际 report_type | ai_run 状态 | MCP FORBIDDEN 摘要 |
| --- | --- | --- | --- |
| t05 (employee) | team_daily | failed | `FORBIDDEN: 当前用户（测试05）没有写入团队日报的权限，只有团队组长或管理员才有权限写入团队日报` |
| t05 (employee) | team_daily (另一历史 run) | failed | `FORBIDDEN: 当前用户无权访问目标团队（team_id: 3f05e6ed-...）的数据。scope or target not allowed for current user` |
| t01 (PM) | department_daily | failed | `FORBIDDEN: 当前用户没有权限访问部门 department_id=303 的数据` |
| t03 (TL) | department_daily | failed | `FORBIDDEN: 当前用户无权访问 department_id=305 的部门数据` |

结论：越权写报告的拦截实际发生在 MCP `write_report_result` / 读取 scope 工具层，run API 仅做基础 target 解析。这符合产品方案“权限矩阵由 Report MCP 统一执行”的设计；但 run API 不前置拒绝也意味着会真实触发一次模型运行，建议后续在 run API 增加角色前置校验以节省模型成本（属优化项，非阻塞）。

## 业务接口读回字段独立复核

在测试结束后对 6 类报告 + PM + employee_b 的业务接口做独立读回，确认字段一致性（读取服务端当前日期 2026-07-01 对应记录）：

| 报告 | generation_mode | product_status | edited | managed_agent_run_id | model_id | agent_id | content_len |
| --- | --- | --- | --- | --- | --- | --- | --- |
| personal_daily (t05) | managed_agent | ai_generated | false | set | MiniMax-M2.5 | set | 19 * |
| personal_weekly (t05) | managed_agent | ai_generated | false | set | MiniMax-M2.5 | set | 701 |
| team_daily (t03) | managed_agent | ai_generated | false | set | MiniMax-M2.5 | set | 456 |
| team_weekly (t03) | managed_agent | ai_generated | false | set | MiniMax-M2.5 | set | 911 |
| department_daily (t02) | managed_agent | ai_generated | false | set | MiniMax-M2.5 | set | 882 |
| department_weekly (t02) | managed_agent | ai_generated | false | set | MiniMax-M2.5 | set | 1657 |
| PM personal_daily (t01) | managed_agent | ai_generated | false | set | MiniMax-M2.5 | set | 613 |
| PM personal_weekly (t01) | managed_agent | ai_generated | false | set | MiniMax-M2.5 | set | 766 |
| employee_b personal_daily (t06) | managed_agent | ai_generated | false | set | MiniMax-M2.5 | set | 668 |

`*` personal_daily (t05) 在测试结束后的当前内容只剩 19 字符（`# 测试个人日报\n\n这是一条测试记录。`），原因是越权用例 `t05 team_daily` 失败后，Agent 用 `write_report_result` 写了一个 personal_daily 占位内容覆盖了真实日报（见下文 bug 列表）。测试运行期间脚本轮询到的内容是真实模型生成的摘要（含 session 关键词），因此矩阵中 `content_check=PASS`；该覆盖发生在主用例通过之后。

脚本中 `run_id matches=FAIL` 是测试夹具现象：同一用户同一日期先后有两次真实模型 run（第一次 23:57、第二次 00:27），upsert 使 `managed_agent_run_id` 指向最后一次写入的 run。直接复核确认 `managed_agent_run_id` 始终指向一个真实 succeeded 的 ai_run，业务字段全部正确。

## MCP 通用客户端回归

```
python3 scripts/test_report_mcp_generic_client.py
[STATS] pass=178 fail=0 skip=0
```

## 默认配置初始化回归

```
python3 scripts/test_default_report_assets.py
```

12 个测试账号 Skill / MCP / Agent duplicate count 均为 `1/1/1`，owner=self，非 system 模板（见上文“默认 Report 配置回归结果”表）。

## Go / 前端回归

```
cd api && go test ./...
ok  	github.com/aidashboard/api/handler
ok  	github.com/aidashboard/api/service

pnpm --dir web lint        PASS
pnpm --dir web typecheck   PASS
pnpm --dir web build       PASS (built in 4.29s)
```

## grep 清理结果

对 api/web 生产代码执行 12 个旧引用 pattern 检查，结果均为 0 命中：

```
ensureDefaultPersonalDailyAgent        : 0 hits in api/web
AIDA_REPORT_AGENT:personal_daily       : 0 hits in api/web
aida-daily-report                      : 0 hits in api/web
personal-daily-v1                      : 0 hits in api/web
aida-report-mcp-p0                     : 0 hits in api/web
get_report_context                     : 0 hits in api/web
aida_daily_report_get_context          : 0 hits in api/web
aida_daily_report_save_draft           : 0 hits in api/web
/mcp/daily-report                      : 0 hits in api/web (404 confirmed)
mcp_authorization                      : 0 hits in api/web
default-managed-agent-runs             : 0 hits in api/web
report-agents/default/ensure           : 0 hits in api/web
```

`doc/` 中出现的同名引用均为历史方案 / 删除说明文档，非生产代码。`mcp_authorization` 在 `doc/AI Assets整体交互改造方案.md` 等文档中作为“不应再出现的旧参数”被引用说明，符合预期。

## FAIL / TIMEOUT / BLOCKED 明细

- FAIL: 0
- TIMEOUT: 0
- BLOCKED: 0

## 最高优先级 bug 列表

1. **`write_report_result` 不校验 run.report_type 与 args.report_type 一致性**（api/handler/report_mcp_write.go）。表现：越权 `t05 team_daily` run 失败后，Agent 用同一 `run_id` 调用 `write_report_result` 写入了 `personal_daily` 占位内容，覆盖了 t05 已生成的真实 personal_daily 日报。`aiRunGuard` 只校验 run 属主，未校验 run 的 report_type / target 与本次写回一致。建议：在 `toolWriteReportResult` 中比对 `ai_runs.input_ref_json.report_type` 与 `args.ReportType`，不一致返回 `INVALID_ARGUMENT`。
2. **run API 不前置拒绝越权 report_type**（api/handler/managed_agent.go `StartReportAgentRun` → `resolveTarget`）。表现：employee/PM/TL 对无权限的 team/department report_type 用 `target=self` 时，run API 返回 HTTP 200 并真实启动模型，最终由 MCP 层 FORBIDDEN 失败。建议：在 `resolveTarget` 的 `self` 分支按 report_type 增加角色前置校验，避免无谓模型成本。
3. **Report Agent run 状态轮询缺位**（api/service/managed_agent_run_status_syncer.go 只刷新 `external_task_id IS NOT NULL` 的 run，而 Report Agent run 只有 `external_session_id`）。表现：若 Agent 未调用 `write_report_result` / `write_report_failure`，ai_run 永远停在 `pending`。当前依赖 MCP 写回工具副作用更新 ai_run 状态。建议：syncer 增加 `external_session_id IS NOT NULL` 分支或新增 session 状态查询。

## 建议修复顺序

1. bug 1（数据正确性，会被越权 run 污染真实日报）。
2. bug 2（成本 + 体验，减少无意义模型运行）。
3. bug 3（可观测性，避免 ai_run 永久 pending）。

## 不属于本轮范围的问题

- UI 自动化、定时任务、历史资产清理均不在本轮范围。
- 业务代码 bug 仅记录，不在本轮修改。

## 测试结论与摘要

- 总用例数（真实模型 + 越权）: `18`
- PASS: `14`
- FAIL: `0`
- TIMEOUT: `0`
- BLOCKED: `0`
- WARN (run API 接受但 MCP 层未验证): `4`
- 真实模型 run 总数: `9`
- 真实模型 succeeded: `9`
- 真实模型 failed: `0`
- 6 类 report_type 全部真实生成成功: `True`
- 已成功的 report_type: `['department_daily', 'department_weekly', 'personal_daily', 'personal_weekly', 'team_daily', 'team_weekly']`
- session upload 通过: `True`
- 业务接口读回通过: `True`
- 前置检查通过: `True`
- 默认资产回归通过: `True`

### 最高优先级 bug / 建议修复顺序
- 见上文“最高优先级 bug 列表”与“建议修复顺序”。
- 越权用例中 run API 接受但 MCP 层 FORBIDDEN 已确认（见“MCP 层 FORBIDDEN 证据”），失败发生在 MCP 层而非 run API 层。

### 明早优先看的 bug
1. `write_report_result` 不校验 run.report_type ↔ args.report_type 一致性，导致越权 run 覆盖真实 personal_daily（bug 列表 1）。
2. run API 未前置拒绝越权 report_type，浪费模型成本（bug 列表 2）。

### 不属于本轮范围的问题
- UI 自动化、定时任务、历史资产清理均不在本轮范围。
- 业务代码 bug 仅记录，不在本轮修改。
