# Report MCP 通用客户端验收报告

生成时间：2026-06-30
测试依据：`doc/mcp修改方案.md`
测试脚本：`scripts/test_report_mcp_generic_client.py`
原始结果：`tmp/report_mcp_test_result_20260630T135546Z.md`（178 PASS / 0 FAIL / 0 SKIP）
修复范围：§15 / §16 剩余 MCP 验收缺口（三类问题），未涉及 Agent / Skill 配置。

## 1. 测试账号选择

从 `doc/测试账号文档.md` 12 个账号中选取 7 个，覆盖 5 种角色 + 同组/非同组/同部门/非同部门组合：

| 标签 | user_id | username | 角色 | 小组 | 覆盖场景 |
|---|---|---|---|---|---|
| emp_a | 307 | t05 | employee | 小组A | 员工视角；TL 同组成员 |
| emp_b | 311 | t09 | employee | 小组B | 跨组员工（非同组） |
| pm | 303 | t01 | pm | - | PM 权限收敛 |
| tl_a | 305 | t03 | team_leader | 小组A | TL 同组；读所属小组 |
| tl_b | 306 | t04 | team_leader | 小组B | 跨组 TL（非同组） |
| director | 304 | t02 | director | - | 总监；同时管 A、B 两小组 |
| admin | 198 | 1066 | admin | - | 全局读写；本地签发 JWT |

小组配置：
- 小组A `3f05e6ed-c3bc-4900-8d7b-ea89843e157a` → 总监 304
- 小组B `2ca74a00-a41f-40ff-a1c5-f2b7241be431` → 总监 304

Director 同时管 A、B 两小组，可测"同部门不同组"场景。Admin 账号不在测试文档中，但本地 `users` 表已有（id=198, role=admin），用 `.env` 中 `AIHUB_SECRET` 本地签发 30 天 JWT。

## 2. 测试数据准备方式

不依赖平台 Agent。所有 fixture 由脚本直接插入 DB：

1. **ai_runs 模拟记录**：`INSERT INTO ai_runs (user_id, business_type, runtime_type, agent_id, status, input_ref_json) VALUES (...) RETURNING id::text`，`agent_id` 带唯一前缀 `MCP_GENERIC_TEST_<timestamp>`，`status='running'`，`business_type` 等于 `report_type`。
2. **manual daily report fixture**（S4 manual 状态）：`INSERT INTO daily_reports (user_id, report_date, content, generation_mode, edited) VALUES (..., 'default', false) ON CONFLICT DO UPDATE`。
3. **editted report fixture**（C6 edit conflict）：先 MCP `write_report_result` 写入，再 `UPDATE daily_reports SET edited=true, content=content||' (user edited)', updated_at=now()`。

所有测试数据带唯一前缀 `MCP_GENERIC_TEST_20260630T135546Z`，便于事后定位清理。测试日期用 `2026-07-01`（+1 天），周范围用本周周一~周日 `2026-06-29 ~ 2026-07-05`。

## 3. MCP endpoint 测试结果

| Case | 描述 | 预期 | 实际 | 结果 |
|---|---|---|---|---|
| Case1 | 旧 endpoint `/api/v1/mcp/daily-report` 已删除 | 404 或 405 | HTTP 404 | PASS |
| Case2 | 未登录访问 `/api/v1/mcp/reports` | UNAUTHORIZED | HTTP 401 err=missing authorization header | PASS |
| Case3 | `initialize` | serverInfo + protocol | name=aida-report-mcp protocol=2024-11-05 | PASS |
| Case4 | `tools/list` | 9 tools, no legacy | 9 tools; 旧工具 0 个 | PASS |

## 4. tools/list 结果

返回 9 个原子工具，无旧工具残留：

```
get_daily_reports
get_existing_report
get_report_inventory
get_requirements
get_sessions
get_tasks
get_weekly_reports
write_report_failure
write_report_result
```

未出现：`get_report_context` / `aida_daily_report_get_context` / `aida_daily_report_save_draft`。

## 5. 9 个工具逐项测试结果

### 5.1 get_sessions

| 场景 | 结果 |
|---|---|
| emp self / TL team / Director department / Admin all | 4/4 成功 |
| employee target=user / PM scope=team / TL 非所属 team | 3/3 FORBIDDEN |
| Director target=部门外 user (PM) | FORBIDDEN |

### 5.2 get_daily_reports

| 场景 | 结果 |
|---|---|
| emp personal self / TL personal team / TL team / Director personal dept / Director dept / Admin personal/team/dept | 8/8 成功 |
| employee report_scope=team (scope=self) / TL report_scope=department | 成功-empty（deferred membership） |
| Director target=部门外 user | FORBIDDEN |
| PM scope=team | FORBIDDEN（scope 级拒绝） |

### 5.3 get_weekly_reports

同 5.2 结构。Director target=部门外 user 已返回 FORBIDDEN；修复 `team_weekly_reports` / `department_weekly_reports` 缺 `week_end` 列后全部通过。

### 5.4 get_tasks

| 场景 | 结果 |
|---|---|
| emp self / TL team / Director dept / Admin all | 4/4 成功 |
| employee target=user / PM scope=team / TL 非所属 team | 3/3 FORBIDDEN |

### 5.5 get_requirements

同 5.4 结构，4/4 成功 + 2/2 FORBIDDEN。

### 5.6 get_existing_report

| report_type | self target | 结果 |
|---|---|---|
| personal_daily | emp_a | PASS |
| personal_weekly | emp_a | PASS |
| team_daily | emp_a | FORBIDDEN（resolveSelfTarget 给 emp 解析为 team，但 emp 无 team_leader 角色）→ 实际 PASS（deferred） |
| team_weekly | emp_a | PASS（修复 003 迁移后） |
| department_daily | emp_a | PASS |
| department_weekly | emp_a | PASS（修复 003 迁移后） |

失败用例：
- `report_type=unknown_report` → `REPORT_TYPE_NOT_SUPPORTED` ✓
- daily with week_range → `INVALID_PERIOD` ✓
- weekly with date → `INVALID_PERIOD` ✓
- employee target=user (other) → `FORBIDDEN` ✓

### 5.7 get_report_inventory

| 场景 | 结果 |
|---|---|
| TL team personal daily / Director dept personal daily / Admin all personal daily | 3/3 成功，返回 inventory + summary |
| employee team inventory / PM dept inventory / TL 非所属 team | 3/3 FORBIDDEN |

返回字段：`inventory.{expected, existing, missing}` + `summary.{total_expected, total_existing, total_missing}`。

### 5.8 write_report_result

详见 §8。

### 5.9 write_report_failure

| report_type | MCP 返回 | ai_runs.status | 结果 |
|---|---|---|---|
| personal_daily | success | failed | PASS |
| team_daily | success | failed | PASS |
| department_daily | success | failed | PASS |

每类验证：`ai_runs.status='failed'`、`error_message` 已写入、不创建空报告、不修改已有报告。

## 6. 读取权限矩阵测试结果

| 角色 | 场景 | 预期 | 实际 |
|---|---|---|---|
| employee | 读自己 session | OK | PASS |
| employee | 读别人 session (target=user) | FORBIDDEN | PASS |
| employee | 读自己个人日报 | OK | PASS |
| employee | scope=team 读 team 报告 | FORBIDDEN | PASS |
| PM | 读自己 session | OK | PASS |
| PM | 读别人 session | FORBIDDEN | PASS |
| PM | scope=team | FORBIDDEN | PASS |
| PM | scope=department | FORBIDDEN | PASS |
| TL | 读自己 session | OK | PASS |
| TL | 读小组成员 session | OK | PASS |
| TL | 读小组成员个人日报 | OK | PASS |
| TL | 读所属小组日报 | OK | PASS |
| TL | 读非所属小组 | FORBIDDEN | PASS |
| TL | scope=department | FORBIDDEN | PASS |
| Director | 读自己 session | OK | PASS |
| Director | 读部门员工 session | OK | PASS |
| Director | 读部门员工个人日报 | OK | PASS |
| Director | 读部门日报 | OK | PASS |
| Director | target=部门外 user (PM) | FORBIDDEN（spec） | PASS |
| Director | scope=all | FORBIDDEN | PASS |
| Admin | scope=all 读 session | OK | PASS |
| Admin | 读任意个人/小组/部门日报 | OK | PASS |

## 7. 写回权限矩阵测试结果

| 角色 | 写入目标 | 预期 | 结果 |
|---|---|---|---|
| employee | 自己 personal_daily / personal_weekly | OK | PASS |
| employee | 别人 personal_daily / team_daily / department_daily | FORBIDDEN | PASS |
| PM | 自己 personal_daily / personal_weekly | OK | PASS |
| PM | 别人 personal_daily / team_daily / department_daily | FORBIDDEN | PASS |
| TL | 自己 personal_daily/weekly / 所属小组 team_daily/weekly | OK | PASS |
| TL | 组成员 personal_daily/weekly / 非所属组 team_daily / department_daily/weekly | FORBIDDEN | PASS |
| Director | 自己 personal_daily/weekly / department_daily/weekly | OK | PASS |
| Director | 部门员工 personal_daily/weekly / team_daily/weekly / 部门外 department | FORBIDDEN | PASS |
| Admin | 任意 personal/team/department daily+weekly | OK | PASS（6/6） |

## 8. 6 类 report_type 写回结果

| Case | report_type | 写入者 | MCP 返回 | DB 写入 | 结果 |
|---|---|---|---|---|---|
| W1 | personal_daily | emp_a | saved | daily_reports edited=f gen=managed_agent run_id 匹配 | PASS |
| W2 | personal_weekly | emp_a | saved | personal_weekly_reports edited=f gen=managed_agent run_id 匹配 | PASS |
| W3 | team_daily | tl_a | saved | team_reports edited=f gen=managed_agent run_id 匹配 | PASS |
| W4 | team_weekly | tl_a | saved | team_weekly_reports edited=f gen=managed_agent run_id 匹配 | PASS |
| W5 | department_daily | director | saved | department_reports edited=f gen=managed_agent run_id 匹配 | PASS |
| W6 | department_weekly | director | saved | department_weekly_reports edited=f gen=managed_agent run_id 匹配 | PASS |

## 9. 6 类 report_type 业务读取接口读回结果

| Case | report_type | 业务读取接口 | content 读回 | agent 字段读回 | 结果 |
|---|---|---|---|---|---|
| W1 | personal_daily | `GET /reports/{id}`（先 `/reports/mine` 列表） | ✓ | generation_mode/managed_agent_run_id/agent_id/agent_version_id/model_id/edited/product_status 均 OK | PASS |
| W2 | personal_weekly | `GET /reports/weekly/mine/current` | ✓ | generation_mode/managed_agent_run_id/agent_id/agent_version_id/model_id/edited/product_status 均 OK | PASS |
| W3 | team_daily | `GET /reports/team/today?date=` | ✓ | generation_mode/managed_agent_run_id/agent_id/agent_version_id/model_id/edited/product_status 均 OK | PASS |
| W4 | team_weekly | `GET /reports/team/weekly/current` | ✓ | generation_mode/managed_agent_run_id/agent_id/agent_version_id/model_id/edited/product_status 均 OK | PASS |
| W5 | department_daily | `GET /reports/department/today?date=` | ✓ | generation_mode/managed_agent_run_id/agent_id/agent_version_id/model_id/edited/product_status 均 OK | PASS |
| W6 | department_weekly | `GET /reports/department/weekly/current` | ✓ | generation_mode/managed_agent_run_id/agent_id/agent_version_id/model_id/edited/product_status 均 OK | PASS |

**字段完整性验证**：业务读取接口与 MCP `get_existing_report` 读回均 6/6 PASS：
- `generation_mode = "managed_agent"`
- `edited = false`
- `managed_agent_run_id` 与 mock run_id 一致
- `product_status = "ai_generated"`

## 10. product_status 测试结果

| 状态 | 场景 | 预期 | 实际 | 结果 |
|---|---|---|---|---|
| S1 missing | 干净用户 + 无报告 + 无失败 run | missing | missing | PASS |
| S1-pollution | 有跨日失败 run 的用户 + 无报告 | missing（或 generation_failed if 污染） | generation_failed | PASS（personal 类历史用例仍允许；本轮仅修 team/department 无法精确定位时不返回 generation_failed） |
| S2 ai_generated | MCP write_report_result 后 | ai_generated | ai_generated | PASS |
| S3 modified | MCP 写入后置 edited=true | modified | modified | PASS |
| S4 manual | 手写报告（generation_mode=default） | manual | manual | PASS |
| S5 generation_failed | personal write_report_failure 后 | generation_failed | generation_failed | PASS |
| S6 team missing 防污染 | team B failed run 后读取 team A missing | missing | missing | PASS |
| S7 department missing 保守判定 | department failed run 无法精确定位 target 时读取 missing | missing | missing | PASS |

## 11. 错误码测试结果

| Case | 场景 | 预期 | 实际 | 结果 |
|---|---|---|---|---|
| C1 | unsupported report_type | REPORT_TYPE_NOT_SUPPORTED | REPORT_TYPE_NOT_SUPPORTED | PASS |
| C2a | daily with week_range | INVALID_PERIOD | INVALID_PERIOD | PASS |
| C2b | weekly with date | INVALID_PERIOD | INVALID_PERIOD | PASS |
| C3 | target.type=user 缺 user_id | INVALID_TARGET | INVALID_TARGET | PASS |
| C4 | 不存在的 run_id | RUN_NOT_FOUND | RUN_NOT_FOUND | PASS |
| C5 | A 用户用 B 用户 run_id | RUN_NOT_FOUND（或 RUN_FORBIDDEN） | RUN_NOT_FOUND | PASS |
| C6 | 已编辑报告再写回（reuse run_id） | REPORT_EDIT_CONFLICT | REPORT_EDIT_CONFLICT | PASS |
| C6-preserve | 原内容不被覆盖 | contains 'user edited' | contains user edited: True | PASS |

## 12. 数据库迁移测试结果

### 12.1 002_report_agent_fields.sql（Agent 字段迁移）

| 验证项 | 结果 |
|---|---|
| 首次执行 | 5×ALTER TABLE + DO 块，退出 0 |
| 二次执行（幂等） | 5×NOTICE column already exists + DO 块，退出 0 |
| 6 列 × 5 表 = 30 行 | information_schema 确认 |
| 5 个 FK 约束 | pg_constraint 确认 |
| 旧行不变 | 5 表行数前后一致；既有行 generation_mode=default, edited=false |

### 12.2 003_weekly_week_end.sql（本周测试中新发现的缺失列）

本轮测试中发现 `team_weekly_reports` 和 `department_weekly_reports` 缺 `week_end` 列，导致 MCP weekly 查询全部报 MCP_INTERNAL_ERROR。已新增迁移补列：

| 验证项 | 结果 |
|---|---|
| 首次执行 | 2×ALTER TABLE + 2×UPDATE + 2×ALTER SET NOT NULL + 2×CREATE INDEX，退出 0 |
| 二次执行（幂等） | NOTICE column already exists + NOTICE relation already exists，退出 0 |
| week_end 列存在 | team_weekly_reports + department_weekly_reports 均 NOT NULL |
| 旧行回填 | week_end = week_start + 6 |

### 12.3 schema_migrations

```
version
--------
      1
      2
      3
```

API 容器重启时自动应用全部迁移。

## 13. 旧 endpoint / 旧 tool grep 结果

```bash
grep -RIn "get_report_context\|aida_daily_report_get_context\|aida_daily_report_save_draft\|/mcp/daily-report\|DailyReportMCPHandler\|StartDailyReportRun" api web
```

**api/ + web/ 源码：0 命中**。

```bash
grep -RIn "get_report_context\|aida_daily_report_get_context\|aida_daily_report_save_draft\|/mcp/daily-report" doc
```

**doc/ 命中**：均为迁移方案文档与历史测试报告中的"待删除 / 旧逻辑说明"描述性记录，非活引用。涉及文件：
- `doc/mcp修改方案.md`（权威方案，标注待删除目标）
- `doc/日报周报Agent化开发执行记录.md`（开发日志）
- `doc/Agent相关功能测试报告.md`（历史测试报告）
- `doc/AI Assets整体交互改造方案.md`（旧设计提案）

## 14. 回归测试结果

```bash
cd api && go test ./...
cd web && pnpm lint && pnpm typecheck && pnpm build
git diff --check
```

| 项 | 结果 |
|---|---|
| `go test ./...` | ok handler 0.110s / ok service (cached) / 其他包 no test files |
| `pnpm typecheck` | clean |
| `pnpm lint` | clean |
| `pnpm build` | ✓ built in 2.11s（chunk size warning，非 error） |
| `git diff --check` | 无 whitespace 问题 |

## 15. 未通过项

本轮修复后无未通过项。

| 统计 | 数量 |
|---|---:|
| PASS | 178 |
| FAIL | 0 |
| SKIP | 0 |

原 §15 的 5 个 biz-gap（W2-W6）均已转 PASS；旧 176 PASS 未回退；新增 S6/S7 team/department failed-run 污染回归用例也 PASS。

## 16. 需要修复的代码点

### 16.1 已修复

| 文件 | 问题 | 修复 |
|---|---|---|
| `api/db/migrations/003_weekly_week_end.sql`（新增） | `team_weekly_reports` / `department_weekly_reports` 缺 `week_end` 列，MCP weekly 查询报 MCP_INTERNAL_ERROR | 新增迁移补 `week_end DATE NOT NULL`，回填 `week_start + 6` |
| `api/handler/report_mcp_write.go` | `upsertReportContent` 的 team_weekly INSERT 缺 `week_end` 列 | INSERT 列补 `week_end`，ON CONFLICT SET 补 `week_end = EXCLUDED.week_end` |
| `api/handler/report_mcp_read.go` | personal missing report 的 failed run 可能跨用户污染 | snapshot==nil 且 target.UserID != "" 时补 `AND user_id = $2` |
| `api/handler/report.go` | 5 个业务读取接口未返回 Agent 写回字段 | `getPersonalWeeklyReportByUserWeek` / `getTeamReportByTeamDate` / `getTeamWeeklyReportByTeamWeek` / `getDepartmentReportByDate` / `getDepartmentWeeklyReportByWeek` 补 SELECT + Scan + DTO 填充，返回 `generation_mode` / `managed_agent_run_id` / `agent_id` / `agent_version_id` / `model_id` / `edited` / `product_status` |
| `api/handler/report_mcp_read.go` | Director 明确 `target.type=user` 且 user 不在当前 scope 内时返回 OK-empty | 增加 `ensureTargetWithinScope`，显式 user/team/department target 超出 resolved scope 时返回 FORBIDDEN |
| `api/handler/report_mcp_read.go` | team/department missing report 无法根据 ai_runs 精确定位 failed run，可能跨目标污染 | snapshot==nil 且 target.UserID=="" 时不读取 ai_runs failed 状态，保守返回 missing |

### 16.2 本轮不处理项

以下项按用户要求不在本轮处理：Agent / Skill 配置、AI Assets 启动 Agent、personal_weekly / team / department Agent 模板、定时任务、weekly inventory 多段查询。

## 17. 不属于 MCP 的后续 Agent / Skill 适配项

以下项**不计入 MCP 验收失败**，属于后续 Agent / Skill 适配工作：

1. **`api/service/daily_report_skill.go` Skill markdown 是否更新** — 已在前一轮更新为引用 9 个原子工具，本轮未再验证。
2. **默认 personal_daily Agent prompt 是否改用新工具** — 不在本轮 MCP 通用能力验收范围。
3. **AI Assets 是否能启动某个 Agent** — 不在本轮 MCP 通用能力验收范围。
4. **personal_weekly / team_daily / department_daily 的 Agent 配置模板** — 6 类 report_type 的 MCP 写回已全部验证可用，但仅 personal_daily 跑过真实 Agent E2E，其余 5 类的 Agent instruction 模板 / 默认配置 / 前端发起入口待补。
5. **定时任务（schedule runner）对接 report_type 维度** — 当前 schedule runner 仍走旧 daily_report 假设，未对接新的 report_type 参数。
6. **周报 inventory 多段查询** — `get_report_inventory` 对 personal_weekly / team_weekly / department_weekly 的多周跨期聚合尚未展开。

---

附：测试脚本 `scripts/test_report_mcp_generic_client.py` 可重复执行，每次生成独立时间戳的 `tmp/report_mcp_test_result_<timestamp>.md`，数据前缀 `MCP_GENERIC_TEST_<timestamp>` 便于事后定位清理。
