# Nola 文档

## 发布与部署

- 发布自动化：[release/automation.md](./release/automation.md)
- Windows 桌面发布：[release/windows-desktop.md](./release/windows-desktop.md)
- Core Docker 部署：[deploy/core-docker.md](./deploy/core-docker.md)
- Web 静态部署：[deploy/web.md](./deploy/web.md)

## 交付渠道

| 渠道 | 交付内容 |
| --- | --- |
| GitHub Releases | Windows x64 NSIS 安装包、Windows x64 便携 zip、Web 静态 zip、SHA-256 校验和；GitHub 根据版本 tag 提供源码 zip 和 tar.gz |
| GHCR | `linux/amd64`、`linux/arm64` Core Docker 镜像 |

发布附件使用以下文件名：

```text
Nola-<version>-windows-x64-setup.exe
Nola-<version>-windows-x64-portable.zip
Nola-<version>-web.zip
Nola-<version>-checksums.sha256
```

下载发布附件后，使用 `Nola-<version>-checksums.sha256` 核对文件的 SHA-256 值。

## 开发参考

- 前端、桌面壳、连接配置：[../app/README.md](../app/README.md)
- 后端 API、Worker、配置项：[../core/README.md](../core/README.md)
- 前端 AI 指令：[../app/AI_INSTRUCTIONS.md](../app/AI_INSTRUCTIONS.md)
- 后端 AI 指令：[../core/AI_INSTRUCTIONS.md](../core/AI_INSTRUCTIONS.md)
