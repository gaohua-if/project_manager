# 日报生成真实 Session 接入 P0 实施方案

## 1. 背景与目标

Dashboard 现有“生成今日日报”弹窗已经具备 P0 所需的交互雏形：选择 session、选择默认日报 Skill 或上传 skill.md、生成 Markdown 草稿、展示任务进展建议、编辑后保存或发送日报。但当前 Dashboard 主要使用本地 mock state，没有真正接入用户已上传的 session，也没有按 `session_ids + skill` 调用 LLM 生成日报草稿。

本次目标是在不重做 `/reports` 页面、不改变旧 `POST /reports/today/generate` 行为的前提下，实现 Dashboard 生成今日日报 P0 闭环：

1. Dashboard 弹窗展示真实 session list。
2. 用户选择 session 和 Skill 后调用新增 draft API。
3. draft API 只生成草稿，不写 `daily_reports`。
4. LLM 返回结构化 JSON，包含 Markdown 日报和任务进展建议。
5. 用户保存或发送日报时，才写入最终 Markdown 和 `session_ids`。
6. 任务进展建议只展示，只有用户确认后才调用任务更新接口。

## 2. 当前代码现状

后端已有 Claude CLI 调用能力：

1. `api/service/ai.go`：API 内用于验收标准生成、session 匹配任务，底层调用 `claude -p`。
2. `daemon/server_reports.go`：daemon report generator 服务用于个人/团队日报生成，同样调用 Claude CLI。

已有日报接口：

1. `POST /reports/today/generate` 位于 `api/handler/report.go`，当前只转发 `user_id` 和当天日期到 daemon。
2. daemon 侧按用户和日期查询所有 session，并 upsert `daily_reports`。
3. 该旧接口本次保持兼容，不改变行为。

已有 session 查询：

1. `GET /sessions` 位于 `api/handler/session.go`，返回 `PaginatedSessions`。
2. web API client 已有 `fetchSessions`，返回 `PaginatedSessions`。
3. Dashboard 当前未使用该真实接口，而是使用本地 `SESSION_OPTIONS`。

已有任务更新接口：

1. `PUT /tasks/{id}/progress` 更新任务进度。
2. `PUT /tasks/{id}/status` 更新任务状态。
3. 前端 API client 已有 `updateTaskProgress` 和 `updateTaskStatus`。

已有日报保存接口：

1. `PUT /reports/{id}` 当前支持 `content` 和 `feishu_doc_url`。
2. 数据库 `daily_reports` 已有 `session_ids UUID[]` 字段。
3. 本次需要兼容扩展保存接口，使其可选接收 `session_ids`。

## 3. P0 范围

本次必须完成：

1. 新增实施文档和验收报告。
2. 新增 `POST /reports/today/draft` API。
3. 新增默认日报 Skill 文件。
4. 新增 daemon draft 生成链路。
5. draft API 支持 `session_ids + skill_id + skill_content + include_task_progress`。
6. API 后端校验 session 属于当前用户。
7. LLM 输出严格 JSON 并解析、校验、规范化。
8. Dashboard 弹窗接入真实 session list。
9. Dashboard 下一步调用 draft API。
10. 编辑器填充真实 `report_markdown`。
11. 右侧展示真实 `task_progress_suggestions`。
12. 保存日报时保存最终 Markdown 和 `session_ids`。
13. 任务建议只有用户确认后才更新任务。
14. 补必要单元测试和一个自动化模拟测试。

## 4. 明确不做的 P1/P2 范围

本次不做：

1. 不重做 `/reports` 页面。
2. 不新增 Skill 管理页面。
3. 不新增 `report_skills` 表。
4. 不新增任务建议草稿表。
5. 不新增飞书发送链路。
6. 不新增失败重试队列。
7. 不新增定时生成。
8. 不做日报系统大改版。
9. 不改首页其它模块。
10. 不改需求看板、任务看板、风险通知等无关模块。
11. 不改旧 `POST /reports/today/generate` 行为。
12. 不做破坏性数据库变更。
13. 不自动批量应用任务建议。

## 5. 新增 API 设计

新增接口：

`POST /api/v1/reports/today/draft`

请求体：

```json
{
  "report_date": "2026-06-24",
  "session_ids": ["session_1", "session_2"],
  "skill_id": "default_daily",
  "skill_content": "可选上传 skill.md 内容",
  "include_task_progress": true
}
```

响应体：

```json
{
  "report_markdown": "## 今日完成\n...",
  "selected_session_ids": ["session_1", "session_2"],
  "skill_name": "默认日报 Skill",
  "task_progress_suggestions": [
    {
      "task_id": "task_1",
      "task_title": "控制台日报交互设计",
      "requirement_id": "req_1",
      "requirement_title": "日报入口状态优化",
      "suggested_status": "in_progress",
      "suggested_progress": 75,
      "evidence_session_ids": ["session_1", "session_2"],
      "evidence_session_titles": [
        "Claude Code session 09:30 - 10:20",
        "Codex session 14:00 - 15:10"
      ],
      "reason": "根据 session 内容判断已完成页面结构调整和交互入口梳理。"
    }
  ]
}
```

错误行为：

1. `session_ids` 为空：`400`。
2. `skill_id` 非 `default_daily`：`400`。
3. 任一 session 不存在或不属于当前用户：`403` 或 `400`，错误信息明确指出 session 校验失败。
4. report generator 未配置或不可用：`503/502`。
5. LLM JSON 解析失败、`report_markdown` 为空：`502`。

## 6. 前端交互流程

第一步：

1. 打开 Dashboard 生成今日日报弹窗。
2. 调用 `fetchSessions({ date: today, page: "1", page_size: "100" })`。
3. 展示当天真实 session。
4. 默认勾选当天所有 session。
5. 用户可取消勾选。
6. 用户选择默认 Skill 或上传 `skill.md`。
7. 没有 session 或没有勾选 session 时，禁用下一步。
8. 点击下一步调用 `generateTodayReportDraft`。

第二步：

1. 成功后进入编辑态。
2. 左侧 Markdown 编辑器填充 `report_markdown`。
3. 右侧任务建议列表填充 `task_progress_suggestions`。
4. 无任务建议时显示空态。
5. 点击上一步返回第一步，并保留 session 选择和上传 Skill 状态。
6. 点击保存修改，调用保存日报接口写入最终 Markdown 和 `selected_session_ids`。
7. 点击发送日报，P0 等同保存并关闭弹窗，不新增飞书发送链路。
8. 任务建议卡片点击确认后，才调用 `updateTaskProgress` / `updateTaskStatus`。

## 7. 后端生成流程

API 层：

1. 读取 `GenerateReportDraftRequest`。
2. 校验 `session_ids` 非空。
3. 校验 `skill_id == default_daily`。
4. 使用当前登录 `user_id + session_ids` 查询 session。
5. 如果校验通过的 session 数量和去重后的请求数量不一致，拒绝生成。
6. 查询当前用户负责的 `todo/in_progress` 任务作为任务建议候选。
7. 将已校验 session、任务候选、Skill 内容转发给 daemon draft endpoint。
8. 对 daemon 返回的建议再做 session evidence 和任务状态/进度校验。
9. 返回草稿，不写 `daily_reports`。

daemon 层：

1. 接收 API 已校验的 session 和任务候选。
2. 读取默认 Skill。
3. 合并默认 Skill 与本次上传 Skill 内容。
4. 构造严格 JSON 输出 prompt。
5. 调用 Claude CLI。
6. 解析 JSON，支持 code fence。
7. 校验并规范化 `task_progress_suggestions`。
8. 返回结构化草稿。

## 8. session 权限校验规则

1. 前端传入的 `session_ids` 不可信。
2. API 必须用当前登录 `user_id` 查询 session。
3. `selected_session_ids` 必须以后端查询并校验通过的 session 为准。
4. 任一 session 不属于当前用户或不存在时，整体失败，不生成草稿。
5. draft API 不允许 manager 代他人生成个人日报，P0 仅按当前用户本人生成。

## 9. Skill 处理规则

P0 只支持：

1. `skill_id = default_daily`。
2. 内置默认 Skill 文件。
3. 上传 `skill.md` 仅作为 `skill_content` 参与本次 prompt，不落库。
4. 上传 Skill 不修改默认 Skill 文件。
5. 上传 Skill 不新增管理页面。
6. 上传 Skill 不新增数据库表。

合并规则：

1. 默认 Skill 是基础约束。
2. 上传 Skill 作为补充约束追加。
3. 如果上传 Skill 和默认 Skill 冲突，以安全约束为准：只基于 session 证据、不编造、输出严格 JSON、任务建议保守。

## 10. LLM JSON 输出协议

目标 JSON：

```json
{
  "report_markdown": "...",
  "task_progress_suggestions": [
    {
      "task_id": "...",
      "task_title": "...",
      "requirement_id": "...",
      "requirement_title": "...",
      "suggested_status": "in_progress",
      "suggested_progress": 75,
      "evidence_session_ids": ["..."],
      "evidence_session_titles": ["..."],
      "reason": "..."
    }
  ]
}
```

解析要求：

1. 优先直接 `json.Unmarshal`。
2. 失败后尝试从输出中提取第一个完整 JSON object。
3. 继续失败则返回明确错误。
4. `report_markdown` 为空则返回错误。
5. `task_progress_suggestions` 缺失按空数组。
6. `suggested_progress` 限制到 `0-100`。
7. `suggested_status` 只允许 `todo/in_progress/done`。
8. `evidence_session_ids` 只能包含本次已校验 session。
9. 证据 session 为空的任务建议过滤。
10. 非法任务状态、无效任务 ID、非候选任务建议过滤。

## 11. 错误处理策略

1. 输入校验错误返回 `400`。
2. 权限或 session 归属错误返回 `403`。
3. report generator 未配置返回 `503`。
4. report generator 请求失败返回 `502`。
5. Claude 执行失败返回明确错误。
6. JSON 解析失败返回明确错误，不静默当 Markdown 使用。
7. draft 失败时前端停留第一步并展示错误。
8. 保存日报失败不影响任务建议状态。
9. 任务建议确认失败只提示该任务失败，不影响日报内容。

## 12. 测试方案

后端单元测试覆盖：

1. `session_ids` 为空返回 400。
2. session 不属于当前用户时返回错误。
3. `skill_id` 不合法返回 400。
4. 合法 JSON 解析成功。
5. code fence 包裹 JSON 解析成功。
6. 非法 JSON 返回错误。
7. `suggested_progress` 超过范围会被限制。
8. evidence 包含未选择 session 时被过滤。
9. draft 接口不写 `daily_reports`。
10. 旧 `POST /reports/today/generate` 行为不受影响。
11. `include_task_progress=false` 返回空任务建议。
12. `report_markdown` 为空返回错误。
13. `selected_session_ids` 以后端校验结果为准。

前端测试覆盖：

1. 弹窗打开后调用真实 `fetchSessions`。
2. 有 session 时默认勾选。
3. 无 session 时不能下一步。
4. 点击下一步调用 draft API。
5. draft 成功后进入编辑步骤。
6. `report_markdown` 填入编辑器。
7. `task_progress_suggestions` 渲染。
8. draft 失败展示错误并停留第一步。
9. 保存修改调用保存接口并传入 `content + session_ids`。
10. 未确认任务建议时不调用任务更新接口。
11. 上一步返回保留已选 session。
12. 上传 `skill.md` 后将内容传给 draft API。

## 13. 自动化模拟测试方案

优先使用 Go 后端集成/模拟测试：

1. 使用 mock HTTP server 作为 daemon report generator。
2. 使用 mock SQL driver 或最小测试数据库准备测试用户、session、任务。
3. 调用 `POST /reports/today/draft`。
4. 验证返回 Markdown、selected session、任务建议。
5. 调用 `PUT /reports/{id}` 保存日报并验证 `session_ids`。
6. 验证 draft 过程中没有写 `daily_reports`。
7. 模拟用户确认任务建议，调用任务更新接口验证任务状态/进度变化。

如果完整数据库集成不可用，则以可运行 mock 集成测试覆盖核心处理链路，并在验收报告说明真实程度。

## 14. 验收标准

1. Dashboard 弹窗不再使用固定 mock session 作为生成来源。
2. 打开弹窗能看到当天真实 session。
3. 没有 session 时不能生成。
4. 选择 session 后能生成 Markdown 草稿。
5. 上传 Skill 内容能随本次 draft 请求传入后端。
6. draft API 不写 `daily_reports`。
7. 多次生成草稿不会污染日报记录。
8. 保存或发送日报后，`daily_reports.content` 和 `daily_reports.session_ids` 被写入。
9. 任务进展建议能展示。
10. 未确认任务建议时不会更新任务。
11. 用户确认任务建议后才调用任务更新接口。
12. 旧 `/reports/today/generate` 和 `/reports` 页面行为保持兼容。

## 15. 预计修改文件清单

预计新增或修改：

1. `doc/日报生成真实Session接入_P0_实施方案.md`
2. `doc/日报生成真实Session接入_P0_验收报告.md`
3. `api/model/models.go`
4. `api/handler/report.go`
5. `api/main.go`
6. `api/service/report_draft.go`
7. `api/service/report_skills/default_daily.md`
8. `api/handler/report_test.go`
9. `api/service/report_draft_test.go`
10. `daemon/server_reports.go`
11. `daemon/report_draft_test.go`
12. `web/src/features/aidashboard/api/types.ts`
13. `web/src/features/aidashboard/api/client.ts`
14. `web/src/features/aidashboard/dashboard/DashboardPage.tsx`
15. `web/src/features/aidashboard/dashboard/console-dashboard.css`
16. 必要的最小前端测试或自动化模拟脚本

## 16. 实际修改文件清单

本次实际修改和新增：

1. `doc/日报生成真实Session接入_P0_实施方案.md`：实施方案与实际文件清单。
2. `doc/日报生成真实Session接入_P0_验收报告.md`：验收报告。
3. `api/go.mod`：新增 `go-sqlmock` 测试依赖。
4. `api/go.sum`：新增 `go-sqlmock` 校验值。
5. `api/main.go`：注册 `POST /reports/today/draft`。
6. `api/model/models.go`：新增 draft request/response DTO，扩展 `UpdateReportRequest.session_ids`。
7. `api/service/report_draft.go`：新增 draft skill 校验和响应二次规范化。
8. `api/service/report_draft_test.go`：新增 draft 规范化单元测试。
9. `api/handler/report.go`：新增 draft handler、session 权限校验、任务候选查询、保存日报写入 `session_ids`。
10. `api/handler/report_test.go`：新增 draft/save/旧接口兼容的 handler mock 测试。
11. `api/handler/session.go`：session list 增加 `started_from/started_to` 查询条件。
12. `daemon/server_reports.go`：新增 `/reports/draft`、默认 Skill embed、prompt 构造、LLM JSON 解析和建议过滤。
13. `daemon/report_draft_test.go`：新增 daemon JSON 解析单元测试。
14. `daemon/report_skills/default_daily.md`：新增 P0 默认日报 Skill。
15. `web/package.json`：新增 `pnpm test` 脚本。
16. `web/scripts/dashboard_report_workflow_test.mjs`：新增前端契约测试。
17. `web/src/features/aidashboard/api/client.ts`：新增 `generateTodayReportDraft`，扩展 `updateReport` payload。
18. `web/src/features/aidashboard/api/types.ts`：新增 draft payload/response/任务建议类型。
19. `web/src/features/aidashboard/dashboard/DashboardPage.tsx`：Dashboard 弹窗接真实 session、draft API、保存日报和任务建议确认更新。
20. `web/src/features/aidashboard/dashboard/console-dashboard.css`：新增 session/任务建议空态样式。
21. `scripts/simulate_report_draft_p0.mjs`：新增 P0 自动化模拟脚本。
