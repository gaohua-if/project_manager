# 日报周报 personal_daily Agent E2E 联调报告

> 注：本报告记录的是阶段性 E2E 联调过程。`POST /api/v1/reports/today/default-managed-agent-runs` 已在后续产品边界收敛中删除，不再作为日报页面或最终产品入口。

## 1. 测试环境

- Aida API：`http://127.0.0.1:18090/api/v1`
- Aida 对 Managed Agent 平台暴露地址：`http://192.168.14.157:18090`
- Managed Agent 平台：`http://192.168.18.107:3081`
- Report MCP：`POST /api/v1/mcp/reports`
- 默认 Agent 触发接口：`POST /api/v1/reports/today/default-managed-agent-runs`
- API 容器已在本轮重建：`docker compose up -d --build api`

## 2. 使用账号

- 账号：`测试05`
- username：`t05`
- user_id：`307`
- 角色：`employee`
- 小组：`小组A`
- 登录方式：使用 `doc/测试账号文档.md` 中该账号 Bearer Token。
- 报告中不记录完整 token。

## 3. 使用日期与本地 session 数据

- period.date：`2026-06-29`
- 本地 session 数量：1
- session：`35fdb450-e0f1-4b7f-9cda-7329b696e6ed`
- session_ref：`p0-report-mcp-test-1782749025`
- session 摘要：`【接口测试补数】完成 personal_daily Report MCP 上下文读取与回写验证准备`
- 本轮没有新增或伪造 session 数据。

## 4. 默认 Agent

- Agent name：`日报`
- Agent id：`aida-agent-djm2cyd68a0d`
- engine：`claude-code`
- default_model_id：`MiniMax-M2.5`
- current_version_id：`2`
- MCP binding：`aida-report-mcp-p0@personal-daily-v1`
- Credential Slot：`AIDA_REPORT_MCP_AUTH`

本轮结果：

1. 未新建第二个“日报”Agent。
2. 复用了已有默认 Agent。
3. 修复了该 Agent 的 Report MCP credential slot 配置。
4. 默认 Agent 运行不需要前端传 `agent_id`、`model_id`、`session_ids` 或来源列表。

## 5. 默认 Agent 运行

请求摘要：

```http
POST /api/v1/reports/today/default-managed-agent-runs
Authorization: Bearer <测试05 token>
Content-Type: application/json
```

请求体：

```json
{
  "report_date": "2026-06-29"
}
```

返回摘要：

- ai_run_id：`5c6857de-cf38-49d8-a464-d35d3c0cb870`
- external_task_id / session_id：`2f9c05d4-641b-40fc-ae35-77f9e801d672`
- agent_id：`aida-agent-djm2cyd68a0d`
- model_id：`MiniMax-M2.5`
- status 初始值：`pending`
- mcp_url：`http://192.168.14.157:18090/api/v1/mcp/reports`

运行参数包含：

```json
{
  "run_id": "5c6857de-cf38-49d8-a464-d35d3c0cb870",
  "report_type": "personal_daily",
  "period.date": "2026-06-29",
  "report_date": "2026-06-29",
  "mcp_url": "http://192.168.14.157:18090/api/v1/mcp/reports",
  "mcp_authorization_source": "AIDA_REPORT_MCP_AUTH"
}
```

运行参数不包含：

1. `session_ids`
2. 来源列表
3. `model_id`
4. 完整 `mcp_authorization` token

## 6. Managed Agent 平台 session

Managed Agent session 详情：

- session_id：`2f9c05d4-641b-40fc-ae35-77f9e801d672`
- status：`idle`
- stop_reason：`completed`
- model_id：`MiniMax-M2.5`

Credential audit：

```json
[
  {
    "slot": "AIDA_REPORT_MCP_AUTH",
    "source": "session_override",
    "required": true,
    "resolved": true
  }
]
```

MCP server：

```json
[
  {
    "name": "aida-report-mcp-p0",
    "url": "http://192.168.14.157:18090/api/v1/mcp/reports",
    "egress_host": "192.168.14.157"
  }
]
```

## 7. Agent 调用 MCP 结果

API 日志确认 Managed Agent 第三方服务真实访问了 Aida Report MCP：

```text
POST /api/v1/mcp/reports -> 200
POST /api/v1/mcp/reports -> 204
POST /api/v1/mcp/reports -> 200
POST /api/v1/mcp/reports -> 200
POST /api/v1/mcp/reports -> 200
```

Agent 运行记录确认真实调用：

1. `mcp__aida-report-mcp-p0__get_report_context`
2. `mcp__aida-report-mcp-p0__write_report_result`

`get_report_context` 返回当前用户 `测试05 / user_id=307` 的 personal_daily 上下文，包含当天 session、任务、需求和已有报告状态。

`write_report_result` 返回：

```json
{
  "status": "saved",
  "report_type": "personal_daily",
  "report_id": "3565b5ae-756a-495b-b68d-678a3f4c8566",
  "agent_run_id": "5c6857de-cf38-49d8-a464-d35d3c0cb870",
  "managed_agent_run_id": "5c6857de-cf38-49d8-a464-d35d3c0cb870",
  "product_status": "ai_generated",
  "origin": "ai",
  "updated_by_user": false
}
```

本轮未触发 `write_report_failure`。

## 8. 日报写入与接口回读

写入的日报：

- report_id：`3565b5ae-756a-495b-b68d-678a3f4c8566`
- report_date：`2026-06-29`
- user_id：`307`

通过现有接口回读：

```http
GET /api/v1/reports/3565b5ae-756a-495b-b68d-678a3f4c8566
Authorization: Bearer <测试05 token>
```

回读结果：

1. 日报正文存在。
2. `generation_mode=managed_agent`。
3. `edited=false`。
4. `managed_agent_run_id=5c6857de-cf38-49d8-a464-d35d3c0cb870`。
5. `agent_run_id=5c6857de-cf38-49d8-a464-d35d3c0cb870`。
6. `agent_id=aida-agent-djm2cyd68a0d`。
7. `model_id=MiniMax-M2.5`。
8. `product_status=ai_generated`。
9. `origin=ai`。
10. `updated_by_user=false`。
11. 数据库中 `session_ids IS NULL`，接口回读为 `session_ids: []`，读取正常。

## 9. ai_runs 状态

本地 `ai_runs` 最终状态：

- id：`5c6857de-cf38-49d8-a464-d35d3c0cb870`
- status：`succeeded`
- business_id：`3565b5ae-756a-495b-b68d-678a3f4c8566`
- external_task_id：`2f9c05d4-641b-40fc-ae35-77f9e801d672`
- model_id：`MiniMax-M2.5`
- finished_at：有值
- error_message：空

## 10. 失败点与修复项

### 10.1 首次断点

首次 E2E 发现 Agent 已启动，但访问 `/api/v1/mcp/reports` 时返回 401：

```text
POST /api/v1/mcp/reports -> 401
```

原因：

1. Aida 将 `mcp_authorization` 放在 run params / prompt 中。
2. Managed Agent 平台 MCP 客户端不会自动把 prompt 参数转成 HTTP Authorization header。
3. HTTP MCP 的鉴权必须通过平台 Credential Slot 注入。

### 10.2 已修复

1. 默认 Agent 增加 `AIDA_REPORT_MCP_AUTH` credential slot。
2. Report MCP binding 绑定该 credential slot。
3. 默认 personal_daily run 改为：
   - 创建当前用户 token 的 write-only credential；
   - 调用 Managed Agent `/api/session`；
   - 使用 `credential_overrides` 将本次 credential 注入 session。
4. `ai_runs.input_ref_json` 不再保存完整 `mcp_authorization`。
5. 已清理本地测试数据中历史泄露的 `mcp_authorization` 明文。

修复后同一链路已跑通。

## 11. 测试命令

后端测试：

```bash
docker run --rm --pull=never \
  -v /home/intellif/dev/project_manager:/workspace \
  -w /workspace/api \
  golang:1.26-alpine go test ./...
```

结果：

```text
ok github.com/aidashboard/api/handler
ok github.com/aidashboard/api/service
```

重启 API：

```bash
docker compose up -d --build api
```

## 12. 最终结论

personal_daily Agent E2E 已跑通：

```text
默认 personal_daily Agent
-> Managed Agent session
-> Aida Report MCP get_report_context
-> Agent 生成日报
-> Aida Report MCP write_report_result
-> daily_reports 写入
-> 现有日报接口回读
```

本轮未触碰：

1. weekly
2. team / department
3. PM 独立来源
4. 前端智能生成按钮
5. 定时任务
6. 数据库迁移
