# Agent 相关功能测试报告

日期：2026-06-26

## 1. 测试结论

Agent 相关 P0 功能自动化测试通过。

本次重点覆盖：

- Managed Agent 手动触发。
- Agent 定时任务配置。
- 日报生成场景的 MCP / Skill 接入信息。
- 日报 MCP 工具发现。
- 定时任务到期判定。
- 日报 Managed Agent 输出解析与既有日报保存回归。

显式模型场景采用 `Kimi-K2.6`。

## 2. 测试范围

| 模块 | 范围 |
| --- | --- |
| 手动触发 Agent | `POST /api/v1/ai-assets/agents/{agentId}/runs` |
| Agent 运行记录 | `ai_runs` 写入、查询与状态字段 |
| Agent 定时任务 | 创建、参数校验、每周计划、模型引用 |
| 日报 MCP | `POST /api/v1/mcp/daily-report` 的工具列表 |
| 日报 Skill | `GET /api/v1/ai-assets/daily-report-integration` 返回 MCP URL 与 Skill Markdown |
| 调度器 | 每日 / 每周 / 当天去重规则 |
| 前端 | AI 资产页 TypeScript、ESLint、生产构建 |

## 3. 自动化测试用例

| 用例 ID | 文件 | 场景 | 期望结果 | 结果 |
| --- | --- | --- | --- | --- |
| AGT-001 | `api/handler/managed_agent_test.go` | 手动触发 Agent，不传 `model_id` | 提交平台 Task；`model_id` 为空，使用 Agent 默认模型；写入 `manual_agent_run` | 通过 |
| AGT-002 | `api/handler/managed_agent_test.go` | 获取日报 MCP / Skill 接入信息 | 返回 MCP URL、2 个工具名、`aida-daily-report@1.0.0` Skill Markdown | 通过 |
| AGT-003 | `api/handler/managed_agent_test.go` | 创建每周 Agent 定时任务，模型为 `Kimi-K2.6` | 校验通过并写入计划；返回 `model_id=Kimi-K2.6` | 通过 |
| AGT-004 | `api/handler/managed_agent_test.go` | 创建定时任务时传入非法时间 `25:00` | 返回 `400 Bad Request` | 通过 |
| AGT-005 | `api/handler/daily_report_mcp_test.go` | 日报 MCP `tools/list` | 返回 `aida_daily_report_get_context`、`aida_daily_report_save_draft` | 通过 |
| AGT-006 | `api/service/managed_agent_scheduler_test.go` | 每日任务到点 | 到达配置时间后判定 due | 通过 |
| AGT-007 | `api/service/managed_agent_scheduler_test.go` | 每周任务按星期触发 | 仅配置星期触发 | 通过 |
| AGT-008 | `api/service/managed_agent_scheduler_test.go` | 同一天已运行的计划 | 不重复触发 | 通过 |
| AGT-009 | `api/handler/report_test.go` | 既有日报生成 / 保存回归 | 日报保存、Managed Agent run 关联逻辑不回退 | 通过 |
| AGT-010 | `api/service/report_draft_test.go` | Agent 输出草稿规范化 | 任务建议和 session 证据被校验、过滤、归一化 | 通过 |

## 4. 执行记录

### 后端

```bash
GOCACHE=/tmp/go-build-cache go test ./...
```

结果：

- `github.com/aidashboard/api/handler` 通过。
- `github.com/aidashboard/api/service` 通过。
- 其他包无测试文件或通过编译检查。

说明：handler 测试使用 `httptest.NewServer` 模拟 Managed Agent 平台，测试环境需要允许绑定本地回环端口。

### 前端 Lint

```bash
pnpm lint
```

结果：通过。

残留 warning：

- `web/src/features/aidashboard/organization/pages/OrganizationPage.tsx:97`
- 既有 `useMemo` dependency warning，与本次 Agent 功能无关。

### 前端 Build

```bash
pnpm build
```

结果：通过。

残留 warning：

- Vite chunk size 超过 1300 kB。
- 属于既有打包体积提示，不影响本次 Agent 功能。

## 5. 验证说明

本次自动化测试使用 mock Managed Agent 平台，验证 Aida 侧请求封装、参数、DB 写入和响应行为。

未在自动化中调用真实 Managed Agent 平台，原因：

- 真实平台依赖 `MANAGED_AGENT_URL`、`MANAGED_AGENT_TOKEN` 和可用 Agent 资源。
- 外部平台运行结果受网络、模型、Agent 配置和凭据影响，不适合纳入稳定单元测试。

建议后续做一轮联调验收：

1. 在平台创建绑定日报 MCP / Skill 的 Agent。
2. 模型选择 `Kimi-K2.6`。
3. 手动触发一次日报生成。
4. 创建工作日 19:00 定时任务。
5. 验证 Agent 调用 MCP 读取上下文并保存草稿。

## 6. 最终结论

Agent 相关 P0 自动化测试通过，可进入真实 Managed Agent 平台联调阶段。
