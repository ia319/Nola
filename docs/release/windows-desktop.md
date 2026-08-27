# Windows 桌面发布

## 发布产物

桌面发布目标为 Windows x64：

| 产物 | 路径 |
| --- | --- |
| Core one-dir sidecar | `release-artifacts/<version>/core/windows-x64/dist/nola-core/nola-core.exe` |
| NSIS 安装包 | `release-artifacts/<version>/Nola-<version>-windows-x64-setup.exe` |
| 便携包 | `release-artifacts/<version>/Nola-<version>-windows-x64-portable.zip` |

NSIS 安装包在 Tauri bundle 的 `nola-core/` 资源目录中包含 Core sidecar。便携包在 `Nola.exe` 同级的 `nola-core/` 目录中包含同一套 sidecar 文件。

Windows 安装包和便携包以未签名形式发布，Windows SmartScreen 可能显示安全提示。

便携包目录结构：

```text
Nola-<version>-windows-x64-portable/
├── Nola.exe
├── README.txt
└── nola-core/
    ├── nola-core.exe
    └── _internal/
        └── ...
```

首次运行后，便携包会在解压目录中创建 `data/`。

## 构建要求

- Windows 10/11
- Python 3.10–3.14
- Poetry 2.x
- GNU Make
- Visual Studio C++ MSVC 工具链
- Rust stable
- `x86_64-pc-windows-msvc` target
- Node.js 20.19+、22.13+ 或 24+
- pnpm 10+
- WebView2 Runtime，用于本地运行和验收
- Tauri NSIS 缓存目录：`%LOCALAPPDATA%\tauri\NSIS`

首次构建先安装前端、Core 和 PyInstaller 构建依赖：

```bash
make install
make release-install-core-build
```

## 构建流程

构建一套 Windows 发布产物：

```bash
make release-check-version
make release-clean
make release-build-core-windows
make release-package-windows-setup
make release-package-windows-portable
```

`release-clean` 重建 `release-artifacts/<version>/`。每套发布产物在开始构建时执行一次；打包脚本检测到同名目标文件时会终止构建。

`release-package-windows-setup` 构建 Tauri 应用并注入 Core sidecar。随后执行的便携包脚本复用同一个 `nola_desktop.exe`。

单独构建便携包时，先生成 Tauri 可执行文件：

```bash
make release-check-version
make release-clean
make release-build-core-windows
make desktop-build-windows
make release-package-windows-portable
```

## NSIS 工具

- Tauri bundler 在首次 NSIS 构建时下载工具到 `%LOCALAPPDATA%\tauri\NSIS`。
- GitHub Actions 缓存 Tauri 下载的 Windows 工具。
- 离线构建使用预热后的 Tauri 工具缓存。
- NSIS 二进制文件保留在 Tauri 用户缓存中，位于源码和发布附件之外。

## 连接行为

桌面客户端按照以下优先级选择 Core：

1. 桌面进程参数 `--backend-url`。
2. 用户保存的远程后端或外部本地后端配置。
3. 桌面内置 Core sidecar。
4. 默认外部本地后端 `http://127.0.0.1:8000`。

开发调试可通过桌面进程参数 `--core-sidecar <path>` 或环境变量 `NOLA_DESKTOP_CORE_SIDECAR_PATH` 指定 `nola-core.exe`。

远程后端配置见 [app/README.md](../../app/README.md)。

## Core sidecar 行为

`nola-core` 提供两个运行入口：

```bash
nola-core api --host 127.0.0.1 --port 8000
nola-core worker
```

桌面托管模式：

- API 和 Worker 使用同一 `--data-dir`。
- API 和 Worker 使用同一 `--model-dir`。
- 桌面进程为 API 分配动态 loopback 端口，并轮询 `/health`。
- `/health` 返回的 Core 版本必须匹配桌面版本。
- API 启动失败时停止已启动的 Core 子进程。
- Worker 启动失败时 API 保持可用，运行状态返回 `workerStatus: "failed"`。
- 桌面退出时停止 Worker，再停止 API。

## 环境变量规则

独立后端运行：

- `nola-core api` 和 `nola-core worker` 默认遵循 `NOLA_*` 环境变量。
- 传入 `--ignore-system-env` 后忽略受控的 `NOLA_*` 环境变量。

桌面托管运行：

- 桌面进程启动 Core sidecar 时传入 `--ignore-system-env`。
- 桌面进程显式传入 `--data-dir`、`--model-dir`、`--host`、`--port` 和 `--cors-origins`。
- 桌面进程对子进程移除 `NOLA_COMPUTE_TYPE`、`NOLA_CORS_ORIGINS`、`NOLA_DATA_DIR`、`NOLA_DEVICE`、`NOLA_HOST`、`NOLA_LIVE_REALTIME_TRANSCRIBER`、`NOLA_MAX_FILE_SIZE`、`NOLA_MODEL_DIR`、`NOLA_MODEL_SIZE` 和 `NOLA_PORT`。
- 桌面托管目录和网络参数由桌面进程参数确定；模型和转录业务参数由应用内保存配置与 Core 源码默认值确定。

## 数据和日志目录

桌面托管目录根据 Core sidecar 的位置解析。NSIS 安装包和便携包中的 Core sidecar 均位于 `Nola.exe` 同级的 `nola-core/`。

- Core sidecar 目录：`Nola.exe` 同级的 `nola-core/`。
- 随包提供的 Core sidecar 位于上述目录时，优先使用 `Nola.exe` 同级的 `data/`。
- `data/`、`data/models/` 或 `data/logs/` 无法创建或写入时，回退至 Tauri 用户数据目录下的 `core/`。
- 通过 `--core-sidecar` 或 `NOLA_DESKTOP_CORE_SIDECAR_PATH` 指定其他位置的 sidecar 时，使用 Tauri 用户数据目录下的 `core/`。

选定数据目录后：

- 模型目录：数据目录下的 `models/`。
- 日志目录：数据目录下的 `logs/`。
- API 日志：`api.stdout.log` 和 `api.stderr.log`。
- Worker 日志：`worker.stdout.log` 和 `worker.stderr.log`。

桌面连接配置 `connection-config.json` 始终存储在 Tauri 用户配置目录，与 Core 数据目录分开管理。

## 本地验收

使用未保存 Nola 连接设置的 Windows 测试账户执行以下验收。若测试账户已保存 Nola 连接设置，先在 `设置 > 连接` 中重置连接设置，避免远程或外部本地后端优先于随包提供的 Core sidecar。

1. 运行 `nola-core.exe --help`、`nola-core.exe api --help` 和 `nola-core.exe worker --help`，确认三个 CLI 入口可用。
2. 解压 `release-artifacts/<version>/Nola-<version>-windows-x64-portable.zip` 到源码目录之外。
3. 运行 `Nola.exe`，使用以下命令确认 API 和 Worker 从同级 `nola-core/nola-core.exe` 启动：

   ```powershell
   Get-CimInstance Win32_Process -Filter "Name = 'nola-core.exe'" |
     Select-Object ProcessId, ExecutablePath, CommandLine
   ```

4. 确认数据、模型和日志默认写入解压目录下的 `data/`、`data/models/` 和 `data/logs/`。
5. 下载一个模型并等待完成，随后执行文件转写和字幕导出。
6. 验证麦克风和系统音频设备枚举，并完成一次实时转写。
7. 重新启动 Nola，确认模型、连接配置和历史记录保持可用。
8. 在便携目录缺少写权限时，确认数据目录回退至 Tauri 用户数据目录下的 `core/`。
9. 退出 Nola，确认 API 和 Worker 进程均已结束。
10. 移动整个可写的解压目录后再次启动，确认 Core 数据和模型缓存随目录移动。

NSIS 安装包应在一次性 Windows 虚拟机或可还原快照中完成安装、启动、升级和卸载验收。

运行异常时检查 `data/logs/api.stderr.log` 和 `data/logs/worker.stderr.log`。数据目录回退后，从运行状态返回的 `logDir` 定位日志。
