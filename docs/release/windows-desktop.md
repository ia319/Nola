# Windows 桌面发布

## 当前状态

- 当前可构建 Windows Tauri NSIS 安装包。
- 当前可构建 Windows Core one-dir sidecar。
- 当前桌面运行时已具备 Core sidecar 启动管理器。
- 当前 Windows 便携包将 Core sidecar 放在桌面 exe 同级的 `nola-core/` 目录。
- 当前 Tauri 安装包资源目录尚未包含 Core sidecar。
- 当前桌面音频采集支持 Windows 10/11。
- 当前未配置 Windows 代码签名。

## 构建命令

Core sidecar：

```bash
make release-build-core-windows
```

当前输出路径：

```text
release-artifacts/0.1.0/core/windows-x64/dist/nola-core/nola-core.exe
```

桌面安装包：

```bash
make desktop-build-windows
```

当前输出路径：

```text
app/src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/Nola_0.1.0_x64-setup.exe
```

Release 目标文件名：

```text
Nola-0.1.0-windows-x64-setup.exe
```

Windows 便携包：

```bash
make release-build-core-windows
make desktop-build-windows
make release-package-windows-portable
```

Release 目标文件名：

```text
Nola-0.1.0-windows-x64-portable.zip
```

便携包目录结构：

```text
Nola-0.1.0-windows-x64-portable/
├── Nola.exe
├── README.txt
└── nola-core/
    └── nola-core.exe
```

## 构建环境

- Windows 10/11
- WebView2 Runtime
- Visual Studio C++ MSVC 工具链
- Rust stable
- `x86_64-pc-windows-msvc` target
- Node.js 20.19+、22.13+ 或 24+
- pnpm 10+
- Tauri NSIS 缓存目录：`%LOCALAPPDATA%\tauri\NSIS`

## NSIS 缓存

- Tauri bundler 管理 NSIS 工具。
- 本地首次构建允许联网拉取。
- CI 恢复和保存 `%LOCALAPPDATA%\tauri\NSIS`。
- 离线发布前预热 `%LOCALAPPDATA%\tauri\NSIS`。
- 仓库不提交 NSIS 二进制文件。

## 当前连接行为

启动优先级：

1. 桌面进程参数 `--backend-url`。
2. 用户保存的远程后端或外部本地后端配置。
3. 桌面内置 Core sidecar。
4. 默认外部本地后端 `http://127.0.0.1:8000`。

开发调试可通过桌面进程参数 `--core-sidecar <path>` 或环境变量 `NOLA_DESKTOP_CORE_SIDECAR_PATH` 指向 `nola-core.exe`。

远程后端配置见 [app/README.md](../../app/README.md)。

## Core sidecar 行为

`nola-core` 统一入口：

```bash
nola-core api --host 127.0.0.1 --port 8000
nola-core worker
```

桌面托管模式：

- API 和 Worker 使用同一 `--data-dir`。
- API 和 Worker 使用同一 `--model-dir`。
- API 启动后轮询 `/health`，版本必须匹配桌面版本。
- API 启动失败时停止已启动的 Core 子进程。
- Worker 启动失败时 API 保持可用，运行状态返回 Worker failed。
- 桌面退出时停止 Worker，再停止 API。

## 环境变量规则

独立后端运行：

- `nola-core api` 和 `nola-core worker` 默认遵循 `NOLA_*` 环境变量。
- 传入 `--ignore-system-env` 后忽略受控的 `NOLA_*` 环境变量。

桌面托管运行：

- 桌面进程启动 Core sidecar 时传入 `--ignore-system-env`。
- 桌面进程显式传入 `--data-dir`、`--model-dir`、`--host`、`--port` 和 `--cors-origins`。
- 桌面进程对子进程移除 `NOLA_COMPUTE_TYPE`、`NOLA_CORS_ORIGINS`、`NOLA_DATA_DIR`、`NOLA_DEVICE`、`NOLA_HOST`、`NOLA_LIVE_REALTIME_TRANSCRIBER`、`NOLA_MAX_FILE_SIZE`、`NOLA_MODEL_DIR`、`NOLA_MODEL_SIZE` 和 `NOLA_PORT`。
- 系统全局 `NOLA_*` 不会覆盖桌面托管目录、端口、模型默认值、设备默认值、计算类型默认值或文件大小上限。
- 未显式传入的模型和转录业务默认值来自 Core 源码默认值和应用内保存配置。

## 数据和日志目录

安装版桌面托管运行：

- 数据目录：Tauri 用户数据目录下的 `core/`。
- 模型目录：Tauri 用户数据目录下的 `core/models/`。
- 日志目录：Tauri 用户数据目录下的 `core/logs/`。
- API 日志：`api.stdout.log` 和 `api.stderr.log`。
- Worker 日志：`worker.stdout.log` 和 `worker.stderr.log`。

便携版桌面托管运行：

- Core sidecar 目录：`Nola.exe` 同级的 `nola-core/`。
- 数据目录：便携目录下的 `data/`。
- 模型目录：便携目录下的 `data/models/`。
- 日志目录：便携目录下的 `data/logs/`。
- 便携目录不可写时回退到 Tauri 用户数据目录下的 `core/`。

## 本地验证结果

- `make release-build-core-windows` 生成 one-dir sidecar。
- `make release-package-windows-portable` 生成 Windows 便携 zip。
- `nola-core.exe --help`、`nola-core.exe api --help` 和 `nola-core.exe worker --help` 可运行。
- `nola-core.exe api --ignore-system-env ...` 的 `/health` 返回 `{"status":"ok","version":"0.1.0"}`。
- `nola-core.exe worker --ignore-system-env ...` 可启动并保持运行。
- smoke test 停止后无残留 `nola-core` 进程。

## 便携包手动验收

- 解压 `release-artifacts/0.1.0/Nola-0.1.0-windows-x64-portable.zip` 到非源码目录。
- 运行 `Nola.exe`。
- 验证 Core sidecar 从同级 `nola-core/nola-core.exe` 启动。
- 验证数据目录、模型目录和日志目录默认位于解压目录下的 `data/`。
- 验证便携目录不可写时回退到 Tauri 用户数据目录。
- 退出 Nola 后确认没有残留 `nola-core` 进程。
- 移动解压目录后再次启动。
- 记录 Windows SmartScreen 提示，当前便携包未签名。
