# 日报周报P0 Report MCP真实接口测试报告

## 1. 测试环境

| 项目 | 结果 |
| --- | --- |
| API 地址 | `http://127.0.0.1:18090/api/v1` |
| API 容器 | `project_manager-api-1`，已通过 `docker compose up -d --build api` 重建并重启 |
| 数据库 | `project_manager-db-1` / PostgreSQL 16 |
| 测试日期 | 2026-06-29 |
| P0 写入验证日期 | 2026-08-01 至 2026-08-05 |
| 测试方式 | 真实 HTTP JSON-RPC 请求 + 现有日报 HTTP 读取接口回读 |

## 2. 使用的测试账号

账号来自 `doc/测试账号文档.md`，认证方式为 `Authorization: Bearer <token>`。

| 角色 | 用户 ID | username | 验证范围 |
| --- | ---: | --- | --- |
| employee | 307 | t05 | 完整 P0 链路、写入、防覆盖、失败回写 |
| team_leader | 305 | t03 | `personal_daily` 上下文读取 |
| pm | 303 | t01 | `personal_daily` 上下文读取，验证无 team 不影响个人日报 |
| director | 304 | t02 | `personal_daily` 上下文读取 |

四个账号调用 `/auth/me` 均返回 200。

## 3. 本地 session 数据情况

测试前查询本地数据库发现 `sessions` 表没有任何 session 数据。按本轮测试要求，已进行一次“测试补数”，仅为 employee 账号 307 增加一条真实数据库 session，并关联测试需求和测试任务。

| 用户 | period.date | session 数量 | task 数量 | 说明 |
| --- | --- | ---: | ---: | --- |
| 307 / t05 | 2026-06-29 | 1 | 1 | 测试补数，标记为 P0 Report MCP 接口测试 |
| 305 / t03 | 2026-06-29 | 0 | 0 | empty context |
| 303 / t01 | 2026-06-29 | 0 | 0 | empty context |
| 304 / t02 | 2026-06-29 | 0 | 0 | empty context |

测试补数记录：

| 类型 | ID |
| --- | --- |
| requirement | `bc850638-7b7c-4344-9aad-fa2bc1490e29` |
| task | `1006c5b6-e34c-4bbe-9269-9f867dcd942b` |
| session | `35fdb450-e0f1-4b7f-9cda-7329b696e6ed` |

## 4. 登录方式

使用测试账号文档中的 token，所有请求增加：

```http
Authorization: Bearer <token>
Content-Type: application/json
```

## 5. 测试用例结果

| 用例 | 请求摘要 | 结果 |
| --- | --- | --- |
| 新 endpoint tools/list | `POST /api/v1/mcp/reports` / `tools/list` | 通过，返回 `get_report_context`、`write_report_result`、`write_report_failure` |
| 旧 endpoint tools/list | `POST /api/v1/mcp/daily-report` / `tools/list` | 通过，旧 `aida_daily_report_get_context`、`aida_daily_report_save_draft` 保持可用 |
| employee 上下文读取 | `get_report_context`，`report_type=personal_daily`，`date=2026-06-29` | 通过，返回 actor=307，sessions=1，tasks=1，`product_status=missing` |
| team_leader 上下文读取 | `get_report_context`，actor=305 | 通过，个人日报 empty context，未进入小组日报 |
| pm 上下文读取 | `get_report_context`，actor=303 | 通过，PM 无 team 不影响个人日报 |
| director 上下文读取 | `get_report_context`，actor=304 | 通过，个人日报 empty context，未进入部门日报 |
| `run_id` 可选 | 不传 `run_id` 调 `get_report_context` | 通过 |
| 合法 `run_id` | 传当前用户 `ai_runs.id` 调 `get_report_context` | 通过 |
| 非法 `run_id` | 传不存在 `run_id` | 通过，返回 `invalid run_id` |
| unsupported | `report_type=team_daily` | 通过，返回 `unsupported report_type: team_daily`，未读取小组数据 |
| 无已有日报时写入 | `write_report_result`，date=2026-08-01 | 通过，创建 `daily_reports`，现有 `GET /reports/{id}` 可读到正文 |
| 未编辑 AI 日报更新 | 再次 `write_report_result`，date=2026-08-01 | 通过，正文更新，`product_status=ai_generated` |
| 用户编辑后防覆盖 | AI 写入后用户 `PUT /reports/{id}` 编辑，再调 `write_report_result` | 通过，返回 `REPORT_EDIT_CONFLICT`，正文未被覆盖 |
| conflict 更新 run | conflict 后查询 `ai_runs` | 通过，`status=failed`，`error_message` 有值，`finished_at` 有值 |
| 缺少 `run_id` | `write_report_result` 不传 `run_id` | 通过，返回 `run_id is required`，不创建日报 |
| 他人 `run_id` | 307 登录传 305 的 `run_id` | 通过，返回 `invalid run_id`，不创建日报 |
| failure 回写 | `write_report_failure` | 通过，只更新 `ai_runs`，不创建或修改 `daily_reports` |
| 现有日报接口回读 | `GET /api/v1/reports/{id}` | 通过，可读正文、`generation_mode`、`managed_agent_run_id`、`agent_run_id`、`product_status` |

## 6. 关键返回验证

### 6.1 写入成功后现有日报接口

`write_report_result` 成功后，通过 `GET /api/v1/reports/{id}` 回读：

```json
{
  "content": "【接口测试】Agent 生成的个人日报内容 v2",
  "generation_mode": "managed_agent",
  "edited": false,
  "product_status": "ai_generated",
  "managed_agent_run_id": "9e12db3c-4f92-4020-9708-ef3098ed83ce",
  "agent_run_id": "9e12db3c-4f92-4020-9708-ef3098ed83ce"
}
```

### 6.2 防覆盖

用户编辑后再次 AI 回写：

```json
{
  "error": {
    "message": "REPORT_EDIT_CONFLICT: 报告已被用户编辑，AI 回写已取消"
  }
}
```

回读日报正文仍为用户编辑内容，`product_status=modified`。

## 7. 失败用例和修复记录

| 问题 | 原因 | 修复 |
| --- | --- | --- |
| `GET /reports/{id}` 回读 MCP 写入日报时报 `session_ids` 扫描 NULL 失败 | P0 新 MCP 不传 `session_ids`，`daily_reports.session_ids` 可为空，旧读取接口直接扫描到 string | 将个人日报读取查询中的 `dr.session_ids` 改为 `COALESCE(dr.session_ids, '{}')` |
| 首次真实测试脚本合法 `run_id` 校验失败 | 测试脚本从 `psql` 输出中带入了 `INSERT 0 1` 命令标签，导致 `run_id` 字符串错误 | 修正脚本只取第一行 UUID；非业务代码问题 |

## 8. 最终通过清单

1. `/api/v1/mcp/reports` 已可用。
2. `tools/list` 返回 P0 三个 tool。
3. `/api/v1/mcp/daily-report` 旧 endpoint 保持兼容。
4. `get_report_context` 支持 `personal_daily`，不要求 `run_id`，不接收 `session_ids`。
5. `get_report_context` 传合法 `run_id` 可通过，非法 `run_id` 返回错误。
6. 非 `personal_daily` 返回 unsupported。
7. `write_report_result` 可创建日报。
8. `write_report_result` 可更新未编辑 AI 日报。
9. 用户编辑后再次回写触发 `REPORT_EDIT_CONFLICT`，不覆盖正文。
10. conflict 时 `ai_runs` 标记 failed。
11. `write_report_failure` 只更新 `ai_runs`，不修改日报正文。
12. 现有日报读取接口能读到 MCP 写入内容和计算态字段。

## 9. 剩余风险

1. 本地环境原本没有 session 数据，本次为 employee 账号做了测试补数；其它角色只覆盖 empty context。
2. P0 的 `product_status` 只覆盖个人日报，weekly / team / department 未实现。
3. `generated_at` 当前从 `ai_runs.finished_at` 计算；如果后续 run 状态同步规则变化，需要保持该字段含义一致。
4. `write_report_result` conflict 当前通过 JSON-RPC error 返回，前端接入时需要按 `REPORT_EDIT_CONFLICT` 做明确提示。
