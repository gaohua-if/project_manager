# 日报周报 Agent MCP 代码现状盘点

## 1. 盘点范围与结论

本文基于当前代码现状梳理日报 / 周报进入「Report MCP + Agent 自取数 + 回写报告」闭环前的可复用能力和缺口。

目标链路：

```text
日报/周报页面触发智能生成
→ 调用 Report Action / Managed Agent
→ Agent 自己通过 Report MCP 读取所需上下文
→ Agent 生成日报/周报内容
→ Agent 通过 MCP 回写 Aida 报告事实源
→ 日报/周报页面刷新后展示生成结果
```

当前结论：

1. Managed Agent、AI Assets、`ai_runs`、定时任务、Daily Report MCP 已有底座代码。
2. 当前 Daily Report MCP 只覆盖“个人日报”场景，且仍保留 `session_ids` 参数，不能直接代表新的六类报告 Agent 自取数方案。
3. 当前 MCP 只有个人日报回写 tool，不支持小组日报、部门日报、个人周报、小组周报、部门周报回写。
4. 当前 Report 接口仍以旧 report generator / 来源型生成接口为主，未形成统一 Report Action。
5. `/ai-assets` 页面路径和后端路由是匹配的，服务异常更可能来自 Managed Agent 平台未配置或外部平台调用失败。

## 2. 涉及文件

| 模块 | 文件 |
| --- | --- |
| AI Assets 页面 | `web/src/features/aidashboard/ai-assets/pages/AIAssetsPage.tsx` |
| 前端 API client | `web/src/features/aidashboard/api/client.ts` |
| 前端路由 | `web/src/router/routes.tsx` |
| HTTP 错误处理 | `web/src/shared/request/httpClient.ts` |
| 后端路由注册 | `api/main.go` |
| Managed Agent handler | `api/handler/managed_agent.go` |
| Managed Agent client | `api/service/managed_agent.go` |
| Managed Agent 定时任务 | `api/service/managed_agent_scheduler.go` |
| Managed Agent 状态同步 | `api/service/managed_agent_run_status_syncer.go` |
| Daily Report MCP | `api/handler/daily_report_mcp.go` |
| Report handler | `api/handler/report.go` |
| 数据模型 | `api/model/models.go` |
| 初始迁移 | `api/db/migrations/001_init.sql` |
| API 配置 | `api/config/config.go` |
| Docker Compose | `docker-compose.yml` |

## 3. 当前已有能力

### 3.1 AI Assets 管理能力

前端页面 `AIAssetsPage.tsx` 已有四个 tab：

1. Skills：调用 `GET /api/v1/ai-assets/skills?scope=...`。
2. MCP：调用 `GET /api/v1/ai-assets/mcp?scope=...`，支持 `POST /api/v1/ai-assets/mcp` 创建。
3. Agents：调用 `GET /api/v1/ai-assets/agents`，支持创建、编辑、手动运行。
4. 定时任务：调用 `GET /api/v1/ai-assets/agent-schedules`，支持创建、编辑、删除、立即运行。

页面还提供“日报 MCP/Skill”弹窗，调用 `GET /api/v1/ai-assets/daily-report-integration` 获取当前 Aida Daily Report MCP URL 和旧 Skill Markdown。

权限上，前端路由 `/ai-assets` 对 `admin/director/pm/team_leader/employee` 可见。后端所有 `/api/v1/ai-assets/*` 路由在统一 AuthMiddleware 下，需要有效用户 token。

### 3.2 Managed Agent 创建 / 运行能力

后端 `ManagedAgentHandler` 已具备：

1. 列出 Skill：`ListSkills` 代理到外部 Managed Agent 平台 `/api/skill/list`。
2. 列出 MCP：`ListMCPEntries` 代理到 `/api/mcp/list`。
3. 创建 MCP：`CreateMCPEntry` 代理到 `/api/mcp`。
4. 列出我的 Agent：`ListMyAgents` 代理到 `/api/my/agents`。
5. 创建 / 更新 Agent：`CreateMyAgent`、`UpdateMyAgent` 代理到 `/api/my/agents`。
6. 手动运行 Agent：`StartAgentRun` 调外部 `/api/task/submit`，并写入本地 `ai_runs`。
7. 查询运行记录：`ListAgentRuns`、`GetAgentRun` 读取本地 `ai_runs`，必要时刷新外部 task result。

当前手动运行接口路径：

```text
POST /api/v1/ai-assets/agents/{agentId}/runs
```

请求要求：

1. URL path 必须有 `agentId`。
2. body 至少提供 `message` 或 `params`。
3. `model_id` 可选。
4. `params` 是 `map[string]string`。

该接口不要求 `session_ids`，但它是通用 Agent 手动运行接口，不带日报/周报业务语义，也不会自动回写报告。

### 3.3 MCP 创建 / 注册能力

AI Assets 的 MCP 管理本质是代理外部 Managed Agent 平台：

```text
GET  /api/v1/ai-assets/mcp
POST /api/v1/ai-assets/mcp
```

本地没有保存 MCP registry 表，MCP entry 创建结果来自外部平台。Aida 自身提供的 Daily Report MCP URL 由 `DailyReportIntegration` 动态返回：

```text
GET /api/v1/ai-assets/daily-report-integration
```

### 3.4 Daily Report MCP 能力

后端注册：

```text
POST /api/v1/mcp/daily-report
```

支持 JSON-RPC 方法：

1. `initialize`
2. `ping`
3. `tools/list`
4. `tools/call`

当前 tools 只有两个：

1. `aida_daily_report_get_context`
2. `aida_daily_report_save_draft`

它们都依赖 AuthMiddleware 注入的当前用户。MCP 请求必须带 Aida 用户 Authorization token，否则无法识别用户。

### 3.5 日报/周报读取与保存能力

当前 Report API 覆盖六类报告：

| 报告 | 读取 | 保存 / 更新 |
| --- | --- | --- |
| 我的日报 | `GET /reports/mine`、`GET /reports/today`、`GET /reports/{id}` | `PUT /reports/{id}` |
| 小组日报 | `GET /reports/team/today`、`GET /reports/team/{id}` | `PUT /reports/team/today`、`PUT /reports/team/{id}` |
| 部门日报 | `GET /reports/department/today`、`GET /reports/department/{id}` | `PUT /reports/department/today`、`PUT /reports/department/{id}` |
| 我的周报 | `GET /reports/weekly/mine/current`、`GET /reports/weekly/mine` | `PUT /reports/weekly/mine/current` |
| 小组周报 | `GET /reports/team/weekly/current`、`GET /reports/team/weekly` | `PUT /reports/team/weekly/current`、`PUT /reports/team/weekly/{id}` |
| 部门周报 | `GET /reports/department/weekly/current`、`GET /reports/department/weekly` | `PUT /reports/department/weekly/current`、`PUT /reports/department/weekly/{id}` |

保存接口可以作为最终回写落库的参考，但当前 MCP 还没有统一封装这些写入能力。

### 3.6 旧生成接口能力

当前旧生成接口仍存在，主要依赖 `REPORT_GENERATOR_URL`：

| 能力 | 接口 | 现状 |
| --- | --- | --- |
| 个人日报旧生成 | `POST /reports/today/generate` | 调 report generator `/reports/generate` |
| 个人日报旧草稿 | `POST /reports/today/draft` | 要求 `session_ids`、`skill_id` |
| 小组日报生成 | `POST /reports/team/today/generate` | 调 report generator `/reports/team/generate` |
| 部门日报生成 | `POST /reports/department/today/generate` | 调 report generator `/reports/department/generate` |
| 个人周报生成预览 | `POST /reports/weekly/mine/current/generate` | 要求 `source_daily_report_ids` |
| 小组周报生成预览 | `POST /reports/team/weekly/current/generate` | 要求 `source_personal_weekly_report_ids` |
| 部门周报生成 | `POST /reports/department/weekly/current/generate` | 调 report generator `/reports/department/weekly/generate` |

这些接口不是新 Agent 自取数口径。它们仍由页面或接口调用方传来源参数，或由旧 report generator 直接生成。

### 3.7 定时任务能力

已有 `managed_agent_schedules` 表和定时 runner：

1. `ManagedAgentScheduleRunner` 每分钟扫描 enabled schedule。
2. 支持 `daily`、`weekly`。
3. 到期后调用外部 Managed Agent `/api/task/submit`。
4. 写入本地 `ai_runs`，`business_type = scheduled_agent_run`。
5. 更新 `last_run_at`、`last_ai_run_id`。

已有 `ManagedAgentRunStatusSyncer`：

1. 每分钟扫描未完成 `ai_runs`。
2. 调外部 `/api/task/{taskID}/status`。
3. 更新本地 `ai_runs.status/output_ref_json/error_message/finished_at`。
4. 超过 1 小时标记 `timeout`。

当前定时任务是通用 Agent 定时任务，不是 Report Action 定时任务；不会自动知道日报/周报类型，也不会自动回写报告。

## 4. 当前链路是否打通

| 链路段 | 判断 | 说明 |
| --- | --- | --- |
| 前端触发生成 | 部分支持 | `/ai-assets` 可手动运行 Agent；日报页有旧 `startManagedReportRun` client，但当前报告页新按钮未接入完整 Agent 自取数闭环。 |
| 找到用户配置的 Agent | 不支持 | 当前没有“日报/周报默认 Agent 选择规则”，也没有 Report Action 到 Agent 的绑定表或配置。 |
| 创建 Agent Run | 部分支持 | 通用 `POST /ai-assets/agents/{agentId}/runs` 可创建手动 run；个人日报还有 `POST /reports/today/managed-agent-runs`，但要求 `agent_id` 和 `session_ids`。 |
| Agent 调 MCP | 部分支持 | Aida 提供 `/mcp/daily-report`，但是否被外部 Agent 自动调用依赖 Agent 配置和 MCP binding；代码没有 Report Action 级自动绑定。 |
| MCP 读取报告上下文 | 部分支持 | 仅个人日报上下文；默认可按日期取当前用户 session，也可手动传 `session_ids`。不支持小组/部门/周报上下文。 |
| Agent 生成内容 | 部分支持 | 外部 Managed Agent 可运行；Aida 只能记录 task 和读取结果，生成质量和调用 MCP 取决于 Agent 平台配置。 |
| MCP 回写报告 | 部分支持 | 仅 `aida_daily_report_save_draft` 可回写个人日报到 `daily_reports`。不支持小组/部门/周报。 |
| 前端查询生成结果 | 部分支持 | 可查 `ai_runs` 和报告读取接口；但没有统一轮询 Report Action 状态后刷新六类报告的前端闭环。 |

## 5. Daily Report MCP tools

### 5.1 `aida_daily_report_get_context`

输入参数：

| 参数 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| `report_date` | string | 否 | `YYYY-MM-DD`，默认今天 |
| `session_ids` | string[] | 否 | 指定 session；为空时按当前用户和日期自动读取 |
| `include_task_progress` | boolean | 否 | 默认 true，是否读取当前用户未完成任务 |

输出字段：

| 字段 | 说明 |
| --- | --- |
| `user.id` | 当前鉴权用户 ID |
| `user.name` | 当前鉴权用户名 |
| `user.role` | 当前鉴权用户角色 |
| `report_date` | 报告日期 |
| `selected_session_ids` | 本次上下文使用的 session IDs |
| `sessions` | session 摘要、模型、任务/需求关联、token 等 |
| `task_candidates` | 当前用户 todo / in_progress 任务 |
| `output_contract` | 日报输出约束 |

作用：

读取当前用户个人日报生成上下文。

是否适合新日报/周报方案：

部分适合。它已经具备“Agent 自取数”的雏形：当 `session_ids` 为空时，tool 会按当前用户和日期读取 session。但它只支持个人日报，且上下文仍围绕 session 和 task candidate。

是否依赖旧 Skill / 来源选择：

不直接依赖 Skill 上传，但仍保留 `session_ids` 参数。新方案下可以保留为空自动取数能力，避免页面传来源；不应把页面来源选择重新接回来。

### 5.2 `aida_daily_report_save_draft`

输入参数：

| 参数 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| `report_date` | string | 否 | 默认今天 |
| `report_markdown` | string | 是 | 生成的日报正文 |
| `selected_session_ids` | string[] | 否 | 保存到 `daily_reports.session_ids` |
| `session_ids` | string[] | 否 | `selected_session_ids` 为空时兼容使用 |
| `external_task_id` | string | 否 | 外部 Managed Agent task id |
| `agent_id` | string | 否 | Agent ID |
| `model_id` | string | 否 | 模型 ID |

输出字段：

| 字段 | 说明 |
| --- | --- |
| `status` | 固定 `saved` |
| `report_id` | 写入的 `daily_reports.id` |
| `report_date` | 报告日期 |
| `managed_agent_run_id` | 如传入 task 和 agent，会创建对应 `ai_runs` 并返回 id |
| `selected_session_count` | 保存的 session 数量 |

作用：

把 Agent 生成的个人日报正文写回 `daily_reports`。如果同时传 `external_task_id` 和 `agent_id`，会创建一条 succeeded 的 `ai_runs` 并关联到 `daily_reports.managed_agent_run_id`。

是否适合新日报/周报方案：

只适合个人日报的早期闭环验证。它不能回写小组日报、部门日报或任何周报，也没有新状态模型。

是否依赖旧 Skill / 来源选择：

不依赖 Skill，但仍保存 session 来源数组。

## 6. 当前回写报告能力

### 6.1 MCP 回写

当前只有一个 MCP 回写 tool：

```text
aida_daily_report_save_draft
```

回写范围：

1. 只写个人日报 `daily_reports`。
2. 不支持 `team_reports`。
3. 不支持 `department_reports`。
4. 不支持 `personal_weekly_reports`。
5. 不支持 `team_weekly_reports`。
6. 不支持 `department_weekly_reports`。

落库字段：

1. `daily_reports.content`
2. `daily_reports.edited = false`
3. `daily_reports.session_ids`
4. `daily_reports.generation_mode = 'managed_agent'`
5. `daily_reports.managed_agent_run_id`
6. `daily_reports.agent_id`
7. `daily_reports.model_id`
8. `daily_reports.updated_at`

如传入 `external_task_id + agent_id`，还会写入 `ai_runs`：

1. `business_type = daily_report`
2. `runtime_type = managed_task`
3. `status = succeeded`
4. `input_ref_json`
5. `output_ref_json`
6. `business_id = report_id`

### 6.2 是否影响现有保存 / 编辑逻辑

会影响同一用户同一天个人日报内容，因为 `ON CONFLICT (user_id, report_date) DO UPDATE` 会覆盖 `content`，并将 `edited` 设为 false。

现有 `PUT /reports/{id}` 保存逻辑会把 `edited = true`、`status = 'saved'`。因此 MCP 回写后用户再编辑，可以通过现有保存接口进入“人工修改”语义。但当前没有统一 `AI 已生成 / 已修改 / 已确认` 产品状态字段。

## 7. 当前权限与身份

### 7.1 Agent / MCP 当前用户识别

所有 `/api/v1` 路由，包括 `/api/v1/mcp/daily-report`，都在 `AuthMiddleware` 下：

1. 从 `Authorization: Bearer <token>` 解析 AIHub uid。
2. 通过本地 `users` 表加载 Aida 用户。
3. 检查 `local_enabled`。
4. 将 `model.User` 注入 request context。

MCP tool 通过 `getUser(r)` 只能看到当前鉴权用户，不会自动拥有被汇总用户身份。

### 7.2 角色模型

当前用户模型是单角色字段：

1. `app_role`
2. `role`

不是多角色集合。前端路由也通过 `user.role` 判断。

### 7.3 PM 场景

当前代码中部分 Report handler 仍把 `pm` 和 `team_leader` 放在同一分支：

1. `List`：`team_leader || pm`，如果 PM 无 `team_id` 则只看本人。
2. `GenerateTeamReport` / `SaveTeamReportToday` / `SubmitTeamReport`：允许 `pm`，但要求 `TeamID != nil`。
3. `ListTeamReports` / `ListTeamWeeklyReports`：`pm` 如无 team 返回空。
4. `resolveWeeklyTeamID`：`pm` 如无 team 返回 `no team specified`。

这与“PM 是独立个人用户，不属于 TL 小组”方向部分一致，但代码仍存在 PM 可被当成 TL 使用的分支。后续接入 Agent/MCP 时需要避免让 PM 进入小组汇总链路。

### 7.4 TL / Director 范围

TL 相关接口主要依赖 `u.TeamID` 限制小组范围。Director / Admin 在部分小组来源接口可传 `team_id` 查看指定小组。

部门接口目前基本对 `director/admin` 开放，没有按 Director 所属部门细分；当前系统也没有多部门模型。

## 8. `/ai-assets` 服务异常原因

### 8.1 前端会请求哪些接口

进入 `/ai-assets` 页面后会立即请求：

1. `GET /api/v1/ai-assets/skills?scope=mine`
2. `GET /api/v1/ai-assets/mcp?scope=mine`
3. `GET /api/v1/ai-assets/agents`
4. `GET /api/v1/ai-assets/agent-runs?page_size=50`
5. `GET /api/v1/ai-assets/agent-schedules`

打开“日报 MCP/Skill”弹窗时请求：

```text
GET /api/v1/ai-assets/daily-report-integration
```

### 8.2 后端是否有对应路由

有。`api/main.go` 已注册全部对应路由。

### 8.3 是否是权限问题

不优先判断为权限问题。

原因：

1. `/ai-assets` 前端路由允许所有主要业务角色访问。
2. 后端 `/ai-assets/*` 只要求登录，没有额外角色限制。
3. 如果是 403，前端会显示“暂无访问权限”并跳转 `/403`，不是多次“服务异常，请稍后重试”。

### 8.4 是否是数据为空导致

不是。列表为空时后端应返回空数组，前端 Table 展示空态，不会触发 5xx toast。

### 8.5 是否是服务未启动或接口未实现

接口已实现，但依赖外部 Managed Agent 平台配置。

`ManagedAgentHandler.ensureConfigured` 要求：

1. `MANAGED_AGENT_URL` 非空。
2. `MANAGED_AGENT_TOKEN` 非空。

当前 `api/config/config.go` 支持这两个环境变量，但 `docker-compose.yml` 的 `api.environment` 没有配置 `MANAGED_AGENT_URL` 和 `MANAGED_AGENT_TOKEN`。因此在 docker compose 默认环境下，以下接口会返回 503：

1. `GET /ai-assets/skills`
2. `GET /ai-assets/mcp`
3. `POST /ai-assets/mcp`
4. `GET /ai-assets/agents`
5. `POST /ai-assets/agents`
6. `PUT /ai-assets/agents/{agentId}`
7. `POST /ai-assets/agents/{agentId}/runs`
8. `GET /ai-assets/agent-runs/{runId}` 在刷新外部结果时也依赖配置
9. `POST /ai-assets/agent-schedules/{scheduleId}/runs`

前端 `httpClient` 对 5xx 统一显示：

```text
服务异常，请稍后重试
```

所以当前页面多次 toast 的最可能原因是页面首屏并发请求多个 Managed Agent 代理接口，这些接口因外部平台未配置返回 503。

### 8.6 是否影响后续日报/周报 Agent 配置

影响。没有 Managed Agent 平台配置时：

1. 无法列出可用 Agent。
2. 无法创建 Agent / MCP entry。
3. 无法创建外部 task。
4. 通用定时任务无法真正提交 Agent run。

但 `GET /ai-assets/daily-report-integration` 不调用外部平台，理论上仍可返回 Aida MCP URL 和 Skill Markdown。

## 9. 当前最大缺口

1. 缺统一 Report Action 层：页面不应直接调用 Managed Agent 平台或旧来源生成接口。
2. 缺六类报告的 Report MCP tools：目前只有个人日报 MCP。
3. 缺周报 MCP：个人周报、小组周报、部门周报没有 MCP 取数 / 回写。
4. 缺小组 / 部门汇总取数 tool：Agent 不能通过 MCP 获取成员、小组、部门汇总上下文。
5. 缺 PM 独立个人来源：当前部门日报 / 部门周报来源只看小组报告，不包含 PM 独立个人报告。
6. 缺 Agent 默认选择规则：没有按报告类型、角色、周期找到默认 Agent 的配置。
7. 缺 Agent 回写协议：只有个人日报 `report_markdown` 回写，不覆盖六类报告、不覆盖状态。
8. 缺完整 `AI 已生成` 状态：`daily_reports` 有 `generation_mode`，但产品状态仍未统一。
9. 缺确认 / 修改可信度状态：当前主要是 `saved/submitted/edited/archived`，没有可信度分布模型。
10. 缺定时生成任务绑定：现有 schedule 是通用 Agent 定时任务，不知道对应报告类型，也不自动回写。
11. 缺外部 Managed Agent 配置兜底：`/ai-assets` 在未配置平台时首屏会多接口失败。
12. 缺 MCP 鉴权策略细化：Agent 调 MCP 需要持有用户 token；系统级定时任务如何代表用户调用 MCP 还未定义。
13. 缺小组 / 部门周报运行记录字段：只有 `daily_reports` 有 Managed Agent 字段，周报和汇总表未见同等字段。

## 10. 建议的下一步开发切分

### 阶段 A：先修 AI Assets 基础可用性

目标：

让 `/ai-assets` 在 Managed Agent 未配置时可明确展示“平台未配置”，避免多次通用 5xx toast；在已配置时能正常列出 Skill/MCP/Agent/定时任务。

涉及文件：

1. `api/config/config.go`
2. `docker-compose.yml`
3. `api/handler/managed_agent.go`
4. `web/src/features/aidashboard/ai-assets/pages/AIAssetsPage.tsx`
5. `web/src/features/aidashboard/api/client.ts`

是否需要后端：需要。

是否需要前端：需要。

是否需要数据库：不需要。

风险：

1. 外部 Managed Agent 平台接口字段可能与本地 DTO 不完全一致。
2. 未配置状态需要与真实 5xx 区分，否则仍会误导用户。

### 阶段 B：补 Report MCP 取数 tools

目标：

先提供只读 MCP tools，让 Agent 可以自己读取六类报告所需上下文，前端不再传来源。

建议新增能力：

1. 个人日报上下文：沿用并收敛 `aida_daily_report_get_context`。
2. 小组日报上下文：读取 TL 小组成员可用个人日报。
3. 部门日报上下文：读取小组日报和 PM 独立个人日报。
4. 个人周报上下文：读取本人本周可用日报。
5. 小组周报上下文：读取 TL 本人和成员个人周报。
6. 部门周报上下文：读取小组周报和 PM 独立个人周报。

涉及文件：

1. `api/handler/daily_report_mcp.go` 或新增 `api/handler/report_mcp.go`
2. `api/handler/report.go` 中可复用的查询逻辑
3. `api/model/models.go`

是否需要后端：需要。

是否需要前端：不需要。

是否需要数据库：不一定，取决于是否先复用现有字段。

风险：

1. 当前状态模型不足以判断 `AI 已生成 / 已确认 / 已修改 / 手写`。
2. PM 独立来源需要明确查询规则。
3. Director 的部门范围当前不是细粒度部门模型。

### 阶段 C：补 Report MCP 回写 tools

目标：

让 Agent 通过 MCP 将生成结果写回 Aida 报告事实源。

建议按六类报告拆分或使用统一 tool + `report_type`：

1. 回写个人日报。
2. 回写小组日报。
3. 回写部门日报。
4. 回写个人周报。
5. 回写小组周报。
6. 回写部门周报。

涉及文件：

1. `api/handler/daily_report_mcp.go` 或新增 `api/handler/report_mcp.go`
2. `api/handler/report.go`
3. `api/model/models.go`
4. 可能涉及迁移文件

是否需要后端：需要。

是否需要前端：不需要。

是否需要数据库：可能需要。当前只有 `daily_reports` 有 `generation_mode/managed_agent_run_id/agent_id/model_id`，其他报告表缺少等价字段。

风险：

1. 直接覆盖用户已编辑内容需要二次确认或版本保护。
2. 回写 tool 需要保证权限边界，避免 Agent 写入越权报告。
3. 输出协议需要稳定，否则页面无法可靠展示状态。

### 阶段 D：Managed Agent 接入日报/周报页面

目标：

前端“智能生成 / 重新生成”不再调用旧来源型生成接口，而是调用后端 Report Action / Run 接口。

涉及文件：

1. `web/src/features/aidashboard/reports/components/DailyReportGenerateModal.tsx`
2. `web/src/features/aidashboard/reports/pages/ReportsPage.tsx`
3. `web/src/features/aidashboard/reports/pages/WeeklyReportsPage.tsx`
4. `web/src/features/aidashboard/api/client.ts`
5. `api/handler/managed_agent.go` 或新增 Report Action handler
6. `api/main.go`

是否需要后端：需要。

是否需要前端：需要。

是否需要数据库：可能需要。

风险：

1. 没有默认 Agent 选择规则时，前端无法知道该调用哪个 Agent。
2. Agent run 与报告事实源之间需要明确轮询和刷新策略。
3. 不能把旧 `session_ids` / 来源选择接口包装成新 Agent 自取数接口。

### 阶段 E：定时自动生成

目标：

将定时任务从“通用 Agent schedule”升级为“报告生成 schedule”，按报告类型、角色、周期触发。

涉及文件：

1. `api/service/managed_agent_scheduler.go`
2. `api/service/managed_agent_run_status_syncer.go`
3. `api/handler/managed_agent.go`
4. 可能新增 Report Action schedule 配置

是否需要后端：需要。

是否需要前端：可能需要配置页或只后台配置。

是否需要数据库：可能需要。现有 `managed_agent_schedules` 不含 `report_type/report_scope/action_key`。

风险：

1. 定时任务需要明确以哪个用户身份运行 MCP。
2. 失败重试、超时、重复生成覆盖策略必须明确。
3. PM / TL / Director 的触发范围不同。

### 阶段 F：状态模型和可信度模型

目标：

补齐产品所需状态和汇总可信度分布。

建议输出字段：

1. `product_status`
2. `generation_mode`
3. `trust_level`
4. `usable_for_rollup`
5. `source_summary`
6. `last_ai_run`

涉及文件：

1. `api/model/models.go`
2. `api/handler/report.go`
3. 各报告表迁移
4. 前端报告页面状态展示组件

是否需要后端：需要。

是否需要前端：需要。

是否需要数据库：需要或至少需要计算层过渡。

风险：

1. 当前 `saved/submitted/edited/archived` 与新状态不是一一对应。
2. 确认状态不能做前端假状态，必须真实落库。
3. 汇总报告不能等待确认，但需要展示可信度差异。

## 11. 本次不涉及

本次只是现状盘点，没有实施以下事项：

1. 没有修改业务代码。
2. 没有修改接口。
3. 没有修改数据库。
4. 没有新增迁移。
5. 没有新增 MCP tool。
6. 没有改前端页面。
7. 没有接入日报/周报智能生成按钮。
8. 没有修复 `/ai-assets`。
9. 没有把旧 `session_ids` 来源选择接口包装成新 Agent 自取数接口。
