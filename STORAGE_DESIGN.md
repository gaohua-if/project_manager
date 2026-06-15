# AIDashboard 存储结构设计

> 本文聚焦数据如何落盘与流动。产品流程见 `PRD.md`,日报生成见 `DAILY_REPORT_FLOW.md` / `TEAM_REPORT_FLOW.md`。

## 1. 存储总览

系统采用**双层存储**模型:结构化数据进 PostgreSQL,大体积原始日志进对象存储。

```
┌─────────────────────────────────────────────────────────────────┐
│                        员工本地机器                              │
│  ~/.claude/projects/<encoded-project>/<session-id>.jsonl        │
│  ~/.claude/projects/<encoded-project>/<session-id>/subagents/*  │
└──────────────────────────────┬──────────────────────────────────┘
                               │ aidashboard upload (multipart)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Go API (:8080)                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ SessionHandler.BatchUpload                                │  │
│  │   1) 解析 metadata JSON + 多个 file_N form file           │  │
│  │   2) UPSERT sessions 表(metadata)                         │  │
│  │   3) 上传 .jsonl → MinIO(sessions/<uid>/<ref>.jsonl)      │  │
│  │   4) 写 raw_log_url 回 sessions                           │  │
│  │   5) 写 token_usage                                        │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────────┬───────────────────────────────────┬──────────────┘
               ▼                                   ▼
   ┌───────────────────────┐         ┌─────────────────────────┐
   │   PostgreSQL 16       │         │       MinIO             │
   │   (结构化数据)         │         │   (对象存储 .jsonl)     │
   │                       │         │                         │
   │ • users / teams       │         │ Bucket: aidashboard     │
   │ • requirements        │         │ Prefix: sessions/       │
   │ • tasks / deps        │         │   <user_id>/            │
   │ • sessions (元数据)   │         │     <session_ref>.jsonl │
   │ • token_usage         │         │                         │
   │ • daily_reports       │         └─────────────────────────┘
   │ • team_reports        │
   │ • documents           │
   │ • requirement_teams   │
   │ ──────────────────    │
   │ pgcrypto 扩展         │
   │ gen_random_uuid()     │
   └───────────────────────┘
```

**职责边界**

| 关注点 | 落地位置 |
|--------|----------|
| 关系查询/聚合统计/事务 | PostgreSQL |
| Session 全量交互日志(JSONL,可达 MB 级) | MinIO |
| 配置 & 密钥 | 环境变量(`config.Load()`) |
| 编译产物 | API 单二进制(`api/main.go` → `/usr/local/bin/api`) |

## 2. PostgreSQL 表结构

迁移文件位于 `api/db/migrations/`,启动时由 `db.RunMigrations()` 自动执行,幂等。所有 UUID 主键由 `gen_random_uuid()` 在数据库生成。

### 2.1 组织与权限

```sql
teams (
  id         UUID PK,
  name       TEXT UNIQUE,
  created_at TIMESTAMPTZ
)

users (
  id         UUID PK,
  feishu_id  TEXT UNIQUE,              -- 可选,留作 SSO 打通
  name       TEXT,
  role       TEXT CHECK IN ('director','team_leader','pm','employee'),
  team_id    UUID → teams(id),
  created_at TIMESTAMPTZ
)
-- 索引:idx_users_team, idx_users_role
```

**角色到可见数据的映射**(在 handler 内通过 `getUser(r).Role` 拼接 SQL):
- `director`: 全表
- `team_leader` / `pm`: 本 team_id 下用户
- `employee`: 仅 `user_id = self`

### 2.2 需求与任务

```sql
requirements (
  id                  UUID PK,
  title               TEXT,
  description         TEXT,
  feishu_doc_url      TEXT,            -- 可选外链
  acceptance_criteria TEXT[],          -- PostgreSQL 数组,3-8 条
  creator_id          UUID → users(id),
  creator_role        TEXT,
  status              TEXT CHECK IN ('active','completed','cancelled'),
  priority            TEXT CHECK IN ('low','medium','high','urgent'),
  progress            INT CHECK [0,100],
  deadline            DATE,
  created_at, updated_at
)

requirement_teams (                  -- 需求 ↔ 团队 N:N
  requirement_id UUID → requirements(id) ON DELETE CASCADE,
  team_id        UUID → teams(id)        ON DELETE CASCADE,
  PRIMARY KEY (requirement_id, team_id)
)

tasks (
  id                      UUID PK,
  requirement_id          UUID → requirements(id),
  title                   TEXT,
  acceptance_criteria_ids INT[],         -- 引用 requirement.acceptance_criteria 的下标
  assignee_id             UUID → users(id),
  creator_tl_id           UUID → users(id),
  status                  TEXT CHECK IN ('todo','in_progress','done','blocked'),
  priority                TEXT CHECK IN ('low','medium','high'),
  due_date                DATE,
  created_at, updated_at
)

task_dependencies (                   -- 任务依赖,目前固定 finish_to_start
  task_id       UUID → tasks(id) ON DELETE CASCADE,
  depends_on_id UUID → tasks(id) ON DELETE CASCADE,
  dep_type      TEXT DEFAULT 'finish_to_start',
  PRIMARY KEY (task_id, depends_on_id),
  CHECK (task_id != depends_on_id)     -- 禁止自环
)
```

**设计要点**
- AC 以 `TEXT[]` 数组形式存在 `requirements` 上;`tasks.acceptance_criteria_ids` 存下标,避免冗余文本与漂移。
- 依赖类型字段已留(`dep_type`),目前业务上只用 finish_to_start,扩展 start_to_start / finish_to_finish 不需改表。

### 2.3 Session 与 Token

```sql
sessions (
  id                UUID PK,
  session_ref       TEXT,              -- 来自 JSONL 的 sessionId(Claude Code 自带)
  user_id           UUID → users(id),
  agent_type        TEXT DEFAULT 'claude_code',
  started_at        TIMESTAMPTZ,
  ended_at          TIMESTAMPTZ,
  duration_secs     INT,
  model             TEXT,
  summary           TEXT,              -- 第一条 user message 截断 200 字
  tool_calls_json   JSONB,             -- {"Read":12,"Edit":5,...}
  git_commits       TEXT[],            -- PostgreSQL 数组
  task_id           UUID → tasks(id),
  requirement_id    UUID → requirements(id),  -- 通过 task 反查冗余写入
  match_confidence  FLOAT,             -- AI 匹配置信度 0.0-1.0
  raw_log_url       TEXT,              -- MinIO object key,**不是**完整 URL
  uploaded_at       TIMESTAMPTZ DEFAULT now()
)
-- UNIQUE(session_ref, user_id): 同一 session 重复上传走 UPSERT
-- 索引:user, task, started, (user_id, started_at DESC)
```

```sql
token_usage (
  id             UUID PK,
  session_id     UUID → sessions(id) ON DELETE CASCADE,
  user_id, task_id, requirement_id,  -- 冗余:便于直接按任务/需求/人聚合,不再 JOIN sessions
  agent_type     TEXT,
  model          TEXT,
  input_tokens   BIGINT,
  output_tokens  BIGINT,
  total_tokens   BIGINT,
  recorded_at    TIMESTAMPTZ DEFAULT now()
)
-- ON DELETE CASCADE:删除 session 时 token 记录自动清理,不会留孤儿数据
```

**为什么 token_usage 单独一张表?**
- 一个 session 可能跨多个模型(中途切换 model),按行记录可精确分模型聚合。
- 直接 `SUM(total_tokens) GROUP BY model / user_id / task_id`,不需要拆 JSONB。
- 索引覆盖 `idx_token_user / _task / _recorded / _model`,Dashboard 查询全部走索引。

### 2.4 日报

```sql
daily_reports (                       -- 个人日报
  id           UUID PK,
  user_id      UUID → users(id),
  report_date  DATE,
  content      TEXT,                  -- AI 生成的 Markdown
  edited       BOOLEAN DEFAULT FALSE, -- 人工编辑后置 true,后续 generate 不再覆盖
  feishu_doc_url TEXT,
  session_ids  UUID[],                -- 该日报关联的 session(便于回溯)
  created_at, updated_at,
  UNIQUE (user_id, report_date)       -- 一人一天一条,UPSERT 入口
)

team_reports (                        -- 团队日报(TL 生成,聚合成员日报)
  id                UUID PK,
  team_id           UUID → teams(id),
  leader_id         UUID → users(id),
  report_date       DATE,
  content           TEXT,
  feishu_doc_url    TEXT,
  member_report_ids UUID[],           -- 引用的子日报
  session_ids       UUID[],           -- 团队当日的全部 session
  created_at, updated_at,
  UNIQUE (team_id, report_date)
)
```

**`edited` 字段语义**
- 由 consumer 定时任务生成时 `edited=false`。
- 任何通过 `PUT /reports/{id}` 手动编辑后置 `true`,AI 不再覆盖。
- 通过该位避免「人工修订被自动任务清空」的常见坑。

### 2.5 文档(外链,不上传文件)

```sql
documents (
  id             UUID PK,
  user_id        UUID → users(id),
  title          TEXT,
  url            TEXT,                -- 只存外链,不存文件内容
  description    TEXT,
  task_id        UUID → tasks(id),
  requirement_id UUID → requirements(id),
  uploaded_at    TIMESTAMPTZ
)
```

> 文件型附件请走 MinIO(参考 §3 扩展),不要把二进制塞进数据库。

## 3. MinIO 对象存储

### 3.1 配置

`config.MinioConfigured()` 要求 `MINIO_ENDPOINT / ACCESS_KEY / SECRET_KEY` 三个变量都非空才启用;任一缺失,API 仍能启动但禁用原始日志上传(降级模式)。

| 环境变量 | 默认 | 说明 |
|---------|------|------|
| `MINIO_ENDPOINT` | (空) | 内部访问地址,如 `minio:9000` |
| `MINIO_ACCESS_KEY` | (空) | |
| `MINIO_SECRET_KEY` | (空) | |
| `MINIO_BUCKET` | `aidashboard` | API 启动时自动创建 |
| `MINIO_USE_SSL` | `false` | |
| `MINIO_EXTERNAL_ENDPOINT` | (空) | 预留:对外暴露的公网地址 |

### 3.2 Object Key 约定

```
sessions/<user_id>/<session_ref>.jsonl
```

- **路径包含 `user_id`** 是天然的隔离边界,后续按 user 做生命周期/权限裁剪非常便宜。
- **不使用文件名携带元数据**,所有元数据在 PostgreSQL;`raw_log_url` 字段只存 object key(如 `sessions/c00000.../b62ba734....jsonl`),**不存完整 URL**——避免更换 endpoint 时全部失效。
- 客户端获取日志:`GET /sessions/{id}/log` → 后端用 `user_id/role` 鉴权后从 MinIO 流式 `GetObject` 返回。

### 3.3 客户端访问流程

```
1. employee → GET /api/v1/sessions/{id}/log  (Authorization: Bearer)
2. SessionHandler.DownloadLog:
   a. SELECT raw_log_url, user_id FROM sessions WHERE id=$1
   b. 鉴权:role=director OR owner_id=self,否则 403
   c. minio.GetObject(bucket, raw_log_url) → io.ReadCloser
   d. Content-Type: application/x-jsonlines, Content-Disposition: attachment
   e. io.Copy(w, stream)
```

**预签名 URL?** 当前没有走。原因:
- 内部 minio 网络隔离,API 作为代理更安全(凭据不出 API)。
- 流式返回可避免暴露 MinIO 给浏览器。
- 后续要做直传/大文件时再启用 `presignedGetObject` 即可,接口无需改。

### 3.4 失败容忍

`BatchUpload` 在 metadata 已写入但 MinIO 上传失败时,**不回滚**数据库,而是返回 `warning: ...` 状态。理由:
- 元数据丢失比日志丢失更严重(Dashboard、日报都依赖 sessions 表)。
- 客户端可基于 `warning` 状态重试上传该 file,UPSERT 保证幂等。

## 4. 数据流动

### 4.1 Session 上报链路

```
[A] 员工本地                                [B] 服务器

~/.claude/projects/<encoded>/
  <sid>.jsonl          ──┐
  <sid>/subagents/*.jsonl │  aidashboard upload
                          │  扫描 → 解析 → 构造 multipart
                          ▼
                  POST /api/v1/sessions/batch
                  (multipart/form-data:
                    metadata = {sessions:[...]},
                    file_<sid> = .jsonl,
                    file_<sub_sid> = .jsonl)
                          │
                          ▼
                  SessionHandler.BatchUpload
                  for each session in metadata:
                    ┌─ sessions UPSERT (by session_ref + user_id)
                    ├─ minio.Upload(sessions/<uid>/<ref>.jsonl)
                    ├─ UPDATE sessions.raw_log_url
                    └─ token_usage 重写(delete + insert in tx)
```

**幂等性**
- `(session_ref, user_id)` 唯一索引保证重复上传走 UPDATE 分支。
- `token_usage` 用「删后插」事务保证可重算,不会累加。

### 4.2 Session → Task 匹配

```
sessions.summary + tasks[] → AIClient.MatchSessionToTask
                                ↓
                          {"task_id": "...", "confidence": 0.85}
                                ↓
              UPDATE sessions SET task_id=..., match_confidence=...
              (用户可在 Dashboard 手动 override: PUT /sessions/{id}/task)
```

### 4.3 日报生成

```
触发:POST /reports/today/generate (manual) 或 consumer 定时任务
   │
   ▼
listUserReportSessions(user_id, date, tz)
   ─────────────────────────────────────
   SELECT s.*, SUM(token_usage.*) ...
   FROM sessions s
   LEFT JOIN token_usage tu ON tu.session_id = s.id
   LEFT JOIN tasks t ...
   WHERE s.user_id=$1 AND DATE(s.started_at AT TIME ZONE $2)=$3
   │
   ▼
AIClient(claude -p "<prompt>") → Markdown
   │
   ▼
UPSERT daily_reports (user_id, report_date) UNIQUE
   ─ 若 edited=true:跳过覆盖(尊重人工修订)
   ─ 否则:content + session_ids + edited=false
```

## 5. 索引与查询模式

| 查询场景 | 命中索引 |
|---------|---------|
| 员工查看自己 sessions | `idx_sessions_user` + `idx_sessions_user_date` |
| 任务详情下展示关联 sessions | `idx_sessions_task` |
| 日报按日期拉取 sessions | `idx_sessions_user_date` + `started_at` 过滤 |
| Token 按用户/任务/模型聚合 | `idx_token_user / _task / _model` |
| 防止 session 重复写入 | `idx_sessions_ref UNIQUE(session_ref,user_id)` |
| 需求状态/进度看板 | `idx_requirements_status` |
| 日报列表(一人多日) | `idx_reports_user_date` |

**未建的、可能需要补的索引**
- `documents(task_id)` —— 任务详情页查关联文档目前全表扫描,数据量大了会慢。
- `team_reports(team_id, report_date DESC)` —— 已建(`004_team_reports.sql`)。
- `sessions(requirement_id)` —— 若总监视图常按需求聚合 sessions,建议补。

## 6. 备份与生命周期

### 6.1 备份策略(建议)

| 数据 | 频率 | 工具 |
|------|------|------|
| PostgreSQL | 全量每日 + WAL 归档 | `pg_basebackup` / `pg_dump` |
| MinIO | 跨节点复制(生产) | minio bucket replication |
| ~/.claude/projects | 不备份(员工本地,反正可重传) | — |

### 6.2 生命周期(尚未实现,设计预留)

- **Session 元数据**:保留 N 年后归档到冷表(`sessions_archive`),按 `uploaded_at` 分区。
- **JSONL 原文**:90 天后迁移到 MinIO tiers(cold),1 年后删除元数据为 empty summary 的。
- **daily_reports**:永久保留(合规与历史回溯)。
- **token_usage**:聚合到 `token_daily` 物化视图后,原始行可清理(>1 年)。

## 7. 当前已知约束与扩展点

| 现状 | 扩展方向 |
|------|----------|
| Session 只支持 `agent_type='claude_code'` | 加 Codex/OpenClaw 时扩展 `agent_type` 枚举 + 解析器分支 |
| MinIO 没启用外部预签名 | 大文件直传时切 `presignedPutObject`,API 不再中转 |
| `MINIO_EXTERNAL_ENDPOINT` 字段已留但未用 | 客户端直链下载时填充 |
| `git_commits` 数组未参与匹配 | 可作为 session↔task 匹配的附加信号 |
| `documents` 不存文件本体 | 需要附件时新增 `documents.object_key` 指向 MinIO |
| `task_dependencies.dep_type` 仅用 finish_to_start | start_to_start / finish_to_finish 直接放开即可 |
| 单库单实例 | 员工/团队量级到 1k+ 时,可按 `user_id` hash 分片 sessions/token_usage |

## 8. 相关文件速查

| 关注点 | 路径 |
|--------|------|
| 表结构迁移 | `api/db/migrations/00{1,2,3,4}_*.sql` |
| DB 连接 + 迁移执行 | `api/db/db.go` |
| MinIO 客户端封装 | `api/storage/minio.go` |
| 配置加载 | `api/config/config.go` |
| Session 上报/查询/下载 | `api/handler/session.go` |
| Token 聚合 | `api/handler/token.go` |
| 日报生成 | `api/handler/report.go` + `daemon/main.go` |
| AI 客户端(AC 生成、Task 匹配) | `api/service/ai.go` |
| 客户端 CLI | `daemon/main.go`(`cmdUpload` / `parseJSONL`) |
| 容器编排 | `docker-compose.yml` |
