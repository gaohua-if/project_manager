# Aida — PRD & Architecture Design

## 1. 背景与目标

AI 部门 40 名员工 + 5 名管理人员（1 总监 + 3 TL + 1 PM），每人日常使用 Claude Code / Codex / OpenClaw 等 AI agent 辅助开发。构建中心化 Dashboard，通过员工自主上报 session log，实现需求驱动、任务执行追踪和自动化报告。

**核心目标：**
- AI 自动生成日报/周报到飞书文档，无需人工填写
- 需求进度实时可见（需求 → 任务 → Session → 交付）
- Token 消耗统计精确到任务粒度
- 需求创建时自动匹配验收标准
- 分角色视图（总监/TL/PM/员工）

**组织结构：** 3 团队：AI工程 / 推理加速 / 模型训练

---

## 2. 术语定义 (详见 CONTEXT.md)

| 术语 | 定义 |
|------|------|
| Session | AI Agent 启动→结束的完整交互周期。resume 算新 session |
| 需求 | 任何有明确验收标准的工作项。总监/TL/PM 均可创建 |
| 任务 | TL 拆解的最小执行单元。无验收标准，只有完成/未完成 |
| Token | 原始 token 量（不折现）。日/周/月粒度，可切 需求/任务/团队/成员/模型 维度 |
| 活跃 | 当日 ≥1 个已上报 Session |
| 验收标准 | AI 根据需求描述自动生成 3-8 条。任务-AC 由 TL 手动关联。系统自动确认完成 |

---

## 3. 用户与角色

| 角色 | 人数 | 职责 | 飞书报告 |
|------|:---:|------|---------|
| 部门总监 | 1 | 创建需求 · 全局成本 · 跨团队阻塞升级 | 部门每日进展 / 部门周报 |
| Team Leader | 3 | 创建需求 · 拆解任务 · 分配 · 设依赖 · 关联AC | 团队日报 / 团队周报 / 个人日报 |
| 产品经理 | 1 | 创建需求 · 跟踪验收 · 重点关注需求 | PM周报 / 个人日报 |
| 员工 | 40 | 执行任务 · 上报Session · 确认日报 | 个人日报 / 个人周报 |

### 3.1 RACI

| 动作 | 总监 | PM | TL | 员工 |
|------|:--:|:--:|:--:|:--:|
| 创建需求 | R/A | R/A | R/A | - |
| 拆解需求→任务 | - | I | R/A | - |
| 关联任务→AC | - | - | R/A | - |
| 设置任务依赖 | - | - | R/A | - |
| 分配任务到人 | - | - | R/A | - |
| 执行+上报Session | R | R | R | R |
| 编辑飞书报告 | R/A | R/A | R/A | R/A |
| 跨团队阻塞 | R/A | R/A | I | - |
| 全局成本 | R/A | I | I | - |

### 3.2 跨团队协作

1. 需求创建时指定参与团队
2. 各队 TL 独立拆解本队任务，协商跨队依赖
3. 阻塞由双方 TL 协商 → PM 协调 → 总监升级

---

## 4. 系统架构

```
[40台机器] local-daemon → HTTPS → [中心API(Go)] → PostgreSQL 16 → Web Dashboard(Next.js)
                                      ↕
                                飞书 SSO / 飞书开放API(PM数据) / 飞书文档API(报告生成)
```

---

## 5. 数据模型

```sql
-- 团队
CREATE TABLE teams (id UUID PK, name TEXT); -- AI工程|推理加速|模型训练

-- 用户
CREATE TABLE users (id UUID PK, feishu_id TEXT UNIQUE, name TEXT, role TEXT, team_id UUID);

-- 需求 (总监/TL/PM 均可创建)
CREATE TABLE requirements (
    id UUID PK, title TEXT, description TEXT, feishu_doc_url TEXT,
    acceptance_criteria TEXT[],         -- AI自动生成3-8条
    creator_id UUID, creator_role TEXT, -- director|pm|team_leader
    status TEXT DEFAULT 'active', priority TEXT,
    progress INTEGER DEFAULT 0,         -- 0-100%
    deadline DATE, created_at TIMESTAMPTZ
);

-- 需求-团队 多对多
CREATE TABLE requirement_teams (requirement_id UUID, team_id UUID, PK);

-- 任务 (TL拆解)
CREATE TABLE tasks (
    id UUID PK, requirement_id UUID, title TEXT,
    acceptance_criteria_ids INT[],      -- TL手动关联的AC编号
    assignee_id UUID, creator_tl_id UUID,
    status TEXT DEFAULT 'todo', priority TEXT, due_date DATE
);

-- 任务依赖
CREATE TABLE task_dependencies (task_id UUID, depends_on_id UUID, dep_type TEXT, PK);

-- Session
CREATE TABLE sessions (
    id UUID PK, session_ref TEXT, user_id UUID, agent_type TEXT,
    started_at TIMESTAMPTZ, duration_secs INT, model TEXT,
    summary TEXT, tool_calls_json JSONB, git_commits TEXT[],
    task_id UUID, requirement_id UUID, raw_log_url TEXT
);

-- Token (原始量，不折现)
CREATE TABLE token_usage (
    id UUID PK, user_id UUID, session_id UUID, task_id UUID, requirement_id UUID,
    agent_type TEXT, model TEXT,
    input_tokens BIGINT, output_tokens BIGINT, total_tokens BIGINT,
    recorded_at TIMESTAMPTZ
);

-- 日报
CREATE TABLE daily_reports (
    id UUID PK, user_id UUID, date DATE, content TEXT,
    edited BOOLEAN, session_ids UUID[], UNIQUE(user_id, date)
);
```

### 关键流程

```
创建需求 → AI生成AC → TL拆任务+关联AC+分配+设依赖 → 员工执行+上报
                                                          ↓
Session AI自动匹配任务 → 验收标准自动完成检测 → 需求进度自动更新
                                                          ↓
                                    日报20:00/周报周五17:00 → 飞书文档
```

---

## 6. 报告规则

| 报告 | 生成时间 | 内容 |
|------|---------|------|
| 个人日报 | 每天 20:00 | 系统数据(任务进度+Token) + AI段落(基于session) + 心得 |
| 团队日报 | 每天 20:00 | 汇总队员日报 + TL微调 |
| 部门每日进展 | 每天 20:00 | 3队当日关键动态 + 总监编辑 |
| 个人/团队周报 | 周五 17:00 | 本周汇总+下周计划 |
| PM/部门周报 | 周五 17:00 | 交付进展+风险+Token汇总 |

报告生成到飞书文档，Dashboard 只放链接。

---

## 7. 隐私与安全

- **自主上报**：员工勾选后上报，未勾选永不离机
- **撤回 = 物理删除**，不留存
- **数据留存**：6 个月热存储（可查询），超期归档冷存储
- **Session-任务关联**：AI 自动匹配，员工可确认或覆盖
- **角色隔离**：TL 看本队摘要，总监看聚合
- 飞书 SSO + TLS 1.3

---

## 8. 技术选型

| 组件 | 选型 |
|------|------|
| 本地 Daemon | Go (单二进制，跨平台) |
| API Server | Go (chi/gin) |
| 数据库 | PostgreSQL 16 |
| Dashboard | Next.js 14 + Tailwind + Recharts |
| 飞书集成 | OAuth2 + 开放API + 文档API |
| 部署 | Docker Compose (单机) |

---

## 9. 第一阶段原型范围

1. 员工：Session 上报 + 飞书日报/周报链接 + 个人 Token
2. TL：任务拆解+AC关联 + 团队日报/周报链接 + 成员面板 + 本队 Token
3. 总监：需求总览 + 部门报告链接 + 团队活跃度 + Token 趋势(日/周/月+饼图)
4. PM：重点关注需求 + 验收标准追踪 + PM报告链接 + Token 分布(按需求/模型)
5. 飞书 SSO 登录
6. 需求创建 → AI 自动生成验收标准

---

## 10. 验收标准

- [ ] 总监/TL/PM 可创建需求，AI 自动生成验收标准
- [ ] TL 拆解任务时手动关联验收标准
- [ ] 任务全部完成时系统自动确认对应验收标准
- [ ] 员工上报 session 后 AI 自动关联任务
- [ ] 日报 20:00 / 周报周五 17:00 自动生成到飞书文档
- [ ] 总监可见 3 队活跃度和需求进度
- [ ] PM 可见重点关注需求 + 每需求 Token
- [ ] Token 消耗按日/周/月，饼图可切换维度
- [ ] 所有 Token 展示为原始量（非货币）
- [ ] 员工可撤回已上报 session（物理删除）
