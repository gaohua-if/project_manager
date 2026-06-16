# 日报生成流程

本文档说明 Aida 中 Claude Code session 日报的端到端生成流程。当前设计采用用户手动触发模式：用户机器只负责上传 session，用户在 Web 端点击生成日报，服务端 report-generator 微服务调用 `claude -p` 生成草稿，用户随后可以编辑保存。

## 参与组件

| 组件 | 位置 | 职责 |
|------|------|------|
| Claude Code | 用户机器或用户服务器 | 产生本地 session log |
| `aida upload` | 用户机器或用户服务器 | 扫描并上传本人的 session 数据 |
| Go API | 服务端 | 接收 session 上报，写入 PostgreSQL |
| PostgreSQL | 服务端 | 存储用户、session、token、任务、日报数据 |
| `consumer` / report-generator | 服务端独立容器 | 接收 API 的手动生成请求，调用 `claude -p` 生成日报 |
| Web Dashboard | 服务端 | 用户手动触发生成，并编辑日报 |

## 总体流程

```text
用户机器 Claude Code
        |
        | 生成 ~/.claude/projects/*.jsonl
        v
aida upload
        |
        | POST /api/v1/sessions/batch
        v
Go API
        |
        | 写入 sessions / token_usage
        v
PostgreSQL
        |
        | 用户在 Web 点击 Generate AI Report
        v
Go API
        |
        | POST http://consumer:8090/reports/generate
        v
claude -p 生成 Markdown 日报
        |
        | upsert daily_reports
        v
Web Dashboard 展示日报
```

## 1. 用户上传 Session

用户在自己的机器或服务器上运行：

```bash
aida upload --all
```

CLI 会扫描用户本机：

```text
~/.claude/projects/
```

然后解析 Claude Code 的 `.jsonl` session log，提取以下信息：

| 字段 | 来源 |
|------|------|
| `session_ref` | Claude session ID |
| `started_at` / `ended_at` | log 中的时间戳 |
| `model` | assistant message |
| `summary` | 首条用户请求摘要 |
| `tool_calls` | assistant tool_use 统计 |
| `token_usage` | input/output token 汇总 |
| sub-agent sessions | 主 session 下的 `subagents/*.jsonl` |

上传接口：

```http
POST /api/v1/sessions/batch
Authorization: Bearer <user-token>
```

API 按 token 中的用户身份写入：

- `sessions`
- `token_usage`

重要约束：

- 用户 session log 不会由服务端消费者直接读取。
- 用户可以在不同机器或服务器上操作，只要最终通过 CLI 上传到平台即可。
- 同一用户的同一 `session_ref` 会更新已有记录，避免重复数据。

## 2. 用户手动触发生成

用户打开 Web Dashboard 的 Reports 页面，点击：

```text
Generate AI Report
```

Web 调用 API：

```http
POST /api/v1/reports/today/generate
Authorization: Bearer <user-token>
```

API 做两件事：

1. 从用户 token 中确定当前用户。
2. 请求服务端 report-generator 生成该用户当天日报。

API 到 report-generator 的内网调用：

```http
POST http://consumer:8090/reports/generate
Content-Type: application/json

{
  "user_id": "<current-user-id>",
  "report_date": "2026-06-11"
}
```

## 3. 服务端 Report Generator 运行

服务端通过 Docker Compose 启动 API、Web、DB 和 report-generator：

```bash
docker compose up -d
```

report-generator 使用服务端环境变量：

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | PostgreSQL 连接串，服务端模式必填 |
| `AIDA_CLAUDE_BIN` | Claude CLI 命令，默认 `claude` |
| `AIDA_CLAUDE_TIMEOUT` | Claude 生成超时时间，默认 `10m` |
| `PORT` | report-generator HTTP 端口，默认 `8090` |
| `TZ` | 时区，默认 `Asia/Shanghai` |

API 使用以下环境变量找到 report-generator：

| 变量 | 说明 |
|------|------|
| `REPORT_GENERATOR_URL` | report-generator 内网地址，例如 `http://consumer:8090` |

Compose 中默认配置：

```yaml
api:
  environment:
    REPORT_GENERATOR_URL: "http://consumer:8090"

consumer:
  environment:
    DATABASE_URL: "postgres://aidashboard:devpassword@db:5432/aidashboard?sslmode=disable"
```

## 4. Report Generator 查询待生成数据

report-generator 收到生成请求后，会：

1. 校验 `user_id` 是否为员工用户。
2. 使用 `report_date` 查询该用户当天已上传的 session。
3. 组装 session、token、任务和需求上下文。

查询的数据来自：

- `users`
- `sessions`
- `token_usage`
- `tasks`
- `requirements`

每个 session 会带上：

| 信息 | 用途 |
|------|------|
| session 时间 | 还原当天工作顺序 |
| summary | 描述主要工作内容 |
| token usage | 汇总 AI 使用量 |
| tool calls | 判断具体操作类型 |
| task title | 关联任务上下文 |
| requirement title | 关联需求上下文 |

日期过滤使用 `TZ` 对齐，例如默认 `Asia/Shanghai`，避免 UTC 日期导致跨天偏差。

## 5. 调用 Claude 生成日报

report-generator 为当前用户构造 prompt，然后执行：

```bash
claude -p "<prompt>"
```

生成要求：

- 只输出 Markdown
- 使用中文
- 结构包含：
  - 今日完成
  - 问题与风险
  - 明日计划
  - Session 明细
- 内容基于已上传 session 数据，不夸大
- 缺少信息时写“暂无”

服务端容器会挂载服务端主机的 Claude 配置：

```yaml
volumes:
  - ${HOME}/.claude:/root/.claude
```

该挂载只用于服务端 `claude -p` 的登录态，不用于读取用户 session log。

## 6. 写回日报

Claude 返回 Markdown 后，report-generator 写入 `daily_reports`。

写入策略：

- 如果该用户当天没有日报，则插入。
- 如果已存在，则更新 `content`、`session_ids`、`updated_at`。
- `session_ids` 保存本次日报引用的 session ID 列表。

目标表：

```sql
daily_reports (
  user_id,
  report_date,
  content,
  session_ids,
  edited,
  updated_at
)
```

唯一约束：

```sql
UNIQUE (user_id, report_date)
```

因此同一用户同一天只会保留一份日报。

## 7. 用户编辑 AI 日报

API 在生成完成后重新读取日报并返回给 Web。用户可以直接在 Reports 页面点击 Edit，对 AI 生成的日报草稿进行修改，并保存。

保存接口：

```http
PUT /api/v1/reports/{id}
Authorization: Bearer <user-token>
```

保存后：

- `content` 更新为用户修改后的内容。
- `edited` 标记为 `true`。
- 用户后续仍可再次点击 Generate AI Report 重新生成草稿；重新生成会覆盖当天日报内容。

员工只能看到自己的日报；TL、PM、Director 根据角色权限看到对应范围内的日报。

## 运行建议

推荐部署方式：

1. API、DB、Web 常驻运行。
2. 用户机器定期或手动执行 `aida upload --all`。
3. 用户在 Reports 页面手动点击 Generate AI Report。
4. 用户检查 AI 草稿并手动编辑保存。
5. 如果希望生成昨天或指定日期日报，可以后续扩展 API/Web 支持选择 `report_date`。

推荐启动命令：

```bash
docker compose up -d
```

查看 report-generator 日志：

```bash
docker compose logs -f consumer
```

## 注意事项

- consumer/report-generator 是服务端微服务，不应该部署在每个用户机器上。
- 用户机器不需要暴露 `~/.claude` 给服务端。
- 服务端只需要自己的 Claude CLI 登录配置，用于生成日报。
- 日报质量取决于用户是否及时上传 session，以及 session 是否正确关联任务和需求。
- 当前生成逻辑基于已入库的 session 摘要和统计信息，不会读取完整原始 `.jsonl` 内容。
- 生成动作由用户手动触发，不依赖定时任务，因此不会因为定时时间不准导致生成错过或过早执行。
