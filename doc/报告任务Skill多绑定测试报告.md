# 报告任务 Skill 多绑定测试报告

- 生成时间: `2026-07-02T01:04:19.744465+00:00`
- Prefix: `SKILL_BINDING_20260702_010419`
- 测试目标: 新增 skill 后，generic agent 与 report agent 都能绑定并展示；agent 支持多个 skill、多个 MCP。
- 测试账号: `305/t03` role=`team_leader`
- 结论: `PASS`

## 1. 新增资源

| 类型 | slug | version | owner | marker |
| --- | --- | --- | --- | --- |
| skill | `skill-binding-main-20260702-010419` | `1.0.0` | `t03` | `SKILL_BINDING_20260702_010419_MAIN` |
| skill | `skill-binding-extra-20260702-010419` | `1.0.0` | `t03` | `SKILL_BINDING_20260702_010419_EXTRA` |
| mcp | `mcp-binding-main-20260702-010419` | `1.0.0` | `t03` | `SKILL_BINDING_20260702_010419_MCP_MAIN` |
| mcp | `mcp-binding-extra-20260702-010419` | `1.0.0` | `t03` | `SKILL_BINDING_20260702_010419_MCP_EXTRA` |

## 2. Agent 绑定结果

| agent_type | agent_id | skills | mcp_bindings |
| --- | --- | --- | --- |
| generic | `agent-skill-generic-20260702-010419` | t03/skill-binding-main-20260702-010419@1.0.0<br>t03/skill-binding-extra-20260702-010419@1.0.0 | t03/mcp-binding-main-20260702-010419@1.0.0<br>t03/mcp-binding-extra-20260702-010419@1.0.0 |
| report | `agent-skill-report-20260702-010419` | t03/aida-report@1.0.0<br>t03/skill-binding-main-20260702-010419@1.0.0<br>t03/skill-binding-extra-20260702-010419@1.0.0 | t03/aida-report-mcp@report-v1<br>t03/mcp-binding-main-20260702-010419@1.0.0<br>t03/mcp-binding-extra-20260702-010419@1.0.0 |

## 3. Case 明细

| case_id | expected | actual | result | evidence |
| --- | --- | --- | --- | --- |
| SKILL-PRE-001 | auth token is valid | HTTP 200 | PASS | {"id": "305", "username": "t03", "nickname": "测试03", "email": "t03@q.com", "name": "测试03", "employee_id": "305", "app_role": "team_leader", "role": "team_leader", "team_id": "3f05e6ed-c3bc-4900-8d7b-e |
| SKILL-PRE-002 | default report assets exist | HTTP 200 | PASS | agent_id=aida-test202671-djn3fscf20b6 |
| SKILL-CREATE-001 | create skill skill-binding-main-20260702-010419 | HTTP 200 | PASS | {"skill_id": "b7b1be7b-5798-4fbe-b902-2fb2fb76d0f8", "owner": "t03", "published_by": "t03", "slug": "skill-binding-main-20260702-010419", "version": "1.0.0", "sha256": "f47f3fded67957932fd02a2252f7701c4d922dff4a90efd1782582107a7ae946"} |
| SKILL-MD-001 | skill markdown contains marker SKILL_BINDING_20260702_010419_MAIN | HTTP 200 | PASS | content_has_marker=True |
| SKILL-CREATE-002 | create skill skill-binding-extra-20260702-010419 | HTTP 200 | PASS | {"skill_id": "e888add8-40e0-4f8f-9c09-e21f3f5427c0", "owner": "t03", "published_by": "t03", "slug": "skill-binding-extra-20260702-010419", "version": "1.0.0", "sha256": "c11eb7c8f6d73b18d2ad2d0919569591b14175180fa501d2e48250f6f22509f2"} |
| SKILL-MD-002 | skill markdown contains marker SKILL_BINDING_20260702_010419_EXTRA | HTTP 200 | PASS | content_has_marker=True |
| MCP-CREATE-003 | create MCP mcp-binding-main-20260702-010419 | HTTP 200 | PASS | {"entry_id": "f0066ee8-b752-4a52-9f95-693812531b46", "slug": "mcp-binding-main-20260702-010419", "version": "1.0.0", "name": "MCP Binding Main", "description": "MCP binding test marker SKILL_BINDING_20260702_010419_MCP_MAIN", "transport": "http", "url": "https://example.invalid/aida-skill-binding/SK |
| MCP-CREATE-004 | create MCP mcp-binding-extra-20260702-010419 | HTTP 200 | PASS | {"entry_id": "12db2d8f-fed9-4735-bb08-8dcbd78bdf19", "slug": "mcp-binding-extra-20260702-010419", "version": "1.0.0", "name": "MCP Binding Extra", "description": "MCP binding test marker SKILL_BINDING_20260702_010419_MCP_EXTRA", "transport": "http", "url": "https://example.invalid/aida-skill-binding |
| AGENT-CREATE-GENERIC | create generic agent with 2 skills and 2 MCPs | HTTP 200 | PASS | agent_id=agent-skill-generic-20260702-010419; body={"agent_id": "agent-skill-generic-20260702-010419", "managed_version": 1} |
| AGENT-CREATE-REPORT | create report agent with report skill/MCP plus extra skills/MCPs | HTTP 200 | PASS | agent_id=agent-skill-report-20260702-010419; body={"agent_id": "agent-skill-report-20260702-010419", "managed_version": 1} |
| AGENT-LIST-001 | list agents after create | HTTP 200 | PASS | agent_count=8 |
| AGENT-GENERIC-SKILLS | generic agent has both custom skills | skills=['t03/skill-binding-main-20260702-010419@1.0.0', 't03/skill-binding-extra-20260702-010419@1.0.0'] | PASS | skill_count=2 |
| AGENT-GENERIC-MCPS | generic agent has both custom MCP bindings | mcp=['t03/mcp-binding-main-20260702-010419@1.0.0', 't03/mcp-binding-extra-20260702-010419@1.0.0'] | PASS | mcp_count=2 |
| AGENT-REPORT-SKILLS | report agent has report skill plus both custom skills | skills=['t03/aida-report@1.0.0', 't03/skill-binding-main-20260702-010419@1.0.0', 't03/skill-binding-extra-20260702-010419@1.0.0'] | PASS | skill_count=3 |
| AGENT-REPORT-MCPS | report agent has report MCP plus both custom MCP bindings | mcp=['t03/aida-report-mcp@report-v1', 't03/mcp-binding-main-20260702-010419@1.0.0', 't03/mcp-binding-extra-20260702-010419@1.0.0'] | PASS | mcp_count=3 |
| AGENT-REPORT-PROFILE | report agent keeps report business profile | business_type=report report_types=['personal_daily'] | PASS | profile stored in managed_agent_profiles |

说明：本测试验证的是 Agent 配置层面的 skill/MCP 绑定是否通过 Aida 正常写入并可从平台读取。测试资源默认保留，便于在 Agent 平台 UI 中复核。
