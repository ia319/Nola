# Core Docker 部署

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

`compose.yaml` 启动两个后端进程：

- `core-api`：FastAPI、文件上传、模型管理、实时转写 WebSocket 和导出接口。
- `core-worker`：离线文件转写任务 Worker。

两个服务使用同一个 `nola-core:0.1.0` 镜像，并共享同一组 volume。

默认端口绑定：

```yaml
127.0.0.1:8000:8000
```

默认绑定只允许本机访问。远程访问应通过反向代理发布 HTTPS/WSS 入口。

## 数据卷

Compose 定义两个 named volume：

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

API 和 Worker 必须共享同一个 `/data` 和 `/models`。如果两者使用不同 volume，Worker 将无法读取 API 接收的上传文件，也无法写回同一个任务数据库。

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
- `NOLA_MODEL_SIZE`：没有持久化默认模型时的后备模型。
- `NOLA_DEVICE`：`cpu`、`cuda` 或 `auto`。
- `NOLA_COMPUTE_TYPE`：`int8`、`float16`、`default` 等 Faster-Whisper 计算类型。
- `NOLA_LIVE_REALTIME_TRANSCRIBER`：实时转写运行时。

Docker 后端遵循容器环境变量。Compose 默认不设置 `NOLA_MODEL_SIZE`、`NOLA_DEVICE`、`NOLA_COMPUTE_TYPE` 或转录参数默认值；未设置时使用 Core 源码默认值和应用内保存配置。

桌面集成版的 sidecar 环境变量规则见 [Windows 桌面发布](../release/windows-desktop.md)。

## 健康检查

镜像内置 `/health` 健康检查：

```text
GET /health
```

期望响应：

```json
{"status":"ok","version":"0.1.0"}
```

Compose 中 `core-worker` 等待 `core-api` 健康后启动。Worker 没有 HTTP 端口，因此 compose 禁用 Worker 自身健康检查。

## 镜像范围

当前 Dockerfile 默认 CPU 镜像行为：

- 不安装可选 `gpu` 依赖组
- 不设置 `NOLA_DEVICE` 或 `NOLA_COMPUTE_TYPE`
- 转录业务默认值来自 Core 源码默认值和应用内保存配置

GPU 镜像需要单独定义 CUDA runtime 基础镜像、驱动要求和 `gpu` 依赖组安装方式。

## 安全边界

- 默认 compose 只绑定 `127.0.0.1:8000`。
- 公网部署需要反向代理、TLS 和外部认证层。
- 当前项目不内置 OAuth2、OIDC 或 API token。
- 直接把 `8000` 暴露到公网不属于受支持部署方式。
- Web 静态站点访问远程 Core 时，应使用 HTTPS/WSS，并配置明确的 `NOLA_CORS_ORIGINS`。

## GHCR 发布

第一轮 GHCR 目标平台：

```text
linux/amd64
linux/arm64
```

推荐 tag：

```text
ghcr.io/<owner>/nola-core:0.1.0
ghcr.io/<owner>/nola-core:0.1
ghcr.io/<owner>/nola-core:latest
```

GitHub Release 不上传 Docker 镜像压缩包；Release 页面只说明镜像地址和支持平台。
