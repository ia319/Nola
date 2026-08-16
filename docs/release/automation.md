# 发布自动化

## 工作流职责

| 文件 | 职责 |
| --- | --- |
| [ci.yml](../../.github/workflows/ci.yml) | 运行 App、Core 和桌面质量检查，随后运行测试、OpenAPI 类型漂移检查和 Windows 桌面构建 |
| [release.yml](../../.github/workflows/release.yml) | 校验版本，构建 Windows 与 Web 附件，生成校验和，并创建或更新草稿 GitHub Release |
| [docker.yml](../../.github/workflows/docker.yml) | 构建 Core 多架构镜像，并在 GitHub Release 发布后推送到 GHCR |

发布工作流将写权限限制在发布 job：GitHub Release 使用 `contents: write`，GHCR 使用 `packages: write`。两个工作流均使用仓库提供的 `GITHUB_TOKEN`。

## PR 发布演练

为修改 `.github/workflows/ci.yml`、`.github/workflows/release.yml`、`.github/actions/**`、`scripts/release/**`、Tauri 打包文件或发布依赖清单的 PR 添加 `release-dry-run` 标签。

发布演练按照以下顺序运行：

1. 等待同一提交的 `Checks and Tests` 工作流成功完成。
2. 校验工作区版本一致性。
3. 并行构建 Windows 安装包、Windows 便携包和 Web 静态包。
4. 汇总附件并生成 SHA-256 校验和。
5. 校验附件名称、数量和校验和内容。
6. 上传保留 14 天的 Actions artifact `release-assets-<version>`。

PR 发布演练的终点是 Actions artifact，发布权限保持关闭。移除 `release-dry-run` 标签后，后续 PR 提交仅运行常规检查和测试。

`stage-release-assets` job 在包含三个最终包的独立暂存目录中生成校验和。本地 Windows 暂存目录同时保留 Core sidecar 中间产物，供打包排查和产物验收使用。

## Tag 发布流程

版本 tag 是 GitHub Release 和 GHCR 镜像的源码基准。创建 tag 前完成以下检查：

以下命令以版本 `0.2.0` 为例。

1. 将版本号写入所有版本源：

   ```bash
   make release-set-version VERSION=0.2.0
   make release-check-version
   ```

2. 合并版本改动，并确认 `main` 上的 `Checks and Tests` 工作流成功。
3. 按照 [Windows 桌面发布](./windows-desktop.md) 完成本地 Windows 构建和产物验收。
4. 在同一暂存目录运行 `make release-package-web`，并按照 [Web 静态部署](../deploy/web.md) 验证 Web 静态包。
5. 在已验证的 `main` 提交上创建并推送 tag：

   ```powershell
   $Version = "0.2.0"
   git tag -a "v$Version" -m "Nola $Version"
   git push origin "v$Version"
   ```

推送 `v<version>` tag 后，`release.yml` 校验 tag 与项目版本的一致性，构建发布附件，并创建草稿 GitHub Release。草稿包含自动生成的变更说明和以下附件：

```text
Nola-<version>-windows-x64-setup.exe
Nola-<version>-windows-x64-portable.zip
Nola-<version>-web.zip
Nola-<version>-checksums.sha256
```

检查草稿附件并完成手动验收后，在 GitHub Releases 页面发布草稿。`release` 的 `published` 事件随后触发 `docker.yml`，为 `linux/amd64` 和 `linux/arm64` 推送 Core 镜像。

## 手动运行模式

`Release` 工作流提供两种 `workflow_dispatch` 模式：

- `dry-run`：从所选 ref 构建和校验 Actions artifact。
- `draft-release`：从已有 SemVer tag 构建附件并创建或更新草稿 Release。

`Publish Docker Images` 工作流提供两种 `workflow_dispatch` 模式：

- `dry-run`：从所选 ref 或指定 tag 构建多架构镜像并验证 Dockerfile。
- `publish`：从已有 SemVer tag 推送 GHCR 镜像。

`draft-release` 和 Docker `publish` 模式均要求已有的 `v<version>` tag。Docker 版本格式为 `v<major>.<minor>.<patch>[-prerelease]`。

## Actions Artifact 与 Release 附件

- Actions artifact 用于 job 之间传递产物和下载 PR 演练结果，保留期为 14 天。
- GitHub Release 附件由草稿 Release 持久保存，并面向版本使用者分发。
- GitHub 根据 Release tag 自动提供源码 zip 和 tar.gz。

针对同一 tag 重新运行 `draft-release` 时，工作流先确认现有 Release 仍为草稿，再替换其中的附件。已发布 Release 会使该工作流终止，避免自动改写正式发布内容。
