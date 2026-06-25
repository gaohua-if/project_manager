# Dashboard 日报模块接入现状与改造方案

## 1. 结论摘要

当前 Dashboard「今日报告」卡片是半真实状态：

* 已经真实接入：个人今日日报草稿生成 `POST /reports/today/draft`、保存个人日报 `GET /reports/today` + `PUT /reports/{id}`、生成弹窗内的当天 session list、任务建议确认更新。
* 仍是 mock / 原型数据：Dashboard 卡片初始化展示的「我的日报 / 部门报告 / 本周周报」状态、提交覆盖数、发送失败、已发送、周报内容、部门报告内容。
* `/reports` 日报记录页面已经接入真实日报和团队日报接口，但 Dashboard 卡片里的“日报记录 / 部门报告记录”只是跳转入口，本身不读取记录统计。
* 最大风险：`GET /reports/today` 不是纯查询，当前实现会在无今日日报时自动插入一条 `daily_reports`。Dashboard 如果用它做状态初始化，会污染日报记录。
* 下一步最应该先改：先把 Dashboard「我的日报」卡片状态改成只读真实状态，优先通过 `GET /reports?from=YYYY-MM-DD&to=YYYY-MM-DD` 查询当天记录并按当前用户过滤，不要调用 `GET /reports/today` 做状态查询。

## 2. 前端现状

Dashboard 今日报告模块主要在 `web/src/features/aidashboard/dashboard/DashboardPage.tsx`。卡片基础数据来自本地 `ROLE_DATA`，再叠加组件内 `reportStateById` 状态；只有个人日报生成弹窗的一部分动作会调用真实接口。

| UI 模块 | 当前数据来源 | 是否真实接口 | 相关代码位置 | 说明 |
| ------ | ------ | ------ | ------ | -- |
| 我的日报 | 初始状态来自 `ROLE_DATA.personalReports` 和 `reportStateById`；打开生成弹窗后 session 来自 `/sessions`；生成草稿来自 `/reports/today/draft`；保存来自 `/reports/today` + `/reports/{id}` | 半真实 | `DashboardPage.tsx` 的 `ROLE_DATA`、`personalReports`、`reportSessionsQuery`、`draftMutation`、`saveReportMutation`；`client.ts` 的 `fetchSessions`、`generateTodayReportDraft`、`fetchTodayReport`、`updateReport` | 卡片状态如“草稿待确认 / 已发送 / 发送失败”不是后端字段。保存按钮会真实写 `daily_reports.content/session_ids`，但“发送日报”P0 实际只是保存并把本地状态改为“已发送”。 |
| 部门报告 | `ROLE_DATA.summaryReports` 中 director 的 `department_daily` 原型数据 | 否 | `DashboardPage.tsx` 的 `director-department-daily`、`ReportSection`、`getSummaryReportLabel`、`getDefaultDraftMarkdown` | 后端没有 department report 表或接口。Dashboard 展示的“部门日报发送失败”“各组提交情况”来自本地 mock，不是后端。 |
| 本周周报 | `ROLE_DATA.personalReports` / `summaryReports` 中 `personal_weekly`、`team_weekly`、`department_weekly`；内容来自 `getDefaultDraftMarkdown` | 否 | `DashboardPage.tsx` 的 `personal_weekly`、`team_weekly`、`department_weekly`、`renderWeeklyReportAction`、`getDefaultDraftMarkdown` | 没有周报后端模型和接口。“确认周报 / 编辑周报 / 生成周报”都是前端原型流程。 |
| 日报记录 | Dashboard 仅提供按钮跳转 `/reports`；记录页面 `ReportsPage` 读取真实 `/reports` | 入口半真实，目标页面真实 | `DashboardPage.tsx` 的 `onViewReports`、`ReportSection`；`ReportsPage.tsx` 的 `fetchReports` | Dashboard 卡片不读取历史日报数量或发送状态；`/reports` 页面员工/PM/总监员工日报列表使用真实 `daily_reports`。 |
| 部门报告记录 | Dashboard 文案来自 `getSummaryRecordLabel`，点击仍跳转 `/reports`；`ReportsPage` director tab 展示真实 `team_reports` 和员工日报，但不是 department report | 半真实 | `DashboardPage.tsx` 的 `getSummaryRecordLabel`；`ReportsPage.tsx` 的 `DirectorReportsView`、`fetchTeamReports`、`fetchReports` | `/reports` 的 director 页面标题叫“部门报告”，实际数据是小组日报 `team_reports` 和员工日报 `daily_reports`，没有部门级 report 实体。 |

补充判断：

* Dashboard 上“已发送 / 发送失败 / 待确认”是前端 `ReportStatus` 本地枚举和 `ROLE_DATA` 初始值，不来自后端字段。
* `DailyReport` 类型只有 `content`、`edited`、`feishu_doc_url`、`session_ids` 等字段，没有发送状态字段。
* `TeamReport` 类型也没有发送状态字段。
* Dashboard 的“重试发送”按钮调用的是本地 `onSend`，不调用真实发送或重试接口。
* Dashboard 的“编辑日报”对于个人日报保存动作会写真实日报，但打开编辑器时不一定先读取真实日报内容；非个人日报和周报编辑器使用本地默认 Markdown。

## 3. 后端接口现状

当前日报相关路由注册在 `api/main.go`，主要实现位于 `api/handler/report.go`；生成链路部分在 `daemon/server_reports.go`。

| 接口 | 方法 | 后端位置 | 前端是否使用 | 用途 | 是否会写库 |
| ----------------------- | -- | ---- | ------ | -- | ----- |
| `/reports` | GET | `api/handler/report.go` `List` | `ReportsPage` 使用；Dashboard 当前未用于报告卡片状态 | 查询日报列表，支持 `from/to`。employee 查自己；team_leader/pm 查本团队成员；director/admin 查全部 | 否 |
| `/reports/today` | GET | `api/handler/report.go` `GetOrCreateToday` | Dashboard 保存日报前使用；`client.ts` 暴露为 `fetchTodayReport` | 获取当前用户今日日报；如果不存在则生成 fallback 内容并插入 `daily_reports` | 是，无记录时会插入 |
| `/reports/{id}` | GET | `api/handler/report.go` `Get` | `client.ts` 暴露，当前 ReportsPage 主要用列表数据 | 获取单个日报 | 否 |
| `/reports/{id}` | PUT | `api/handler/report.go` `Update` | Dashboard 保存个人日报使用；ReportsPage 编辑日报使用 | 更新日报 `content`、`feishu_doc_url`、`session_ids`；更新 `content` 时 `edited=true` | 是 |
| `/reports/today/draft` | POST | `api/handler/report.go` `GenerateTodayDraft`；daemon `/reports/draft` | Dashboard 个人日报生成弹窗使用 | 基于选中 session 和 skill 生成个人日报草稿和任务建议 | 否 |
| `/reports/today/generate` | POST | `api/handler/report.go` `GenerateToday`；daemon `/reports/generate` | `ReportsPage` 的“生成我的日报”使用；Dashboard 今日报告卡片不直接使用 | 调 daemon 生成当前用户今日日报并 upsert `daily_reports` | 是 |
| `/reports/team/members` | GET | `api/handler/report.go` `ListTeamMemberReports` | `ReportsPage` TL 成员日报 tab 使用 | 查询某团队某日期成员日报提交情况 | 否 |
| `/reports/team/today` | GET | `api/handler/report.go` `GetTeamReportToday` | `ReportsPage` TL 团队日报 tab 使用 | 查询当前用户所属团队今日团队日报；无团队或无日报返回 404 | 否 |
| `/reports/team/today/generate` | POST | `api/handler/report.go` `GenerateTeamReport`；daemon `/reports/team/generate` | `ReportsPage` TL 使用 | TL 生成本团队今日团队日报并 upsert `team_reports` | 是 |
| `/reports/team` | GET | `api/handler/report.go` `ListTeamReports` | `ReportsPage` director 使用；TL/PM 可用 | 查询团队日报历史。TL/PM 限本团队；director/admin 查全部团队 | 否 |
| `/reports/team/{id}` | PUT | `api/handler/report.go` `UpdateTeamReport` | `ReportsPage` TL 编辑团队日报使用 | 更新团队日报 `content`、`feishu_doc_url` | 是 |

后端模型现状：

* `DailyReport` 对应 `daily_reports`，字段包括 `content`、`edited`、`feishu_doc_url`、`session_ids`，没有 `status`、`send_status`、`sent_at`、`send_error`。
* `TeamReport` 对应 `team_reports`，字段包括 `team_id`、`leader_id`、`content`、`feishu_doc_url`、`member_report_ids`、`session_ids`，没有部门级字段、周报字段、发送状态字段。
* 迁移 `004_team_reports.sql` 只创建 `team_reports`，没有 `department_reports` 或 `weekly_reports`。

## 4. 当前真实接入范围

* 个人日报 draft 真实：Dashboard 个人日报弹窗调用 `POST /reports/today/draft`，后端校验 session 属于当前用户，daemon 返回结构化草稿。
* 个人日报保存真实：Dashboard 保存时调用 `PUT /reports/{id}`，会保存最终 Markdown 和 `session_ids`。
* `session_ids` 保存真实：`Update` 支持 `session_ids`，并通过 `validateReportSessionIDs` 校验 session 属于当前用户。
* 报告记录页部分真实：`ReportsPage` 的员工/PM日报列表读取 `/reports`；TL 页面读取 `/reports/team/today`、`/reports/team/members`；director 页面读取 `/reports/team` 和 `/reports`。
* 团队日报已有真实能力：TL 可通过 `/reports/team/today/generate` 生成团队日报，写入 `team_reports`；TL 可编辑团队日报。
* Dashboard 今日报告卡片未真实初始化：卡片的初始状态、状态文案、覆盖数、发送失败等不是从上述真实接口读取。

## 5. 当前 mock / 半真实范围

* 我的日报状态：Dashboard 初始状态来自 `ROLE_DATA`，不是后端；生成/保存后只在本地覆盖状态。
* 已发送状态：后端没有发送状态字段；Dashboard 点击发送后只是保存日报并本地改成“已发送”。
* 发送失败状态：后端没有发送失败字段；Dashboard 中 director 部门报告的“发送失败”是 `ROLE_DATA` 原型数据。
* 重试发送：没有真实重试发送接口；Dashboard `重试发送` 只触发本地 `onSend`。
* 部门报告状态：没有 `department_reports` 模型或接口；Dashboard 部门报告是前端原型展示。
* 部门报告提交人数：`coverage.expected/submitted/missing/failed` 来自 `ROLE_DATA`，不是接口。
* 本周周报：没有 weekly report 后端模型或接口；Dashboard 周报内容来自 `getDefaultDraftMarkdown`。
* 确认周报：没有真实接口；只是打开本地编辑器。
* 记录入口：Dashboard 两个记录按钮都只是跳转 `/reports`，没有按“日报记录 / 部门报告记录”读取不同统计或状态。
* `/reports` director 页面标题为“部门报告”，但实际展示的是小组日报 `team_reports` 和员工日报 `daily_reports`，不是部门级报告。

## 6. 关键风险

1. `/reports/today` 会自动创建日报，Dashboard 初始化时不能随便调用它做状态查询。否则用户只是打开首页，也可能生成一条 fallback 日报记录。
2. 如果“已发送”只是前端本地状态，刷新后会丢失，也无法和真实发送链路、飞书文档状态对齐。
3. 如果部门报告没有真实接口，不能把 `team_reports` 冒充成 department report；director 页面可以展示团队日报汇总，但这不等于部门报告实体。
4. 如果发送链路没有真实接口，不能显示成真实已发送；`feishu_doc_url` 只能说明关联了飞书文档 URL，不能说明发送成功。
5. 如果周报没有后端能力，不应该和个人日报一起改；周报涉及新的周期、聚合口径、模型和状态字段。
6. `PUT /reports/{id}` 当前按 id 更新日报，虽然会校验传入 `session_ids` 属于当前用户，但代码中没有看到对日报 id 归属的显式校验；后续改造真实编辑入口时需要补权限审计。
7. `PUT /reports/team/{id}` 只校验角色为 `team_leader`，代码中没有看到 team_id 归属校验；团队日报编辑真实化前需要补权限审计。

## 7. 推荐改造顺序

### P0-1：先改我的日报卡片状态真实化

目标：只真实化 Dashboard「我的日报」卡片的只读状态，不碰部门报告、周报和发送链路。

建议接口：

* 优先使用 `GET /reports?from=今天&to=今天`，前端按 `user_id === currentUser.id` 找当前用户日报。
* 不建议使用 `GET /reports/today` 做卡片初始化，因为该接口会自动创建日报。
* P0 可以不新增只读接口；如果后续需要更明确的“我的今日状态”口径，再考虑新增无副作用的只读接口，例如 `GET /reports/today/status`。

建议数据口径与现有 UI 状态映射：

* 没有当天记录：映射到现有 `ReportStatus = "待生成"`，状态标签显示“待生成”，主按钮沿用现有文案“生成日报”。
* 有当天记录且 `edited=false`：数据口径为“已生成，待确认”，UI 映射到现有 `ReportStatus = "草稿待确认"`，状态标签按现有 `ReportStatusTag` 显示“待确认”，主按钮沿用现有文案“确认日报”。
* 有当天记录且 `edited=true`：数据口径为“已编辑，待确认”，UI 仍映射到现有 `ReportStatus = "草稿待确认"`，状态标签显示“待确认”，主按钮沿用现有文案“确认日报”。

需要避免：

* 不调用 `GET /reports/today` 初始化状态。
* 不继续用 `ROLE_DATA` 的日报状态覆盖真实查询结果。
* 不新增“已生成，待确认”“已编辑，待确认”作为前端按钮状态或 `ReportStatus` 枚举值；一期只用真实数据选择现有按钮分支。
* 不引入发送状态、飞书状态、失败状态等额外口径。

改动范围：

* `DashboardPage.tsx` 增加只读查询和状态映射。
* `client.ts` 可复用现有 `fetchReports`，理论上不需要新增 client 方法。
* 不改后端，不改 UI 布局。

### P0-2：再改日报记录入口真实化

目标：让 Dashboard 的“日报记录”入口与 `/reports` 页面真实能力对齐。

现状：

* `ReportsPage` 已经可复用，员工/PM/director 的日报历史来自 `GET /reports`。
* TL 的团队日报和成员日报来自 `GET /reports/team/today`、`GET /reports/team/members`、`GET /reports/team`。

建议：

* Dashboard 入口仍跳 `/reports`，但文案避免“确认与发送记录”这种暗示真实发送链路的表达。
* 如需要 Dashboard 上展示记录数量，可用 `GET /reports?from=近7天&to=今天` 只读查询；不要调用 `GET /reports/today`。
* director 的“部门报告记录”应改成“团队日报记录”或“部门视角记录”，避免暗示已有部门报告实体。

### P1：部门报告真实化

目标：先确认 department report 和 team report 的业务边界，再设计后端能力。

需要确认：

* “部门报告”是否是多个 `team_reports` 的二次汇总，还是 director 自己生成的一份独立报告。
* 部门报告归属字段：department_id、director_id、report_date、source_team_report_ids、content、session_ids。
* 部门提交覆盖口径：应提交团队数、已提交团队数、缺失团队数、失败团队数是否来自 team report 状态。
* 发送状态字段：send_status、sent_at、send_error、target 等。

建议：

* P1 不要伪造提交人数和失败状态。
* 在没有 department report 实体前，Dashboard 只能展示“团队日报汇总视角”，不能展示成真实部门报告。
* 如果继续复用 `team_reports`，UI 文案必须明确为“小组日报 / 团队日报”，不要叫“部门报告已发送”。

### P2：周报和发送链路真实化

周报需要的后端能力：

* weekly report 模型：个人周报、团队周报、部门周报是否分表或统一 report_type。
* 周期字段：week_start、week_end、report_type、scope。
* 来源字段：daily_report_ids、team_report_ids、session_ids、task_ids。
* 生成接口、查询接口、更新接口。

发送链路需要的后端能力：

* send_status：pending/sent/failed 等固定枚举。
* sent_at、send_error、send_target、feishu_message_id 或 doc_url。
* 发送、重试发送接口。
* 权限和幂等策略。

建议：

* 不建议现在和个人日报卡片状态真实化混在一起做。
* 周报和发送链路会引入新状态机，应单独设计、单独验收。

## 8. 建议下一步 Codex 开发任务

建议优先开发任务提示词：

```text
现在开始执行「Dashboard 我的日报卡片状态真实化 P0」任务。

范围限制：
1. 只改 Dashboard 今日报告卡片里的“我的日报”状态。
2. 不改部门报告。
3. 不改周报。
4. 不改发送链路。
5. 不新增后端接口。
6. 不调用 GET /reports/today 做状态初始化，因为它会自动创建日报。

实现要求：
1. 阅读 DashboardPage.tsx、client.ts、types.ts、ReportsPage.tsx、api/handler/report.go。
2. 复用现有 fetchReports({ from: today, to: today }) 查询当天日报。
3. 前端按当前登录用户 user_id 过滤出“我的今日日报”。
4. 没有记录映射到现有 ReportStatus “待生成”，按钮沿用“生成日报”。
5. 有记录且 edited=false，数据口径为“已生成，待确认”，UI 映射到现有 ReportStatus “草稿待确认”，按钮沿用“确认日报”。
6. 有记录且 edited=true，数据口径为“已编辑，待确认”，UI 映射到现有 ReportStatus “草稿待确认”，按钮沿用“确认日报”。
7. 不新增按钮状态文案，不新增 ReportStatus 枚举值，不显示“已发送 / 发送失败 / 已关联飞书”等额外状态。
8. 保留现有生成草稿、编辑保存流程。
9. 不改 /reports 页面。
10. 不改 UI 布局，只替换数据来源和状态映射。
11. 增加最小测试或脚本验证，并如实记录结果。
```
