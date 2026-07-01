# 默认 Report Agent 方案

## 1. 背景

日报/周报 Agent 化需要让用户在 AI Assets 中拥有一套可见、可编辑、可删除、可复制、可运行的默认报告生成配置。当前问题是测试账号进入 AI Assets 时 Skills / MCP / Agents 可能为 0，说明默认配置没有作为用户个人资产初始化出来。

本方案只解决默认 Report Skill / Report MCP / Report Agent 的个人资产初始化问题，不重做 Report MCP 主协议，不扩展定时任务，不实现 6 个默认 Agent。

## 2. 错误方案说明

以下方向均不采用：

- 系统模板资产；
- 只读官方模板；
- 页面加载时临时创建；
- 列表接口里隐藏 ensure；
- 每次进入 AI Assets 自动重建；
- 代码里不可见的默认 Agent；
- 默认创建 6 个 Agent；
- 默认 MCP 保存固定 token、admin token 或用户 token 明文。

这些方案会导致用户删除后刷新又被创建回来，或让默认配置变成不可管理的隐藏对象，不符合 AI Assets 的产品边界。

## 3. 最终产品口径

默认配置本质上是用户自己的普通 AI Assets 个人配置，只是平台在用户账号生效时自动帮用户创建。

创建后：

- 用户可以正常查看、编辑、删除、复制、运行；
- AI Assets 列表只查询，不创建；
- 用户删除后，刷新 AI Assets 页面不会自动恢复；
- 本轮不提供“恢复默认配置”按钮；
- 存量账号通过显式 backfill 补齐；
- 后续新账号在创建 / 启用 / 生效时初始化。

## 4. 默认配置初始化时机

默认配置只在以下时机初始化：

1. admin 创建用户且用户可登录；
2. 用户从 disabled / pending 变为 active；
3. bootstrap admin 首次创建；
4. 显式执行存量账号 backfill；
5. 测试脚本显式初始化。

不会在以下时机初始化：

- 打开 AI Assets 页面；
- 调用 Skills / MCP / Agents 列表接口；
- 普通 Report Agent run 时发现不存在默认 Agent。

## 5. 存量账号 backfill

存量账号需要一次性 backfill：

- 后端提供 admin backfill 接口：`POST /api/v1/admin/ai-assets/default-report-assets/backfill`；
- backfill 幂等；
- 已存在同 slug/version 的默认 Skill / MCP 时不覆盖；
- 已存在通用默认 Report Agent 时只做必要字段修复；
- 已存在旧 personal_daily 默认 Agent 时迁移为新的通用 Report Agent；
- 重复执行不会创建重复默认资产。

如果用户删除默认资产，只有显式再次执行 backfill 才会补齐，页面刷新不会恢复。

## 6. 默认 Skill 配置

默认 Skill 是当前用户自己的普通 Skill：

- slug：`aida-report`
- version：`1.0.0`
- name：`Aida Report Skill`
- owner：当前用户
- 标记：`AIDA_REPORT_DEFAULT:true`

Skill 内容使用通用 Report Skill markdown，要求包含以下 MCP 原子工具：

- `get_sessions`
- `get_daily_reports`
- `get_weekly_reports`
- `get_tasks`
- `get_requirements`
- `get_existing_report`
- `get_report_inventory`
- `write_report_result`
- `write_report_failure`

不得引用旧工具：

- `get_report_context`
- `aida_daily_report_get_context`
- `aida_daily_report_save_draft`

## 7. 默认 MCP 配置

默认 MCP 是当前用户自己的普通 MCP：

- slug：`aida-report-mcp`
- version：`report-v1`
- name：`Aida Report MCP`
- endpoint：`/api/v1/mcp/reports`
- credential slot：`AIDA_REPORT_MCP_AUTH`
- owner：当前用户
- 标记：`AIDA_REPORT_DEFAULT:true`

MCP 配置只声明 credential slot，不保存任何固定 token。运行时由 Aida 后端按当前用户或 schedule owner 注入授权 value。

## 8. 默认 Agent 配置

默认 Agent 是当前用户自己的普通 Agent：

- name：`报告生成 Agent`
- owner：当前用户
- 默认 engine：`MANAGED_AGENT_DEFAULT_ENGINE`
- 默认 model：`MANAGED_AGENT_DEFAULT_MODEL_ID`
- 绑定当前用户自己的 `Aida Report Skill`
- 绑定当前用户自己的 `Aida Report MCP`
- credential slot：`AIDA_REPORT_MCP_AUTH`

稳定标记：

```text
AIDA_REPORT_DEFAULT:true
AIDA_REPORT_AGENT:default
AIDA_REPORT_AGENT_TYPES:personal_daily,personal_weekly,team_daily,team_weekly,department_daily,department_weekly
AIDA_MANAGED_DEFAULT_AGENT:true
```

默认只创建一个 Report Agent，不创建 6 个默认 Agent。运行时通过 `report_type` 区分生成哪类报告。

## 9. Token / Credential Slot 口径

Report MCP 不配置固定 token。

规则：

- MCP 配置只声明 `AIDA_REPORT_MCP_AUTH` credential slot；
- Agent 绑定 MCP 时只绑定 credential slot；
- 手动运行时按当前登录用户注入 token；
- 定时运行时后续按 schedule owner 注入 token；
- token 不进入前端请求参数；
- token 不进入 Agent config；
- token 不进入 MCP config；
- token 不进入 `input_ref_json`；
- token 不进入日志；
- Report MCP 仍通过 Aida AuthMiddleware 识别当前用户身份。

## 10. AI Assets 展示口径

用户进入 AI Assets 后应看到自己的普通个人资产：

- Skills >= 1，包含 `Aida Report Skill`；
- MCP >= 1，包含 `Aida Report MCP`；
- Agents >= 1，包含 `报告生成 Agent`。

这些资产不是 system owner、不是 hidden template、不是只读对象。页面不负责创建，只展示后端已经初始化的个人资产。

## 11. 删除 / 修改 / 复制行为

默认资产创建后等同普通用户资产：

- 用户可编辑内容；
- 用户可删除；
- 用户可复制；
- 用户可运行；
- 用户修改过的 Skill / MCP 不被 backfill 覆盖；
- 用户自定义 Agent instructions / model 不被强制覆盖；
- 缺失必要绑定或 credential slot 时 backfill 可以修复。

删除后刷新 AI Assets 页面不会自动恢复。显式 backfill 的恢复行为用于存量修复和测试，不是普通页面行为。

## 12. 验收标准

接口级验收必须覆盖：

1. backfill 对存量账号幂等；
2. employee / PM / TL / Director / Admin 均拥有默认 Skill / MCP / Agent；
3. 默认 Skill 内容包含新工具且不包含旧工具；
4. 默认 MCP 指向 `/api/v1/mcp/reports`，只声明 `AIDA_REPORT_MCP_AUTH`；
5. 默认 Agent 数量为 1，不是 6 个；
6. 默认 Agent 绑定当前用户自己的 Skill / MCP；
7. `input_ref_json` 不包含 token、Authorization、credential value；
8. AI Assets 列表接口不会触发创建；
9. 删除后刷新列表不会自动恢复；
10. Report MCP 通用客户端验收不被破坏。

## 13. 测试账号验证结果

测试脚本：

```bash
scripts/test_default_report_assets.py
```

输出：

- `doc/默认Report配置初始化验收报告.md`
- `tmp/default_report_assets_test_result_<timestamp>.md`

脚本覆盖：

- 测试账号文档中的 employee / PM / TL / Director / Admin；
- backfill 或显式用户级初始化；
- AI Assets 列表；
- Skill markdown 工具检查；
- MCP token 泄露检查；
- 默认 Agent 标记与数量检查；
- 可选 Report Agent run smoke。

本文件只记录方案和验收口径，实时测试结果以 `doc/默认Report配置初始化验收报告.md` 为准。
