# AIHub SSO 迁移计划 - 进度报告

## 概述

将 Aida 从自有认证（employee_id + bcrypt + JWT）迁移至 AIHub 统一认证（AIHub 作为身份提供者）。目标：
- 统一三个调用方的鉴权根：Aida UI、Managed Platform、Scheduled Agent MCP 回调
- 定时任务触发时 Agent 可直接使用 AIHub token 调用 Aida MCP（无需 Aida 登录）

## 已完成

### 1. 数据库 Schema (任务 #2 ✅)

- **源迁移编辑** (001, 003, 004, 007, 010, 011)：所有 `user_id`/`creator_id`/`assignee_id` 等列从 `UUID` 改为 `BIGINT`
- **002_seed.sql**：仅保留 teams，删除虚拟用户（改为首次登录懒创建）
- **005_user_auth.sql**：删除 employee_id/email/password_hash 列相关逻辑
- **012_aihub_auth.sql**（新增）：现有开发数据库的迁移脚本
  - 删除所有用户外键约束
  - 清空用户键控数据（无 AIHub ID 映射）
  - 将 users.id 从 UUID 转为 BIGINT
  - 级联至 11 张表的 13 个引用列
  - 重建外键
- **013_aihub_user_cache_column.sql**（新增）：补齐已执行 012 的旧库 `aihub_username` 缓存列，保持幂等

### 2. Go 认证核心 (任务 #3 ✅)

#### 已完成
- **api/config/config.go**：新增 `AIHubHost`、`AIHubJWTSecret`
- **api/service/aihub.go**：AIHubClient (Login, GetUserInfo) — 对接确认的端点
- **api/service/aihub_token.go**：ParseAIHubUID、VerifyAIHubToken（本地 HS256 验签）+ 单元测试
- **api/model/models.go**：
  - `User.ID` 从 `string` 改为 `int64`
  - 删除了 LoginRequest/RegisterRequest 中的 employee_id/password 字段
  - 所有模型结构体中的 `UserID`/`LeaderID`/`CreatorID`/`AssigneeID`/`CreatorTLID` 改为 `int64`（或 `*int64`）
- **api/handler/middleware.go**：
  - `AuthMiddleware` 重写为验证 AIHub token（本地验签或远程 introspection）
  - 添加 30 秒 TTL 的 userInfoCache
  - 添加 `upsertAidaUser` 懒创建用户行
- **api/handler/auth.go**：
  - `Login` 代理至 AIHub，删除 bcrypt/JWT 签发
  - 删除 `Register`、`issueToken`、密码重置
  - 扫描更新为 `int64` ID
- **api/main.go**：连接 AIHubClient，更新 AuthHandler/AuthMiddleware 构造
- **handler/helpers.go**：新增 `nullInt64Ptr` 辅助函数
- **api/handler/task.go**：
  - `CreateTaskRequest` / `UpdateTaskRequest` 的 `assignee_id` 已改为数值型 AIHub user id
  - `canCreateTask` / `canReassignTask` / `canManageTask` 已统一使用 `int64`
  - 删除任务时的 `assignee_id` / `creator_tl_id` 扫描已改为 `sql.NullInt64` / `int64`
- **api/main.go**：移除本地密码重置路由，密码由 AIHub 管理
- **docker-compose.override.yml**：新增 `AIHUB_HOST` / `AIHUB_JWT_SECRET` 配置透传，默认指向已确认 AIHub 地址
- **api/service/aihub.go**：`roles` 字段兼容 AIHub 返回的字符串数组和对象数组

### 3. MCP 切通 (任务 #4 ✅)

- `/mcp/daily-report` 通过新的 AuthMiddleware 接收 AIHub token（无需 Aida 登录）
- 调度器触发时不再烘焙 aida_context，Agent 自行通过 MCP 获取
- `message`/`params` 字段已改为可选，通用 Agent 手动运行可只提交启动参数（例如 `urls=[...]`）

### 4. 前端 SSO 切通 (任务 #5 ✅)

- `types.ts`：`User.id` 从 `string` → `number`，`LoginCredentials.employee_id` → `username`
- `authApi.ts`：登录请求改为 `{username, password}`；兼容解析 `aihub_username` / `username`
- `LoginPage.tsx`：表单字段改为 AIHub 账号
- 删除 `RegisterPage` 和 `/register` 路由
- 删除组织页本地密码重置入口和 `/organization/users/:id/reset-password` 路由
- 需求/任务/组织相关页面已同步数值型 user id

## 编译状态

```
GOCACHE=/tmp/go-build-cache go test ./...
pnpm lint
pnpm build
docker compose up -d --build api web
curl -s http://127.0.0.1:18090/health
curl -s http://127.0.0.1:18090/api/v1/auth/me -H 'Authorization: Bearer <AIHub token>'
```

本地验证结果：
- API/Web 容器已重建启动
- `schema_migrations` 已记录到 13
- `/api/v1/auth/me` 已通过 AIHub Bearer token 返回当前用户，并懒创建本地 `users` 行

## 待确认事项

1. **生产环境数据库**是否需要手动执行 012/013 迁移？（开发环境已完成，`docker compose down -v` 后新库可从 001 直接初始化）
2. **生产 AIHub JWT secret** 是否下发到 Aida：未配置时走 AIHub userinfo introspection；配置后可本地 HS256 验签。

## 技术细节

### AIHub 合约（已确认）

- **登录**: `POST /api/v1/auth/login` {username, password} → {code:0, data:{id:int, token:HS256}}
- **用户信息**: `GET /api/v1/users/{id}` + Bearer token → {code:0, data:{id, username, nickname, email, roles}}
- **Token**: HS256, payload `{exp, iat, uid:<int>}`
- **服务地址**: `http://192.168.11.18:30030`

### 认证流程

1. 前端 POST `/auth/login` {username, password}
2. Aida 调用 AIHub Login，获取 AIHub token
3. Aida 调用 AIHub GetUserInfo(int, token) 验证 token 并获取用户信息
4. Aida 通过 `upsertAidaUser` 在本地 users 表创建/更新行（懒创建）
5. 返回 AIHub token 给前端，后续请求携带此 token
6. 中间件通过 introspection (GET /users/{uid}) 验证 token（无本地密钥时）或本地验签

### 懒创建策略

- 用户首次登录时自动在 Aida users 表创建行
- 默认角色 `employee`，team_id 为 NULL
- Aida 管理员可通过 admin 端点提升角色/分配团队
