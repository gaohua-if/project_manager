# AI Coding Console 简易部署文档

## 1. 镜像信息

当前版本标签：`20260626`（也可使用 `latest`）。

### 后端 API

```text
192.168.14.129:80/aied/ai-coding-console-api:20260626
```

### 前端 Web

```text
192.168.14.129:80/aied/ai-coding-console-web:20260626
```

### 报告生成服务 consumer

```text
192.168.14.129:80/aied/ai-coding-console-consumer:20260626
```

> 私库 `192.168.14.129:80` 走 HTTP。若目标服务器 docker 默认以 HTTPS 拉取私库会报 `http: server gave HTTP response to HTTPS client`，需在 `/etc/docker/daemon.json` 加入 `"insecure-registries": ["192.168.14.129:80"]` 后重启 docker（需 root）。
>
> 若无法配置 insecure-registry，可在能访问私库的机器上 `docker pull` / `docker save` 这三个镜像，再 `scp` 到目标机 `docker load` 离线导入，效果一致。

### 1.1 镜像标签约定

**每个镜像固定打两个标签：**

- **日期标签 `YYYYMMDD`**（构建当天，如 `20260626`）— 不可变，用于回滚和明确指定版本。
- **`latest`** — 始终指向最新一次构建。

> 部署 / compose 文件里**统一用日期标签**锁定版本，避免 `latest` 漂移导致环境不一致；`latest` 仅作便捷引用。下面 `<TAG>` 即指当天日期。

### 1.2 构建与推送

在本机源码根目录执行（三个组件 context 分别是 `./api` `./web` `./daemon`）：

```bash
REG=192.168.14.129:80/aied
TAG=$(date +%Y%m%d)        # 例如 20260626

# api / web / consumer 各自构建，同时打 日期 + latest 两个标签
docker build -t $REG/ai-coding-console-api:$TAG      -t $REG/ai-coding-console-api:latest      ./api
docker build -t $REG/ai-coding-console-web:$TAG      -t $REG/ai-coding-console-web:latest      ./web
docker build -t $REG/ai-coding-console-consumer:$TAG -t $REG/ai-coding-console-consumer:latest ./daemon

# 推送两个标签（需先 docker login 私库；私库为 HTTP，见 §1 insecure-registry 说明）
for repo in ai-coding-console-api ai-coding-console-web ai-coding-console-consumer; do
  for t in $TAG latest; do docker push $REG/$repo:$t; done
done
```

> 推送后记得把部署 / compose 文件中的镜像标签同步更新为本次的 `<TAG>`。

---

## 2. 依赖服务

需要部署以下服务（均可单机运行，无外部依赖）：

- PostgreSQL 16（基础镜像 `postgres:16`）
- MinIO（基础镜像 `minio/minio:latest`）
- 后端 API
- 前端 Web
- 报告生成服务 consumer

> `consumer` 负责日报 / 周报的 AI 生成，启动时会监听 `:8090`，由 API 通过 `REPORT_GENERATOR_URL` 调用。它通过挂载宿主机 `~/.claude` 复用服务端 Claude 登录——**部署后需在宿主机执行一次 `claude` 登录**，否则容器虽能启动，但报告生成会失败。

---

## 3. `docker-compose` 示例

```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_DB: aidashboard
      POSTGRES_USER: aidashboard
      POSTGRES_PASSWORD: devpassword
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "15433:5432"

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin123
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"
      - "9001:9001"

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
      - db
      - minio
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
      - db

volumes:
  pgdata:
  minio_data:
```

---

## 4. 启动命令

拉取镜像：

```bash
docker compose pull
```

> 若使用离线导入（私库未配置 insecure-registry），跳过 `docker compose pull`，改为：
>
> ```bash
> # 在能访问私库的机器上
> docker pull 192.168.14.129:80/aied/ai-coding-console-api:20260626
> docker pull 192.168.14.129:80/aied/ai-coding-console-web:20260626
> docker pull 192.168.14.129:80/aied/ai-coding-console-consumer:20260626
> docker save 192.168.14.129:80/aied/ai-coding-console-api:20260626 \
>             192.168.14.129:80/aied/ai-coding-console-web:20260626 \
>             192.168.14.129:80/aied/ai-coding-console-consumer:20260626 \
>   | gzip > aida-images.tar.gz
> scp aida-images.tar.gz <用户>@<服务器IP>:/tmp/
>
> # 在目标服务器上
> gunzip -c /tmp/aida-images.tar.gz | docker load
> ```

启动服务：

```bash
docker compose up -d
```

查看服务状态：

```bash
docker compose ps
```

查看后端 API 日志：

```bash
docker compose logs -f api
```

查看前端 Web 日志：

```bash
docker compose logs -f web
```

---

## 5. 访问地址

### 前端页面

```text
http://服务器IP:13000
```

### API 地址

```text
http://服务器IP:18090
```

### MinIO 控制台

```text
http://服务器IP:9001
```

---

## 6. 默认账号

系统初始化后会自动创建内置账号。**当前镜像随种子数据部署，迁移 `008_builtin_password_123.sql` 已将所有内置账号（含 admin）密码统一重置为 `123`**：

```text
工号：admin
密码：123
```

> 注意：早期文档写的 `Admin@123!` 已被上述迁移覆盖，不再生效。
>
> 建议上线后第一时间：修改 admin 密码、更换 `JWT_SECRET`、并视情况清理/替换种子用户数据。

---

## 7. aida CLI 安装包托管（MinIO）

用户通过 Linux `curl ... | bash` 或 Windows PowerShell 一行命令安装 `aida` 命令行工具。安装包直接托管在本机 MinIO 上，无需额外静态服务器。

### 7.1 构建发布包

在能编译的开发机执行（`AIDA_RELEASE_URL` 会被固化进 `install.sh`，必须指向最终对外地址）。

测试包固定使用当前测试主机 `192.168.14.157`：

```bash
# 修改根目录 VERSION 后构建
make release-test-dir
# 产物在 ./aida-releases-test/：
# install.sh / install.ps1 / aida-linux-amd64 / aida-windows-amd64.exe / aida-latest.txt / SHA256SUMS.txt
```

正式包必须传入最终部署服务器地址：

```bash
make release-prod-dir \
  AIDA_RELEASE_URL=http://<服务器IP>:9000/statics-live/aida \
  AIDA_API_URL=http://<服务器IP>:18090/api/v1
# 产物在 ./aida-releases-release/：
# install.sh / install.ps1 / aida-linux-amd64 / aida-windows-amd64.exe / aida-latest.txt / SHA256SUMS.txt
```

### 7.2 上传到 MinIO 并开放匿名下载

把对应 release 目录传到服务器（如测试包 `aida-releases-test/`，正式包 `aida-releases-release/`，目标路径统一示例为 `/tmp/aida-releases`），然后用 `minio/mc` 容器上传到
bucket `statics-live`、前缀 `aida/`，并设匿名只读：

```bash
docker run --rm --network host -v /tmp/aida-releases:/data:ro --entrypoint sh minio/mc -c '
  mc alias set local http://localhost:9000 minioadmin minioadmin123
  mc mb -p local/statics-live 2>/dev/null || true
  mc cp /data/* local/statics-live/aida/
  mc anonymous set download local/statics-live/aida
'
```

> 发布包存放在 `minio_data` 卷中，随 MinIO 重启保留。更新版本时重复 7.1 / 7.2 覆盖上传即可。

### 7.3 安装命令

Linux：

```bash
curl -fsSL http://<服务器IP>:9000/statics-live/aida/install.sh \
  | AIDA_API_URL=http://<服务器IP>:18090/api/v1 AIDA_TOKEN=<用户JWT> bash
```

Windows：

```powershell
$env:AIDA_API_URL="http://<服务器IP>:18090/api/v1"; $env:AIDA_TOKEN="<用户JWT>"; powershell -ExecutionPolicy Bypass -NoProfile -Command "Invoke-RestMethod http://<服务器IP>:9000/statics-live/aida/install.ps1 | Invoke-Expression"
```

不带 `AIDA_API_URL` / `AIDA_TOKEN` 也可安装，装完再执行 `aida login` 即可。Windows 安装脚本会写入当前用户 PATH，安装后建议重新打开 PowerShell。

### 7.4（可选）去掉 URL 中的 `:9000`

MinIO S3 端点固定在 `9000`。若希望对外是 `http://<服务器IP>/statics-live/aida/...`（80 端口），
在服务器（或入口）nginx 上加一段反代即可（需要 root）：

```nginx
# /etc/nginx/conf.d/statics-live.conf
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

加载后安装命令即可简化为：

```bash
curl -fsSL http://<服务器IP>/statics-live/aida/install.sh | bash
```

Windows：

```powershell
powershell -ExecutionPolicy Bypass -NoProfile -Command "Invoke-RestMethod http://<服务器IP>/statics-live/aida/install.ps1 | Invoke-Expression"
```
