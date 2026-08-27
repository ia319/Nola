# Core Docker 部署

## 环境要求

- Docker Engine
- Docker Compose v2

## 快速启动

```bash
make core-docker-up
```

```text
API 地址：http://127.0.0.1:8000
API 健康检查：http://127.0.0.1:8000/health
API 文档：http://127.0.0.1:8000/docs
```

停止服务：

```bash
make core-docker-down
```

单独构建镜像：

```bash
make core-docker-build
```

## Compose 服务

`compose.yaml` 启动两个后端服务：

- `core-api`：FastAPI、文件上传、模型管理、实时转写 WebSocket 和导出接口。
- `core-worker`：离线文件转写任务 Worker。

两个服务使用同一个本地构建镜像，并共享同一组 Docker 命名卷。

默认端口绑定：

```yaml
127.0.0.1:8000:8000
```

默认绑定仅接受本机连接。远程访问应通过反向代理发布 HTTPS/WSS 入口。

## 数据卷

Compose 定义两个 Docker 命名卷：

```text
nola-core-data    -> /data
nola-core-models  -> /models
```

`/data` 内容：

```text
nola.db
uploads/
exports/
```

`/models` 内容：

```text
Hugging Face 模型缓存
```

API 和 Worker 必须挂载同一个 `/data` 卷以共享 SQLite 数据库、上传文件和导出文件，并挂载同一个 `/models` 卷以共享模型缓存。

## 环境变量

Compose 默认值：

```yaml
NOLA_HOST: 0.0.0.0
NOLA_PORT: "8000"
NOLA_DATA_DIR: /data
NOLA_MODEL_DIR: /models
NOLA_CORS_ORIGINS: http://localhost:5173,http://127.0.0.1:5173
```

常用覆盖项：

- `NOLA_CORS_ORIGINS`：允许访问 API 的 Web 前端 origin 列表。
- `NOLA_MODEL_SIZE`：默认模型。
- `NOLA_DEVICE`：`cpu`、`cuda` 或 `auto`。
- `NOLA_COMPUTE_TYPE`：`default`、`float16` 或 `int8`。
- `NOLA_LIVE_REALTIME_TRANSCRIBER`：实时转写运行时。
- `NOLA_MAX_FILE_SIZE`：上传文件大小上限，单位为字节。

Compose 仅设置上表列出的主机、端口、数据目录、模型目录和 CORS 默认值。

其他配置按以下优先级从高到低解析：

- 模型选择、设备和计算类型：任务请求、已保存的应用默认值、容器环境变量、源码默认值。
- 转录参数：任务请求、已保存的应用默认值、Core/Faster-Whisper 默认值。容器环境变量不参与转录参数解析。

桌面集成版的 sidecar 环境变量规则见 [Windows 桌面发布](../release/windows-desktop.md)。

## 健康检查

镜像内置 `/health` 健康检查：

```text
GET /health
```

响应中的 `version` 来自 Core 包的 `__version__`：

```json
{"status":"ok","version":"<core-version>"}
```

Compose 在 `core-api` 健康后启动 `core-worker`，并将 Worker 的 healthcheck 设为禁用状态。

## 镜像范围

Dockerfile 构建 CPU 运行环境：

- 基础镜像为 `python:3.11.14-slim-bookworm`。
- Python 环境安装 Poetry `main` 依赖组。
- 系统环境包含 FFmpeg 和 `libgomp1`。
- API 和 Worker 以非 root 用户 `nola` 运行。
- 设备、计算类型和转录业务参数由 Core 配置层级解析。

GPU 执行需要自定义镜像提供 CUDA 12 runtime、cuBLAS、cuDNN 和 Poetry `gpu` 依赖组。

## 安全边界

- `8000` 端口适用于本机或受信任内部网络。
- 公网入口必须通过反向代理提供 TLS，并由外部认证层实施 OAuth2、OIDC 或 API token 认证。
- Web 静态站点访问远程 Core 时，应使用 HTTPS/WSS，并配置明确的 `NOLA_CORS_ORIGINS`。

## GHCR 发布

Core Docker 镜像通过 GHCR 分发：

```bash
docker pull ghcr.io/ia319/nola-core:<version>
```

GHCR 版本标签格式为 `<major>.<minor>.<patch>[-prerelease]`。

镜像平台：

```text
linux/amd64
linux/arm64
```

稳定版本发布三个 tag：

```text
ghcr.io/ia319/nola-core:<version>
ghcr.io/ia319/nola-core:<major>.<minor>
ghcr.io/ia319/nola-core:latest
```

预发布版本仅发布完整版本 tag。
