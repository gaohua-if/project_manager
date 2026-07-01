# AI Coding Console 部署文档

## 1. 文档目的

本文档用于部署 Aida / AI Coding Console 的服务端环境，适用于：

- 人工按步骤执行部署
- agent 按文档编排自动化部署
- 日常升级、回滚、验证和 CLI 发布

目标是让部署过程可重复、可验证、可维护，而不是依赖临时口头说明。

---

## 2. 部署范围

当前系统包含 5 个运行组件：

1. `db`：PostgreSQL 16
2. `minio`：对象存储，用于原始日志与 CLI 安装包托管
3. `api`：后端 API
4. `web`：前端页面
5. `consumer`：日报 / 周报生成服务

其中：

- `api`、`web`、`consumer` 为业务服务
- `db`、`minio` 为基础依赖

---

## 3. 架构说明

部署后整体关系如下：

```text
用户浏览器 --> web --> api --> PostgreSQL
                      |--> MinIO
                      |--> consumer --> Claude CLI

开发机 / 员工机器 --> aida CLI --> api
```

关键说明：

- `web` 对外提供页面访问入口
- `api` 负责业务接口、鉴权、需求任务、Token、报表相关逻辑
- `consumer` 由 `api` 通过 `REPORT_GENERATOR_URL` 调用，用于生成日报 / 周报草稿
- `consumer` 需要复用宿主机上的 Claude 登录态，因此必须挂载宿主机 `~/.claude`

---

## 4. 前置条件

## 4.1 服务器要求

建议至少满足：

- Linux 服务器
- 已安装 Docker Engine
- 已安装 Docker Compose v2
- 具备 root 或可执行 Docker 管理操作的权限
- 服务器可访问镜像仓库 `192.168.14.129:80`

## 4.2 网络与端口规划

默认部署端口如下，可按需调整：

| 服务 | 容器端口 | 宿主机示例端口 | 说明 |
|---|---:|---:|---|
| Web | 80 | 13000 | 用户访问入口 |
| API | 8080 | 18090 | 前端与 CLI 调用 |
| PostgreSQL | 5432 | 15433 或不暴露 | 生产建议仅内网可达 |
| MinIO API | 9000 | 9000 | 对象存储与 CLI 安装包下载 |
| MinIO Console | 9001 | 9001 | 管理控制台 |
| Consumer | 8090 | 通常不对外暴露 | 仅 API 内部调用 |

## 4.3 Claude 登录前置条件

`consumer` 依赖 Claude CLI 生成日报 / 周报，因此部署完成后必须在宿主机执行一次 Claude 登录。

要求：

- 宿主机存在可用的 `~/.claude`
- `consumer` 通过 volume 挂载该目录到容器内 `/root/.claude`

如果未登录 Claude：

- 服务可以启动
- 但日报 / 周报生成会失败

---

## 5. 镜像信息

当前镜像仓库：

```text
192.168.14.129:80/aied
```

当前版本标签示例：

```text
20260626
```

对应镜像：

```text
192.168.14.129:80/aied/ai-coding-console-api:20260626
192.168.14.129:80/aied/ai-coding-console-web:20260626
192.168.14.129:80/aied/ai-coding-console-consumer:20260626
```

## 5.1 标签约定

每个业务镜像固定打两个标签：

- 日期标签 `YYYYMMDD`
- `latest`

建议：

- 部署文件一律使用日期标签
- `latest` 仅用于临时调试或人工检查

原因：

- 日期标签可精确回滚
- 避免 `latest` 漂移导致环境不一致

## 5.2 私库是 HTTP 仓库

当前私库 `192.168.14.129:80` 走 HTTP，而不是 HTTPS。

如果目标服务器 Docker 默认按 HTTPS 拉取，会报错：

```text
http: server gave HTTP response to HTTPS client
```

解决方式：

1. 修改 `/etc/docker/daemon.json`
2. 加入 insecure registry 配置
3. 重启 Docker

示例：

```json
{
  "insecure-registries": ["192.168.14.129:80"]
}
```

重启：

```bash
systemctl restart docker
```

验证：

```bash
docker info | grep -A5 "Insecure Registries"
```

如果目标机无法改 Docker 配置，可改用离线导入方案，见第 8 章。

---

## 6. 从源码构建并推送镜像

如果你不是直接使用现成镜像，而是要从当前仓库发布新版本，可在源码根目录执行：

```bash
REG=192.168.14.129:80/aied
TAG=$(date +%Y%m%d)

docker build -t $REG/ai-coding-console-api:$TAG      -t $REG/ai-coding-console-api:latest      ./api
docker build -t $REG/ai-coding-console-web:$TAG      -t $REG/ai-coding-console-web:latest      ./web
docker build -t $REG/ai-coding-console-consumer:$TAG -t $REG/ai-coding-console-consumer:latest ./daemon

for repo in ai-coding-console-api ai-coding-console-web ai-coding-console-consumer; do
  for t in $TAG latest; do
    docker push $REG/$repo:$t
  done
done
```

发布后需要同步更新部署文件中的镜像标签。

---

## 7. 标准部署流程

本章给出推荐的标准部署方式：单机 Docker Compose 部署。

## 7.1 目录准备

建议在目标服务器准备独立部署目录，例如：

```bash
mkdir -p /data/ai-coding-console
cd /data/ai-coding-console
```

建议在该目录下保存：

- `docker-compose.yml`
- `.env`（如需要）
- 运维记录、备份脚本、升级脚本

## 7.2 部署版 `docker-compose.yml`

下面是一份可直接落地的参考配置。请按实际 IP、域名、密码、镜像标签调整。

```yaml
services:
  db:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_DB: aidashboard
      POSTGRES_USER: aidashboard
      POSTGRES_PASSWORD: devpassword
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "15433:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U aidashboard"]
      interval: 5s
      timeout: 5s
      retries: 10

  minio:
    image: minio/minio:latest
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin123
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"
      - "9001:9001"
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 5s
      timeout: 5s
      retries: 10

  api:
    image: 192.168.14.129:80/aied/ai-coding-console-api:20260626
    restart: unless-stopped
    environment:
      DATABASE_URL: "postgres://aidashboard:devpassword@db:5432/aidashboard?sslmode=disable"
      JWT_SECRET: "please-change-in-production"
      CORS_ORIGIN: "http://服务器IP:13000"
      MINIO_ENDPOINT: "minio:9000"
      MINIO_ACCESS_KEY: "minioadmin"
      MINIO_SECRET_KEY: "minioadmin123"
      MINIO_BUCKET: "aidashboard"
      MINIO_USE_SSL: "false"
      MINIO_EXTERNAL_ENDPOINT: "http://服务器IP:9000"
      REPORT_GENERATOR_URL: "http://consumer:8090"
      TZ: "Asia/Shanghai"
    depends_on:
      db:
        condition: service_healthy
      minio:
        condition: service_healthy
    ports:
      - "18090:8080"

  web:
    image: 192.168.14.129:80/aied/ai-coding-console-web:20260626
    restart: unless-stopped
    environment:
      AIHUB_RUNTIME_CONFIG_apiBaseUrl: "/api/v1"
      AIHUB_RUNTIME_CONFIG_authApiBaseUrl: "/api/v1"
      AIHUB_RUNTIME_CONFIG_userApiBaseUrl: "/api/v1"
      AIHUB_RUNTIME_CONFIG_appTitle: "AI Coding Console"
    depends_on:
      - api
    ports:
      - "13000:80"

  consumer:
    image: 192.168.14.129:80/aied/ai-coding-console-consumer:20260626
    restart: unless-stopped
    command: ["aida", "serve"]
    environment:
      DATABASE_URL: "postgres://aidashboard:devpassword@db:5432/aidashboard?sslmode=disable"
      AIDA_CLAUDE_TIMEOUT: "10m"
      PORT: "8090"
      TZ: "Asia/Shanghai"
    volumes:
      - /home/<部署用户>/.claude:/root/.claude
    depends_on:
      db:
        condition: service_healthy

volumes:
  pgdata:
  minio_data:
```

## 7.3 关键配置说明

### `JWT_SECRET`

- 必须修改
- 生产环境不要使用默认值
- 建议使用高强度随机字符串

### `CORS_ORIGIN`

- 必须与用户实际访问前端页面的地址一致
- 如果使用域名，填写域名地址
- 如果多个来源，按后端支持格式配置

### `MINIO_EXTERNAL_ENDPOINT`

- 填写客户端可访问的 MinIO 对外地址
- 用于对象访问链接与 CLI 安装包地址

### `REPORT_GENERATOR_URL`

- 必须指向 `consumer`
- 通常使用容器内服务名：`http://consumer:8090`

### `~/.claude` 挂载

- 必须确认宿主机目录真实存在
- 必须确保部署用户在宿主机完成过 Claude 登录

## 7.4 启动服务

在部署目录执行：

```bash
docker compose pull
docker compose up -d
```

查看状态：

```bash
docker compose ps
```

查看日志：

```bash
docker compose logs -f api
docker compose logs -f web
docker compose logs -f consumer
docker compose logs -f db
docker compose logs -f minio
```

---

## 8. 离线导入部署

如果目标服务器不能直接从私库拉镜像，可在一台能访问私库的机器执行：

```bash
docker pull 192.168.14.129:80/aied/ai-coding-console-api:20260626
docker pull 192.168.14.129:80/aied/ai-coding-console-web:20260626
docker pull 192.168.14.129:80/aied/ai-coding-console-consumer:20260626

docker save \
  192.168.14.129:80/aied/ai-coding-console-api:20260626 \
  192.168.14.129:80/aied/ai-coding-console-web:20260626 \
  192.168.14.129:80/aied/ai-coding-console-consumer:20260626 \
  | gzip > ai-coding-console-images-20260626.tar.gz

scp ai-coding-console-images-20260626.tar.gz <用户>@<服务器IP>:/tmp/
```

在目标服务器导入：

```bash
gunzip -c /tmp/ai-coding-console-images-20260626.tar.gz | docker load
docker images | grep ai-coding-console
```

之后继续执行：

```bash
docker compose up -d
```

---

## 9. 首次部署后的初始化与验证

## 9.1 检查服务可用性

### 前端页面

```text
http://服务器IP:13000
```

### API

```text
http://服务器IP:18090
```

### MinIO Console

```text
http://服务器IP:9001
```

## 9.2 默认账号

当前数据库迁移中，内置账号密码已统一重置为：

```text
工号：admin
密码：123
```

说明：

- 旧文档中提到的 `Admin@123!` 已失效
- 当前镜像初始化后以迁移 `008_builtin_password_123.sql` 的结果为准

建议首次登录后立即执行：

1. 修改 `admin` 密码
2. 替换 `JWT_SECRET`
3. 评估是否保留默认内置用户

## 9.3 验证数据库迁移

进入数据库：

```bash
docker compose exec db psql -U aidashboard -d aidashboard
```

检查迁移记录：

```sql
select * from schema_migrations order by version;
```

重点确认包含：

- `005_user_auth.sql`
- `007_requirements_p0.sql`
- `016_requirement_task_versions.sql`

## 9.4 验证 Claude 报表能力

在宿主机确认 Claude 已登录后，检查 consumer 日志：

```bash
docker compose logs --tail=200 consumer
```

如果报表生成失败，优先检查：

- `/home/<部署用户>/.claude` 是否存在
- volume 挂载路径是否正确
- 宿主机是否完成 Claude 登录

---

## 10. 升级流程

推荐升级顺序如下：

1. 备份数据库
2. 更新镜像标签
3. 拉取新镜像
4. 重启服务
5. 验证核心能力

示例：

```bash
cd /data/ai-coding-console

# 1. 备份数据库
docker compose exec -T db pg_dump -U aidashboard aidashboard > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. 修改 docker-compose.yml 中的镜像 tag

# 3. 拉取新镜像
docker compose pull

# 4. 重启服务
docker compose up -d

# 5. 验证
docker compose ps
docker compose logs --tail=100 api
docker compose logs --tail=100 web
docker compose logs --tail=100 consumer
```

升级后至少验证：

- 页面能正常打开
- admin 能登录
- 需求列表能正常加载
- Dashboard 能正常加载
- consumer 无明显启动错误

---

## 11. 回滚流程

如果新版本异常，按旧标签回滚：

1. 将 `docker-compose.yml` 中镜像 tag 改回上一版本
2. 拉取或导入旧镜像
3. 重新 `docker compose up -d`

示例：

```bash
docker compose pull
docker compose up -d
docker compose ps
```

注意：

- 如果新版本已经执行了不可兼容的数据迁移，单纯回滚镜像可能不够
- 因此升级前的数据库备份必须保留

---

## 12. CLI 安装包发布

`aida` CLI 的 Linux / macOS Apple Silicon / Windows 安装包可直接发布到本机 MinIO，无需额外静态文件服务器。

## 12.1 构建发布包

仓库根目录执行：

### 测试包

```bash
make release-test-dir
```

产物目录：

```text
./aida-releases-test/
```

该命令会生成：

- `install.sh`
- `install.ps1`
- `aida-linux-amd64`
- `aida-darwin-arm64`
- `aida-windows-amd64.exe`
- `aida-latest.txt`
- `SHA256SUMS.txt`

### 正式包

正式包必须传入最终对外地址：

```bash
make release-prod-dir \
  AIDA_RELEASE_URL=http://<服务器IP>:9000/statics-live/aida \
  AIDA_API_URL=http://<服务器IP>:18090/api/v1
```

产物目录：

```text
./aida-releases-release/
```

说明：

- 测试包固定使用测试地址 `http://192.168.14.157:9000/statics-live/aida`
- 正式包必须传入实际服务器地址
- 安装脚本会把 `AIDA_RELEASE_URL` 与 `AIDA_API_URL` 固化进去

## 12.2 上传到 MinIO

假设你把生成目录拷贝到了服务器 `/tmp/aida-releases`：

```bash
docker run --rm --network host -v /tmp/aida-releases:/data:ro --entrypoint sh minio/mc -c '
  mc alias set local http://localhost:9000 minioadmin minioadmin123
  mc mb -p local/statics-live 2>/dev/null || true
  mc cp /data/* local/statics-live/aida/
  mc anonymous set download local/statics-live/aida
'
```

说明：

- bucket 名为 `statics-live`
- 发布前缀为 `aida/`
- 命令会将该目录设置为匿名只读下载

## 12.3 CLI 安装命令

### Linux / macOS Apple Silicon

```bash
curl -fsSL http://<服务器IP>:9000/statics-live/aida/install.sh \
  | AIDA_API_URL=http://<服务器IP>:18090/api/v1 AIDA_TOKEN=<用户JWT> bash
```

`install.sh` 会按当前系统选择二进制：Linux x86_64 下载 `aida-linux-amd64`，macOS arm64 下载 `aida-darwin-arm64`。

### Windows

```powershell
$env:AIDA_API_URL="http://<服务器IP>:18090/api/v1"; $env:AIDA_TOKEN="<用户JWT>"; Invoke-RestMethod http://<服务器IP>:9000/statics-live/aida/install.ps1 | Invoke-Expression
```

如果不带 `AIDA_TOKEN`，安装后可手动登录：

```bash
aida login --server http://<服务器IP>:18090/api/v1 --token <jwt>
```

Windows 注意事项：

- 直接在当前 PowerShell 会话中执行 `Invoke-RestMethod ... | Invoke-Expression`
- 不要再套一层 `powershell -Command`
- 否则 PATH 刷新只会发生在子进程里

## 12.4 可选：通过 Nginx 去掉 `:9000`

如果希望安装地址变成：

```text
http://<服务器IP>/statics-live/aida/install.sh
```

可在服务器 Nginx 上配置反向代理：

```nginx
server {
    listen 80;
    server_name <服务器IP或域名>;

    location /statics-live/ {
        proxy_pass http://127.0.0.1:9000/statics-live/;
        proxy_set_header Host $host;
        proxy_buffering off;
    }
}
```

---

## 13. 运维建议

生产环境建议至少做以下加固：

1. 修改 `JWT_SECRET`
2. 修改 MinIO 默认账号密码
3. 修改 PostgreSQL 默认密码
4. 修改 `admin` 默认密码
5. 对外使用固定域名，而不是裸 IP
6. 对 Web / API / MinIO 增加反向代理和访问控制
7. 定期备份 PostgreSQL 与 MinIO 数据

---

## 14. 常见问题

## 14.1 拉镜像时报 HTTPS / HTTP 冲突

现象：

```text
http: server gave HTTP response to HTTPS client
```

原因：

- 私库是 HTTP
- Docker 默认按 HTTPS 访问

处理：

- 配置 `insecure-registries`
- 或使用离线导入方式

## 14.2 consumer 启动正常，但日报生成失败

优先检查：

1. 宿主机是否已经 Claude 登录
2. `/home/<部署用户>/.claude` 是否存在
3. volume 挂载路径是否写对
4. `REPORT_GENERATOR_URL` 是否指向 `http://consumer:8090`

## 14.3 页面能打开，但接口 401 或登录异常

优先检查：

1. `JWT_SECRET` 是否在 API 重启前后发生不一致
2. 浏览器访问地址是否与 `CORS_ORIGIN` 匹配
3. 是否误用了旧环境 token

## 14.4 CLI 安装成功，但命令找不到

### Linux / macOS Apple Silicon

- 重新执行 `source ~/.bashrc` 或对应 shell 的 rc 文件
- 确认 `~/.local/bin` 已加入 PATH

### Windows

- 在当前 PowerShell 会话刷新 PATH
- 确保不要用 `powershell -Command` 再嵌套执行安装命令

---

## 15. 交付检查清单

部署完成后，至少完成以下检查：

- `docker compose ps` 全部服务为运行状态
- Web 页面可访问
- admin 可登录
- 需求列表可正常加载
- Dashboard 可正常加载
- consumer 无明显报错
- Claude 报表生成可用
- CLI 安装包可下载
- Linux / macOS Apple Silicon / Windows 安装命令至少验证一端

如果这份文档后续需要扩展，可以继续补充：

- HTTPS / 域名正式接入方案
- 备份恢复 SOP
- 多环境发布规范
- CI/CD 自动化发布流程
