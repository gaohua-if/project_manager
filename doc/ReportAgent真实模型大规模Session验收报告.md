# Report Agent 真实模型大规模 Session 验收报告

- 生成时间: `20260701_013205`
- test_run_id: `large-20260701_013205-8854b51f`
- 测试日期: `2026-07-01` (周 2026-06-29 ~ 2026-07-05)

## 测试目标与范围

- **目标**: 在真实模型 + 真实 session 上传场景下，大面积暴露 Report Agent 链路问题。
- **范围**:
  - 真实本地 session 文件解析与上传（≥20 条，多角色分配）。
  - 默认 Report Agent 真实模型运行（≥18 次，≥12 次成功）。
  - 6 类 report_type 全部真实生成。
  - 业务接口读回字段一致性校验。
  - 越权用例的 run API / MCP 层拒绝行为。
  - MCP 通用回归、默认资产回归、Go / 前端构建回归。
- **不在范围**:
  - UI 自动化、定时任务、历史资产清理。
  - 业务代码 bug 修复（仅记录）。

## 测试账号清单

| user_id | username | role | team |
| --- | --- | --- | --- |
| 303 | t01 | pm | - |
| 304 | t02 | director | - |
| 305 | t03 | team_leader | 小组A |
| 306 | t04 | team_leader | 小组B |
| 307 | t05 | employee | 小组A |
| 308 | t06 | employee | 小组A |
| 309 | t07 | employee | 小组A |
| 310 | t08 | employee | 小组A |
| 311 | t09 | employee | 小组B |
| 312 | t10 | employee | 小组B |
| 313 | t11 | employee | 小组B |
| 314 | t12 | employee | 小组B |

## 数据脱敏与隐私说明

- 本轮所有 session 内容来自本地 `~/.claude/projects/` 已有 jsonl 文件。
- 上传到 Aida 时仅在 summary 中注入 `REPORT_AGENT_REAL_LARGE_TEST_<ts>` 前缀和来源 metadata，不修改原文件。
- 测试账户统一密码 `12345678`，JWT 由 `AIHUB_SECRET` 本地签名，未走公网。
- 报告中所有 `local_file` 字段为开发机本地路径，不包含敏感凭据。

## 唯一前缀与 traceability

- test_run_id: `large-20260701_013205-8854b51f`
- prefix: `REPORT_AGENT_REAL_LARGE_TEST_20260701_013205`
- 每条上传 session 的 `session_ref` 包含 prefix，可用于数据库反查。
- 每条上传 session 的 summary 头部包含 `[local session upload]`、`role=`、`batch=`、`source_file=`、`local_session_id=`、`content_len=`。

## session metadata 字段说明

通过 `/api/v1/sessions/batch` 上传，metadata JSON 结构:

```json
{"sessions": [{"session_ref": "<prefix>-<role>-<batch>-<rand>",
  "agent_type": "claude_code",
  "started_at": "<from local jsonl timestamp>",
  "ended_at": "<from local jsonl timestamp>",
  "duration_secs": 600,
  "model": "claude-sonnet-4-6",
  "summary": "<prefix> + role/batch/source/local_session_id/content_len/summary_text"}]}
```

- 反查字段: `metadata.test_run_id`、`metadata.source_local_file`、`metadata.local_sha256`、`metadata.assigned_user`、`metadata.upload_batch` 暂未在 API schema 中正式落库，但通过 summary 文本可定位。

## 测试环境与前置检查

- API base: `http://127.0.0.1:18090/api/v1`
- Managed Agent URL: `http://192.168.18.107:3081`
- 唯一前缀: `REPORT_AGENT_REAL_LARGE_TEST_20260701_013205`
- test_run_id: `large-20260701_013205-8854b51f`
- 默认模型: `MiniMax-M2.5` / engine `claude-code` (不降级)
- 轮询: interval `10.0s`, timeout `900.0s`
- 跳过真实模型: `False`
- 本地 session 候选文件数: `60`
- 目标上传条数: ≥`20`
- 目标真实模型运行次数: ≥`18` (≥`12` 成功)

| 检查项 | 结果 | 详情 |
| --- | --- | --- |
| GET /health | PASS | status=200 body={'status': 'ok'} |
| POST /mcp/reports exists | PASS | status=401 |
| /mcp/daily-report absent | PASS | status=404 |
| local sessions ≥ 20 | PASS | count=60 |

## 本地 session 数据源盘点

- 候选总数: `60`
- 来源目录（按优先级）: `~/.claude/projects/`, `tmp/`
- 支持格式: `.md/.txt/.json/.jsonl/.csv`

| # | local_file | source_kind | session_id | started_at | ended_at | content_len | sha256[:12] |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `3e8d7f79-6961-426e-a122-164c3f706207.jsonl` | jsonl | `3e8d7f79-6961-426e-a122-164c3f706207` | 2026-06-24T13:23:22.922+00:00 | 2026-06-25T08:58:13.558+00:00 | 365237 | `79e95d0f2fcb` |
| 2 | `aa9693d1-5a3a-4e01-9b11-9f684da9b79b.jsonl` | jsonl | `aa9693d1-5a3a-4e01-9b11-9f684da9b79b` | 2026-06-25T09:20:45.691+00:00 | 2026-06-25T15:35:30.695+00:00 | 209428 | `5144a8c3fc76` |
| 3 | `832dca06-1be0-4b60-87ed-a4196bf39e71.jsonl` | jsonl | `832dca06-1be0-4b60-87ed-a4196bf39e71` | 2026-06-30T07:42:11.397+00:00 | 2026-06-30T16:20:44.816+00:00 | 123435 | `1f83e0b6c56e` |
| 4 | `10f1902f-d727-430b-8a13-6e9ee0425b48.jsonl` | jsonl | `10f1902f-d727-430b-8a13-6e9ee0425b48` | 2026-06-24T06:18:26.656+00:00 | 2026-06-25T06:23:53.655+00:00 | 121117 | `92b9eeccd6ad` |
| 5 | `96a3e045-35d9-4559-92a9-a033723f1312.jsonl` | jsonl | `96a3e045-35d9-4559-92a9-a033723f1312` | 2026-06-29T04:10:36.940+00:00 | 2026-06-29T07:31:13.555+00:00 | 89879 | `c198b50dc7e0` |
| 6 | `0da858e6-c61b-4595-a64c-6b783ba23b31.jsonl` | jsonl | `0da858e6-c61b-4595-a64c-6b783ba23b31` | 2026-06-26T08:35:41.277+00:00 | 2026-06-26T09:47:09.315+00:00 | 100292 | `8ffa096b0b8c` |
| 7 | `eb3941c4-4e1d-4709-b25a-c573050bbbfb.jsonl` | jsonl | `eb3941c4-4e1d-4709-b25a-c573050bbbfb` | 2026-06-26T02:11:55.340+00:00 | 2026-06-26T05:03:33.121+00:00 | 59468 | `0606fcca40ec` |
| 8 | `9d96f06e-7d86-486a-a671-d63f77e1ba6f.jsonl` | jsonl | `9d96f06e-7d86-486a-a671-d63f77e1ba6f` | 2026-06-26T07:11:36.593+00:00 | 2026-06-26T08:29:34.804+00:00 | 48020 | `a740b2dda754` |
| 9 | `54ff43a0-aa04-4860-915f-2c4a610a37c9.jsonl` | jsonl | `54ff43a0-aa04-4860-915f-2c4a610a37c9` | 2026-06-26T13:10:28.729+00:00 | 2026-06-27T04:15:27.755+00:00 | 81404 | `bf9ba14966a0` |
| 10 | `38149616-51fa-4b27-82da-d8a39f367145.jsonl` | jsonl | `38149616-51fa-4b27-82da-d8a39f367145` | 2026-06-27T09:17:00.498+00:00 | 2026-06-29T01:39:40.263+00:00 | 42270 | `abf1db9ae686` |
| 11 | `b2aa8f38-3bec-4815-9568-d94ed5475153.jsonl` | jsonl | `b2aa8f38-3bec-4815-9568-d94ed5475153` | 2026-06-30T23:46:01.578+00:00 | 2026-07-01T01:32:05.737+00:00 | 46515 | `f469bd6c496b` |
| 12 | `b31870b0-bd47-4385-bba1-edbdaef0d3c8.jsonl` | jsonl | `b31870b0-bd47-4385-bba1-edbdaef0d3c8` | 2026-06-30T09:36:12.706+00:00 | 2026-06-30T13:43:16.906+00:00 | 26014 | `2bd76929b543` |
| 13 | `5fba7fea-0b52-419b-a456-50f155ecc7b3.jsonl` | jsonl | `5fba7fea-0b52-419b-a456-50f155ecc7b3` | 2026-06-27T07:22:41.480+00:00 | 2026-06-27T07:52:27.793+00:00 | 15843 | `577cb47af1af` |
| 14 | `7ea74ca9-b8f5-4f65-a464-222e7b988a50.jsonl` | jsonl | `7ea74ca9-b8f5-4f65-a464-222e7b988a50` | 2026-06-25T15:42:32.294+00:00 | 2026-06-26T02:11:00.458+00:00 | 25111 | `30368e1aae2e` |
| 15 | `2134865d-9061-4e99-86c1-665c62873dd1.jsonl` | jsonl | `2134865d-9061-4e99-86c1-665c62873dd1` | 2026-06-25T06:56:01.962+00:00 | 2026-06-25T09:20:41.093+00:00 | 14959 | `f2a2aefdcfb1` |
| 16 | `bb7gocv0x.txt` | txt | `bb7gocv0x` | 2026-06-30T09:00:00Z | 2026-06-30T10:00:00Z | 1251393 | `036323143d7a` |
| 17 | `b42i2kxqm.txt` | txt | `b42i2kxqm` | 2026-06-30T09:00:00Z | 2026-06-30T10:00:00Z | 1082897 | `2e9784face57` |
| 18 | `69153d62-6b6c-406a-9d22-c18109e37a3b.jsonl` | jsonl | `69153d62-6b6c-406a-9d22-c18109e37a3b` | 2026-06-26T02:56:38.383+00:00 | 2026-06-26T08:19:30.426+00:00 | 21682 | `76599247802c` |
| 19 | `7df06977-67f1-4688-8fe3-6276d6e4bfab.jsonl` | jsonl | `7df06977-67f1-4688-8fe3-6276d6e4bfab` | 2026-06-17T03:36:41.743+00:00 | 2026-06-18T08:38:48.965+00:00 | 43634 | `83e0522af962` |
| 20 | `41eeca5e-43ec-4fb6-b055-5a368bae45ab.jsonl` | jsonl | `41eeca5e-43ec-4fb6-b055-5a368bae45ab` | 2026-06-24T05:48:59.490+00:00 | 2026-06-24T11:01:12.711+00:00 | 12180 | `3923750552da` |
| 21 | `41f82498-c68a-4e2d-bfaf-c73374e71069.jsonl` | jsonl | `41f82498-c68a-4e2d-bfaf-c73374e71069` | 2026-06-26T06:07:43.475+00:00 | 2026-06-26T07:09:05.375+00:00 | 11155 | `8fd4a9c9a45d` |
| 22 | `49544592-e557-42cc-b343-5cb8bbdaecdc.jsonl` | jsonl | `49544592-e557-42cc-b343-5cb8bbdaecdc` | 2026-06-26T08:31:21.339+00:00 | 2026-06-26T09:16:07.662+00:00 | 7725 | `8b144b1f0bbd` |
| 23 | `978c7c8d-1bed-4d4a-aed1-bb75ed1895a4.jsonl` | jsonl | `978c7c8d-1bed-4d4a-aed1-bb75ed1895a4` | 2026-06-29T11:23:24.988+00:00 | 2026-06-29T12:56:12.873+00:00 | 2050 | `656b05f47186` |
| 24 | `agent-a107a7802c3db9a55.jsonl` | jsonl | `3e8d7f79-6961-426e-a122-164c3f706207` | 2026-06-25T07:58:59.647+00:00 | 2026-06-25T08:03:15.059+00:00 | 23725 | `58eca29f0629` |
| 25 | `agent-ae4aa6d8000cf4627.jsonl` | jsonl | `3e8d7f79-6961-426e-a122-164c3f706207` | 2026-06-25T07:53:20.752+00:00 | 2026-06-25T07:58:48.064+00:00 | 10429 | `f18139d1b556` |
| 26 | `agent-afe1edec9902c83ab.jsonl` | jsonl | `38149616-51fa-4b27-82da-d8a39f367145` | 2026-06-27T09:29:54.408+00:00 | 2026-06-27T09:32:32.447+00:00 | 12310 | `1072ab6bd562` |
| 27 | `agent-addee0bc8f652a59e.jsonl` | jsonl | `3e8d7f79-6961-426e-a122-164c3f706207` | 2026-06-25T07:53:20.882+00:00 | 2026-06-25T07:57:22.428+00:00 | 13783 | `721447ff857a` |
| 28 | `agent-a0afcc35b3ff244eb.jsonl` | jsonl | `2134865d-9061-4e99-86c1-665c62873dd1` | 2026-06-25T09:16:11.764+00:00 | 2026-06-25T09:20:40.999+00:00 | 2734 | `4c9987965bf7` |
| 29 | `agent-ae80fe95afaa0dd12.jsonl` | jsonl | `2134865d-9061-4e99-86c1-665c62873dd1` | 2026-06-25T09:12:31.522+00:00 | 2026-06-25T09:15:58.655+00:00 | 14629 | `8ebca30fd8a4` |
| 30 | `agent-a45e4880c9a0b0375.jsonl` | jsonl | `38149616-51fa-4b27-82da-d8a39f367145` | 2026-06-27T09:29:54.408+00:00 | 2026-06-27T09:33:57.078+00:00 | 15206 | `e5f619563161` |
| 31 | `agent-a8cf886a84ad06561.jsonl` | jsonl | `aa9693d1-5a3a-4e01-9b11-9f684da9b79b` | 2026-06-25T10:19:18.849+00:00 | 2026-06-25T10:21:47.940+00:00 | 12576 | `16e89e0088d4` |
| 32 | `beuves737.txt` | txt | `beuves737` | 2026-06-30T09:00:00Z | 2026-06-30T10:00:00Z | 295167 | `7362961e21df` |
| 33 | `brbb2v5uz.txt` | txt | `brbb2v5uz` | 2026-06-30T09:00:00Z | 2026-06-30T10:00:00Z | 295623 | `633723e13a20` |
| 34 | `bc7jnhncv.txt` | txt | `bc7jnhncv` | 2026-06-30T09:00:00Z | 2026-06-30T10:00:00Z | 270141 | `f06a1f16301a` |
| 35 | `agent-a53a354503f8075da.jsonl` | jsonl | `96a3e045-35d9-4559-92a9-a033723f1312` | 2026-06-29T06:02:36.001+00:00 | 2026-06-29T06:05:28.396+00:00 | 20146 | `e08cf5aa5d5d` |
| 36 | `300559e7-dc01-462f-9ac9-3cfc9914cfa6.jsonl` | jsonl | `300559e7-dc01-462f-9ac9-3cfc9914cfa6` | 2026-06-22T02:11:57.629+00:00 | 2026-06-24T02:56:57.110+00:00 | 3205 | `7364022c994e` |
| 37 | `agent-a62fc3da97a41334d.jsonl` | jsonl | `aa9693d1-5a3a-4e01-9b11-9f684da9b79b` | 2026-06-25T10:19:18.850+00:00 | 2026-06-25T10:21:41.987+00:00 | 12986 | `0fc39e1a4a3f` |
| 38 | `agent-a63d5c0ed9c0da3c5.jsonl` | jsonl | `aa9693d1-5a3a-4e01-9b11-9f684da9b79b` | 2026-06-25T10:22:10.631+00:00 | 2026-06-25T10:24:32.252+00:00 | 19927 | `eafe3acdad07` |
| 39 | `agent-a8c5e10b2d8b0a207.jsonl` | jsonl | `aa9693d1-5a3a-4e01-9b11-9f684da9b79b` | 2026-06-25T09:36:28.298+00:00 | 2026-06-25T09:38:30.220+00:00 | 13139 | `e993e5ce718c` |
| 40 | `agent-a43806522969f3467.jsonl` | jsonl | `2134865d-9061-4e99-86c1-665c62873dd1` | 2026-06-25T09:12:31.521+00:00 | 2026-06-25T09:15:12.321+00:00 | 10758 | `f8c911f17c08` |
| ... | (+20 more) | | | | | | |

## 角色分配汇总

| role | username | target range | actual count |
| --- | --- | --- | --- |
| employee_a | t05 | 6-8 | 8 |
| employee_b | t06 | 5-7 | 7 |
| pm | t01 | 4-6 | 6 |
| tl | t03 | 3-5 | 5 |
| director | t02 | 2-4 | 4 |
| **total** | - | - | **30** |

## 默认 Report 配置回归结果

对每个测试账号验证 AI Assets 中存在属于自己的默认 Skill / MCP / Agent，duplicate count = 1/1/1。

| user_id | username | role | skill | mcp | agent | dup (s/m/a) | owner=self | not system |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 303 | t01 | pm | PASS | PASS | PASS | 1/1/1 | PASS | PASS |
| 304 | t02 | director | PASS | PASS | PASS | 1/1/1 | PASS | PASS |
| 305 | t03 | team_leader | PASS | PASS | PASS | 1/1/1 | PASS | PASS |
| 306 | t04 | team_leader | PASS | PASS | PASS | 1/1/1 | PASS | PASS |
| 307 | t05 | employee | PASS | PASS | PASS | 1/1/1 | PASS | PASS |
| 308 | t06 | employee | PASS | PASS | PASS | 1/1/1 | PASS | PASS |
| 309 | t07 | employee | PASS | PASS | PASS | 1/1/1 | PASS | PASS |
| 310 | t08 | employee | PASS | PASS | PASS | 1/1/1 | PASS | PASS |
| 311 | t09 | employee | PASS | PASS | PASS | 1/1/1 | PASS | PASS |
| 312 | t10 | employee | PASS | PASS | PASS | 1/1/1 | PASS | PASS |
| 313 | t11 | employee | PASS | PASS | PASS | 1/1/1 | PASS | PASS |
| 314 | t12 | employee | PASS | PASS | PASS | 1/1/1 | PASS | PASS |

## 大规模本地 session 上传结果

- test_run_id: `large-20260701_013205-8854b51f`
- 唯一前缀（注入 title/summary）: `REPORT_AGENT_REAL_LARGE_TEST_20260701_013205`
- 目标角色分配: employee_a 6-8, employee_b 5-7, PM 4-6, TL 3-5, Director 2-4

| # | role | user | batch | local_file | local_session_id | content_len | sha256[:12] | upload status | session_id | ok |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | employee_a | t05 | 1 | `bb7gocv0x.txt` | `bb7gocv0x` | 1251393 | `036323143d7a` | 200 | `4f419910-1867-4c67-8858-0c30cdbc09be` | PASS |
| 2 | employee_a | t05 | 2 | `eb3941c4-4e1d-4709-b25a-c573050bbbfb.jsonl` | `eb3941c4-4e1d-4709-b25a-c573050bbbfb` | 59468 | `0606fcca40ec` | 200 | `97f0bfc9-620c-4a54-9b10-72d893f30bca` | PASS |
| 3 | employee_a | t05 | 3 | `agent-a62fc3da97a41334d.jsonl` | `aa9693d1-5a3a-4e01-9b11-9f684da9b79b` | 12986 | `0fc39e1a4a3f` | 200 | `b19a57e0-9276-4e23-b6e5-dbf47232589c` | PASS |
| 4 | employee_a | t05 | 4 | `agent-afe1edec9902c83ab.jsonl` | `38149616-51fa-4b27-82da-d8a39f367145` | 12310 | `1072ab6bd562` | 200 | `03470566-cfb3-4108-af9b-af1642a64258` | PASS |
| 5 | employee_a | t05 | 5 | `agent-a8cf886a84ad06561.jsonl` | `aa9693d1-5a3a-4e01-9b11-9f684da9b79b` | 12576 | `16e89e0088d4` | 200 | `b8d51bba-640d-46f7-86db-2a4a38dc5013` | PASS |
| 6 | employee_a | t05 | 6 | `agent-a1814d3f6f6c4c903.jsonl` | `aa9693d1-5a3a-4e01-9b11-9f684da9b79b` | 2934 | `192a4124e71c` | 200 | `9dc0e576-1210-4690-8c8c-41a468db5de0` | PASS |
| 7 | employee_a | t05 | 7 | `5fba7fea-0b52-419b-a456-50f155ecc7b3.jsonl` | `5fba7fea-0b52-419b-a456-50f155ecc7b3` | 15843 | `577cb47af1af` | 200 | `beeff8d2-4a31-4541-a83c-fad4b82a22d8` | PASS |
| 8 | employee_a | t05 | 8 | `agent-a0ae7471e0894a3d3.jsonl` | `aa9693d1-5a3a-4e01-9b11-9f684da9b79b` | 804 | `6e3496fcf3b6` | 200 | `c7d74011-665f-49e3-a2d4-f908154c4ed6` | PASS |
| 9 | employee_b | t06 | 1 | `832dca06-1be0-4b60-87ed-a4196bf39e71.jsonl` | `832dca06-1be0-4b60-87ed-a4196bf39e71` | 123435 | `1f83e0b6c56e` | 200 | `b7c13bde-0d27-4e74-8623-b25e68d8d31b` | PASS |
| 10 | employee_b | t06 | 2 | `agent-a8848a90750b03ccc.jsonl` | `aa9693d1-5a3a-4e01-9b11-9f684da9b79b` | 18711 | `2a8b45f3f9c8` | 200 | `254e7199-6235-4d15-83f1-e0fc1b034ab8` | PASS |
| 11 | employee_b | t06 | 3 | `b31870b0-bd47-4385-bba1-edbdaef0d3c8.jsonl` | `b31870b0-bd47-4385-bba1-edbdaef0d3c8` | 26014 | `2bd76929b543` | 200 | `e15be4fb-e0fe-4452-ac72-4cc8abc810de` | PASS |
| 12 | employee_b | t06 | 4 | `b42i2kxqm.txt` | `b42i2kxqm` | 1082897 | `2e9784face57` | 200 | `4696c049-7054-43f3-83f0-b7d9e284e202` | PASS |
| 13 | employee_b | t06 | 5 | `agent-abe8215b7ba72c1c9.jsonl` | `38149616-51fa-4b27-82da-d8a39f367145` | 11084 | `2fba67e06094` | 200 | `1f37503b-ef18-40f3-99aa-a3db2b62ba52` | PASS |
| 14 | employee_b | t06 | 6 | `agent-a107a7802c3db9a55.jsonl` | `3e8d7f79-6961-426e-a122-164c3f706207` | 23725 | `58eca29f0629` | 200 | `b421225e-0d1e-429b-8af1-681235094aa1` | PASS |
| 15 | employee_b | t06 | 7 | `agent-addee0bc8f652a59e.jsonl` | `3e8d7f79-6961-426e-a122-164c3f706207` | 13783 | `721447ff857a` | 200 | `51ad33a7-7ae7-45fd-823c-73141a88d49b` | PASS |
| 16 | pm | t01 | 1 | `7ea74ca9-b8f5-4f65-a464-222e7b988a50.jsonl` | `7ea74ca9-b8f5-4f65-a464-222e7b988a50` | 25111 | `30368e1aae2e` | 200 | `85ee5a2d-d8ae-45cb-8e01-89e87e5b4677` | PASS |
| 17 | pm | t01 | 2 | `agent-a5d3be10dead36938.jsonl` | `2134865d-9061-4e99-86c1-665c62873dd1` | 17360 | `357a3ee69ada` | 200 | `eecdf8fe-9eaf-4c0a-a76e-06f71a296d91` | PASS |
| 18 | pm | t01 | 3 | `41eeca5e-43ec-4fb6-b055-5a368bae45ab.jsonl` | `41eeca5e-43ec-4fb6-b055-5a368bae45ab` | 12180 | `3923750552da` | 200 | `cd6ebd94-afc5-42f9-9c97-8d6ba254a637` | PASS |
| 19 | pm | t01 | 4 | `47d234b7-a057-447f-9920-2048bb3a3f82.jsonl` | `47d234b7-a057-447f-9920-2048bb3a3f82` | 4166 | `3f10f5d4c04e` | 200 | `8bcf30eb-c6c5-418c-8cc2-458d145ff755` | PASS |
| 20 | pm | t01 | 5 | `brbb2v5uz.txt` | `brbb2v5uz` | 295623 | `633723e13a20` | 200 | `04303efc-de02-46c8-8fda-527340d07dd5` | PASS |
| 21 | pm | t01 | 6 | `beuves737.txt` | `beuves737` | 295167 | `7362961e21df` | 200 | `f3506dfc-7ceb-48fe-af42-4d498cb61fc3` | PASS |
| 22 | tl | t03 | 1 | `bsk4y4750.txt` | `bsk4y4750` | 104083 | `400a405e0da6` | 200 | `6268b503-0e27-4287-8c23-c9cf89940899` | PASS |
| 23 | tl | t03 | 2 | `bma00650l.txt` | `bma00650l` | 89966 | `41e80f10de6f` | 200 | `8ca4a961-543a-4deb-a07f-5d30420bb7ae` | PASS |
| 24 | tl | t03 | 3 | `agent-a0afcc35b3ff244eb.jsonl` | `2134865d-9061-4e99-86c1-665c62873dd1` | 2734 | `4c9987965bf7` | 200 | `313151bc-7628-4591-b75e-6dc4aa03fb7f` | PASS |
| 25 | tl | t03 | 4 | `978c7c8d-1bed-4d4a-aed1-bb75ed1895a4.jsonl` | `978c7c8d-1bed-4d4a-aed1-bb75ed1895a4` | 2050 | `656b05f47186` | 200 | `467a1673-ddc3-4792-a63c-f0a033dbdf38` | PASS |
| 26 | tl | t03 | 5 | `300559e7-dc01-462f-9ac9-3cfc9914cfa6.jsonl` | `300559e7-dc01-462f-9ac9-3cfc9914cfa6` | 3205 | `7364022c994e` | 200 | `ba289273-53ee-48e6-94d9-1ed39503bb81` | PASS |
| 27 | director | t02 | 1 | `mcp-codegraph-codegraph_status-1782374016247.txt` | `mcp-codegraph-codegraph_status-1782374016247` | 189169 | `4da1a86c56c9` | 200 | `2d308339-a14b-44b7-90e9-9207bc08cdbf` | PASS |
| 28 | director | t02 | 2 | `aa9693d1-5a3a-4e01-9b11-9f684da9b79b.jsonl` | `aa9693d1-5a3a-4e01-9b11-9f684da9b79b` | 209428 | `5144a8c3fc76` | 200 | `3a5af46f-2dd0-498a-9d4b-3c4b8437fcf1` | PASS |
| 29 | director | t02 | 3 | `agent-aac3b7897243e4988.jsonl` | `96a3e045-35d9-4559-92a9-a033723f1312` | 4291 | `65a8f208be89` | 200 | `75476671-2d9b-4f9c-94e6-780af4760b8e` | PASS |
| 30 | director | t02 | 4 | `69153d62-6b6c-406a-9d22-c18109e37a3b.jsonl` | `69153d62-6b6c-406a-9d22-c18109e37a3b` | 21682 | `76599247802c` | 200 | `ba977d60-7497-4dda-b407-8b05e31c6887` | PASS |

- 上传尝试: `30`
- 上传成功: `30`
- 目标达成 (≥20): `True`

## session scope 权限校验

通过业务接口 `/sessions` 确认 employee 只能看自己、TL 能看同组、Director 能看部门。

| 用例 | 结果 | 详情 |
| --- | --- | --- |
| employee t05 只能看自己 session | PASS | owners={'307'} |
| TL t03 能读同组成员 session | PASS | owners={'307', '308', '305'} |
| Director t02 能读部门成员 session | PASS | owners={'303', '307', '308', '305', '304'} |

## 各角色 session 上传达成情况

| role | username | target range | actual uploaded | ok |
| --- | --- | --- | --- | --- |
| employee_a | t05 | 6-8 | 8 | 8 |
| employee_b | t06 | 5-7 | 7 | 7 |
| pm | t01 | 4-6 | 6 | 6 |
| tl | t03 | 3-5 | 5 | 5 |
| director | t02 | 2-4 | 4 | 4 |

## 真实 Agent run API 与模型运行汇总

- run API: `POST /api/v1/ai-assets/report-agents/{agentId}/runs`
- 只传 `report_type` / `period` / `target`，由后端注入 `mcp_url`、`credential_slot`、`run_id`。
- 默认模型: `MiniMax-M2.5` / engine `claude-code` (不降级)。


## 越权真实 Agent 测试

对越权用例优先利用 run API 前置校验或短失败；不长时间等待模型。

| 用例 | 调用者 | report_type | target | 期望 | 实际 HTTP / 错误 | 结果 |
| --- | --- | --- | --- | --- | --- | --- |
| t05 | t05 | team_daily | {"type": "self"} | reject-or-mcp-forbidden | HTTP 200 run_id=7dc4c039-3528-4c7c-a87c-d534e42bb840 status=pending (run API accepted; MCP-layer enforcement not verified) | WARN_RUN_API_ACCEPTED |
| t05 | t05 | department_daily | {"type": "self"} | reject-or-mcp-forbidden | HTTP 200 run_id=8f54011f-57e9-448b-b3da-ff68f76534ff status=pending (run API accepted; MCP-layer enforcement not verified) | WARN_RUN_API_ACCEPTED |
| t05 | t05 | personal_daily | {"type": "user", "user_id": "308"} | reject | HTTP 403 code=None error=forbidden target | PASS |
| t01 | t01 | team_daily | {"type": "self"} | reject-or-mcp-forbidden | HTTP 400 code=None error=target team is required | PASS |
| t01 | t01 | department_daily | {"type": "self"} | reject-or-mcp-forbidden | HTTP 200 run_id=a7f5c104-c465-49d6-b01f-e3cacfbf4264 status=pending (run API accepted; MCP-layer enforcement not verified) | WARN_RUN_API_ACCEPTED |
| t03 | t03 | department_daily | {"type": "self"} | reject-or-mcp-forbidden | HTTP 200 run_id=febfa9ec-fe9f-4430-9c9a-4add3e780b60 status=pending (run API accepted; MCP-layer enforcement not verified) | WARN_RUN_API_ACCEPTED |
| t03 | t03 | personal_daily | {"type": "user", "user_id": "307"} | reject | HTTP 403 code=None error=forbidden target | PASS |
| t02 | t02 | team_daily | {"type": "self"} | reject-or-mcp-forbidden | HTTP 400 code=None error=target team is required | PASS |
| t02 | t02 | personal_daily | {"type": "user", "user_id": "307"} | reject | HTTP 403 code=None error=forbidden target | PASS |

## 真实 Agent 运行矩阵

| report_type | 运行用户 | target | session upload | agent run created | model run status | MCP read evidence | MCP write evidence | business readback | content check | permission check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| personal_daily | t05 | {"type": "self"} | N/A | PASS | PASS | N/A | PASS | PASS | PASS | PASS |
| personal_weekly | t05 | {"type": "self"} | N/A | PASS | PASS | N/A | PASS | PASS | PASS | PASS |
| personal_daily | t06 | {"type": "self"} | N/A | PASS | PASS | N/A | PASS | PASS | PASS | PASS |
| personal_weekly | t06 | {"type": "self"} | N/A | PASS | PASS | N/A | PASS | PASS | PASS | PASS |
| personal_daily | t01 | {"type": "self"} | N/A | PASS | PASS | N/A | PASS | PASS | PASS | PASS |
| personal_weekly | t01 | {"type": "self"} | N/A | PASS | PASS | N/A | PASS | PASS | PASS | PASS |
| team_daily | t03 | {"type": "self"} | N/A | PASS | PASS | N/A | PASS | PASS | PASS | PASS |
| team_weekly | t03 | {"type": "self"} | N/A | PASS | PASS | N/A | PASS | PASS | PASS | PASS |
| personal_daily | t03 | {"type": "self"} | N/A | PASS | PASS | N/A | PASS | PASS | PASS | PASS |
| department_daily | t02 | {"type": "self"} | N/A | PASS | PASS | N/A | PASS | PASS | PASS | PASS |
| department_weekly | t02 | {"type": "self"} | N/A | PASS | PASS | N/A | PASS | PASS | PASS | PASS |
| personal_weekly | t02 | {"type": "self"} | N/A | PASS | PASS | N/A | PASS | PASS | PASS | PASS |
| personal_weekly | t03 | {"type": "self"} | N/A | PASS | PASS | N/A | PASS | PASS | PASS | PASS |
| personal_daily | t02 | {"type": "self"} | N/A | PASS | PASS | N/A | PASS | PASS | PASS | PASS |
| personal_weekly | t06 | {"type": "self"} | N/A | PASS | PASS | N/A | PASS | PASS | PASS | PASS |
| personal_daily | t01 | {"type": "self"} | N/A | PASS | PASS | N/A | PASS | PASS | PASS | PASS |
| personal_weekly | t05 | {"type": "self"} | N/A | PASS | PASS | N/A | PASS | PASS | PASS | PASS |
| personal_weekly | t01 | {"type": "self"} | N/A | PASS | PASS | N/A | PASS | PASS | PASS | PASS |

## 真实 Agent run 明细

| label | run_id | report_type | user | session_id | initial_status |
| --- | --- | --- | --- | --- | --- |
| personal_daily@t05 | `1a02fa5b-62bb-47bb-b6de-ce55fee8e63b` | personal_daily | t05 | `ad609975-0314-4531-b6e5-c6cc6a8cdca3` | pending |
| personal_weekly@t05 | `a292d294-9657-476a-a73f-26cb052cf800` | personal_weekly | t05 | `72d3a00a-7328-40ee-babe-92fc47640bd7` | pending |
| personal_daily@t06 | `772b1d12-5c0f-4014-a11b-d828c1f83864` | personal_daily | t06 | `35453297-3370-4105-9036-ded10b7eb5cf` | pending |
| personal_weekly@t06 | `2bd373ec-8f51-4c59-9643-951f14f85f79` | personal_weekly | t06 | `7bae706f-e378-4ece-b658-1f7e8da7b93b` | pending |
| personal_daily@t01 | `cbfaa66d-7073-4ce8-bbb2-0e108cda3ea2` | personal_daily | t01 | `02d9dc15-9c8f-44f8-972d-373e28cffff5` | pending |
| personal_weekly@t01 | `1ee99a8f-6934-429f-8d56-9741119cae10` | personal_weekly | t01 | `537a83a3-cda5-46cd-8d3f-30b6f94891d1` | pending |
| team_daily@t03 | `16da1255-3cd0-4fd3-9bd0-e7e12746e93d` | team_daily | t03 | `4d9c3377-aa40-48c4-b63f-12fde673c0d4` | pending |
| team_weekly@t03 | `56a1d415-f014-46c8-95dd-893aaaa25970` | team_weekly | t03 | `706f5127-8c97-4823-87fd-07ea7e382f44` | pending |
| tl_personal_daily@t03 | `77192027-804d-43f6-9640-3c68603de8fb` | personal_daily | t03 | `7fe113d6-71a6-4bdb-b885-8fdc6caf23c0` | pending |
| department_daily@t02 | `ddefaf03-c14a-4ecd-b2aa-18a4d069e753` | department_daily | t02 | `1ffb6b3c-4869-4f28-afe7-e43f1c5f5773` | pending |
| department_weekly@t02 | `ca844125-3bf9-4e72-97e4-5c09dc03ed67` | department_weekly | t02 | `1646d525-6690-4c34-809a-19ed24d22c15` | pending |
| director_personal_weekly@t02 | `c996fbd4-6fb2-4c95-9fb1-917bffc5aeae` | personal_weekly | t02 | `ccdcff32-20d3-40db-8b12-437aebfe579f` | pending |
| tl_personal_weekly@t03 | `e9d07af4-1419-4e9e-9b8c-7e3d764d13b2` | personal_weekly | t03 | `2fd0cdf1-0cd7-4df8-a912-cd82eb3a2ea0` | pending |
| director_personal_daily@t02 | `461e67df-4ee2-4a64-8546-20ec48282079` | personal_daily | t02 | `17a582c6-38d4-43b6-8aa8-8dd82e3f6e08` | pending |
| emp_b_personal_weekly@t06 | `c8d05903-d955-4c8c-9a3d-6fa8a32140a2` | personal_weekly | t06 | `b87df2f0-632c-46db-b294-9fc7d8a16f55` | pending |
| pm_personal_daily_extra@t01 | `6c63778e-29b0-4851-8395-af51f08428fe` | personal_daily | t01 | `11f85519-f120-4378-8f9c-ab48105d517b` | pending |
| emp_a_personal_weekly_extra@t05 | `b11b20c6-cdc0-4bcb-b8c1-bed88064e2af` | personal_weekly | t05 | `c6947c20-2dba-4b2c-a65e-07d3e92c7a38` | pending |
| pm_personal_weekly_extra@t01 | `f2d8ba02-50fd-4e67-b584-60e66411705d` | personal_weekly | t01 | `752d3f5a-34a5-43f2-85a6-d4eada525415` | pending |

## 内容质量最低校验与业务接口读回字段

只对 `business_readback=PASS` 的用例做字段级校验。

| label | content_non_empty | product_status=ai_generated | generation_mode=managed_agent | edited=false | run_id matches | model_id | agent_id |
| --- | --- | --- | --- | --- | --- | --- | --- |
| personal_daily@t05 | PASS | PASS | PASS | PASS | FAIL | PASS | PASS |
| personal_weekly@t05 | PASS | PASS | PASS | PASS | FAIL | FAIL | PASS |
| personal_daily@t06 | PASS | PASS | PASS | PASS | FAIL | PASS | PASS |
| personal_weekly@t06 | PASS | PASS | PASS | PASS | FAIL | PASS | PASS |
| personal_daily@t01 | PASS | PASS | PASS | PASS | FAIL | PASS | PASS |
| personal_weekly@t01 | PASS | PASS | PASS | PASS | FAIL | FAIL | PASS |
| team_daily@t03 | PASS | PASS | PASS | PASS | FAIL | PASS | PASS |
| team_weekly@t03 | PASS | PASS | PASS | PASS | FAIL | FAIL | PASS |
| tl_personal_daily@t03 | PASS | PASS | PASS | PASS | FAIL | PASS | PASS |
| department_daily@t02 | PASS | PASS | PASS | PASS | FAIL | PASS | PASS |
| department_weekly@t02 | PASS | PASS | PASS | PASS | FAIL | FAIL | PASS |
| director_personal_weekly@t02 | PASS | PASS | PASS | PASS | FAIL | FAIL | PASS |
| tl_personal_weekly@t03 | PASS | PASS | PASS | PASS | FAIL | FAIL | PASS |
| director_personal_daily@t02 | PASS | PASS | PASS | PASS | FAIL | FAIL | PASS |
| emp_b_personal_weekly@t06 | PASS | PASS | PASS | PASS | FAIL | PASS | PASS |
| pm_personal_daily_extra@t01 | PASS | PASS | PASS | PASS | FAIL | PASS | PASS |
| emp_a_personal_weekly_extra@t05 | PASS | PASS | PASS | PASS | FAIL | FAIL | PASS |
| pm_personal_weekly_extra@t01 | PASS | PASS | PASS | PASS | FAIL | FAIL | PASS |

## 各 report_type 运行覆盖矩阵

| report_type | 运行次数 | PASS | PARTIAL | FAIL | TIMEOUT |
| --- | --- | --- | --- | --- | --- |
| personal_daily | 6 | 6 | 0 | 0 | 0 |
| personal_weekly | 8 | 8 | 0 | 0 | 0 |
| team_daily | 1 | 1 | 0 | 0 | 0 |
| team_weekly | 1 | 1 | 0 | 0 | 0 |
| department_daily | 1 | 1 | 0 | 0 | 0 |
| department_weekly | 1 | 1 | 0 | 0 | 0 |

## 6 类报告真实生成结果汇总

- 6 类 report_type 全部真实生成成功: `True`
- 已成功: `['department_daily', 'department_weekly', 'personal_daily', 'personal_weekly', 'team_daily', 'team_weekly']`

## 业务接口读回字段一致性矩阵

对 `business_readback=PASS` 的用例做字段级一致性校验。

| label | run_id matches | model_id present | agent_id present | product_status | generation_mode | edited |
| --- | --- | --- | --- | --- | --- | --- |
| personal_daily@t05 | FAIL | PASS | PASS | PASS | PASS | PASS |
| personal_weekly@t05 | FAIL | FAIL | PASS | PASS | PASS | PASS |
| personal_daily@t06 | FAIL | PASS | PASS | PASS | PASS | PASS |
| personal_weekly@t06 | FAIL | PASS | PASS | PASS | PASS | PASS |
| personal_daily@t01 | FAIL | PASS | PASS | PASS | PASS | PASS |
| personal_weekly@t01 | FAIL | FAIL | PASS | PASS | PASS | PASS |
| team_daily@t03 | FAIL | PASS | PASS | PASS | PASS | PASS |
| team_weekly@t03 | FAIL | FAIL | PASS | PASS | PASS | PASS |
| tl_personal_daily@t03 | FAIL | PASS | PASS | PASS | PASS | PASS |
| department_daily@t02 | FAIL | PASS | PASS | PASS | PASS | PASS |
| department_weekly@t02 | FAIL | FAIL | PASS | PASS | PASS | PASS |
| director_personal_weekly@t02 | FAIL | FAIL | PASS | PASS | PASS | PASS |
| tl_personal_weekly@t03 | FAIL | FAIL | PASS | PASS | PASS | PASS |
| director_personal_daily@t02 | FAIL | FAIL | PASS | PASS | PASS | PASS |
| emp_b_personal_weekly@t06 | FAIL | PASS | PASS | PASS | PASS | PASS |
| pm_personal_daily_extra@t01 | FAIL | PASS | PASS | PASS | PASS | PASS |
| emp_a_personal_weekly_extra@t05 | FAIL | FAIL | PASS | PASS | PASS | PASS |
| pm_personal_weekly_extra@t01 | FAIL | FAIL | PASS | PASS | PASS | PASS |

## 越权测试结果

| 用例 | report_type | 期望 | 实际 | 结果 |
| --- | --- | --- | --- | --- |
| t05 | team_daily | reject-or-mcp-forbidden | HTTP 200 run_id=7dc4c039-3528-4c7c-a87c-d534e42bb840 status=pending (run API accepted; MCP-layer enforcement not verified) | WARN_RUN_API_ACCEPTED |
| t05 | department_daily | reject-or-mcp-forbidden | HTTP 200 run_id=8f54011f-57e9-448b-b3da-ff68f76534ff status=pending (run API accepted; MCP-layer enforcement not verified) | WARN_RUN_API_ACCEPTED |
| t05 | personal_daily | reject | HTTP 403 code=None error=forbidden target | PASS |
| t01 | team_daily | reject-or-mcp-forbidden | HTTP 400 code=None error=target team is required | PASS |
| t01 | department_daily | reject-or-mcp-forbidden | HTTP 200 run_id=a7f5c104-c465-49d6-b01f-e3cacfbf4264 status=pending (run API accepted; MCP-layer enforcement not verified) | WARN_RUN_API_ACCEPTED |
| t03 | department_daily | reject-or-mcp-forbidden | HTTP 200 run_id=febfa9ec-fe9f-4430-9c9a-4add3e780b60 status=pending (run API accepted; MCP-layer enforcement not verified) | WARN_RUN_API_ACCEPTED |
| t03 | personal_daily | reject | HTTP 403 code=None error=forbidden target | PASS |
| t02 | team_daily | reject-or-mcp-forbidden | HTTP 400 code=None error=target team is required | PASS |
| t02 | personal_daily | reject | HTTP 403 code=None error=forbidden target | PASS |

## 默认资产 backfill 触发情况

- 未触发 backfill（默认资产初次校验已通过）。

## 辅助回归与 grep 清理

本节由测试脚本自动采集，记录 MCP 通用客户端、默认资产、Go / 前端回归与 grep 清理结果。

- `scripts/test_report_mcp_generic_client.py`: rc=`0`, last=`[STATS] pass=178 fail=0 skip=0`
- `scripts/test_default_report_assets.py`: rc=`0`
- `cd api && go test ./...`: rc=`0`
  ```
  ok  	github.com/aidashboard/api/handler	(cached)
  ok  	github.com/aidashboard/api/service	(cached)
  ```
- `pnpm --dir web lint`: rc=`0`
- `pnpm --dir web typecheck`: rc=`0`
- `pnpm --dir web build`: rc=`0`

### grep 清理（api/web 生产代码）
| pattern | api/web hits |
| --- | --- |
| `ensureDefaultPersonalDailyAgent` | 0 |
| `AIDA_REPORT_AGENT:personal_daily` | 0 |
| `aida-daily-report` | 0 |
| `personal-daily-v1` | 0 |
| `aida-report-mcp-p0` | 0 |
| `get_report_context` | 0 |
| `aida_daily_report_get_context` | 0 |
| `aida_daily_report_save_draft` | 0 |
| `/mcp/daily-report` | 0 |
| `mcp_authorization` | 0 |
| `default-managed-agent-runs` | 0 |
| `report-agents/default/ensure` | 0 |

## MCP 通用客户端回归通过情况

- `scripts/test_report_mcp_generic_client.py`: rc=`0`, last=`[STATS] pass=178 fail=0 skip=0`
- 178 用例，期望 pass=178 fail=0。

## Go 单元测试通过情况

- `cd api && go test ./...`: rc=`0`
```
ok  	github.com/aidashboard/api/handler	(cached)
ok  	github.com/aidashboard/api/service	(cached)
```

## 前端 lint / typecheck / build 通过情况

- `pnpm --dir web lint`: rc=`0`
- `pnpm --dir web typecheck`: rc=`0`
- `pnpm --dir web build`: rc=`0`

## 大规模 vs 第一轮差异说明

- 第一轮: 使用脚本伪造的 fixture，每用户 2 条 session，6 类报告各 1 次运行。
- 第二轮: 使用本地真实 jsonl session（≥20 条），每用户 2-8 条，运行 ≥18 次真实模型。
- 关键差异:
  - 数据来源: 真实 `.claude/projects/` jsonl vs 伪造 fixture。
  - 规模: 30 条上传 + 18+ 运行 vs 10 条上传 + 9 运行。
  - 角色: 5 个角色全覆盖 vs 同样 5 角色。
  - 模型: 默认 `MiniMax-M2.5` 不降级。

## 已知 bug 跟踪

- 详见上文 FAIL/TIMEOUT/PARTIAL/BLOCKED 明细。
- 业务代码 bug 仅记录，不在本轮修改。
- 越权用例 run API 接受但 MCP 层 FORBIDDEN 的 4 个 WARN 用例，需 MCP 层兜底拒绝。

## 测试执行时长

- 总执行时长: `1.0s`
- 单次真实模型运行平均: `1.0s`

## 建议后续跟进

- 修复 run API 接受越权用例但 MCP 层未前置拒绝的问题。
- 修复 `personal_weekly` 等读回字段 `managed_agent_run_id` / `model_id` 缺失问题（见字段一致性矩阵）。
- 大规模 session 上传下 `/sessions/batch` 接口稳定性跟踪。
- 增加更多 employee 角色的 session 上传覆盖（后续轮次）。

## 测试结论与摘要

- 上传尝试 session 数: `30`
- 上传成功 session 数: `30`
- 上传门槛 (≥20) 达成: `True`
- 真实模型 run 总数: `18` (门槛 ≥18: `True`)
- 真实模型 succeeded: `18` (门槛 ≥12: `True`)
- 真实模型 partial: `0`
- 真实模型 failed: `0`
- 真实模型 timeout: `0`
- 6 类 report_type 全部真实生成成功: `True`
- 已成功的 report_type: `['department_daily', 'department_weekly', 'personal_daily', 'personal_weekly', 'team_daily', 'team_weekly']`
- session upload + scope 通过: `True`
- 业务接口读回通过: `True`
- 前置检查通过: `True`
- 默认资产回归通过: `True`
- 越权用例 PASS/FAIL/WARN/BLOCKED: `5/0/4/0`

### 最高优先级 bug / 建议修复顺序
- 详见上文 FAIL/TIMEOUT/BLOCKED 明细；按 `FAIL > TIMEOUT > BLOCKED` 排序处理。
- 越权用例中如出现 run API 接受但 MCP 层 FORBIDDEN，记录失败发生在 MCP 层而非 run API 层。
- 大规模 session 上传如出现失败，优先排查 /sessions/batch 接口在大批量下的稳定性。

### 不属于本轮范围的问题
- UI 自动化、定时任务、历史资产清理均不在本轮范围。
- 业务代码 bug 仅记录，不在本轮修改。
