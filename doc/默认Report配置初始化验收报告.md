# 默认 Report 配置初始化验收报告

- API: `http://127.0.0.1:18090/api/v1`
- Managed Agent: `http://192.168.18.107:3081`
- 测试时间: `20260701_013220`

## Backfill

- `AIDA_ADMIN_TOKEN` 未提供，后端 admin backfill 调用标记为 BLOCKED。
- 脚本改为使用测试账号 token 显式执行用户级直接 backfill，用于补齐当前测试账号个人资产。

| user_id | username | role | skill created | mcp created | agent created | agent repaired | old personal_daily repaired | duplicate count | error |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 303 | t01 | pm | False | False | False | False | False | 1/1/1 |  |
| 304 | t02 | director | False | False | False | False | False | 1/1/1 |  |
| 305 | t03 | team_leader | False | False | False | False | False | 1/1/1 |  |
| 306 | t04 | team_leader | False | False | False | False | False | 1/1/1 |  |
| 307 | t05 | employee | False | False | False | False | False | 1/1/1 |  |
| 308 | t06 | employee | False | False | False | False | False | 1/1/1 |  |
| 309 | t07 | employee | False | False | False | False | False | 1/1/1 |  |
| 310 | t08 | employee | False | False | False | False | False | 1/1/1 |  |
| 311 | t09 | employee | False | False | False | False | False | 1/1/1 |  |
| 312 | t10 | employee | False | False | False | False | False | 1/1/1 |  |
| 313 | t11 | employee | False | False | False | False | False | 1/1/1 |  |
| 314 | t12 | employee | False | False | False | False | False | 1/1/1 |  |
| 198 | 1066 | admin | False | False | False | False | False | 1/1/1 |  |

## AI Assets 列表与配置检查

| user_id | username | role | skills | mcp | agents | report skill | report mcp | report agent | duplicate skill/mcp/agent | skill missing tools | skill forbidden tools | mcp token leak |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- | --- | --- | --- |
| 303 | t01 | pm | 1 | 3 | 5 | True | True | True | 1/1/1 |  |  |  |
| 304 | t02 | director | 1 | 1 | 2 | True | True | True | 1/1/1 |  |  |  |
| 305 | t03 | team_leader | 1 | 1 | 1 | True | True | True | 1/1/1 |  |  |  |
| 306 | t04 | team_leader | 1 | 1 | 1 | True | True | True | 1/1/1 |  |  |  |
| 307 | t05 | employee | 1 | 2 | 2 | True | True | True | 1/1/1 |  |  |  |
| 308 | t06 | employee | 1 | 1 | 1 | True | True | True | 1/1/1 |  |  |  |
| 309 | t07 | employee | 1 | 1 | 1 | True | True | True | 1/1/1 |  |  |  |
| 310 | t08 | employee | 1 | 1 | 1 | True | True | True | 1/1/1 |  |  |  |
| 311 | t09 | employee | 1 | 1 | 1 | True | True | True | 1/1/1 |  |  |  |
| 312 | t10 | employee | 1 | 1 | 1 | True | True | True | 1/1/1 |  |  |  |
| 313 | t11 | employee | 1 | 1 | 1 | True | True | True | 1/1/1 |  |  |  |
| 314 | t12 | employee | 1 | 1 | 1 | True | True | True | 1/1/1 |  |  |  |
| 198 | 1066 | admin | 1 | 1 | 1 | True | True | True | 1/1/1 |  |  |  |

## 删除行为

- 本脚本不删除公共测试账号资产。代码层面 AI Assets 列表接口只查询，不触发默认资产创建；删除后的自动恢复只会发生在显式 backfill 或后续账号生效初始化再次执行时。

## Report Agent run API smoke

- `AIDA_RUN_AGENT_SMOKE=1` 未开启，本轮不启动真实第三方 session，避免触发模型运行。

