# 日报生成真实 Session 接入 P0 验收报告

## 1. 本次完成内容

已完成 Dashboard 生成今日日报 P0 闭环：

1. Dashboard 弹窗接入当天真实 session list。
2. 新增 `POST /reports/today/draft`，只生成草稿，不写 `daily_reports`。
3. draft 请求支持 `session_ids`、`skill_id`、`skill_content`、`include_task_progress`。
4. API 后端按当前登录用户校验 session 归属。
5. daemon 新增 `/reports/draft`，使用默认日报 Skill + 上传 Skill 内容构造 Claude prompt。
6. LLM 输出协议改为严格 JSON，并支持 code fence JSON 提取。
7. 前端编辑器填充真实 `report_markdown`。
8. 前端右侧展示真实 `task_progress_suggestions`。
9. 保存/发送日报时写入最终 Markdown 和 `session_ids`。
10. 任务建议只在用户点击“编辑任务”并确认后才调用任务更新接口。
11. 旧 `POST /reports/today/generate` 保持原 `/reports/generate` generator 行为。

## 2. 实际修改文件清单

1. `doc/日报生成真实Session接入_P0_实施方案.md`
2. `doc/日报生成真实Session接入_P0_验收报告.md`
3. `api/go.mod`
4. `api/go.sum`
5. `api/main.go`
6. `api/model/models.go`
7. `api/service/report_draft.go`
8. `api/service/report_draft_test.go`
9. `api/handler/report.go`
10. `api/handler/report_test.go`
11. `api/handler/session.go`
12. `daemon/server_reports.go`
13. `daemon/report_draft_test.go`
14. `daemon/report_skills/default_daily.md`
15. `web/package.json`
16. `web/scripts/dashboard_report_workflow_test.mjs`
17. `web/src/features/aidashboard/api/client.ts`
18. `web/src/features/aidashboard/api/types.ts`
19. `web/src/features/aidashboard/dashboard/DashboardPage.tsx`
20. `web/src/features/aidashboard/dashboard/console-dashboard.css`
21. `scripts/simulate_report_draft_p0.mjs`

当前工作树还存在若干非本次任务产生的已修改/删除/新增文件，未在本次范围内处理。

## 3. 新增接口说明

`POST /api/v1/reports/today/draft`

请求字段：

1. `report_date`: 日报日期，空时默认今天。
2. `session_ids`: 必填，用户选择的 session id 列表；为空返回 `400`。
3. `skill_id`: P0 支持 `default_daily`，其它值返回 `400`。
4. `skill_content`: 可选上传 Skill 内容，仅本次生成使用，不落库。
5. `include_task_progress`: false 时返回空任务建议。

响应字段：

1. `report_markdown`
2. `selected_session_ids`
3. `skill_name`
4. `task_progress_suggestions`

错误码行为：

1. `400`: 请求体错误、空 `session_ids`、非法 `skill_id`。
2. `403`: 任一 session 不存在或不属于当前用户。
3. `503`: report generator 未配置。
4. `502`: generator 请求失败、返回错误、返回非法 JSON 或空 Markdown。

## 4. 前端交互说明

Dashboard 弹窗保持现有两步布局：

1. 第一步加载当天 `started_at` 范围内真实 session。
2. 默认勾选当天全部真实 session；用户手动改选后保留选择。
3. 没有 session 或未勾选 session 时禁用下一步。
4. 上传 `skill.md` 后读取文本，作为 `skill_content` 发送给 draft API。
5. 下一步调用 `generateTodayReportDraft`。
6. draft 成功后进入编辑步骤，Markdown 编辑器填充 `report_markdown`。
7. 任务建议列表展示 `task_progress_suggestions`，无建议时显示空态。
8. 保存修改调用 `fetchTodayReport` + `updateReport`，写入 `content` 和 `session_ids`。
9. 发送日报在 P0 中等同保存并关闭弹窗，不新增飞书发送链路。
10. 任务建议点击“编辑任务”后需二次确认，确认后才调用任务更新接口。

## 5. 后端生成流程说明

API 层：

1. 校验 `session_ids` 非空和 `skill_id`。
2. 使用当前登录 `user_id + session_ids` 查询 session。
3. 查询结果数量不等于去重后的请求数量时拒绝生成。
4. 查询当前用户负责的 `todo/in_progress` 任务候选。
5. 将已校验 session、任务候选、Skill 内容转发 daemon `/reports/draft`。
6. 对 daemon 返回的任务建议进行二次过滤：任务必须来自候选，状态必须合法，进度裁剪到 0-100，evidence session 必须来自本次已校验 session。
7. draft 不写 `daily_reports`。

daemon 层：

1. embed `daemon/report_skills/default_daily.md`。
2. 合并默认 Skill 和上传 Skill。
3. 构造严格 JSON 输出 prompt。
4. 调用 Claude CLI。
5. 解析 JSON，支持 markdown code fence 包裹。
6. 过滤非法任务建议并返回结构化响应。

## 6. 测试覆盖说明

新增 Go 测试文件：

1. `api/service/report_draft_test.go`
2. `api/handler/report_test.go`
3. `daemon/report_draft_test.go`

覆盖点包括：

1. 空 `session_ids` 返回 400。
2. 非法 `skill_id` 返回 400。
3. session 不属于当前用户时返回错误。
4. 合法 JSON 解析成功。
5. code fence JSON 解析成功。
6. 非法 JSON 返回错误。
7. 空 `report_markdown` 返回错误。
8. `suggested_progress` 裁剪到 0-100。
9. evidence 包含未选择 session 时过滤。
10. `include_task_progress=false` 返回空任务建议。
11. draft handler 不写 `daily_reports`。
12. 保存日报时写 `session_ids`。
13. 旧 `/reports/today/generate` 仍调用 `/reports/generate`。

新增前端契约测试：

1. `web/scripts/dashboard_report_workflow_test.mjs`
2. 已接入 `pnpm test`

覆盖点包括真实 session 调用、draft API client、保存 `session_ids`、任务建议二次确认等关键契约。

## 7. 自动化模拟测试结果

新增脚本：

`scripts/simulate_report_draft_p0.mjs`

模拟数据：

1. 1 个测试用户。
2. 当天 2 条 session。
3. 1 个进行中任务。
4. 1 条任务进展建议。

模拟链路：

1. 调用 mock draft 生成，返回非空 Markdown。
2. 验证 `selected_session_ids` 正确。
3. 验证生成 draft 不更新任务。
4. 保存日报，验证 content 和 `session_ids` 保存。
5. 验证保存日报不更新任务。
6. 模拟用户确认任务建议。
7. 验证任务状态/进度更新。

执行结果：

`node scripts/simulate_report_draft_p0.mjs` 通过。

该脚本是 mock 自动化模拟，不连接真实数据库/真实 API/真实 Claude。

## 8. 已执行命令和结果

已通过：

1. `node scripts/simulate_report_draft_p0.mjs`
2. `cd web && node scripts/dashboard_report_workflow_test.mjs`
3. `cd web && pnpm test`
4. `cd web && pnpm typecheck`
5. `cd web && pnpm lint`
6. `cd web && pnpm build`
7. `cd web && pnpm validate`
8. `/home/intellif/.codex/plugins/cache/aihub-frontend/aihub-frontend/0.1.29/scripts/verify-project.sh /home/intellif/dev/project_manager/web`
9. `/home/intellif/.codex/plugins/cache/aihub-frontend/aihub-frontend/0.1.29/scripts/validate-project.sh /home/intellif/dev/project_manager/web`

未能执行：

1. `cd api && go test ./...`
2. `cd daemon && go test ./...`
3. `gofmt`

原因：

当前环境没有 `go` / `gofmt` 命令，返回 `/bin/bash: go: command not found` 和 `/bin/bash: gofmt: command not found`。

已知非本次问题：

1. `pnpm lint` 通过但保留既有 warning：`OrganizationPage.tsx` 的 `users` memo dependency warning。
2. `pnpm build` 通过但保留既有大 chunk warning。
3. 插件 verify 通过但保留既有 Table/Modal/ResourceTable 规范 warning。

## 9. 未完成项

1. 未在当前环境实际执行 Go 单元测试和 gofmt，原因是 Go 工具链缺失。
2. 未连接真实数据库执行完整 API 集成测试。
3. 未调用真实 Claude CLI 验证模型输出质量。
4. 前端测试为契约脚本，不是 React DOM 交互测试。

## 10. 已知风险

1. Go 代码未经过本环境 gofmt/go test，需要在具备 Go 1.26+ 的环境中执行。
2. Claude 输出质量依赖 prompt 和本地 Claude CLI 可用性。
3. `fetchTodayReport` 在保存时会创建今日日报记录，然后立即 update；这符合“保存才写日报”，但保存失败时可能留下基础日报内容。
4. Dashboard 仍是角色预览型页面，个人日报真实链路已接入，但其它报告类型保留原型行为。
5. `session_ids` 保存已校验当前用户 session；旧 `PUT /reports/{id}` 仍保持原有 report id 更新语义，未扩大到权限系统重构。

## 11. 后续 P1 建议

1. P1 再考虑 Skill 模板管理。
2. P1 再考虑任务建议草稿表。
3. P1 再考虑飞书发送链路。
4. P1 再考虑更完整的 session raw log 分析。
5. P1 增加真实数据库集成测试和 Playwright 弹窗流程测试。

## 12. Dashboard Token 统计真实化状态

本次追加完成 Dashboard Token 统计卡片 P0 真实化，范围仅限 Dashboard Token 卡片。

已使用接口：

1. `GET /tokens/sessions?from=&to=&scope=`：作为 Token 卡片主数据源。
2. `GET /tokens?period=range&from=&to=&group_by=team`：仅在总监预览视角用于展示各组真实 Token 分布。

已真实化字段：

1. 总 Token：由 `/tokens/sessions` 返回的 `total_tokens` 求和。
2. Session 数：由 `/tokens/sessions` 返回数组长度计算。
3. 上报人数：由 `/tokens/sessions` 中 `user_id` / `user_name` 去重计算。
4. 每日趋势：按 `started_at` 日期聚合 `total_tokens`，并对当前范围内无数据日期补 0。
5. 我的 Token：TL/PM/总监预览下额外调用 `scope=mine` 的 `/tokens/sessions` 计算。
6. 各组 Token：总监预览下使用 `/tokens?group_by=team` 返回的 `label`、`value`、`percent` 展示。

未真实化字段与处理：

1. `coverage`：现有 Token 接口没有成员覆盖率口径，Token 卡片不展示。
2. 各组 `session_count`：`/tokens?group_by=team` 当前不返回该字段，Token 卡片不展示，不从 token 数反推。
3. 各组 `uploader_count`：`/tokens?group_by=team` 当前不返回该字段，Token 卡片不展示。
4. 各组覆盖率：现有接口不支持，Token 卡片不展示。

Mock 状态：

1. Dashboard Token 卡片主数据路径不再使用 `TOKEN_DATA`。
2. 接口失败时显示 `Token 数据加载失败`，不会回退到 mock 数据。
3. 空数据时显示轻量空态，不伪造数据。

后端接口状态：

1. 本次没有新增后端接口。
2. 本次没有修改 `api/handler/token.go`。
3. 后续如果需要覆盖率、各组 session 数、各组上报人数，建议新增 `GET /dashboard/tokens/summary` 或扩展 `/tokens?group_by=` 的 group 返回字段。

本次新增/更新的 Token 相关文件：

1. `web/src/features/aidashboard/dashboard/DashboardPage.tsx`
2. `web/src/features/aidashboard/dashboard/dashboardTokenStats.ts`
3. `web/src/features/aidashboard/dashboard/console-dashboard.css`
4. `web/src/features/aidashboard/api/types.ts`
5. `web/scripts/dashboard_token_workflow_test.mjs`
6. `web/package.json`

本次 Token 统计检查结果：

1. `cd web && pnpm test`：通过，包含日报契约和 Token 聚合契约测试。
2. `cd web && pnpm typecheck`：通过。
3. `cd web && pnpm lint`：通过，保留既有 `OrganizationPage.tsx` hook dependency warning。
4. `cd web && pnpm build`：通过，保留既有大 chunk warning。
5. `cd web && pnpm validate`：通过，保留既有大 chunk warning。
6. `verify-project.sh /home/intellif/dev/project_manager/web`：通过，保留既有 Table/Modal 规范 warning。
7. `validate-project.sh /home/intellif/dev/project_manager/web`：通过。
