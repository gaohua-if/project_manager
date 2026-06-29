# 日报周报 Agent 方案

版本：v0.1  
状态：现状梳理与接入方案草案  
范围：基于 `Managed Agent平台接入需求文档.md`、当前已 merge 的部分 Managed Agent 代码、当前日报/周报实现现状整理。本文不定义新的产品交互细节，未确认的交互统一标记为待产品确认。

---

## 1. 背景

当前 Aida 已经具备日报、周报的生成、手写、保存、提交、查看能力。近期 `managed-agent-actions` 分支已部分合入当前 branch，提供了一批 Managed Agent 底座代码，包括外部 Agent 平台 client、AI 资产页、运行记录、日报 MCP、定时任务和运行状态同步。

完整 Managed Agent 代码仍未全部合入，且同事仍在测试。因此当前阶段不适合直接把日报/周报主流程替换为 Agent 生成。更合理的处理方式是：

1. 先明确当前日报/周报现状。
2. 明确已经合入的 Agent 能力边界。
3. 明确哪些能力可复用，哪些能力仍缺失。
4. 为后续“日报/周报生成迁移到 Agent 为主”提供技术接入方案。

本文不负责重写 `Managed Agent平台接入需求文档.md`，该文档仍作为外部平台接入参考。

---

## 2. 当前日报现状

### 2.1 页面入口

日报入口在 `web/src/features/aidashboard/reports/pages/ReportsPage.tsx`。

当前日报页按角色展示不同 tab：

| 角色 | 可见日报范围 |
| --- | --- |
| 员工 | 我的日报 |
| TL / PM | 我的日报、小组日报 |
| 总监 / Admin | 我的日报、部门日报 |

日报生成和编辑通过 `DailyReportGenerateModal` 统一弹窗承载。

### 2.2 个人日报

当前个人日报具备以下能力：

1. 按日期加载本人 session。
2. 默认选中当天所有本人 session。
3. 支持上传本次使用的 `skill.md` 作为补充约束。
4. 点击“生成日报”后调用当前默认日报生成链路。
5. 无 session 时可直接进入手写。
6. 生成结果进入 Markdown 编辑区。
7. 可保存日报。
8. 员工可保存并发送给 TL。
9. TL / PM 可保存并发送给总监。
10. 总监角色个人日报只保存，不走发送给上级。

关键前端接口：

| 能力 | 前端方法 |
| --- | --- |
| 拉取日报列表 | `fetchMyReports` |
| 拉取日报详情 | `fetchReport` |
| 获取/创建今日日报 | `fetchTodayReport` |
| 生成日报草稿 | `generateTodayReportDraft` |
| 保存日报 | `saveReport` |
| 提交日报 | `submitReport` |

关键后端接口：

| 能力 | 路由 | Handler |
| --- | --- | --- |
| 获取今日日报 | `GET /reports/today` | `GetOrCreateToday` |
| 生成日报草稿 | `POST /reports/today/draft` | `GenerateTodayDraft` |
| 旧生成接口 | `POST /reports/today/generate` | `GenerateToday` |
| 保存日报 | `PUT /reports/{id}` | `Update` |
| 提交日报 | `POST /reports/{id}/submit` | `SubmitReport` |

### 2.3 小组日报

小组日报由 TL / PM 使用，当前能力：

1. 查看成员日报来源。
2. 展示已发送、未发送成员情况。
3. 支持手写小组日报。
4. 当存在已发送成员日报时，可基于成员日报生成小组日报。
5. 生成结果进入编辑区。
6. 可保存小组日报。
7. 可保存并发送给总监。
8. 查看详情时展示小组日报正文和来源成员日报。

关键前端接口：

| 能力 | 前端方法 |
| --- | --- |
| 拉取来源 | `fetchTeamReportSources` |
| 拉取当天小组日报 | `fetchTeamReportTodayOrNull` |
| 生成小组日报 | `generateTeamReport` |
| 保存当天小组日报 | `saveTeamReportCurrent` |
| 更新小组日报 | `updateTeamReport` |
| 提交小组日报 | `submitTeamReport` |

关键后端接口：

| 能力 | 路由 | Handler |
| --- | --- | --- |
| 来源成员日报 | `GET /reports/team/sources` | `GetTeamReportSources` |
| 当前小组日报 | `GET /reports/team/today` | `GetTeamReportToday` |
| 生成小组日报 | `POST /reports/team/today/generate` | `GenerateTeamReport` |
| 保存小组日报 | `PUT /reports/team/today` | `SaveTeamReportToday` |
| 提交小组日报 | `POST /reports/team/{id}/submit` | `SubmitTeamReport` |

### 2.4 部门日报

部门日报由总监 / Admin 使用，当前能力：

1. 查看来源小组日报。
2. 展示已发送、未发送小组情况。
3. 支持手写部门日报。
4. 当存在已发送小组日报时，可基于小组日报生成部门日报。
5. 生成结果进入编辑区。
6. 可保存部门日报。
7. 当前产品语义中部门日报主要用于保存、查看和复制发送，不强调平台内继续向上提交。
8. 查看详情时展示部门日报正文和来源小组日报。

关键前端接口：

| 能力 | 前端方法 |
| --- | --- |
| 拉取来源 | `fetchDepartmentReportSources` |
| 拉取当天部门日报 | `fetchDepartmentReportTodayOrNull` |
| 生成部门日报 | `generateDepartmentReport` |
| 保存当天部门日报 | `saveDepartmentReportCurrent` |
| 更新部门日报 | `updateDepartmentReport` |

关键后端接口：

| 能力 | 路由 | Handler |
| --- | --- | --- |
| 来源小组日报 | `GET /reports/department/sources` | `GetDepartmentReportSources` |
| 当前部门日报 | `GET /reports/department/today` | `GetDepartmentReportToday` |
| 生成部门日报 | `POST /reports/department/today/generate` | `GenerateDepartmentReport` |
| 保存部门日报 | `PUT /reports/department/today` | `SaveDepartmentReportToday` |

---

## 3. 当前周报现状

### 3.1 页面入口

周报入口在 `web/src/features/aidashboard/reports/pages/WeeklyReportsPage.tsx`。

周报同样按角色区分：

| 角色 | 可见周报范围 |
| --- | --- |
| 员工 | 我的周报 |
| TL / PM | 我的周报、小组周报 |
| 总监 / Admin | 我的周报、部门周报 |

### 3.2 个人周报

当前个人周报能力：

1. 按周选择周期。
2. 拉取本周个人日报作为来源。
3. 支持手写周报。
4. 可选择来源日报生成个人周报预览。
5. 生成结果进入编辑区。
6. 可保存个人周报。
7. 可提交个人周报。
8. 详情以弹窗或详情视图展示 Markdown 正文和来源日报。

关键前端接口：

| 能力 | 前端方法 |
| --- | --- |
| 拉取当前个人周报 | `fetchPersonalWeeklyReportCurrentOrNull` |
| 拉取来源日报 | `fetchPersonalWeeklyReportSources` |
| 生成个人周报预览 | `generatePersonalWeeklyReport` |
| 保存个人周报 | `savePersonalWeeklyReport` |
| 提交个人周报 | `submitPersonalWeeklyReport` |

关键后端接口：

| 能力 | 路由 | Handler |
| --- | --- | --- |
| 当前个人周报 | `GET /reports/weekly/mine/current` | `GetPersonalWeeklyReportCurrent` |
| 来源日报 | `GET /reports/weekly/mine/sources` | `GetPersonalWeeklyReportSources` |
| 生成预览 | `POST /reports/weekly/mine/current/generate` | `GeneratePersonalWeeklyReportPreview` |
| 保存 | `PUT /reports/weekly/mine/current` | `SavePersonalWeeklyReportCurrent` |
| 提交 | `POST /reports/weekly/mine/current/submit` | `SubmitPersonalWeeklyReportCurrent` |

### 3.3 小组周报

当前小组周报能力：

1. TL / PM 查看成员个人周报来源。
2. 支持手写小组周报。
3. 支持基于已提交个人周报生成小组周报预览。
4. 可保存小组周报。
5. 可提交小组周报给总监。
6. 详情展示小组周报正文和来源个人周报。

关键后端接口：

| 能力 | 路由 | Handler |
| --- | --- | --- |
| 当前小组周报 | `GET /reports/team/weekly/current` | `GetTeamWeeklyReportCurrent` |
| 来源个人周报 | `GET /reports/team/weekly/sources` | `GetTeamWeeklyReportSources` |
| 生成小组周报 | `POST /reports/team/weekly/current/generate` | `GenerateTeamWeeklyReport` |
| 保存小组周报 | `PUT /reports/team/weekly/current` | `SaveTeamWeeklyReportCurrent` |
| 提交小组周报 | `POST /reports/team/weekly/current/submit` | `SubmitTeamWeeklyReportCurrent` |

### 3.4 部门周报

当前部门周报能力：

1. 总监 / Admin 查看来源小组周报。
2. 支持手写部门周报。
3. 支持基于已提交小组周报生成部门周报。
4. 可保存部门周报。
5. 详情展示部门周报正文和来源小组周报。

关键后端接口：

| 能力 | 路由 | Handler |
| --- | --- | --- |
| 当前部门周报 | `GET /reports/department/weekly/current` | `GetDepartmentWeeklyReportCurrent` |
| 来源小组周报 | `GET /reports/department/weekly/sources` | `GetDepartmentWeeklyReportSources` |
| 生成部门周报 | `POST /reports/department/weekly/current/generate` | `GenerateDepartmentWeeklyReport` |
| 保存部门周报 | `PUT /reports/department/weekly/current` | `SaveDepartmentWeeklyReportCurrent` |

---

## 4. 当前已合入的 Managed Agent 能力

当前 branch 已经合入部分 Managed Agent 底座，不代表完整产品能力已经完成。

### 4.1 外部平台配置

后端配置新增：

| 配置 | 说明 |
| --- | --- |
| `MANAGED_AGENT_URL` | Managed Agent 平台地址 |
| `MANAGED_AGENT_TOKEN` | Aida 服务端调用 Managed Agent 平台使用的 token |

配置集中在 `api/config/config.go`，前端不接触平台 token。

### 4.2 Managed Agent Client

`api/service/managed_agent.go` 封装了外部平台调用：

| 能力 | 外部接口 |
| --- | --- |
| Skill 列表 | `GET /api/skill/list?scope=` |
| MCP 列表 | `GET /api/mcp/list?scope=` |
| 创建 MCP | `POST /api/mcp` |
| 我的 Agent 列表 | `GET /api/my/agents` |
| 创建个人 Agent | `POST /api/my/agents` |
| 更新个人 Agent | `PUT /api/my/agents/{agentId}` |
| 提交 Task | `POST /api/task/submit` |
| 查询 Task 状态 | `GET /api/task/{taskId}/status` |
| 查询 Task 结果 | `GET /api/task/{taskId}/result` |

当前只封装了 Task 模式和资产管理的一部分接口，Session 模式、凭据、文件上传、Skill 上传等完整能力尚未接入。

### 4.3 AI 资产页面

前端新增 `/ai-assets` 页面，位置在 `web/src/features/aidashboard/ai-assets/pages/AIAssetsPage.tsx`。

页面当前能力：

1. 查看 Skill 列表。
2. 查看 MCP 列表。
3. 创建 MCP entry。
4. 查看个人 Agent 列表。
5. 创建/更新个人 Agent。
6. 手动触发 Agent Run。
7. 查看 Agent Run 记录。
8. 查看/创建/更新/删除 Agent Schedule。
9. 复制 Daily Report MCP / Skill 接入信息。

该页面属于独立 AI 资产管理入口，当前没有嵌入日报/周报生成主流程。

### 4.4 运行记录

新增 `ai_runs` 运行记录模型，用于保存外部 Agent task/session 与 Aida 业务对象之间的关系。

主要字段：

| 字段 | 说明 |
| --- | --- |
| `business_type` | 业务类型，例如 `daily_report`、`manual_agent_run`、`scheduled_agent_run` |
| `business_id` | 关联 Aida 业务对象 ID |
| `runtime_type` | 当前主要为 `managed_task` |
| `agent_id` | 外部 Agent ID |
| `agent_version_id` | 外部 Agent 版本 |
| `external_task_id` | Managed Agent 平台 task ID |
| `model_id` | 使用模型 |
| `status` | `pending`、`running`、`succeeded`、`failed`、`timeout` |
| `input_ref_json` | 输入引用，不保存完整业务大对象 |
| `output_ref_json` | 输出引用和结果摘要 |
| `error_message` | 错误信息 |

### 4.5 状态同步

`api/service/managed_agent_run_status_syncer.go` 提供后台同步：

1. 定时扫描未结束的 `ai_runs`。
2. 调用外部 `GET /api/task/{taskId}/status`。
3. 更新本地 `ai_runs.status`。
4. 超过 1 小时未完成标记为 `timeout`。

### 4.6 Agent Schedule

`api/service/managed_agent_scheduler.go` 和 `managed_agent_schedules` 支持定时任务：

1. 创建 daily / weekly schedule。
2. 按 `time_of_day`、`timezone`、`weekdays` 判断是否到期。
3. 到期后调用 Managed Agent Task。
4. 写入 `ai_runs`。
5. 更新 `last_run_at` 和 `last_ai_run_id`。

当前 schedule 是通用 Agent 调度，不是日报/周报业务调度。

### 4.7 Daily Report MCP

`api/handler/daily_report_mcp.go` 提供 MCP endpoint：

| Tool | 说明 |
| --- | --- |
| `aida_daily_report_get_context` | 读取当前用户日报生成上下文 |
| `aida_daily_report_save_draft` | 保存 Agent 生成的日报草稿 |

MCP 工具可以读取：

1. 当前用户信息。
2. 报告日期。
3. session 列表。
4. session 摘要、时间、模型、token、关联任务和需求。
5. 任务候选。
6. 输出协议。

`save_draft` 当前可以写入 `daily_reports`，并记录 `generation_mode = managed_agent`、`managed_agent_run_id`、`agent_id`、`model_id`。

注意：这是独立 MCP 写入能力，不等于现有日报页面已经迁移到 Agent 生成。

### 4.8 独立日报 Agent Run 接口

当前已新增：

| 能力 | 路由 |
| --- | --- |
| 发起日报 Agent Run | `POST /reports/today/managed-agent-runs` |
| 查询日报 Agent Run | `GET /reports/managed-agent-runs/{runId}` |

发起逻辑：

1. 校验用户可访问的 session。
2. 将 session log URL 作为 Agent 输入。
3. 默认模型为 `Kimi-K2.6`。
4. 提交外部 Managed Agent Task。
5. 写入 `ai_runs`，`business_type = daily_report`。
6. 查询结果时解析外部结果为 `GenerateReportDraftResponse`。

当前该接口未接入日报弹窗的“生成日报”按钮。

---

## 5. 当前未完成或未接入的能力

### 5.1 Managed Agent 平台能力缺口

参考 `Managed Agent平台接入需求文档.md`，当前代码未完整覆盖：

1. Skill 注册、派生版本、文件列表、读取文件、下载 artifact。
2. MCP 删除、归档、恢复。
3. Agent 归档、恢复。
4. Credential 保存、列表、删除、凭据槽绑定。
5. File 上传。
6. Session 模式创建、事件流、追问、打断、结束。
7. Task 取消、事件流、反馈、指标反馈。
8. 成本、token、耗时等外部运行指标同步。

### 5.2 日报接入缺口

当前日报主流程仍走原有生成接口，未完成：

1. 日报弹窗选择 Agent。
2. 日报弹窗发起 `managed-agent-runs`。
3. 日报弹窗轮询 `ai_runs`。
4. Agent 结果进入当前编辑区。
5. Agent 失败后的错误展示和回退策略。
6. Agent 生成来源在日报详情页展示。
7. Agent 生成结果中的任务建议确认流程。
8. Agent 生成与默认生成器之间的统一状态模型。

### 5.3 周报接入缺口

当前没有周报专用 Managed Agent 接口，未完成：

1. 个人周报 Agent Run。
2. 小组周报 Agent Run。
3. 部门周报 Agent Run。
4. 周报 MCP 或上下文接口。
5. 周报输出协议。
6. 周报来源数据与 `ai_runs` 的关联。
7. 周报详情页展示 Agent 来源。

### 5.4 产品交互缺口

以下内容不在当前代码和本文中直接定义，需要产品确认：

1. 日报/周报页面是否展示“默认生成”和“Agent 生成”的选择。
2. Agent 选择入口是否出现在生成弹窗中。
3. 是否允许用户在生成时选择模型。
4. 是否允许用户在生成时选择凭据。
5. Agent 生成失败时是否保留当前编辑内容。
6. 生成中关闭弹窗后，是否允许稍后恢复状态。
7. AI 资产页对普通员工是否开放全部能力。
8. 默认 Agent 是否由系统预置，还是由用户自行创建。

---

## 6. 接入原则

### 6.1 Aida 仍是业务事实源

需求、任务、session、日报、周报、提交状态、权限判断仍由 Aida 管理。

Managed Agent 只负责生成，不拥有日报/周报业务状态。

### 6.2 Agent 结果不能直接改变业务状态

Agent 输出只能成为草稿或建议。

不应由 Agent 自动执行以下动作：

1. 自动提交日报。
2. 自动提交周报。
3. 自动更新任务状态。
4. 自动更新任务进度。
5. 自动修改需求状态。

所有业务写入必须经过 Aida 现有保存/提交接口，或经过后续明确设计的确认接口。

### 6.3 当前生成链路不能被 merge 阶段替换

当前日报/周报默认生成能力已经存在。Managed Agent 接入时应避免在未完成产品和技术方案前替换默认路径。

应保持：

1. 手写能力不变。
2. 默认生成能力不变。
3. 保存/提交能力不变。
4. 查看详情能力不变。
5. 来源列表能力不变。

### 6.4 Agent 运行必须可追溯

所有通过 Managed Agent 产生的生成结果，都应记录：

1. 触发人。
2. 业务类型。
3. 业务对象。
4. `agent_id`。
5. `agent_version_id`。
6. `model_id`。
7. 外部 `task_id` 或 `session_id`。
8. 输入来源。
9. 输出摘要。
10. 状态和错误。

当前 `ai_runs` 可以承载这部分追溯。

---

## 7. 日报 Agent 化接入方案

本章只描述技术接入方案，不定义具体 UI。

### 7.1 建议接入路径

日报可以先接入个人日报，再扩展小组日报和部门日报。

原因：

1. 个人日报上下文最简单。
2. 权限范围最小。
3. 当前已经有 `daily-report MCP` 和 `managed-agent-runs` 接口。
4. 个人日报当前已有 session 选择、草稿编辑、保存和提交流程。

### 7.2 个人日报 Agent 生成

当前可复用能力：

| 能力 | 现有实现 |
| --- | --- |
| 日期选择 | `DailyReportGenerateModal` 已支持 `reportDate` |
| session 选择 | `DailyReportGenerateModal` 已支持 |
| 草稿编辑 | `DailyReportGenerateModal` 已支持 |
| 保存/提交 | `saveReport` / `submitReport` |
| Agent Run | `POST /reports/today/managed-agent-runs` |
| Run 查询 | `GET /reports/managed-agent-runs/{runId}` |
| Run 记录 | `ai_runs` |
| 输出解析 | `ParseManagedReportDraft` + `NormalizeDraftResponse` |

需要补齐：

1. 前端选择 Agent 的数据来源。
2. 前端发起 Agent Run。
3. 前端轮询 Run 状态。
4. 成功后将 `draft.report_markdown` 写入现有编辑区。
5. 将 `draft.selected_session_ids` 写入现有 session 来源。
6. 保存日报时是否绑定 `managed_agent_run_id` 的方案。
7. 日报详情是否展示生成来源。

当前已经刻意避免把 `managed_agent_run_id` 直接塞进现有 `saveReport` 参数。后续如果需要绑定 Agent Run 和日报保存，建议单独设计保存接口或新增明确字段，而不是隐式侵入现有保存路径。

### 7.3 小组日报 Agent 生成

当前可复用能力：

| 能力 | 现有实现 |
| --- | --- |
| 来源成员日报 | `GetTeamReportSources` |
| 手写小组日报 | 已支持 |
| 默认生成小组日报 | `GenerateTeamReport` |
| 保存小组日报 | `SaveTeamReportToday` / `UpdateTeamReport` |
| 提交小组日报 | `SubmitTeamReport` |

需要补齐：

1. 小组日报 Agent Run 后端接口。
2. 小组日报 Agent 上下文组装。
3. 输出协议。
4. 运行记录 `business_type`，例如 `team_daily_report`。
5. 与 `team_reports` 的关联方式。
6. 权限裁剪：只能读取当前 TL/PM 管理团队数据。
7. 来源成员日报 ID 追溯。

小组日报不建议直接复用个人日报 MCP，因为上下文对象不同：个人日报基于 session，组日报基于已提交成员日报和成员缺失情况。

### 7.4 部门日报 Agent 生成

当前可复用能力：

| 能力 | 现有实现 |
| --- | --- |
| 来源小组日报 | `GetDepartmentReportSources` |
| 手写部门日报 | 已支持 |
| 默认生成部门日报 | `GenerateDepartmentReport` |
| 保存部门日报 | `SaveDepartmentReportToday` / `UpdateDepartmentReport` |

需要补齐：

1. 部门日报 Agent Run 后端接口。
2. 部门日报上下文组装。
3. 输出协议。
4. 运行记录 `business_type`，例如 `department_daily_report`。
5. 与 `department_reports` 的关联方式。
6. 权限裁剪：只能由总监/Admin 读取部门范围数据。
7. 来源小组日报 ID 追溯。

---

## 8. 周报 Agent 化接入方案

当前没有周报 Agent 底座接口，周报需要新增独立能力，不应强行复用个人日报接口。

### 8.1 个人周报 Agent 生成

当前可复用能力：

| 能力 | 现有实现 |
| --- | --- |
| 周期选择 | `WeeklyReportsPage` |
| 来源日报选择 | `fetchPersonalWeeklyReportSources` |
| 手写周报 | 已支持 |
| 默认生成个人周报 | `GeneratePersonalWeeklyReportPreview` |
| 保存/提交个人周报 | `SavePersonalWeeklyReportCurrent` / `SubmitPersonalWeeklyReportCurrent` |

需要新增：

1. `POST /reports/weekly/mine/current/managed-agent-runs`。
2. `GET /reports/weekly/managed-agent-runs/{runId}` 或复用统一 run 查询。
3. 个人周报上下文结构。
4. 周报输出协议。
5. `ai_runs.business_type = personal_weekly_report`。
6. `personal_weekly_reports` 与 `ai_runs` 的关联方式。

### 8.2 小组周报 Agent 生成

当前可复用能力：

| 能力 | 现有实现 |
| --- | --- |
| 来源个人周报 | `GetTeamWeeklyReportSources` |
| 手写小组周报 | 已支持 |
| 默认生成小组周报 | `GenerateTeamWeeklyReport` |
| 保存/提交小组周报 | `SaveTeamWeeklyReportCurrent` / `SubmitTeamWeeklyReportCurrent` |

需要新增：

1. 小组周报 Agent Run 接口。
2. 小组周报上下文结构。
3. `ai_runs.business_type = team_weekly_report`。
4. 来源个人周报 ID 追溯。
5. TL/PM 团队权限裁剪。

### 8.3 部门周报 Agent 生成

当前可复用能力：

| 能力 | 现有实现 |
| --- | --- |
| 来源小组周报 | `GetDepartmentWeeklyReportSources` |
| 手写部门周报 | 已支持 |
| 默认生成部门周报 | `GenerateDepartmentWeeklyReport` |
| 保存部门周报 | `SaveDepartmentWeeklyReportCurrent` |

需要新增：

1. 部门周报 Agent Run 接口。
2. 部门周报上下文结构。
3. `ai_runs.business_type = department_weekly_report`。
4. 来源小组周报 ID 追溯。
5. 总监/Admin 权限裁剪。

---

## 9. 上下文契约

Agent 生成不应直接接收完整数据库对象。Aida 应组装经过权限裁剪、结构稳定的上下文。

### 9.1 个人日报上下文

建议字段：

| 字段 | 说明 |
| --- | --- |
| `user` | 当前用户 ID、姓名、角色 |
| `report_date` | 日报日期 |
| `selected_session_ids` | 本次选择的 session |
| `sessions` | session 摘要、时间、模型、token、关联任务/需求 |
| `task_candidates` | 可建议进度的任务候选 |
| `output_contract` | 输出 JSON 协议 |

当前 `DailyReportMCPHandler.getDailyReportContext` 已经接近该结构。

### 9.2 小组日报上下文

建议字段：

| 字段 | 说明 |
| --- | --- |
| `team` | 团队 ID、名称 |
| `leader` | TL/PM 用户信息 |
| `report_date` | 日期 |
| `submitted_reports` | 已发送成员日报 |
| `missing_members` | 未发送成员 |
| `team_tasks` | 可选，团队任务风险和进展 |
| `output_contract` | 输出协议 |

### 9.3 部门日报上下文

建议字段：

| 字段 | 说明 |
| --- | --- |
| `report_date` | 日期 |
| `submitted_team_reports` | 已发送小组日报 |
| `missing_teams` | 未发送小组 |
| `department_risks` | 可选，部门范围风险 |
| `output_contract` | 输出协议 |

### 9.4 个人周报上下文

建议字段：

| 字段 | 说明 |
| --- | --- |
| `user` | 当前用户 |
| `week_start` / `week_end` | 周期 |
| `daily_reports` | 选中的个人日报 |
| `source_session_ids` | 可选，来源 session |
| `output_contract` | 输出协议 |

### 9.5 小组周报上下文

建议字段：

| 字段 | 说明 |
| --- | --- |
| `team` | 团队 |
| `week_start` / `week_end` | 周期 |
| `submitted_personal_weekly_reports` | 已提交个人周报 |
| `missing_members` | 未提交成员 |
| `output_contract` | 输出协议 |

### 9.6 部门周报上下文

建议字段：

| 字段 | 说明 |
| --- | --- |
| `week_start` / `week_end` | 周期 |
| `submitted_team_weekly_reports` | 已提交小组周报 |
| `missing_teams` | 未提交小组 |
| `output_contract` | 输出协议 |

---

## 10. 输出协议

输出协议应保持稳定，避免前端和后端依赖自然语言解析。

### 10.1 日报输出

当前 `GenerateReportDraftResponse` 已包括：

| 字段 | 说明 |
| --- | --- |
| `report_markdown` | 日报正文 Markdown |
| `selected_session_ids` | 实际使用的 session |
| `skill_name` | 使用 Skill 名称 |
| `task_progress_suggestions` | 任务进度建议 |
| `managed_agent_run_id` | Agent 运行记录 ID |
| `agent_id` | Agent ID |
| `agent_version_id` | Agent 版本 |
| `model_id` | 模型 |
| `status` | 运行状态 |

日报 Agent 输出至少需要 `report_markdown`。

任务建议必须满足：

1. 只展示，不自动应用。
2. `task_id` 必须属于用户可访问任务。
3. 证据 session 必须来自本次选择 session。
4. 状态和进度仍需走现有任务更新接口和乐观锁规则。

### 10.2 周报输出

当前没有周报 Agent 输出 DTO。后续需要定义与周报保存接口匹配的结构。

建议最小字段：

| 字段 | 说明 |
| --- | --- |
| `report_markdown` | 周报正文 Markdown |
| `source_report_ids` | 实际使用的来源日报/周报 ID |
| `summary_items` | 可选，结构化摘要 |
| `risks` | 可选，风险项 |
| `managed_agent_run_id` | Agent 运行记录 ID |
| `agent_id` | Agent ID |
| `agent_version_id` | Agent 版本 |
| `model_id` | 模型 |

---

## 11. 数据模型影响

### 11.1 已存在的数据模型

当前已存在：

1. `daily_reports.generation_mode`
2. `daily_reports.managed_agent_run_id`
3. `daily_reports.agent_id`
4. `daily_reports.agent_version_id`
5. `daily_reports.model_id`
6. `ai_runs`
7. `managed_agent_schedules`

这些字段已经能记录个人日报 Agent 生成来源。

### 11.2 周报数据缺口

周报表当前未看到对应 Agent 来源字段。后续有两种方向：

1. 在各周报表增加 `generation_mode`、`managed_agent_run_id`、`agent_id`、`agent_version_id`、`model_id`。
2. 不改周报表，只通过 `ai_runs.business_type + business_id` 关联周报。

建议后续优先评估第二种，减少对现有周报表的侵入；如详情页需要高频展示来源，再考虑冗余字段。

### 11.3 保存接口影响

当前日报保存接口已保持原有语义：

```text
PUT /reports/{id}
```

仍只负责保存内容、飞书链接、session 来源等当前业务字段。

后续如果要在保存时报入 `managed_agent_run_id`，不建议隐式扩展现有保存接口。更清晰的做法是：

1. 生成成功时只产生 `ai_runs`。
2. 用户保存时通过明确接口绑定 run 与 report。
3. 或新增专门字段并在产品和后端契约中明确说明。

---

## 12. 后端接入方案

### 12.1 保留现有生成接口

现有接口继续保留：

1. `POST /reports/today/draft`
2. `POST /reports/team/today/generate`
3. `POST /reports/department/today/generate`
4. `POST /reports/weekly/mine/current/generate`
5. `POST /reports/team/weekly/current/generate`
6. `POST /reports/department/weekly/current/generate`

这些接口是当前默认生成器路径，不应在 Agent 方案未完成前被替换。

### 12.2 新增 Agent Run 接口

日报已有个人日报 Agent Run 接口。

周报和汇总日报建议按业务类型补齐独立接口，而不是让前端直接调用通用 `/ai-assets/agents/{agentId}/runs`。

建议接口形态：

| 业务 | 发起接口 | 查询接口 |
| --- | --- | --- |
| 个人日报 | 已有 `POST /reports/today/managed-agent-runs` | 已有 `GET /reports/managed-agent-runs/{runId}` |
| 小组日报 | `POST /reports/team/today/managed-agent-runs` | 可复用统一 run 查询 |
| 部门日报 | `POST /reports/department/today/managed-agent-runs` | 可复用统一 run 查询 |
| 个人周报 | `POST /reports/weekly/mine/current/managed-agent-runs` | 可复用统一 run 查询 |
| 小组周报 | `POST /reports/team/weekly/current/managed-agent-runs` | 可复用统一 run 查询 |
| 部门周报 | `POST /reports/department/weekly/current/managed-agent-runs` | 可复用统一 run 查询 |

### 12.3 上下文构建服务

建议后端新增独立服务层，避免 handler 中堆积上下文拼装逻辑。

建议服务：

```text
ReportAgentContextService
├─ BuildPersonalDailyContext
├─ BuildTeamDailyContext
├─ BuildDepartmentDailyContext
├─ BuildPersonalWeeklyContext
├─ BuildTeamWeeklyContext
└─ BuildDepartmentWeeklyContext
```

这些方法只负责：

1. 权限裁剪。
2. 来源数据加载。
3. 输出稳定结构。
4. 不负责调用 Agent。
5. 不负责写报告。

### 12.4 Agent Run 服务

建议封装：

```text
ReportAgentRunService
├─ StartRun
├─ GetRun
├─ RefreshRun
├─ ParseResult
└─ BindRunToReport
```

职责：

1. 调用 `ManagedAgentClient.SubmitTask`。
2. 写入 `ai_runs`。
3. 查询状态和结果。
4. 解析输出协议。
5. 返回统一 DTO 给前端。

### 12.5 状态模型

后端统一使用 `ai_runs.status`：

| 状态 | 含义 |
| --- | --- |
| `pending` | 已提交，等待外部平台执行 |
| `running` | 外部平台执行中 |
| `succeeded` | 执行成功，结果可解析 |
| `failed` | 执行失败或结果解析失败 |
| `timeout` | 超时 |

---

## 13. 前端接入方案

本章只描述接入点，不定义具体视觉和交互。

### 13.1 日报弹窗接入点

`DailyReportGenerateModal` 当前已经具备：

1. 来源选择区。
2. 生成按钮。
3. 编辑区。
4. 保存/提交按钮。
5. 错误提示。
6. 覆盖确认。

Agent 接入时可复用这些状态：

| 当前状态 | Agent 接入复用方式 |
| --- | --- |
| `draftMarkdown` | 写入 Agent 生成正文 |
| `draftTouched` | 标记 Agent 结果进入编辑态 |
| `draftError` | 展示 Agent 失败原因 |
| `selectedSessionIds` | 作为 Agent 输入来源 |
| `personalDraftSessionIds` | 保存 Agent 实际使用 session |
| `isGenerating` | 包含 Agent run pending 状态 |

需要新增的前端状态：

1. 当前生成方式。
2. 当前选择的 Agent。
3. 当前 `runId`。
4. 当前 run 状态。
5. 当前 run 错误。

具体 UI 位置待产品确认。

### 13.2 周报页面接入点

`WeeklyReportsPage` 当前个人、小组、部门周报都已有：

1. 来源确认。
2. 手写入口。
3. 默认生成入口。
4. 编辑区。
5. 保存/提交。
6. 来源原文查看。

Agent 接入时可复用：

| 当前状态 | Agent 接入复用方式 |
| --- | --- |
| `editorContent` | 写入 Agent 生成周报 |
| 来源选择状态 | 作为 Agent 输入来源 |
| generate mutation | 扩展为默认生成和 Agent 生成两个 mutation |
| save/submit mutation | 保持不变 |

具体 UI 位置待产品确认。

### 13.3 API client

当前已有：

1. `startManagedReportRun`
2. `fetchManagedReportRun`
3. `fetchManagedAgentRuns`
4. `fetchManagedAgentRun`
5. `fetchManagedAgents`

后续需要补齐 report 场景专用 client：

1. `startTeamDailyManagedReportRun`
2. `startDepartmentDailyManagedReportRun`
3. `startPersonalWeeklyManagedReportRun`
4. `startTeamWeeklyManagedReportRun`
5. `startDepartmentWeeklyManagedReportRun`

---

## 14. 权限与安全

### 14.1 权限裁剪

Agent 上下文必须遵守当前 Aida 权限：

| 场景 | 数据范围 |
| --- | --- |
| 个人日报 | 当前用户自己的 session、任务、日报 |
| 小组日报 | 当前 TL/PM 管理团队成员已发送日报 |
| 部门日报 | 总监/Admin 可见的小组日报 |
| 个人周报 | 当前用户自己的日报 |
| 小组周报 | 当前 TL/PM 管理团队成员已提交个人周报 |
| 部门周报 | 总监/Admin 可见的小组周报 |

### 14.2 凭据安全

当前 Aida 不应保存外部平台凭据明文。

后续如果接入凭据：

1. 前端不展示 secret。
2. 后端不落库保存 secret value。
3. 只保存外部 `credential_id` 或凭据槽引用。
4. 错误信息脱敏。

### 14.3 输出安全

Agent 输出不能直接信任。

后端应校验：

1. `report_markdown` 是否为空。
2. `task_id` 是否可访问。
3. `session_id` 是否来自本次输入。
4. 来源报告 ID 是否属于当前业务范围。
5. JSON 解析失败时不能自动保存为正式报告。

---

## 15. 分期建议

### 15.1 当前阶段：底座确认

目标：确认已合入的 Agent 底座不破坏当前日报/周报。

验收点：

1. 不配置 `MANAGED_AGENT_URL` / `MANAGED_AGENT_TOKEN` 时，日报/周报现有功能不受影响。
2. `/ai-assets` 可独立访问。
3. 外部平台配置正确时，可以拉取 Skill/MCP/Agent。
4. 手动 Agent Run 可写入 `ai_runs`。
5. schedule 可创建、更新、删除、手动触发。
6. syncer 可同步运行状态。
7. `daily-report MCP` 可返回工具列表和上下文。

### 15.2 第一阶段：个人日报 Agent 生成

目标：只接个人日报，不碰周报、小组日报、部门日报主流程。

依赖：

1. 完整 Managed Agent 平台接口稳定。
2. 默认日报 Agent 或用户个人 Agent 可用。
3. 输出协议稳定。
4. 产品确认生成方式选择和失败处理。

技术工作：

1. 前端接入 Agent 选择。
2. 调用 `startManagedReportRun`。
3. 轮询 `fetchManagedReportRun`。
4. 成功后写入当前编辑区。
5. 保存/提交仍走现有接口。
6. 明确 run 与 report 的绑定策略。

### 15.3 第二阶段：小组/部门日报 Agent 生成

目标：扩展日报汇总场景。

技术工作：

1. 新增小组日报 Agent 上下文。
2. 新增部门日报 Agent 上下文。
3. 新增对应 run 接口。
4. 使用 `ai_runs` 记录运行。
5. 复用现有保存/提交。

### 15.4 第三阶段：个人周报 Agent 生成

目标：接入个人周报。

技术工作：

1. 新增周报上下文。
2. 新增周报输出 DTO。
3. 新增个人周报 run 接口。
4. 成功后写入周报编辑区。
5. 保存/提交仍走现有接口。

### 15.5 第四阶段：小组/部门周报 Agent 生成

目标：扩展周报汇总场景。

技术工作：

1. 新增小组周报上下文。
2. 新增部门周报上下文。
3. 新增对应 run 接口。
4. 记录来源个人周报/小组周报。
5. 保存仍走现有接口。

---

## 16. 风险与待确认

### 16.1 当前风险

1. 完整 Managed Agent 代码尚未合入，当前能力不是最终形态。
2. 外部平台接口稳定性未验证。
3. 当前只支持部分资产接口和 Task 模式。
4. 日报 MCP 能写 `daily_reports`，但尚未纳入现有日报页面状态管理。
5. 周报完全没有 Agent 专用接口。
6. 当前 `ai_runs` 可记录运行，但各报告表与 run 的绑定策略尚未统一。
7. 登录和用户体系相关代码当前工作区存在大量改动，后续需要确认权限模型是否变化。

### 16.2 待确认问题

1. 默认日报 Agent 是否由平台预置。
2. 用户是否必须先创建个人 Agent 才能使用 Agent 生成。
3. 生成时是否允许选择模型。
4. 生成时是否允许选择凭据。
5. Agent 运行失败是否允许切回默认生成器。
6. 生成中关闭弹窗后是否恢复运行状态。
7. 周报是否允许使用同一个日报 Agent，还是必须区分周报 Agent。
8. 小组/部门汇总类报告是否使用 TL/总监自己的 Agent。
9. Agent 结果是否需要保存原始输出。
10. `params` 长度是否足够承载上下文，是否必须走文件上传。
11. 是否需要把 Agent 运行 token/cost 计入当前 Token 统计。

---

## 17. 当前结论

1. 当前日报/周报已经有完整的手写、默认生成、保存、提交、详情查看流程。
2. 已合入的 Managed Agent 代码是底座能力，不是完整日报/周报 Agent 化实现。
3. 个人日报是当前最接近可接入 Agent 的场景，因为已有独立 run 接口和 daily-report MCP。
4. 小组日报、部门日报、个人周报、小组周报、部门周报都还需要新增业务上下文和 run 接口。
5. Agent 化不应在 merge 阶段替换当前默认生成器。
6. 后续改造应以 `ai_runs` 作为统一运行追溯，以现有保存/提交接口保持业务状态一致。
7. 具体前端交互仍待产品确认，本文不定义最终交互。
