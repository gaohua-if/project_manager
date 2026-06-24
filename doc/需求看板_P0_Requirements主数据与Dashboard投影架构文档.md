# AIcoding 管理平台 - Requirements 主数据与 Dashboard 投影架构

> 状态：P0 实现口径已冻结  
> 日期：2026-06-24  
> 依据：`doc/需求看板_P0_需求文档.md` 与 `doc/需求看板_P0_架构文档.md`

## 1. 目标与边界

- `requirements` 是需求、任务、依赖、进度、关注和风险的主数据域。
- `dashboard` 是当前用户视角的 projection，不是独立业务域，不复制 Requirements 的状态、关注和风险规则。
- Dashboard 只读取后端聚合结果并提供跳转入口；不直接写需求进度，不计算最终风险，不维护独立关注列表。
- Requirements 与 Dashboard 共享同一份需求/任务数据、关注关系和风险派生结果。
- 本文档只冻结本次正式开发所需的最小闭环，不重新设计需求看板或完整 Dashboard。

## 2. 数据权威与分层

| 层 | 职责 | P0 实现 |
|---|---|---|
| DB Model | 保存 Requirement、Task、Dependency、Follow 事实 | 复用旧表，新增任务进度和关注表 |
| Requirements Domain/Service | 任务阻塞、超期、临期、需求进度聚合 | 后端统一计算 |
| Projection | 将主数据投影为“我关注的事项”和“待处理风险” | Dashboard 只读 API |
| API DTO | 返回页面需要的稳定字段 | 不暴露前端自行推导所需的底层细节 |
| Frontend ViewModel | 文案、日期和 Token 显示格式化 | 不决定 blocked/overdue/due_soon |

## 3. Requirement 与 Task 口径

### 3.1 Requirement 阶段

现有页面与旧接口的存储值继续使用：

| 页面阶段 | 存储值 |
|---|---|
| 待开始 | `todo` |
| 评审 | `review` |
| 进行中 | `active` |
| 完成 | `completed` |
| 已取消（仅筛选） | `cancelled` |

需求进度是所有任务 `progress` 的聚合结果，前端不允许直接写 Requirement progress。

### 3.2 Task 存储状态

- `task.status` 只保存 `todo | in_progress | done`。
- `blocked` 不是人工状态，是 Requirements Domain 根据未完成上游依赖派生的 `display_status` 和 risk。
- 前端和 Dashboard 不允许写入 `status=blocked`。旧数据中的 `blocked` 在迁移时转为 `in_progress`。
- 状态改为 `done` 时后端将进度同步为 100；进度改为 100 不自动完成任务。
- 任务进度为 0-100 的用户确认值，不依赖 Session 或 Token。

### 3.3 依赖

- P0 仅支持同一 Requirement 内的任务依赖。
- 禁止自依赖、跨需求依赖和形成环。
- 依赖变更后不回写 blocked；下次查询立即重新派生。

## 4. 关注模型

本期确认实现需求和任务关注，不再作为待确认项。

```text
user_follows
- user_id UUID
- target_type requirement | task
- target_id UUID
- created_at TIMESTAMPTZ
- PRIMARY KEY (user_id, target_type, target_id)
```

- Requirements 页面是关注/取消关注的维护入口。
- Dashboard “我关注的事项”只从该关系表生成投影。
- 写入前校验目标存在且当前用户可见；重复关注幂等，取消关注物理删除。
- 不关注节点、评论、团队，不做关注人列表、通知和复杂订阅规则。

## 5. 风险模型

P0 风险只派生，不单独落库：

| 类型 | 规则 |
|---|---|
| `blocked` | 未完成任务存在状态不为 `done` 的上游依赖 |
| `overdue` | 任务未完成且 `due_date < today` |
| `due_soon` | 任务未完成且截止日期在未来 48 小时内 |

- 规则由 Requirements Domain/Service 统一执行。
- Requirements 列表、详情和任务 DTO 返回派生风险；Dashboard 风险列表使用同一投影。
- 风险项必须同时带 `requirement_id`/`task_id` 与导航目标。
- 不新增风险中心、风险状态机、人工阻塞、通知中心或风险表。

## 6. 完成与归档

- Requirement 完成后进入 `completed`。
- 看板完成列默认展示最近 7 天且最多 10 条，全部完成通过筛选/任务树查看。
- `cancelled` 不进入主看板列，只通过筛选查看。
- P0 不实现 archive/unarchive，不新增 `archived_at`，不自动归档已完成需求。

## 7. Dashboard 投影

### 7.1 我关注的事项

- 输入：当前用户的 `user_follows` + Requirement/Task 主数据 + Requirements 风险派生结果。
- 输出：类型、标题、所属需求、负责人、展示状态、截止日期、最高优先级风险、最近更新和导航目标。
- 完成和已取消 Requirement 默认不进入 Dashboard 关注投影，关注关系本身不删除。

### 7.2 待处理风险

- 输入：当前用户可见/负责/关注范围内的未完成任务。
- 输出：风险类型、级别、原因、影响对象、负责人、截止日期、Requirement/Task 定位参数。
- Dashboard 不在浏览器中重新计算 blocked/overdue/due_soon。

### 7.3 导航

```text
/requirements?requirementId={requirement_id}
/requirements?requirementId={requirement_id}&taskId={task_id}
```

Requirements 页面读取参数后打开对应需求或任务抽屉，不增加第三个视角。

## 8. API 与 DTO 最小集

### 8.1 复用/扩展旧接口

- `GET /api/v1/requirements`：扩展任务摘要、风险摘要、关注态和 Token 来源 ID。
- `GET /api/v1/requirements/{id}`：扩展同上详情字段。
- `POST /api/v1/requirements`：接收用户填写的 `acceptance_criteria`。
- `PUT /api/v1/requirements/{id}`：更新阶段及现有基础字段。
- `GET /api/v1/tasks`、`GET /api/v1/tasks/{id}`：扩展 `progress`、`display_status`、`risk_types`、依赖和 Token 来源 ID。
- `POST /api/v1/tasks`、`PUT /api/v1/tasks/{id}`、`PUT /api/v1/tasks/{id}/status`：复用并禁止写入 blocked。
- `PUT /api/v1/tasks/{id}/progress`：新增最小进度接口。
- `POST /api/v1/tasks/{id}/dependencies`、`DELETE /api/v1/tasks/{id}/dependencies/{dep_id}`：复用并增加同需求/无环校验。

### 8.2 关注与 Dashboard 投影接口

- `GET /api/v1/follows`
- `POST /api/v1/follows`
- `DELETE /api/v1/follows/{target_type}/{target_id}`
- `GET /api/v1/dashboard/follows`
- `GET /api/v1/dashboard/risks`

核心 DTO：`RequirementListItemDTO`、`RequirementDetailDTO`、`RequirementTaskDTO`、`TaskDependencyDTO`、`RequirementRiskSummaryDTO`、`RequirementFollowStateDTO`、`DashboardFollowItemDTO`、`DashboardRiskItemDTO`、`DashboardNavigationTargetDTO`。DTO 以现有页面实际字段为上限，不引入通用查询 DSL 或独立 Dashboard 表。

## 9. 日报、Token 与 Session 边界

- Dashboard 今日报告、日报弹窗、Token 统计和 Session 上传概览优先保持旧逻辑。
- 日报任务建议后续可关联真实 `requirement_task`，但 Session/LLM/Token 只能生成摘要或进展建议。
- 只有用户在结构化任务交互中确认后，才能调用 Task API 修改状态或进度。
- 不新增 `report_task_updates` 状态机，不重构完整日报/周报系统，不做 Skill 上传管理和飞书发送。

## 10. 一致性与刷新

- Task 进度/状态写入与 Requirement 进度重算在同一后端请求内完成。
- Follow 写入成功后前端同时失效 Requirements follow 与 Dashboard follow/risk query。
- 依赖、截止日期和任务状态变更后，Requirements 和 Dashboard 均通过重查后端 projection 获得一致结果。
- Dashboard 不单独落库；除旧报告或 Token 服务已有缓存外，不新增 Dashboard 缓存表。

## 11. P0 明确不做

手动归档/取消归档、自动归档、独立关注中心、独立风险中心、通知中心、评论、审批、跨需求依赖、多级任务树、人工阻塞、依据 Session/Token 自动改进度、自动完成任务、完整日报/周报重构、部门报告、Skill 管理、飞书发送、Token 明细页重构、权限管理页重构。
