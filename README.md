# Aida 使用说明书

## 目录

- [系统简介](#系统简介)
- [部署指南](#部署指南)
- [角色与权限](#角色与权限)
- [Web Dashboard 使用](#web-dashboard-使用)
- [CLI 工具使用](#cli-工具使用)
- [数据说明](#数据说明)
- [常见问题](#常见问题)

---

## 系统简介

Aida 是 AI 部门的 centralized dashboard，用于追踪 Claude Code 等 AI Agent 的使用情况。核心功能：

- **需求管理**：创建需求，AI 自动生成验收标准（AC），TL 拆解为任务并分配
- **Session 上报**：通过 CLI 工具上传 Claude Code session 日志，自动匹配任务
- **Token 统计**：按人/团队/需求/模型维度查看 Token 消耗
- **自动日报**：基于 session 数据自动生成日报，可附加飞书文档链接

### 系统架构

```
[员工本地机器]                          [服务器]
                                         
Claude Code → ~/.claude/projects/*.jsonl         
                                         
CLI (aida) ──HTTPS──→ Go API ──→ PostgreSQL
                                  ↕
                            Web Dashboard (Next.js)
```

---

## 部署指南

### 环境要求

| 组件 | 版本 |
|------|------|
| Docker | 20.10+ |
| Docker Compose | v2+ |
| Go | 1.26+（仅编译 CLI 时需要） |
| PostgreSQL | 16（Docker 内置） |

### 方式一：Docker Compose（推荐）

```bash
# 克隆项目
git clone <repo-url> && cd project_manager

# 一键启动（PostgreSQL + API + Web）
docker compose up -d

# 查看服务状态
docker compose ps
```

启动后：
- **Web Dashboard**：http://localhost:3000
- **API**：http://localhost:8080/health
- **PostgreSQL**：localhost:5432

### 方式二：本地开发

```bash
# 1. 启动数据库
docker compose up -d db

# 2. 启动 API
cd api
DATABASE_URL="postgres://aidashboard:devpassword@localhost:5432/aidashboard?sslmode=disable" \
JWT_SECRET="your-secret" \
PORT="8080" \
go run main.go

# 3. 启动 Web（另一个终端）
cd web
pnpm dev
```

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | PostgreSQL 连接串 | `postgres://aidashboard:devpassword@localhost:5432/aidashboard?sslmode=disable` |
| `JWT_SECRET` | JWT 签名密钥（生产环境务必修改） | `dev-jwt-secret` |
| `AI_API_URL` | AI 接口地址（用于生成验收标准） | 空（暂不启用） |
| `AI_API_KEY` | AI 接口密钥 | 空 |
| `AI_MODEL` | AI 模型名称 | 空 |
| `CORS_ORIGIN` | 允许的前端域名 | `http://localhost:3000` |
| `PORT` | API 监听端口 | `8080` |

### 编译 CLI 工具

```bash
cd daemon
go build -o aida .

# 可选：复制到 PATH
cp aida /usr/local/bin/
```

### CLI Release 打包与安装

面向用户发布 `aida` CLI 时，不要求用户安装 Go 或 Docker。发布人员在当前项目主机上用项目既有的 Go Docker builder 同时打包 Linux/Windows 二进制；该 builder 与 `daemon/Dockerfile` 保持一致，使用 `golang:1.26-alpine`。

```bash
# 在仓库根目录执行
# 测试包：固化当前测试主机 192.168.14.157 的 MinIO 下载地址
make release-test-dir
```

该命令会生成测试 release 静态目录：

```text
./aida-releases-test/
  install.sh
  install.ps1
  aida-linux-amd64
  aida-windows-amd64.exe
  aida-latest.txt
  SHA256SUMS.txt
```

将目录里的文件发布到测试静态下载目录 `http://192.168.14.157:9000/statics-live/aida/`。正式包使用 `make release-prod-dir`，见 `doc/AI_Coding_Console_简易部署文档.md`。

Linux 用户安装：

```bash
curl -fsSL http://<host>/statics-live/aida/install.sh | bash

aida login --server http://<server>:8080/api/v1 --token <jwt>
aida sessions
aida upload --all
```

Windows 用户安装：

```powershell
powershell -ExecutionPolicy Bypass -NoProfile -Command "Invoke-RestMethod http://<host>/statics-live/aida/install.ps1 | Invoke-Expression"

aida login --server http://<server>:8080/api/v1 --token <jwt>
aida sessions
aida upload --all
```

如果要安装时直接写入登录配置：

```bash
curl -fsSL http://<host>/statics-live/aida/install.sh \
  | AIDA_API_URL=http://<server>:8080/api/v1 AIDA_TOKEN=<jwt> bash
```

Windows 对应命令：

```powershell
$env:AIDA_API_URL="http://<server>:8080/api/v1"; $env:AIDA_TOKEN="<jwt>"; powershell -ExecutionPolicy Bypass -NoProfile -Command "Invoke-RestMethod http://<host>/statics-live/aida/install.ps1 | Invoke-Expression"
```

约定：

- 用户机器只需要 `aida` 二进制，不需要 Go、Docker 或源码。
- Windows 安装脚本会安装到 `%LOCALAPPDATA%\Aida\bin\aida.exe`，并自动写入当前用户 PATH；用户可能需要重新打开 PowerShell。
- 发布机器使用 Docker builder，避免本机 Go 版本不一致。当前 `daemon/go.mod` 要求 Go 1.26.3+，不要使用低版本 Go 镜像打包。
- `release-test-dir` 固定测试下载地址为 `http://192.168.14.157:9000/statics-live/aida`；正式包不要复用测试包。

---

## 角色与权限

系统有 4 种角色，对应不同视图和操作权限：

### 角色一览

| 角色 | 人数 | 职责 | 可见范围 |
|------|:----:|------|---------|
| 管理员 (Admin) | 1 | 账号管理：分配角色与团队、重置密码 | 全部门 |
| 总监 (Director) | 1 | 全局需求、成本、跨团队阻塞 | 全部门 |
| 产品经理 (PM) | 1 | 需求跟踪、验收标准、重点关注 | 全部门 |
| 团队负责人 (TL) | 3 | 创建需求、拆解任务、分配 | 本团队 |
| 员工 (Employee) | 40 | 执行任务、上报 Session | 个人 |

### 默认用户

种子数据由 `api/db/migrations/002_seed.sql` + `005_user_auth.sql` 写入。所有种子账号默认密码均为 `Changeme123!`（管理员除外），首次登录后请尽快由管理员重置。

| 工号 | 姓名 | 角色 | 团队 | 默认密码 |
|------|------|------|------|----------|
| `admin` | 管理员 | Admin | - | `Admin@123!` |
| `li_director` | 李总监 | Director | - | `Changeme123!` |
| `chen_pm` | 陈PM | PM | - | `Changeme123!` |
| `liu_tl` | 刘TL | Team Leader | AI工程 | `Changeme123!` |
| `zhao_tl` | 赵TL | Team Leader | 推理加速 | `Changeme123!` |
| `sun_tl` | 孙TL | Team Leader | 模型训练 | `Changeme123!` |
| `zhangsan` | 张三 | Employee | AI工程 | `Changeme123!` |
| `lisi` | 李四 | Employee | AI工程 | `Changeme123!` |
| `wangwu` | 王五 | Employee | AI工程 | `Changeme123!` |
| `zhaoliu` | 赵六 | Employee | AI工程 | `Changeme123!` |
| `qianqi` | 钱七 | Employee | AI工程 | `Changeme123!` |
| `sunba` | 孙八 | Employee | 推理加速 | `Changeme123!` |
| `zhoujiu` | 周九 | Employee | 推理加速 | `Changeme123!` |
| `wushi` | 吴十 | Employee | 模型训练 | `Changeme123!` |

新用户可通过 `POST /api/v1/auth/register` 自助注册（默认 `employee` + 无团队，待管理员分配团队后才能进入团队工作流）。

### 权限矩阵

| 操作 | 管理员 | 总监 | PM | TL | 员工 |
|------|:----:|:----:|:--:|:--:|:----:|
| 分配角色/团队、重置密码 | ✓ | - | - | - | - |
| 创建需求 | ✓ | ✓ | ✓ | ✓ | - |
| 拆解任务 | ✓ | - | - | ✓ | - |
| 关联任务→AC | ✓ | - | - | ✓ | - |
| 分配任务 | ✓ | - | - | ✓ | - |
| 上报 Session | ✓ | ✓ | ✓ | ✓ | ✓ |
| 查看全部门数据 | ✓ | ✓ | ✓ | - | - |
| 查看本团队数据 | ✓ | ✓ | ✓ | ✓ | - |
| 查看个人数据 | ✓ | ✓ | ✓ | ✓ |

---

## Web Dashboard 使用

### 登录

1. 打开 http://localhost:3000
2. 输入**工号**和**密码**（首次使用点击「注册」自助开通）
3. 点击 **登录** 进入对应角色的 Dashboard

### 总监视图

**路径**：`/dashboard`

- 部门需求总览（进度、状态、截止日期）
- 各团队活跃度
- Token 消耗趋势（按日/周/月）
- 跨团队阻塞告警

### TL 视图

**路径**：`/dashboard` → `/tasks` → `/requirements`

1. **查看团队任务**：点击左侧 **Tasks**，可按状态筛选
2. **创建需求**：点击 **Requirements** → **+ New Requirement**，填写标题、描述、选择参与团队
3. **拆解任务**：进入需求详情页 → **+ Add Task**
   - 填写任务标题
   - 勾选关联的验收标准（AC）
   - 指派负责人（Assignee ID）
   - 设置优先级和截止日期
4. **查看成员 Session**：点击 **Sessions** 查看团队上报记录

### 员工视图

**路径**：`/dashboard` → `/tasks` → `/sessions` → `/reports`

1. **查看我的任务**：Dashboard 或 Tasks 页面
2. **更新任务状态**：进入任务详情 → 点击 **Mark Done**
3. **查看 Session**：Sessions 页面查看已上报的 Claude Code session
4. **关联任务**：在 Session 列表中通过下拉框覆盖 AI 自动匹配结果
5. **撤回 Session**：点击 **Withdraw** 永久删除该 session 记录
6. **查看日报**：Reports 页面查看自动生成的日报
7. **编辑日报**：点击 **Edit** 修改内容，附加飞书文档链接

### PM 视图

**路径**：`/dashboard` → `/requirements`

- 所有需求列表（含重点关注标记）
- 验收标准完成状态
- 每个需求的 Token 消耗
- 跨团队阻塞项

### 关键页面

| 页面 | 路径 | 说明 |
|------|------|------|
| Dashboard | `/dashboard` | 角色对应的概览页 |
| 需求列表 | `/requirements` | 创建和浏览需求 |
| 需求详情 | `/requirements/[id]` | AC 清单、关联任务、进度 |
| 任务列表 | `/tasks` | 按状态/需求/负责人筛选 |
| 任务详情 | `/tasks/[id]` | 依赖关系、状态更新 |
| Session | `/sessions` | 上报记录、AI 匹配、撤回 |
| 日报 | `/reports` | 查看/编辑日报、飞书链接 |

---

## CLI 工具使用

CLI 工具 `aida` 用于从本机扫描并上传 Claude Code session 到服务器。

### Session 文件位置

```
~/.claude/projects/
├── -home-gh-my-project/
│   ├── a48dd56f-2cb8-4363-86e5-1202c28d10de.jsonl   ← 主 session
│   └── a48dd56f-2cb8-4363-86e5-1202c28d10de/
│       └── subagents/
│           ├── agent-ac179380a25e4d84b.jsonl          ← 子 agent session
│           └── agent-af7ac11502aba729d.jsonl
├── -home-gh-another-project/
│   └── ...
```

每个 `.jsonl` 文件是一个 session 的完整日志。主 session 下的 `subagents/` 目录包含子 agent session。

### 获取 Token

通过 API 获取登录 Token（工号 + 密码）：

```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"employee_id":"zhangsan","password":"Changeme123!"}'
```

返回的 `token` 字段即为 CLI 所需的 Token。新用户也可通过 `/api/v1/auth/register` 自助注册。

### login — 登录

```bash
# 指定服务器和 Token
aida login --server http://localhost:8080/api/v1 --token eyJhbG...

# 交互式输入（省略 --token 会提示输入）
aida login --server http://localhost:8080/api/v1

# 使用默认服务器地址
aida login --token eyJhbG...
```

登录成功后会验证 Token 有效性，并保存到 `~/.aida.yaml`。

### sessions — 列出本地 Session

```bash
# 列出最近 48 小时的 session
aida sessions

# 列出所有 session
aida sessions --all

# 按项目目录筛选
aida sessions --project project-manager
```

输出示例：

```
  #     Date                 Tokens     Duration   Model       Project                 Summary
  ------------------------------------------------------------------------------------------------------------
  1     2026-06-09 08:42     1.4M       1322m      glm-5.1     ..e/gh/project/manager  
                                               2 sub-agent(s)
  2     2026-06-08 12:11     473.3K     46m        glm-5.1     ..4b44f3/workspace/tmp  
  3     2026-06-08 06:17     60.9K      4m         glm-5.1     ..17d/c5ced7c2/workdir  You are running as a local...

  Total: 3 sessions
  Session logs: /home/gh/.claude/projects/
```

说明：
- `#` 列的数字是上传时引用的编号
- `Tokens` 为该 session 消耗的 Token 总量（包含子 agent）
- `sub-agent(s)` 表示该主 session 下有 N 个子 agent session
- 列表**只显示主 session**，子 agent session 不单独显示

### upload — 上传 Session

```bash
# 上传指定编号的 session
aida upload 1
aida upload 1 3 5

# 上传所有 session
aida upload --all

# 交互式选择（不带参数，会弹出选择器）
aida upload
```

上传行为：
- 上传主 session 时，**自动附带该主 session 下的所有子 agent session**
- 已上传的 session 会显示 `[SKIP]`，不会重复上传
- 撤回（在 Web 端操作）是物理删除，撤回后可重新上传

输出示例：

```
Uploading 1 session(s) to http://localhost:8080/api/v1 ...

  [OK]    a48dd56f-2cb    08:42      1.4M  Worked on route design...
          └─ 2 sub-agent(s) uploaded

Done. 1 main + 2 sub-agent(s) uploaded.
Dashboard: http://localhost:8080
```

### serve — 服务端 AI 日报生成器

`serve` 是服务端 report-generator 微服务：用户先在各自机器上用 `aida upload` 把 Claude Code session 上传到平台；用户在 Web Reports 页面点击 **Generate AI Report** 后，API 调用该服务从 PostgreSQL 拉取当前用户当天已上报的 session 数据，执行 `claude -p` 生成 Markdown 日报，并写回 `daily_reports`。用户随后可以在页面中编辑 AI 生成的日报草稿。

```bash
# 本地调试 report-generator。需要能访问平台数据库，并且服务端已配置 claude 登录态。
DATABASE_URL="postgres://aidashboard:devpassword@localhost:5432/aidashboard?sslmode=disable" \
PORT=8090 aida serve
```

Docker Compose 启动完整服务：

```bash
docker compose up -d
```

report-generator 环境变量：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | 平台 PostgreSQL 连接串 | 无，服务端模式必填 |
| `AIDA_CLAUDE_BIN` | Claude CLI 命令 | `claude` |
| `AIDA_CLAUDE_TIMEOUT` | `claude -p` 超时时间 | `10m` |
| `PORT` | report-generator HTTP 端口 | `8090` |
| `TZ` | API 与消费者使用的本地时区 | `Asia/Shanghai` |

API 通过 `REPORT_GENERATOR_URL` 调用 report-generator，Compose 默认值为 `http://consumer:8090`。

Compose 的 `consumer` 服务会把服务端主机 `${HOME}/.claude` 挂载到容器 `/root/.claude`，只用于复用服务端 Claude Code 登录配置；它不会读取用户机器上的 session log。

### status — 查看登录状态

```bash
aida status
```

输出：

```
Server:  http://localhost:8080/api/v1
Config:  /home/gh/.aida.yaml
User:    张三 (employee)
Status:  logged in as 张三 (employee)
```

### help — 帮助

```bash
aida help
aida --help
```

---

## 数据说明

### 核心概念

| 概念 | 说明 |
|------|------|
| **Session** | AI Agent 一次启动→结束的完整交互。resume 算新 session |
| **需求 (Requirement)** | 有明确验收标准的工作项。总监/TL/PM 均可创建 |
| **任务 (Task)** | TL 拆解的最小执行单元。只有完成/未完成两种状态 |
| **验收标准 (AC)** | 需求创建时自动生成 3-8 条。TL 手动关联到任务 |
| **Token** | 原始 Token 量（不折算为货币） |
| **活跃** | 当日 ≥1 个已上报 session |

### Session 数据提取

CLI 从 Claude Code 的 JSONL 文件中提取以下信息：

| 字段 | 来源 |
|------|------|
| Session ID | `sessionId` 字段 |
| 开始/结束时间 | 首条和末条事件的 `timestamp` |
| 模型 | `assistant` 事件的 `message.model` |
| Token 用量 | `assistant` 事件的 `message.usage` 累加 |
| 摘要 | 首条 `user` 事件的 `message.content[0].text`（截取前 200 字符） |
| Tool 调用 | `assistant` 事件中 `type: "tool_use"` 的 `name` 统计 |

### 进度自动计算

```
需求进度 = 已完成的 AC 数 / 总 AC 数 × 100%
AC 完成 = 该 AC 关联的所有任务均为 done 状态
```

当员工将任务标记为 **done** 时，系统自动重新计算所属需求的进度。进度达到 100% 时，需求状态自动变为 **completed**。

### 数据保留

| 类型 | 保留策略 |
|------|---------|
| Session 日志 | 6 个月热存储，超期归档冷存储 |
| 日报 | 永久保留 |
| 撤回 | 物理删除，不可恢复 |

---

## 常见问题

### Q: CLI 提示 "Not logged in"

运行 `aida login --server <url> --token <token>` 先登录。Token 从 Web Dashboard 的登录流程获取。

### Q: sessions 命令看不到我的 session

- 确认 `~/.claude/projects/` 目录下有 `.jsonl` 文件
- 默认只显示最近 48 小时，使用 `--all` 查看全部
- 子 agent session 不会在列表中单独显示，但上传时会自动附带

### Q: 上传后 Web 端看不到

- 检查 `aida status` 确认登录的用户身份
- Session 只对上报者本人、其 TL 和总监可见

### Q: 如何撤回已上报的 Session

在 Web Dashboard 的 **Sessions** 页面，点击对应 session 的 **Withdraw** 按钮。撤回 = 物理删除，关联的 Token 记录也会一并删除。

### Q: Token 数据为什么是 0

- 确认 session 中有 `assistant` 类型的事件且包含 `usage` 字段
- 某些短 session 或仅使用内置工具的 session 可能不产生 Token 记录

### Q: 如何修改日报

在 Web Dashboard 的 **Reports** 页面：
1. 点击 **Generate Today's Report** 生成今日日报
2. 点击 **Edit** 修改内容或附加飞书文档链接
3. 编辑后日报标记为 "Edited"

### Q: 忘记 CLI 配置文件在哪

```
~/.aida.yaml
```

可以直接编辑或删除后重新 `aida login`。

### Q: 如何重置数据库

```bash
docker compose down -v    # 停止并删除数据卷
docker compose up -d      # 重新启动（自动执行迁移和种子数据）
```
