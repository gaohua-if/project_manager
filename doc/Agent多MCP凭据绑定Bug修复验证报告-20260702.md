# Agent 多 MCP 凭据绑定 Bug 修复验证报告

## 1. 背景

- 测试时间：2026-07-02
- 测试账号：t03 / user_id=305
- 问题 agent：`aida-testskillmcp-djnolw2dltnh`
- agent 名称：`testSkillMcp`
- agent 类型：`generic`
- 运行模型：`MiniMax-M2.5`

该 agent 绑定了多个 skill 和多个 MCP：

- skills：
  - `skill-binding-extra-20260702-010419@1.0.0`
  - `skill-binding-main-20260702-010419@1.0.0`
  - `aida-report@1.0.0`
- MCP：
  - `mcp-binding-extra-20260702-010419@1.0.0`
  - `mcp-binding-main-20260702-010419@1.0.0`
  - `aida-report-mcp@report-v1`

## 2. 问题现象

手动运行该 generic agent 时，Aida API 返回 502，平台返回的真实错误为：

```text
MCP_CONFIG_INVALID: mcp entry aida-report-mcp@report-v1 requires a credential: bind a credential slot
```

结论：这是代码 bug，不是测试数据问题。用户在 UI 上可以把 `aida-report-mcp` 作为多个 MCP 之一绑定到 generic agent，但运行链路没有为需要凭据的 report MCP 自动补齐 credential slot 和 credential override，导致提交到 agent 平台时被拒绝。

## 3. 根因

generic agent 原运行链路走平台 `/api/task/submit`：

- Aida 只把 agent_id、message、model_id、params 提交给平台任务接口。
- 平台当前 `/api/task/submit` 的请求结构不支持透传 `credential_overrides`。
- `aida-report-mcp@report-v1` 是需要鉴权的 MCP，必须有 `AIDA_REPORT_MCP_AUTH` 凭据槽和对应 credential。
- 因此 generic agent 一旦绑定 `aida-report-mcp`，但没有显式 credential slot，就会在平台侧触发 `MCP_CONFIG_INVALID`。

## 4. 修复方案

修复位置：`api/handler/managed_agent.go`

新增兼容路径：

1. generic agent 仍优先走原有 `/api/task/submit`，保持普通 agent 行为不变。
2. 如果平台返回 `MCP_CONFIG_INVALID` 且提示 MCP 需要 credential，则识别为 report MCP 凭据绑定问题。
3. Aida 拉取当前 agent 配置，检查是否绑定 `aida-report-mcp`。
4. 如果缺少 credential slot，则自动把该 MCP 绑定补为 `credential_slot=AIDA_REPORT_MCP_AUTH` 并更新 agent。
5. 为当前用户创建一次性平台 credential，值为当前用户 bearer token。
6. 改走平台 `/api/session` 创建 session，并通过 `credential_overrides` 注入 `AIDA_REPORT_MCP_AUTH`。
7. 本地创建并回填 `ai_runs.external_session_id`，后续状态同步沿用现有同步器。

补充测试：`api/handler/managed_agent_test.go`

- 新增单元测试覆盖：
  - `/api/task/submit` 返回 report MCP credential 错误。
  - Aida 自动修复 agent MCP binding。
  - 创建平台 credential。
  - 创建 session 时带上 `CredentialOverrides`。
  - `StartPromptValues` 正常传递 params。
  - session message 留空，避免覆盖平台 start prompt template。

## 5. 验证结果

### 5.1 单元测试

```text
cd /home/intellif/dev/project_manager/api
go test ./handler
go test ./...
```

结果：

- `go test ./handler`：PASS
- `go test ./...`：PASS

### 5.2 服务部署

```text
cd /home/intellif/dev/project_manager
docker compose up -d --build api
```

结果：API 服务构建并重启成功。

### 5.3 用户报错场景复测

复测请求：

- agent_id：`aida-testskillmcp-djnolw2dltnh`
- message：`测试 test`
- model_id：`MiniMax-M2.5`
- params：`{"text":"test"}`

复测结果：

- Aida run id：`23189e2f-3a15-4e84-b20e-e91222b8c842`
- 平台 session id：`2ba6ffa3-e233-4af9-80fd-697cc7f5ae7d`
- Aida 最终状态：`succeeded`
- 平台同步状态：`completed`
- 创建时间：`2026-07-02 01:13:59 UTC`
- 完成时间：`2026-07-02 01:14:48 UTC`

落库关键信息：

```json
{
  "status": "succeeded",
  "external_session_id": "2ba6ffa3-e233-4af9-80fd-697cc7f5ae7d",
  "input_ref_json": {
    "credential_slot": "AIDA_REPORT_MCP_AUTH",
    "credential_override": "redacted",
    "trigger_source": "manual"
  },
  "output_ref_json": {
    "status": "completed",
    "session_id": "2ba6ffa3-e233-4af9-80fd-697cc7f5ae7d"
  }
}
```

### 5.4 Agent 配置复查

修复后该 agent 的 `aida-report-mcp@report-v1` 已自动补齐：

```json
{
  "owner": "t03",
  "slug": "aida-report-mcp",
  "version": "report-v1",
  "credential_slot": "AIDA_REPORT_MCP_AUTH"
}
```

结论：该 agent 后续再次运行不会再因为同一个 `requires a credential: bind a credential slot` 错误失败。

## 6. 最终结论

本轮用户报错已修复并复测通过。

- 多 skill 绑定正常保留。
- 多 MCP 绑定正常保留。
- generic agent 绑定 report MCP 时，缺失 credential slot 的场景已自动修复。
- 真实模型任务已运行完成，Aida 状态 `succeeded`，平台状态 `completed`。

剩余注意点：

- 当前修复针对 `aida-report-mcp` 这种需要用户 bearer token 的 report MCP。
- 如果后续出现其他需要不同凭据类型的 MCP，应按 MCP 的 credential schema 增加对应的 credential slot 和 override 规则，不能一律复用 `AIDA_REPORT_MCP_AUTH`。
