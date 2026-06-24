# 需求看板 P0：Requirements 主数据与 Dashboard 现状映射架构文档

> 文档类型：正式开发前架构分析  
> 基线日期：2026-06-24  
> 输出范围：现状盘点、主数据映射、分层、数据流、接口契约草案、兼容策略  
> 明确限制：本文档不修改代码、不修改接口、不修改数据库、不重新设计 Requirements 或 Dashboard。

## 一、文档目标

1. `requirements` 是需求、任务、依赖、进度和 Token 来源归集的主数据页面。
2. Requirements 的 P0 业务范围已经由以下两份文档确定，本文不重新讨论或扩展其产品范围：
   - `doc/需求看板_P0_需求文档.md`
   - `doc/需求看板_P0_架构文档.md`
3. Dashboard 是现有控制台页面，没有与 Requirements P0 同级的完整独立需求文档。Dashboard 的功能必须从当前代码、组件、交互、Mock 和旧接口中盘点，不能根据截图臆测。
4. 本文用于正式开发前厘清三者关系：
   - Requirements P0 主数据。
   - 旧服务接口与旧数据库模型。
   - Dashboard 当前已实现的展示和交互功能。
5. 本文重点不是重新设计 Dashboard，而是明确：
   - Dashboard 每个现有模块的数据来源。
   - Dashboard 需要消费哪些 Requirements 主数据。
   - 哪些能力属于报告、Session、Token 等独立域。
   - 哪些旧接口可复用、哪些 DTO 需要扩展、哪些契约缺失。
6. 总体原则：**Requirements 是主数据，Dashboard 是查询投影与入口聚合，不维护第二套需求、任务、关注或风险规则。**

## 二、输入资料与实际扫描路径

### 2.1 Requirements 定稿文档

- `doc/需求看板_P0_需求文档.md`
- `doc/需求看板_P0_架构文档.md`

### 2.2 旧服务和数据库资料

- `doc/旧服务接口.md`
- `api/main.go`
- `api/model/models.go`
- `api/handler/requirement.go`
- `api/handler/task.go`
- `api/handler/session.go`
- `api/handler/token.go`
- `api/handler/report.go`
- `api/handler/team.go`
- `api/handler/middleware.go`
- `api/db/migrations/001_init.sql`
- `api/db/migrations/002_seed.sql`
- `api/db/migrations/003_documents.sql`
- `api/db/migrations/004_team_reports.sql`
- `api/db/migrations/005_user_auth.sql`
- `api/db/migrations/006_token_cache.sql`
- `daemon/server_reports.go`
- `daemon/device_client.go`
- `daemon/codex_scan.go`

### 2.3 当前激活 Dashboard 页面

- `web/src/router/routes.tsx`
- `web/src/features/aidashboard/dashboard/DashboardPage.tsx`
- `web/src/features/aidashboard/dashboard/console-dashboard.css`

`routes.tsx` 当前 `/dashboard` 实际挂载 `DashboardPage`。因此 Dashboard 现状盘点以该文件为主。

### 2.4 Dashboard 目录中的辅助或历史组件

- `web/src/features/aidashboard/dashboard/DashboardState.tsx`
- `web/src/features/aidashboard/dashboard/EmployeeDashboard.tsx`
- `web/src/features/aidashboard/dashboard/TLDashboard.tsx`
- `web/src/features/aidashboard/dashboard/DirectorDashboard.tsx`
- `web/src/features/aidashboard/dashboard/PMDashboard.tsx`
- `web/src/features/aidashboard/dashboard/RoleHomepagePrototype.tsx`
- `web/src/features/aidashboard/dashboard/shared.tsx`
- `web/src/features/aidashboard/dashboard/charts.tsx`
- `web/src/features/aidashboard/dashboard/formatters.ts`
- `web/src/features/aidashboard/dashboard/metric-card.css`
- `web/src/features/aidashboard/dashboard/role-homepage.css`

扫描结论：四个角色 Dashboard 包装组件只渲染 `RoleHomepagePrototype`，当前没有被路由引用；`DashboardState`、`charts`、`shared` 也没有被当前 `DashboardPage` 调用。它们属于可复用或历史代码，不等于当前控制台正在运行的功能。

### 2.5 Dashboard 相关 API、类型和真实页面

- `web/src/features/aidashboard/api/client.ts`
- `web/src/features/aidashboard/api/types.ts`
- `web/src/features/aidashboard/reports/pages/ReportsPage.tsx`
- `web/src/features/aidashboard/tokens/pages/TokensPage.tsx`
- `web/src/features/aidashboard/sessions/pages/SessionsPage.tsx`
- `web/src/shared/request/httpClient.ts`
- `web/src/shared/auth/authContext.ts`
- `web/src/router/PermissionGuard.tsx`
- `web/src/router/routeAccess.ts`

### 2.6 当前 Requirements 页面和 Mock

- `web/src/features/aidashboard/requirements/pages/RequirementsListPage.tsx`
- `web/src/features/aidashboard/requirements/pages/RequirementCreatePage.tsx`
- `web/src/features/aidashboard/requirements/pages/RequirementDetailPage.tsx`
- `web/src/features/aidashboard/requirements/pages/RequirementsBoard.css`
- `web/src/features/aidashboard/requirements/components/RequirementMetricCard.tsx`
- `web/src/features/aidashboard/requirements/components/RequirementMetricCard.css`
- `web/src/features/aidashboard/requirements/mock/types.ts`
- `web/src/features/aidashboard/requirements/mock/requirementsBoardMockApi.ts`
- `web/src/features/aidashboard/tasks/pages/TaskCreatePage.tsx`
- `web/src/features/aidashboard/tasks/pages/TaskDetailPage.tsx`
- `web/src/features/aidashboard/tasks/pages/TasksListPage.tsx`
- `web/src/features/aidashboard/api/client.ts`
- `web/src/features/aidashboard/api/types.ts`

扫描结论：当前 Requirements 主页面实际调用 `requirementsBoardMockApi`；旧真实 API client 仍存在，但字段和状态与 P0 定稿模型不完全一致。

### 2.7 Dashboard Mock、hooks 和 type 的实际位置

当前激活 Dashboard 没有独立 `hooks/`、`mock/`、`types/` 文件：

- Mock 数据直接定义在 `DashboardPage.tsx`：`ROLE_DATA`、`TOKEN_DATA`、`SESSION_OPTIONS`、`REPORT_SKILL_OPTIONS`、`TASK_PROGRESS_SUGGESTIONS`、`DEFAULT_MARKDOWN`。
- 类型直接定义在 `DashboardPage.tsx`：`ReportItem`、`FollowItem`、`RiskItem`、`ReportCoverage`、`ConsoleRoleData`、`TokenReport`、`TaskProgressSuggestion` 等。
- 状态通过 React `useState/useMemo` 管理，没有 React Query hook，没有真实 API 调用。
- `DashboardState.tsx` 提供多 Query 错误聚合组件，但当前 Dashboard 未使用。

## 三、Requirements 页面 P0 基线

本节只摘要两份 P0 定稿文档，不根据 Dashboard 需要扩展 Requirements 产品范围。

### 3.1 P0 已确认

| 能力 | P0 基线 |
| --- | --- |
| 需求列表 | 需求看板 + 任务树两个视角，不增加第三视角 |
| 需求详情 | 右侧详情抽屉为日常查看和维护主入口 |
| 需求阶段 | 待开始、评审、进行中、完成；已取消不作为主看板列 |
| 任务列表 | 需求 + 任务两层，不支持无限子任务 |
| 任务状态 | 待办、进行中、阻塞、完成 |
| 任务进度 | 0–100，由用户手动维护，Slider + InputNumber |
| 任务依赖 | 只支持同一需求内上游任务依赖 |
| 依赖阻塞 | 上游未完成时派生阻塞，上游完成后自动解除 |
| 超期/临期 | 截止日期属于需求/任务字段；Dashboard 可据此派生摘要，但 P0 不建设风险中心 |
| 需求进度聚合 | 由下属任务聚合，不允许手动维护需求进度 |
| Token 来源 | 需求和任务均可关联；任务来源汇总到所属需求 |
| Session 口径 | Session 不是管理对象，只是 Token 来源的底层工作记录；不展示 Session 数 KPI |
| 完成 | 完成列只展示最近 7 天且最多 10 条，支持查看全部已完成 |
| 取消 | 已取消仅通过筛选/归档查询，不进入主看板列 |
| 创建需求 | 独立页面，包含标题、描述、验收标准、优先级、截止日期、参与团队 |
| 添加任务 | 主流程为需求详情抽屉内打开弹窗，完成后保留需求上下文 |

### 3.2 P0 未确认或仅有实现痕迹

| 能力 | 判断 |
| --- | --- |
| 关注需求/关注任务 | 两份 P0 文档未列入范围；当前 Requirements Mock 已出现 `MockFavorite` 和关注按钮，但不能据此认定为 P0 已确认 |
| 手动归档/取消归档 | 文档确认历史完成查询和已取消筛选，但未确认独立 `archived` 状态、手动归档按钮或取消归档业务流程 |
| 删除任务 | P0 文档未定义删除任务交互与约束 |
| 风险等级 | P0 只确认依赖阻塞和截止日期；高/中/低风险等级属于 Dashboard 展示派生规则，尚非 Requirements 主数据 |
| 临期阈值 | P0 文档没有统一具体阈值；当前原型和旧代码存在 48 小时、3 天、7 天等不同表达，需要单独确认 |
| 任务进度历史 | P0 确认当前进度，但未确认进度变更历史表或审计 UI |

### 3.3 P0 明确不做

- 重新设计完整 Dashboard。
- 日报任务进展卡属于 Requirements P0 之外。
- LLM 自动更新任务进度。
- 人工标记阻塞和阻塞原因。
- 评论、注释、审批流。
- 独立依赖视图、Session 视图、风险中心、通知中心。
- 跨需求依赖。
- 多级任务树。
- Token 成本分摊和复杂去重。
- 自动根据 Session/Token 修改进度。
- 自动完成任务、自动归档需求。
- 完整权限矩阵和字段级权限。

### 3.4 Requirements P0 主数据边界

Requirements 主数据负责：

- Requirement。
- Task。
- Requirement 与 Task 关系。
- Task dependency。
- 任务当前状态和进度。
- 需求任务聚合。
- TokenSource 与需求/任务关联。
- completed/cancelled 及最近完成查询。

Dashboard 只能读取或通过正式任务更新用例写 Task；不得维护 Requirement/Task 的副本状态。

## 四、Dashboard 现状代码盘点

### 4.1 总体现状

| 项目 | 当前事实 |
| --- | --- |
| 激活页面 | `DashboardPage` |
| 路由 | `/dashboard` |
| 真实 API | 无 |
| Query hooks | 无 |
| Mock | 全部内嵌在 `DashboardPage.tsx` |
| 数据持久化 | 无，刷新即恢复默认 Mock |
| 角色 | employee、team_leader、director、pm，通过页面 Segmented 手动切换 |
| 与 Requirements 关联 | 只有拼接 URL 的跳转，没有共享查询或主数据关联 |

### 4.2 页面布局

代码路径：`DashboardPage.tsx`，组件：`DashboardPage`、`PanelHeader`。

布局顺序：

1. 原型角色切换条。
2. “我关注的事项”整行面板。
3. 左侧“今日报告”、右侧“Token 统计”的双列区域。
4. “待处理风险”整行面板。
5. 报告工作流 Modal。
6. 任务进展编辑 Modal。

当前数据来源：组件内状态和常量。当前不调用真实接口。

分类：页面布局属于 Dashboard 展示层，应保留；不是 Requirements 主数据。

### 4.3 页面角色切换

代码：`ROLE_OPTIONS`、`previewRole`、`ROLE_DATA[previewRole]`。

按钮/交互：个人、TL、总监、PM Segmented。

当前作用：切换整页 Mock 数据、报告类型、关注项、风险和 Token 汇总。

真实接口：无。与 Requirements：仅切换 Mock 视角。

判断：原型展示层功能；正式接入时应由登录用户角色决定，但本期文档不改页面。

### 4.4 我的关注事项

代码：`FollowCard`、`sortFollowItems`、`getFollowPriority`、`getFollowTone`。

展示字段：

- 类型：需求/任务。
- 标题。
- 所属需求（任务可有）。
- requirementId、taskId。
- 负责人。
- 状态。
- 截止日期。
- 依赖描述。
- 风险标签。
- 最近变化摘要。

页面汇总：总项数、阻塞数、临期数。

排序：超期 → 依赖阻塞 → 临期 → 进行中 → 已完成。

按钮：每条“详情”。

跳转：

- 需求：`/requirements?requirementId={id}`。
- 任务：`/requirements?requirementId={rid}&taskId={tid}`。

数据来源：`ROLE_DATA.*.follows`，全部 Mock。

真实接口：无。Requirements 当前 Mock 有 favorites，但 P0 文档未确认关注能力。

映射判断：需要 Requirements 主数据支撑；关注关系是否进入本期需单独确认，不能直接视为 Requirements P0 已确认。

### 4.5 今日报告

代码：`ReportSection`、`ReportTaskRow`、`renderReportActions`、`renderPrimaryReportAction`、`ReportStatusTag`。

报告类型：

- personal_daily、personal_weekly。
- team_daily、team_weekly。
- department_daily、department_weekly。

报告状态：待生成、生成中、草稿待确认、已发送、发送失败、生成失败。

展示字段：报告名称、类型、scope、状态、描述、来源摘要、Session 数、生成模式、Skill、更新时间、下次生成时间、提交覆盖率。

按钮全集：

- 生成报告/日报/组报/部门报告。
- 重新生成。
- 确认报告。
- 发送报告。
- 编辑报告。
- 重试发送。
- 查看报告。
- 生成/确认/编辑周报。
- 日报记录入口。
- 周报/组报/部门报告记录入口。

跳转：两个记录快捷入口均进入 `/reports`。

数据来源：`ROLE_DATA.personalReports`、`summaryReports`，状态更新仅写 `reportStateById`。

真实接口：当前 Dashboard 不调用；独立 `/reports` 页面已调用旧报告接口。

映射判断：属于报告域，复用旧服务但不直接属于 Requirements。报告来源摘要可读取 Requirements 投影，但不应写 Requirements 主数据。

### 4.6 日报/报告工作流弹窗

代码：`ReportModalContent`、`renderReportModalFooter`、`GenerationSettingsPanel`。

弹窗一：报告工作流 Modal。

- 个人日报步骤：选择 Session → 编辑内容。
- 其他报告步骤：确认来源 → 编辑内容。
- 生成来源：Session Checkbox 列表。
- 默认选中：`session-am`、`session-pm`。
- Skill：系统预设下拉 + 上传 `.md`。
- 编辑：Markdown TextArea。
- 个人日报编辑右侧：任务进展建议列表。

弹窗按钮全集：

- 稍后处理。
- 下一步。
- 生成报告。
- 上一步。
- 保存修改。
- 发送日报/周报/组报/部门报告。
- 上传 `skill.md`。
- 编辑任务。

当前行为：只更新本地状态；不调用报告、Session、任务接口；不持久化。

与 Requirements：任务建议只用 Mock task key/name，没有读取真实 RequirementTask；Session 与任务的关联来自静态数组。

判断：报告弹窗本身属于报告域。本期只分析其任务映射，不进行完整日报系统重构。

### 4.7 任务进展编辑弹窗

代码：`TaskProgressSuggestionList`、`TaskProgressEditModal`。

展示/编辑字段：任务名、建议进度、状态、关联 Session、备注、同步状态。

当前进度选项：25/50/75/100；这与 Requirements P0 的 0–100 Slider + InputNumber 定稿口径不同。

当前保存：写回本地 `taskSuggestions`，标记“待同步”；发送报告仅修改报告状态，并没有调用任务接口。

映射判断：需要引用真实 Requirements Task。最终任务更新必须走任务 Domain Service；前端不能根据 Session 或 Token 自动修改进度。

本期边界：只定义数据关联和契约草案，不改弹窗交互。

### 4.8 Skill 上传管理

代码：`REPORT_SKILL_OPTIONS`、`uploadReportSkill`、`getUploadedSkillName`、`GenerationSettingsPanel`。

当前功能：

- 三个系统 Mock 预设。
- 上传 Markdown。
- 从 `name:` 或文件名推导名称。
- 加入本次页面内存列表并立即选中。
- 刷新页面后丢失。

真实接口/DB：无。

与 Requirements：无。

判断：Dashboard 报告域独立能力，且用户明确本阶段不处理 Skill 上传与管理。

### 4.9 周报入口

代码：`renderWeeklyReportAction`、`getWeeklyReportReminder`、`getDefaultDraftMarkdown`。

当前功能：待生成、生成中、待确认、已发送、发送失败的动作差异；个人周报提示“周五自动汇总”；组/部门周报均有 Mock 模板。

真实接口：旧服务没有周报接口，只有个人日报和团队日报。

与 Requirements：周报来源文案包含任务、风险、阻塞，但没有真实关联。

判断：复用报告域；本阶段不进行完整周报系统重构。

### 4.10 Token 统计与 Session 上传概览

代码：`SessionUploadCard`、`renderSessionUploadSummary`、`TokenPersonalSummary`、`TokenMiniBars`、`TokenMetricBars`、`TokenGroupBars`。

筛选：昨天、近 3 天、近 7 天。

展示字段依角色变化：Token 总量、Session 数、上传人数、个人 Token、团队分组、日期条形数据、上传状态。

按钮：时间范围 Segmented、查看 Token 明细。

跳转：`/tokens`。

数据来源：`TOKEN_DATA` Mock。

真实能力：旧 `/tokens`、`/tokens/sessions` 可复用；当前 Dashboard 未调用。

与 Requirements：TokenUsage 已有 task_id/requirement_id，可按 Requirements 归属聚合；Session 上传状态本身属于 Session/Token 域，不属于 Requirements。

判断：保留旧逻辑，不重构 Token 明细页；Dashboard 只消费摘要投影。

### 4.11 待处理风险

代码：`RiskCard`、`sortRisks`、`getRiskPriority`、`getRiskActionLabel`。

风险类型：

- dependency_blocker。
- deadline。

展示字段：级别、来源、标题、原因、影响对象、负责人、截止日期、对象类型、requirementId/taskId、目标 URL。

排序：已超期 → 依赖阻塞 → 其他。

按钮：处理依赖、查看任务或 Mock actionText。

跳转：Mock `targetUrl`，目标均落在 `/requirements` 查询参数。

数据来源：`ROLE_DATA.*.risks` Mock。

真实接口：无。旧 task dependency 和 due_date 可作为派生基础。

映射判断：需要 Requirements 主数据支撑；风险应由 Domain/Projection 派生，不落 Dashboard 独立风险表。

### 4.12 当前 Dashboard 与 Requirements 的真实关联结论

已经存在：

- `FollowItem`、`RiskItem` 含 requirementId/taskId。
- 点击关注项和风险项会跳转 `/requirements`。
- 报告任务建议具有 task key/name 概念。
- TokenUsage/Session 旧模型具有 task_id/requirement_id。

尚未存在：

- Dashboard 对 Requirements API 的调用。
- Dashboard 对 Requirements Mock 的调用。
- 统一 DTO。
- 真实关注关系。
- 真实风险投影。
- 日报建议与真实任务 ID 的可靠关联。
- Requirements 数据更新后的 Dashboard Query 刷新。

## 五、Dashboard 功能分类

### A. 需要 Requirements 主数据支撑

- 我的关注事项中的需求和任务字段。
- 关注项的负责人、状态、截止日期和最近更新。
- 待处理风险中的依赖阻塞、超期、临期。
- 报告弹窗中的任务进展建议与真实任务关联。
- 点击详情所需 requirementId/taskId。
- 任务阻塞摘要。
- 需求/任务截止日期摘要。
- 报告来源摘要中的任务、需求、依赖和完成状态。
- Token 按 task/requirement 的归属摘要。
- 完成/取消对象的默认排除规则。

### B. 复用旧服务但不直接属于 Requirements

- 今日个人日报、团队日报。
- 日报历史记录。
- 周报入口和展示状态；旧服务目前不完整支持。
- Session 上传概览。
- Token 总量、趋势、上传人和明细。
- 团队日报提交覆盖率。

### C. 只属于 Dashboard 展示层

- 页面双列/整行卡片布局。
- 原型角色切换控件。
- Token 时间范围切换。
- 卡片色彩、标签、按钮布局。
- 关注项和风险项的展示排序。
- 报告动作按状态显示的前端映射。
- 页面快捷入口。

### D. 本期不改造、不发散

- 完整日报系统重构。
- 完整周报系统重构。
- Skill 上传与管理。
- 飞书发送。
- Token 明细页重构。
- 权限管理页重构。
- 独立关注中心。
- 独立风险中心。
- 通知中心。
- Dashboard 全量视觉重设计。

## 六、Requirements 主数据到 Dashboard 的映射

### 6.1 映射总表

| Requirements 主数据/派生 | Dashboard 消费模块 | 旧能力 | 缺口判断 |
| --- | --- | --- | --- |
| Requirement + follow | 我的关注事项 | 当前 Mock favorites；旧 DB/API 无 | 关注关系需新增，Requirement DTO 扩展 follow_state |
| Task + follow | 我的关注事项 | 当前 Mock favorites；旧 DB/API 无 | 同上 |
| Task dependency | 待处理风险 | `task_dependencies`、Task detail dependencies | 可复用 DB，需风险 Projection |
| Task due_date/status | 超期/临期风险 | 旧 Task 已有 | 只需派生 DTO/接口 |
| Requirement deadline/status | 需求风险摘要 | 旧 Requirement 已有 | 只需派生 DTO/接口 |
| Task | 日报任务建议 | `/tasks`、Session task_id | 旧 Task 缺 P0 progress；建议接口需绑定真实 task_id |
| Requirement/Task ID | Dashboard 跳转 | 已有 ID | 只需统一 NavigationTargetDTO |
| TokenSource | Token/报告来源摘要 | sessions + token_usage | 旧模型是一对一归属，P0 多关联语义缺口 |
| completed/cancelled | 默认展示范围 | status 有 completed/cancelled | completed_at/归档字段缺失 |
| Requirement task aggregate | 关注摘要 | 旧 requirement.progress，算法不符合 P0 | 应由统一 Domain 派生，不由 Dashboard 算 |

### 6.2 关注映射

目标关系：Requirement/Task 关注 → Dashboard FollowItem。

现状：

- Requirements Mock 有 `MockFavorite(user_id,target_type,target_id,created_at)`。
- Dashboard 有 FollowItem Mock。
- 旧 DB、旧接口均没有 follow/favorite/watch。
- P0 两份文档没有确认关注属于 Requirements 范围。

结论：这是 Dashboard 现有功能所需的新关联能力，但必须单独确认后实施；不能因当前 Mock 已有就反向扩大 Requirements P0。

### 6.3 风险映射

Task dependencies/status/due_date → Dashboard RiskItem。

- dependency_blocker：任一上游任务未 done，且当前任务未 done。
- overdue：未完成且 due_date 早于业务日期。
- due_soon：未完成且 due_date 进入确认后的临期阈值。

风险不建议落库。删除依赖、上游完成或调整截止日期后，下一次 Projection 查询自然消失。

### 6.4 日报任务建议映射

Requirements Task → DashboardTaskSuggestionDTO。

- task_id 和 requirement_id 必须是真实主数据 ID。
- 当前状态/进度来自 Task Domain。
- Session/Token 只能作为 suggestion_evidence。
- LLM 只生成建议值。
- 用户确认后才允许调用正式任务更新用例。
- Dashboard 不直接写 requirements.progress。

### 6.5 跳转映射

DashboardNavigationTargetDTO 至少包含：

- object_type。
- requirement_id。
- task_id 可选。
- focus：dependency/deadline/progress 可选。

Requirements 页面负责解释 URL 并打开对应抽屉；Dashboard 不携带完整业务对象。

### 6.6 Token/Session 映射

- 旧 Session、TokenUsage 可按 task_id/requirement_id 查询。
- P0 TokenSource 是页面业务概念；Session 是底层来源。
- Dashboard Token 总览属于 Token 域。
- Dashboard 若展示某任务/需求的 Token 摘要，应消费 Requirements TokenSourceSummaryDTO，不自行扫描 Session。
- 不展示“无 Session = 无进展”，不自动改任务进度。

### 6.7 完成与归档映射

- 已完成默认只取最近完成。
- 已取消默认不进入关注/风险投影，除非显式查询历史。
- P0 确认“查看全部已完成”，但没有确认独立 archived 状态。
- `archived_at`、手动归档/取消归档接口属于待确认技术契约，不能当作 P0 已确认页面功能。

### 6.8 Dashboard 是否需要单独落库

原则上不需要。

- Follow 关系若确认，需要通用用户-对象关系表，不是 Dashboard 表。
- 风险由 Requirements Domain 派生，不建 Dashboard 风险表。
- Dashboard 卡片、排序、计数是 Projection。
- 报告、Session、Token 继续使用各自旧域表。
- 可使用查询缓存，但缓存不是业务事实源。

## 七、旧服务接口盘点与复用判断

### 7.1 Requirements/Task 接口

| Method | Path | 当前 request | 当前 response | 当前前端使用 | Requirements | Dashboard | 判断 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/requirements` | query: status, team_id | `Requirement[]` | 旧 client；当前 P0 页面未使用 | 可扩展 | 可作为基础 | 扩展阶段、完成时间、聚合、follow state |
| POST | `/requirements` | title, description, priority, deadline, team_ids, feishu_doc_url | `Requirement` | 旧 client | 可复用后扩展 | 不直接用 | 旧接口自动生成验收标准，与 P0 表单直传不一致 |
| GET | `/requirements/{id}` | path id | `Requirement` | 旧 client | 可扩展 | 跳转后使用 | 需详情聚合或配合 tasks/token 接口 |
| PUT | `/requirements/{id}` | 可选基础字段/status | `Requirement` | 旧 client | 可扩展 | 不直接用 | 缺 completed/archived 专用语义和验收标准更新 |
| GET | `/requirements/{id}/ac` | path id | `ACStatus[]` | 旧 client | 不建议作为 P0 主链路 | 不使用 | P0 不强制任务绑定验收标准 |
| POST | `/requirements/{id}/regenerate-ac` | 无 body | acceptance_criteria | 旧 client | P0 非主链路 | 不使用 | 不建议继续强化 |
| GET | `/tasks` | query: requirement_id, assignee_id, status | `Task[]`，列表不含 dependencies | 旧 client | 可扩展 | 关注/建议基础 | 需 progress、display_status、风险摘要 |
| POST | `/tasks` | requirement_id,title,AC IDs,assignee,priority,due_date,depends_on_ids | `{id,status}` | 旧 client | 可扩展 | 不直接用 | 权限仅 TL，且 AC 绑定与 P0 不一致 |
| GET | `/tasks/{id}` | path id | `Task` + dependencies/blocking | 旧 client | 可扩展 | 跳转后使用 | 可复用依赖详情 |
| PUT | `/tasks/{id}` | title,AC IDs,assignee,status,priority,due_date | `Task` | 旧 client | 可扩展 | 日报确认后可经 Service 使用 | 缺 progress；不可让 Dashboard 直接任意 PUT |
| PUT | `/tasks/{id}/status` | `{status}` | `Task` | 旧 client | 可扩展 | 日报确认后可经 Service 使用 | 允许人工 blocked，不符合 P0，需要校验规则 |
| POST | `/tasks/{id}/dependencies` | `{depends_on_id}` | `Task` | 旧 client | 可复用后加强校验 | 不直接用 | 需限制同一需求、循环依赖 |
| DELETE | `/tasks/{id}/dependencies/{dep_id}` | path ids | `Task` | 旧 client | 可复用 | 不直接用 | 删除后风险 Projection 应同步消失 |

旧接口没有：完成需求、归档、取消归档、删除任务、关注/取消关注、批量任务树、风险摘要、TokenSource 关联。

### 7.2 Report 接口

| Method | Path | request | response | 当前使用 | Dashboard 判断 |
| --- | --- | --- | --- | --- | --- |
| GET | `/reports` | query from/to | `DailyReport[]` | `ReportsPage` | 今日报告历史可复用；当前 Dashboard 未调用 |
| GET | `/reports/today` | 无 | `DailyReport`，不存在会创建 | API client | 可复用但“GET 创建”副作用不理想 |
| POST | `/reports/today/generate` | 无 | `DailyReport` | ReportsPage | 个人日报生成可复用，无法传任务/来源选择 |
| GET | `/reports/{id}` | id | `DailyReport` | API client | 可复用 |
| PUT | `/reports/{id}` | content, feishu_doc_url | `DailyReport` | ReportsPage | 草稿编辑可复用 |
| GET | `/reports/team/members` | date | `TeamMemberReport[]` | TL ReportsPage | 提交覆盖率可复用 |
| GET | `/reports/team/today` | 无 | `TeamReport`/404 | TL ReportsPage | 组报摘要可复用 |
| POST | `/reports/team/today/generate` | 无 | `TeamReport` | TL ReportsPage | TL 组日报可复用 |
| GET | `/reports/team` | from/to | `TeamReport[]` | Director ReportsPage | 组报历史可复用 |
| PUT | `/reports/team/{id}` | content, feishu_doc_url | `TeamReport` | TL ReportsPage | 编辑可复用 |

缺口：周报、部门报告、统一状态、发送状态、任务建议、结构化任务更新、Skill。按本阶段“不做完整日报/周报重构”，只记录缺口，不在本方案实施。

### 7.3 Session 接口

| Method | Path | request | response | 当前使用 | 判断 |
| --- | --- | --- | --- | --- | --- |
| POST | `/sessions/batch` | multipart metadata + JSONL files | total/results | daemon | 保留，属于 Session 域 |
| GET | `/sessions` | query date；按角色 scope | `Session[]` | SessionsPage | 日报来源/上传概览可复用 |
| GET | `/sessions/{id}` | id | Session | API 直接能力 | TokenSource 详情底层来源 |
| GET | `/sessions/{id}/log` | id | JSONL stream | SessionsPage | 本期不用于 Dashboard |
| PUT | `/sessions/{id}/task` | `{task_id|null}` | Session | SessionsPage | 可维护底层归属，不等于任务进度 |
| DELETE | `/sessions/{id}` | id | withdrawn | SessionsPage | 本期不用于 Dashboard |

### 7.4 Token 接口

| Method | Path | request | response | 当前使用 | 判断 |
| --- | --- | --- | --- | --- | --- |
| GET | `/tokens` | period/from/to/group_by | total/input/output/cache/groups/series | Dashboard 旧辅助组件、TokensPage 相关能力 | Dashboard Token 摘要可直接复用或包装 |
| GET | `/tokens/sessions` | from/to/scope | `SessionTokens[]` | TokensPage | Token 明细保留，不重构 |

旧 TokenUsage 已包含 task_id/requirement_id，但当前 Dashboard Mock 没有接入。

### 7.5 Follow/Favorite/Watch 接口

旧服务：无。

当前仅 `requirementsBoardMockApi.listFavorites/toggleFavorite`。因此：

- 不能声称已存在旧接口。
- 若本期确认 Dashboard 关注映射，需要新增通用关注契约。
- 若不确认，Dashboard “我的关注事项”只能先使用“我负责/我参与”的派生集合，不能伪造持久关注。

### 7.6 Risk/Blocking/Deadline 接口

旧服务：无独立风险接口。

可复用数据：

- Task.dependencies/status/due_date。
- Requirement.deadline/status。
- task_dependencies。

建议新增只读 Projection 接口，不新增风险写接口，不新增人工风险字段。

## 八、DB 现状与目标模型判断

### 8.1 旧 DB 现状

| 对象 | 现状 |
| --- | --- |
| requirement 表 | 有：`requirements` |
| task 表 | 有：`tasks` |
| requirement-task | `tasks.requirement_id` 一对多 |
| task dependency | 有：`task_dependencies` |
| follow/favorite/watch | 无 |
| report | `daily_reports`、`team_reports` |
| session | `sessions` |
| token | `token_usage`，含 task_id/requirement_id |
| archived_at | 无 |
| completed_at | Requirement/Task 均无 |
| task progress | 无；只有 `requirements.progress` |
| requirement deadline | 有：`requirements.deadline` |
| task due_date | 有：`tasks.due_date` |
| risk 字段/表 | 无；Task status 允许 blocked，但没有风险实体 |
| TokenSource 多关联 | 无；Session/TokenUsage 当前各只有单个 task_id/requirement_id |

### 8.2 复用旧表

- requirements。
- requirement_teams。
- tasks。
- task_dependencies。
- sessions。
- token_usage。
- daily_reports。
- team_reports。
- users、teams。

### 8.3 扩展旧表：仅作为契约差距，不在本文执行

| 表 | P0/映射需要的缺口 | 确认状态 |
| --- | --- | --- |
| requirements | P0 四阶段、completed_at；可能需要 archived_at | 四阶段/completed_at 有依据；archived_at 未确认 |
| tasks | progress、completed_at；blocked 应优先派生 | progress P0 已确认；历史审计未确认 |
| requirements/tasks | TokenSource 多关联 | P0 已确认关联语义，具体表结构未确认 |

### 8.4 可能新增表

| 候选表 | 用途 | 结论 |
| --- | --- | --- |
| `user_favorites` | 用户关注 requirement/task | 仅在关注能力单独确认后新增；支持 target_type + target_id |
| `token_source_links` | TokenSource 与 requirement/task 多关联 | P0 数据模型所需，具体实现由 Requirements 架构决定 |
| task progress audit | 记录报告同步等更新来源 | P0 未要求 UI；是否落表待确认 |

### 8.5 不建议新增表

- dashboard 表。
- dashboard_follow_items 表。
- dashboard_risks 表。
- 人工 blocking/risk 表。
- Dashboard 自己的 requirement/task 镜像表。
- Session 数统计表。

### 8.6 本期不处理

- report 统一模型重构。
- weekly/department report 新表。
- Skill 表。
- 飞书发送记录表。
- 通知表。

### 8.7 核心模型结论

- Requirements 是事实主数据。
- Dashboard 是 Projection 消费者。
- Follow 若新增，应是跨页面通用关系，不属于 Dashboard 私有表。
- 风险优先派生，不落库。
- Dashboard 原则上不落业务数据，只可缓存查询结果。

## 九、数据分层设计

### 9.1 DB Model 层

职责：持久化 Requirement、Task、Dependency、TokenSource 归属、Follow（若确认）、Report、Session、TokenUsage。

禁止：存 Dashboard 卡片文案、颜色、排序结果或重复风险字段。

### 9.2 Domain 层

Requirements Domain 统一负责：

- 需求阶段合法性。
- 任务状态和 0–100 进度规则。
- 同一需求依赖约束和循环校验。
- display_status/blocked 派生。
- overdue/due_soon 派生基础规则。
- 需求任务完成聚合。
- 需求 Token 汇总。
- 完成/取消默认范围。

Dashboard 不重复实现这些规则。

### 9.3 Service 层

用例：

- RequirementQueryService。
- RequirementCommandService。
- TaskCommandService。
- FollowService（若确认）。
- TokenSourceService。
- ReportService。
- SessionService。
- TokenQueryService。

Dashboard 任务建议确认必须调用 TaskCommandService，不能直接更新 tasks 表。

### 9.4 Projection 层

建议只读投影：

- RequirementsListProjection。
- RequirementDetailProjection。
- DashboardFollowProjection。
- DashboardRiskProjection。
- DashboardTaskSuggestionProjection。
- DashboardNavigationProjection。

Projection 可组合多个 Service/Repository，但不产生新的事实状态。

### 9.5 API DTO 层

API DTO 面向页面用例，不直接暴露 DB 行；统一状态枚举、空值和日期格式。

### 9.6 Frontend ViewModel 层

职责：

- DTO 到组件展示文案。
- 展示排序和分组。
- URL navigation target。
- loading/error/empty。

禁止：

- 直接写 requirement.progress。
- 自行判断最终 blocked/risk。
- 根据 Session/Token 自动修改任务进度。
- 维护独立关注集合。

## 十、数据流设计

### 10.1 Requirements 数据流

| 数据流 | 前端动作 | 接口草案 | Service/DB | 派生 | 刷新策略 |
| --- | --- | --- | --- | --- | --- |
| 列表加载 | 打开页面/筛选 | GET requirements | QueryService 读 requirements/tasks/follows/token links | task summary、blocked、recent done | Query key 按筛选缓存 |
| 详情加载 | 点击卡片 | GET requirement detail | 读 requirement/tasks/deps/token links | 聚合进度、Token、display status | Drawer 独立 query |
| 创建需求 | 提交表单 | POST requirements | 写 requirements + teams | 无 | invalidate requirements/dashboard |
| 更新需求 | 编辑/拖动阶段 | PATCH requirement | 校验阶段并写 | completed_at | invalidate detail/list/dashboard |
| 创建任务 | 抽屉内弹窗 | POST tasks | 写 task/dependencies | blocked/聚合 | invalidate task tree/detail/dashboard |
| 更新任务 | 任务详情保存 | PATCH task | 写合法字段 | display status/聚合 | 同上 |
| 更新依赖 | 选择上游 | PUT task dependencies | 事务替换 dependency | blocked/risk | 同上 |
| 更新进度 | Slider/InputNumber 保存 | PATCH task progress | TaskCommandService 写 progress | status提示、需求聚合 | 同上 |
| 关注需求 | 点击关注 | POST favorite | 若确认，写 user_favorites | 无 | invalidate favorites/dashboard |
| 关注任务 | 点击关注 | POST favorite | 同上 | 无 | 同上 |
| 完成需求 | 阶段变更 | POST/PUT complete | 写 done/completed_at | recent done | invalidate list/dashboard |
| 归档需求 | 条件性动作 | archive endpoint | P0 未确认 | 默认范围 | 待确认 |
| 风险派生 | 查询时 | risk projection | 读 deps/status/due dates | blocked/overdue/due_soon | 数据变更即失效 |
| Token 摘要 | 打开卡片/详情 | token source summary | 读 token links/token_usage | requirement total | token link 变更失效 |

### 10.2 Dashboard 数据流

| 数据流 | 前端动作 | 接口 | 后端/DB | 派生 | 刷新策略 |
| --- | --- | --- | --- | --- | --- |
| 初始化 | 打开 Dashboard | 多投影接口或 dashboard summary | 聚合 requirements/reports/tokens | 角色 scope | 并行 Query，模块独立失败 |
| 我的关注 | 页面加载 | GET dashboard/follows | FollowProjection + Requirements | 状态、阻塞、排序字段 | requirements/favorite 更新失效 |
| 待处理风险 | 页面加载 | GET dashboard/risks | RiskProjection | blocked/overdue/due_soon | task/dependency/date 更新失效 |
| 今日报告 | 页面加载 | GET reports summary | daily/team reports | 状态/coverage | 报告操作后失效 |
| 日报弹窗 | 点击生成/编辑 | GET report edit context | reports + sessions + tasks | 来源推荐 | report/date key |
| 任务建议 | 打开弹窗/生成 | GET suggestions | TaskProjection + report/session evidence | LLM 仅建议 | 重新生成或任务更新失效 |
| Token 统计 | 页面加载/切范围 | GET tokens | token_usage | totals/groups/series | range key |
| Session 概览 | 页面加载 | GET session upload summary | sessions/users | upload coverage | date/range key |
| 点击关注 | 点击详情 | 无写接口 | 使用 NavigationTarget | 无 | Router 打开 Requirements |
| 点击风险 | 点击处理 | 无写接口 | 使用 NavigationTarget | 无 | 同上 |
| 编辑任务建议 | 用户确认 | Task update endpoint | TaskCommandService | Requirements 聚合/风险 | 成功后刷新 requirements/dashboard |
| Requirements 变更 | 其他页面操作 | 无直接动作 | 主数据变化 | Projection 更新 | 返回 Dashboard 时 stale/refetch |

## 十一、接口契约草案

以下是正式开发前契约草案，不代表本次已修改接口。

### 11.1 Requirements 接口

#### 需求列表

- Method/Path：`GET /api/v1/requirements`
- Request：stage、priority、risk、favorite、keyword、include_recent_done。
- Response：`RequirementListItemDTO[]`。
- 判断：扩展旧接口。
- 页面：需求看板、任务树。
- 校验/错误：非法枚举 400；按角色过滤。

#### 需求详情

- `GET /api/v1/requirements/{id}`。
- Response：`RequirementDetailDTO`。
- 扩展旧接口；404/403。

#### 创建需求

- `POST /api/v1/requirements`。
- Request：title、description、acceptance_criteria、priority、due_date、team_ids、feishu_url。
- Response：RequirementDetailDTO。
- 扩展旧接口；验收标准由表单提交，不强制 AI 生成。

#### 更新需求

- `PATCH /api/v1/requirements/{id}`。
- Request：P0 允许更新字段。
- Response：RequirementDetailDTO。
- 旧接口为 PUT，建议兼容。

#### 完成需求

- `POST /api/v1/requirements/{id}/complete`。
- Response：RequirementDetailDTO。
- 新增语义接口或复用 PATCH stage=done。
- 关键校验：权限、completed_at。

#### 归档/取消归档

- 候选：`POST /requirements/{id}/archive`、`DELETE /requirements/{id}/archive`。
- 状态：P0 未确认；只为满足历史查询契约盘点，不应在确认前实现。

#### 任务列表/任务树

- `GET /api/v1/requirements/{id}/tasks` 或复用 `GET /tasks?requirement_id=`。
- Response：RequirementTaskDTO[]。
- 需含 progress、display_status、dependencies summary。

#### 创建任务

- `POST /api/v1/requirements/{id}/tasks` 或兼容旧 POST `/tasks`。
- Request：title、owner_id、priority、due_date、upstream_task_ids。
- 校验：同一 requirement、无自依赖/循环依赖。

#### 更新任务

- `PATCH /api/v1/tasks/{id}`。
- Request：P0 基础字段，不接受人工 blocked。
- Response：RequirementTaskDTO。

#### 删除任务

- 候选：`DELETE /api/v1/tasks/{id}`。
- P0 未确认；需定义有依赖、Token 来源和已完成时的策略后才能实现。

#### 更新任务依赖

- 推荐 `PUT /api/v1/tasks/{id}/dependencies`，Request `{upstream_task_ids:[]}`。
- 可兼容旧 POST/DELETE 单条接口。
- 返回任务及新风险摘要。

#### 更新任务进度

- `PATCH /api/v1/tasks/{id}/progress`。
- Request `{progress,status?,source_type?,source_id?}`。
- 校验 0–100；不要求 TokenSource；不接受自动 blocked。

#### 关注/取消关注需求、任务

- `POST /api/v1/favorites`，Request `{target_type,target_id}`。
- `DELETE /api/v1/favorites/{target_type}/{target_id}`。
- Response：RequirementFollowStateDTO。
- 新增接口，前提是关注能力单独确认。

### 11.2 Dashboard 接口

#### 获取我的关注事项

- `GET /api/v1/dashboard/follows?include_assigned=true`。
- Response：DashboardFollowItemDTO[]。
- 新增 Projection 接口。
- 若关注未确认，仅返回 assigned/participated，不能返回虚假 favorited。

#### 获取待处理风险

- `GET /api/v1/dashboard/risks?types=dependency_blocker,overdue,due_soon`。
- Response：DashboardRiskItemDTO[]。
- 新增只读 Projection；不落风险表。

#### 获取今日报告摘要

- `GET /api/v1/dashboard/reports/today`。
- Response：DashboardReportSummaryDTO[] + coverage。
- 可包装复用旧 report service。

#### 获取日报编辑弹窗数据

- `GET /api/v1/reports/{id}/edit-context` 或组合旧接口。
- Response：DashboardReportEditDTO。
- 本期不做完整报告重构；契约仅记录现状需要。

#### 获取日报任务进展建议

- `GET /api/v1/reports/{id}/task-suggestions`。
- Response：DashboardTaskSuggestionDTO[]。
- 新增投影；建议值不写任务。

#### 获取 Token 统计

- 复用 `GET /api/v1/tokens`。
- Response 可直接用 TokenAggregation 或适配 DashboardTokenSummaryDTO。

#### 获取 Session 上传概览

- 候选 `GET /api/v1/dashboard/session-upload-summary?range=`。
- 可由 sessions/users 聚合；当前无旧接口直接返回 coverage。
- Response：DashboardSessionUploadSummaryDTO。

#### 获取跳转参数

- 不建议单独接口。
- Follow/Risk/Suggestion DTO 内返回 DashboardNavigationTargetDTO。

### 11.3 接口错误场景统一

- 400：非法状态、进度、依赖、筛选。
- 401：未登录。
- 403：无数据范围/操作权限；页面数据请求应模块内展示，不应全局跳走。
- 404：对象不存在或不可见。
- 409：重复关注、循环依赖、状态冲突、乐观锁冲突。
- 422：业务规则不满足。

## 十二、前端数据需求

### 12.1 Requirements DTO

#### RequirementListItemDTO

组件：RequirementCard、RequirementTree requirement row。

字段：id、title、description、stage、priority、teams、due_date、updated_at、completed_at、task_summary、risk_summary、token_summary、follow_state。

派生：task_summary、risk_summary、token_summary；前端不计算最终值。

#### RequirementDetailDTO

组件：RequirementDetailDrawer。

字段：列表字段 + creator、acceptance_criteria、feishu_url、tasks、direct_token_sources、permissions。

#### RequirementTaskDTO

组件：TaskTree row、TaskDetailDrawer、Dashboard task suggestion。

字段：id、requirement_id/title、title、owner、status、display_status、progress、priority、due_date、dependencies、token_summary、updated_at、completed_at、follow_state。

#### TaskDependencyDTO

字段：task_id、title、status、progress、completed、blocks_current。

后端派生：blocks_current。

#### RequirementRiskSummaryDTO

字段：blocked_task_count、overdue_task_count、due_soon_task_count、deadline_risk。

后端派生，前端不重复计算。

#### RequirementFollowStateDTO

字段：favorited、relation_type、created_at。

来源：若关注能力确认则来自 follow service；否则 relation_type 只表示 assigned/participated。

#### TokenSourceSummaryDTO

字段：source_id、occurred_at、tool、uploader、token_count、summary、link_type、linked_requirement_id、linked_task_id。

来源：Session/Token 服务 + Requirements Token link。

### 12.2 Dashboard DTO

#### DashboardFollowItemDTO

组件：FollowCard。

字段：id、object_type、title、requirement_id、task_id、owner、display_status、due_date、risk_summary、recent_activity、relation_type、navigation。

来源：Requirements 主数据 + Follow Projection。状态和风险后端派生。

#### DashboardRiskItemDTO

组件：RiskCard。

字段：id、risk_type、level、source_label、title、reason、owner、due_date、affected_object、requirement_id、task_id、navigation。

来源：Requirements Risk Projection；不落 Dashboard 表。

#### DashboardReportSummaryDTO

组件：ReportSection、ReportTaskRow。

字段：id、kind、scope、name、status、description、source_summary、generate_mode、updated_at、next_at、coverage、available_actions。

来源：Report service；Requirements 只贡献 source summary。

#### DashboardReportEditDTO

组件：ReportModalContent。

字段：report summary、content_markdown、source_options、selected_source_ids、task_suggestions、generation_settings。

来源：Report + Session/Token + Requirements Task Projection。

#### DashboardTaskSuggestionDTO

组件：TaskProgressSuggestionList、TaskProgressEditModal。

字段：task_id、requirement_id、task_name、current_progress、suggested_progress、current_status、suggested_status、evidence、note、sync_state、navigation。

Requirements 提供当前值；报告/LLM 只提供 suggested 值；最终值必须用户确认。

#### DashboardTokenSummaryDTO

组件：SessionUploadCard 内 Token 图表组件。

字段：range、scope、total_tokens、input/output/cache、series、groups、my_total。

来源：Token service。前端只格式化 K/M。

#### DashboardSessionUploadSummaryDTO

组件：SessionUploadCard 当前上传概览部分。

字段：range、status、uploaded_user_count、expected_user_count、source_record_count、series、groups。

来源：Session service；不进入 Requirements 主数据。

#### DashboardNavigationTargetDTO

组件：FollowCard、RiskCard、TaskSuggestion。

字段：route、requirement_id、task_id、focus、query。

来源：Projection；前端只负责 navigate。

## 十三、兼容与迁移策略

### 13.1 Dashboard 保留

- 当前页面布局和模块顺序。
- FollowCard、RiskCard、ReportSection、Token 图表等展示组件。
- 状态到按钮/标签的显示映射。
- `/reports`、`/tokens`、`/requirements` 入口。

### 13.2 Dashboard Mock 替换

- ROLE_DATA → 当前用户 + Follow/Risk/Report Projection。
- TOKEN_DATA → `/tokens`。
- SESSION_OPTIONS → 报告编辑上下文中的 Token/Session 来源。
- TASK_PROGRESS_SUGGESTIONS → 真实 task suggestion DTO。
- REPORT_SKILL_OPTIONS、上传 Skill → 本期不处理，保留现状或隐藏，不能顺带建设。

### 13.3 旧接口复用/扩展

- requirements/tasks：扩展为 P0 DTO；避免 Dashboard 直接拼多接口计算规则。
- reports：保留个人/团队日报旧能力。
- sessions/tokens：保留统计和来源能力。
- follow/risk：旧接口不存在，确认后新增 Projection/关系接口。

### 13.4 Requirements 页面接入

- 用真实 DTO 替换 Mock types/API。
- 保持 P0 页面结构和交互，不重写页面。
- Query keys 与 Dashboard 使用同一主数据命名空间，便于 invalidation。

### 13.5 缺失关系的迁移判断

- Follow：无旧数据，不需要历史迁移；新表上线后默认空。负责人/参与关系通过派生补足。
- Dependency：旧表已有，无需新表；补校验与派生。
- completed_at：旧完成记录可用 updated_at 一次性回填。
- archived_at：P0 未确认；不应提前迁移。
- Task progress：旧 DB 无；默认值策略需 Requirements 实施方案确认，不能由 Dashboard 决定。
- Token links：旧 session/task 归属可作为初始链接来源，复杂多关联迁移由 Requirements 架构确认。

### 13.6 避免双套逻辑

- 所有 status/stage 枚举来自同一 Domain contract。
- Risk Projection 调用 Requirements Domain 规则。
- FollowProjection 读取同一 follow service。
- Dashboard 不缓存可写业务状态。
- 前端只做展示排序，不做最终风险、阻塞和聚合判定。

## 十四、验收场景

1. Requirements 页面继续符合两份 P0 定稿文档。
2. Dashboard 当前激活页面的角色切换、关注、报告、弹窗、周报、Token、Session 概览、风险、按钮和跳转均已盘点。
3. Requirements 关注需求后，Dashboard 出现该需求；前提是关注能力已单独确认。
4. 取消关注后 Dashboard 移除该需求。
5. 关注任务后 Dashboard 出现真实 task_id 的任务。
6. 上游未完成派生 blocked 后，Dashboard 风险出现。
7. 删除依赖后，Requirements 和 Dashboard blocked 同时消失。
8. 未完成且过期时 Dashboard 出现 overdue。
9. 进入确认的临期阈值时出现 due_soon。
10. 点击关注需求打开对应 Requirements 需求抽屉/深链。
11. 点击关注任务或风险打开对应任务抽屉/深链。
12. 日报建议绑定真实 requirement/task。
13. LLM 建议不会自动写进度。
14. 用户确认后才调用任务更新接口。
15. Token 统计继续复用旧逻辑。
16. Session 上传概览继续属于 Session 域。
17. Dashboard 不直接写 requirement.progress。
18. Dashboard 不计算最终风险。
19. Dashboard 不维护独立关注列表。
20. 前端不根据 Session/Token 自动修改任务进度。
21. Requirements 数据更新后 Dashboard Projection 能刷新。
22. 单个 Dashboard 模块请求失败不影响其他模块。

## 十五、明确不做

- 重新设计 Requirements 范围。
- 新增 P0 文档之外的 Requirements 功能。
- 重新设计完整 Dashboard。
- 独立关注中心。
- 独立风险中心。
- 通知中心。
- 评论、注释、审批。
- 跨需求依赖。
- 多级任务树。
- 人工阻塞字段和阻塞原因。
- 自动根据 Session 修改任务进度。
- 自动根据 Token 修改任务进度。
- 自动完成任务。
- 自动归档需求。
- 完整日报系统重构。
- 完整周报系统重构。
- Skill 上传与管理。
- 飞书发送。
- Token 明细页重构。
- 权限管理页重构。
- Dashboard 独立业务表。

## 十六、最终结论

1. Requirements P0 是需求、任务、依赖、进度、完成状态和 Token 来源关联的唯一主数据边界。
2. Dashboard 当前全部业务数据均为前端 Mock；现有真实接口只在独立 Reports、Tokens、Sessions 等页面使用。
3. Dashboard 的“我的关注事项”“待处理风险”“任务建议”“需求/任务跳转”必须消费 Requirements 主数据或其 Projection。
4. 报告、Session、Token 属于独立域，可复用旧服务；它们只能为 Requirements 提供来源或建议，不能自动改变任务进度。
5. 关注能力在当前 Requirements Mock 中已有实现痕迹，但未被 P0 定稿文档确认；需要单独决策，不能反向扩展 P0。
6. 风险不应落 Dashboard 独立表，应由任务依赖、状态和截止日期统一派生。
7. Dashboard 不需要业务主表，是 Requirements 与旧服务能力的查询投影和导航入口。
8. 正式编码前应先冻结 P0 DTO、关注决策、临期阈值和跳转契约，再替换 Mock；本文不执行任何实现改动。

