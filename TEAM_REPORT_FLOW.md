# 团队日报需求文档

## 背景

当前系统支持员工基于个人 Claude Code session 生成个人日报。Team Leader（TL）需要在下班前汇总团队工作情况，向上级汇报。

目前 TL 的痛点：
- 需要逐个查看组员日报，手动复制拼接
- 缺少自身工作的系统化记录
- 无法一键生成团队维度的汇总

## 目标

TL 在 Web 端一键生成团队日报。团队日报的原始数据来源：
1. **TL 自己的 session** — 从 `sessions` 表获取 TL 当天的 Claude Code session
2. **组员日报** — 从 `daily_reports` 表获取本组员工当天已生成的日报

生成后 TL 可以编辑内容，但**组员的日报 TL 只能查看不能修改**。

## 参与角色

| 角色 | 权限 |
|------|------|
| Employee | 查看/编辑自己的日报，生成自己的 AI 日报 |
| Team Leader | 查看本组员工日报（只读），生成团队日报 |
| PM | 查看本组所有日报（只读） |
| Director | 查看所有日报，可编辑任何日报 |

## 数据模型

### 已有表

```sql
-- 个人日报（每用户每天一条）
daily_reports (
  id, user_id, report_date, content, edited,
  feishu_doc_url, session_ids, created_at, updated_at
  UNIQUE (user_id, report_date)
)

-- Session 记录
sessions (
  id, user_id, started_at, ended_at, model, summary,
  task_id, requirement_id, ...
)
```

### 新增表

```sql
-- 团队日报（每团队每天一条）
team_reports (
  id                UUID PRIMARY KEY,
  team_id           UUID REFERENCES teams(id),
  leader_id         UUID REFERENCES users(id),    -- 生成该日报的 TL
  report_date       DATE,
  content           TEXT,                          -- 生成的完整 Markdown
  feishu_doc_url    TEXT,                          -- 飞书文档链接
  member_report_ids UUID[],                        -- 引用的组员日报 ID 列表
  session_ids       UUID[],                        -- TL 自身引用的 session ID 列表
  created_at        TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ,
  UNIQUE (team_id, report_date)
)
```

设计理由：团队日报和个人日报是不同的实体 — 一个按 user_id 去重，一个按 team_id 去重。分开存储避免在 `daily_reports` 上加 `report_type` 列导致所有查询都需要感知类型。

## 团队日报内容结构

生成的团队日报 Markdown 结构如下：

````markdown
# 团队日报 {团队名} {日期}

## TL 工作

### Session 明细
1. `{session_ref}` (model) [关联任务] - session summary
2. ...

### Token 消耗
今日合计: xxx tokens

## 组员日报

### 张三
{张三的 daily_report.content}

### 李四
暂无日报

## 团队总结
{AI 生成的整体工作摘要}
````

### 数据来源

| 区块 | 数据来源 | 说明 |
|------|----------|------|
| TL 工作 | `sessions` 表，`WHERE user_id = tl_id AND DATE(started_at) = today` | 与个人日报逻辑一致，复用已有的 `generateReportContent` |
| 组员日报 | `daily_reports` JOIN `users`，`WHERE team_id = tl.team_id AND role = 'employee' AND report_date = today` | 组员必须先各自生成个人日报 |
| 团队总结 | AI 生成| 基于上述内容让 Claude 总结 |

### 边界情况

| 场景 | 处理方式 |
|------|----------|
| 组员未生成个人日报 | 显示 "暂无日报"，不影响团队日报生成 |
| TL 当天无 session | TL 工作区块显示 "暂无 session 数据" |
| 重复生成 | UPSERT，覆盖当天已有的团队日报 |
| 组员编辑了个人日报 | 团队日报需重新生成才能拿到最新内容（不自动同步） |
| TL 不是 team_leader 角色 | 返回 403 Forbidden |

## 生成流程

```text
TL 在 Web 点击 "Generate Team Report"
        |
        v
POST /api/v1/reports/team/today/generate
Authorization: Bearer <tl-token>
        |
        v
Go API 校验角色 = team_leader
        |
        +---> 查 TL 当天 sessions (复用 generateReportContent)
        |
        +---> 查本组员工当天 daily_reports
        |         LEFT JOIN 保证无日报的组员也会列出
        |
        +---> 调用 report-generator 微服务调用claude
        |
        +---> UPSERT team_reports
        |         INSERT ON CONFLICT (team_id, report_date) DO UPDATE
        |
        v
返回 TeamReport JSON → Web 展示
```



## API 设计

### 查看组员日报（只读）

```
GET /api/v1/reports/team/members?date=2026-06-11
```

权限：team_leader, pm, director

返回：

```json
[
  {
    "user_id": "uuid",
    "user_name": "张三",
    "report_id": "uuid | null",
    "content": "日报内容，未提交则为空",
    "has_report": true
  }
]
```

### 生成团队日报

```
POST /api/v1/reports/team/today/generate
```

权限：team_leader（仅限）

### 获取今天的团队日报

```
GET /api/v1/reports/team/today
```

权限：team_leader

### 历史团队日报列表

```
GET /api/v1/reports/team?from=2026-06-04&to=2026-06-11
```

权限：team_leader, pm, director

### 编辑团队日报

```
PUT /api/v1/reports/team/{id}
Body: { "content": "...", "feishu_doc_url": "https://..." }
```

权限：team_leader（仅限）

## 前端交互

### Reports 页面 — Team Leader 视图

TL 的 Reports 页面使用双 Tab 布局：

```
┌─────────────────────────────────────────────────┐
│  Team Reports                        [Generate My Report] │
│                                                   │
│  ┌──────────────┐ ┌────────────────┐             │
│  │ Team Daily   │ │ Member Reports │             │
│  │ Report  ◀──  │ │                │             │
│  └──────────────┘ └────────────────┘             │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │ Today's Team Report          [Edit] [Generate]│ │
│  │                                               │ │
│  │ 团队日报 AI工程 2026-06-11                    │ │
│  │                                               │ │
│  │ ## TL 工作                                    │ │
│  │ 1. abc123 (sonnet) [登录功能] - 完成登录...   │ │
│  │                                               │ │
│  │ ## 组员日报                                   │ │
│  │ ### 张三                                      │ │
│  │ 完成了数据库迁移...                           │ │
│  │ ### 李四                                      │ │
│  │ 暂无日报                                      │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  History                                          │
│  ▸ 2026-06-10 — AI工程                            │
│  ▸ 2026-06-09 — AI工程                            │
└─────────────────────────────────────────────────┘
```

### Member Reports Tab

```
┌─────────────────────────────────────────────────┐
│  Date: [2026-06-11]                              │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │ 张三  ✅ Submitted                           │ │
│  │ 完成了数据库迁移和 API 接口开发...            │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │ 李四  — Not submitted                        │ │
│  │ No report for this date.                     │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

关键交互约束：
- 组员日报区域**无编辑按钮**，纯只读展示
- 组员状态用绿色 `Submitted` / 灰色 `Not submitted` 标记
- 日期选择器默认今天，可切换查看历史
- 团队日报可编辑内容和飞书链接

### Employee 视图 — 不变

员工仍然只能看到和编辑自己的个人日报，无任何团队相关功能。

### Director / PM 视图 — 不变

Director 和 PM 看到已有的按日期分组的全量日报视图，director 可编辑任意日报。

## 涉及文件

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `api/db/migrations/004_team_reports.sql` | 新增 | team_reports 表 |
| `api/model/models.go` | 修改 | TeamReport, TeamMemberReport, UpdateTeamReportRequest |
| `api/handler/report.go` | 修改 | 5 个新 handler 方法 |
| `api/main.go` | 修改 | 注册新路由 |
| `web/src/lib/types.ts` | 修改 | TeamReport, TeamMemberReport 接口 |
| `web/src/lib/api.ts` | 修改 | 5 个新 API 方法 |
| `web/src/app/(app)/reports/page.tsx` | 修改 | TL 双 Tab 布局 |

## 验证清单

- [ ] team_reports 表正确创建，UNIQUE 约束生效
- [ ] TL 登录后 Reports 页面显示双 Tab
- [ ] Team Daily Report Tab：生成、查看、编辑、历史折叠
- [ ] Member Reports Tab：日期切换、只读展示、状态标记
- [ ] 组员日报无编辑按钮
- [ ] Employee 登录后视图无变化
- [ ] Director/PM 登录后视图无变化
- [ ] 重复生成覆盖旧内容（UPSERT）
- [ ] 非 team_leader 角色调用生成接口返回 403
