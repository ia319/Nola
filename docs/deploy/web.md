# Web 静态部署

## 发布产物

构建独立 Web 产物：

```bash
make release-check-version
make release-clean
make release-package-web
```

输出文件：

```text
release-artifacts/<version>/Nola-<version>-web.zip
```

压缩包根目录包含 `index.html` 和前端静态资源。部署时将压缩包内容解压到静态站点根目录。

`release-clean` 会重建整个版本暂存目录。完整发布流程应在首个产物构建前执行一次。

Web 静态包仅包含浏览器前端资源。转写、模型下载、任务队列、历史记录和实时转写能力由 Nola Core 后端提供。

## 静态服务器

静态服务器需要提供 SPA fallback。任意前端路由刷新后都应返回 `index.html`。

推荐部署形态：

```text
https://nola.example.com/       -> Web 静态文件
https://nola.example.com/health -> Core /health
https://nola.example.com/api/*  -> Core /api/*
```

同域反代使浏览器请求保持同源，并减少 CORS 配置。

## 后端连接

开发模式通过 Vite 代理连接 `http://127.0.0.1:8000`。该代理仅在 `pnpm --dir app dev` 中生效。

静态部署按照以下优先级解析 Core 地址：

1. Web 设置页保存的 Core 地址，存储于浏览器 `localStorage`。
2. 构建时写入的 `VITE_API_URL` 和 `VITE_WS_URL`。
3. 静态站点 origin；发布 zip 的构建时地址为空，因此默认使用同域 Core 路由。

自定义构建时地址会写入静态资源：

```bash
VITE_API_URL=https://api.example.com \
VITE_WS_URL=wss://api.example.com \
make release-package-web
```

`VITE_API_URL` 和 `VITE_WS_URL` 的值在构建时固定。运行时地址切换由 Web 设置页负责。

跨域 Core 配置示例：

```bash
NOLA_CORS_ORIGINS=https://app.example.com \
poetry -C core run uvicorn nola.main:app --host 0.0.0.0 --port 8000
```

远程 Core 地址使用 `https://`。`VITE_WS_URL` 为空时，前端从 HTTP 地址派生 `ws://` 或 `wss://` 地址。

## 公开部署

- Core API 通过反向代理或托管层提供 HTTPS。
- 实时转写 WebSocket 通过 WSS 暴露。
- 跨域部署在 Core CORS 允许列表中加入 Web 站点 origin。
- 公网入口通过外部认证层提供 OAuth2、OIDC、API token 或网络访问控制。

## 验收

- 打开静态站点后应用页面能加载。
- 前端路由刷新后仍返回应用页面。
- 设置页连接检查返回可用状态。
- CORS 配置错误时连接检查显示 `CORS blocked` / `CORS 阻止`。
- 清除已保存的 Core 地址后，确认同域 Core 路由可用；独立静态服务器应显示连接不可用状态。
