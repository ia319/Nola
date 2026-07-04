# Web 静态部署

## 发布产物

```bash
make release-package-web
```

输出文件：

```text
release-artifacts/0.1.0/Nola-0.1.0-web.zip
```

压缩包根目录包含 `index.html` 和前端静态资源。部署时将压缩包内容解压到静态站点根目录。

Web 静态包只包含浏览器前端资源。转写、模型下载、任务队列、历史记录和实时转写能力由 Nola Core 后端提供。

## 静态服务器

静态服务器需要提供 SPA fallback。任意前端路由刷新后都应返回 `index.html`。

推荐部署形态：

```text
https://nola.example.com/       -> Web 静态文件
https://nola.example.com/health -> Core /health
https://nola.example.com/api/*  -> Core /api/*
```

同域反代形态下，浏览器请求保持同源，CORS 配置最少。

## 后端连接

开发模式通过 Vite 代理连接 `http://127.0.0.1:8000`。该代理只在 `pnpm --dir app dev` 中生效。

静态部署使用以下连接方式之一：

- 同域反代：静态站点和 Core API 使用同一 origin。
- 跨域连接：在 Web 设置页保存 Core 后端地址，并在 Core 配置中允许 Web 站点 origin。

跨域 Core 配置示例：

```bash
NOLA_CORS_ORIGINS=https://app.example.com \
poetry run uvicorn nola.main:app --host 0.0.0.0 --port 8000
```

远程后端地址使用 `https://`。实时转写 WebSocket 地址由前端从后端地址派生为 `wss://`。

## 公开部署

- Core API 通过反向代理或托管层提供 HTTPS。
- 实时转写 WebSocket 通过 WSS 暴露。
- Core CORS allow-list 包含 Web 站点 origin。
- 公共入口配置外部认证层、网关认证或网络访问控制。

Nola Core 当前不内置 OAuth2、OIDC、API token 或多用户权限系统。

## 验收

- 打开静态站点后应用页面能加载。
- 前端路由刷新后仍返回应用页面。
- 设置页连接检查返回可用状态。
- CORS 配置错误时连接检查显示 `CORS blocked` / `CORS 阻止`。
- 未配置可用后端时，Web 静态包不执行转写任务。
