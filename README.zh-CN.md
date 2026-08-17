<div align="center">

# Nola

[English](./README.md) · [简体中文](./README.zh-CN.md)

本地优先的语音转写与字幕处理应用

FastAPI、React、SQLite、Faster-Whisper、WhisperStreaming、Tauri 技术栈；离线文件转写、实时音频转写、模型管理、任务历史、字幕导出。

<img src="./docs/media/nola-app-zh.png" alt="Nola 应用界面截图" width="920" />

[转录流程演示](./docs/media/nola-task-transcription-flow.gif)

[客户端与桌面文档](./app/README.md) · [后端文档](./core/README.md) · [发布与部署文档](./docs/README.md)

</div>

## 核心能力

- 文件转写：音频/视频上传、任务创建、进度跟踪、取消、重试、记录删除
- 批量处理：多文件队列、批量任务操作、批量字幕导出
- 实时转写：麦克风输入、系统音频输入、WebSocket 音频流、实时文本输出
- 模型管理：模型列表、模型下载、下载进度、缓存状态、默认模型选择、模型删除
- 历史管理：转写任务、上传文件、实时会话记录
- 字幕导出：SRT、VTT、TXT、ASS、单项导出、批量 ZIP 导出
- 配置管理：后端连接目标、转写默认值、实时转写默认值、导出默认值、模型存储设置
- 桌面能力：Tauri 桌面客户端、Windows 音频设备枚举、WASAPI 音频采集、远程后端连接

## 环境要求

- Python 3.10+
- Poetry 2.x
- GNU Make
- Node.js 20.19+、22.13+ 或 24+
- pnpm 10+
- Rust stable
- Windows 10/11（桌面音频采集与 Windows 安装包构建）
- CPU 推理：无需 CUDA
- NVIDIA GPU 推理：CUDA 12.x、cuBLAS for CUDA 12、cuDNN 9 for CUDA 12

## 快速开始

在不同终端中运行长驻服务。

```bash
# 后端与前端依赖安装
make install
```

```bash
# FastAPI 后端服务启动
make api
```

```text
API 地址：http://127.0.0.1:8000
API 文档：http://127.0.0.1:8000/docs
```

```bash
# 后台转写 Worker 启动
make worker
```

```bash
# Web 前端开发服务启动
make app-dev
```

```text
前端地址：http://localhost:5173
```

```bash
# Tauri 桌面开发客户端启动
make desktop-dev
```

```text
桌面客户端默认后端：http://127.0.0.1:8000
远程后端配置：app/README.md
```

## 运行模式

- 本地 Web：同一开发机器上的后端 API、Worker 与 Web 前端
- 本地桌面：Tauri 桌面客户端与本机后端
- 桌面连接远程后端：本机桌面音频采集与已配置远程后端
- 后端独立部署：面向 Web 或桌面客户端的 API 服务与 Worker 进程

## 当前限制

- 单文件大小上限：500 MB
- 上传格式：mp3, wav, flac, m4a, ogg, webm, aac, mp4, wma
- 导出格式：srt, vtt, txt, ass
- 桌面音频采集：Windows 10/11
- 远程/公网部署边界：可信网络或外部认证层必需

## 项目形态

后端与客户端工作区：

- `core/`：FastAPI API、转写 Worker、SQLite 数据、模型缓存、实时转写运行时
- `app/`：React Web 前端、Tauri 桌面客户端、实时音频采集界面

根 README：项目总览。客户端与后端细节：`app/README.md` 与 `core/README.md`。

## 开发命令

```bash
# 前端、后端、桌面 lint 检查
make lint

# TypeScript 与 Mypy 类型检查
make typecheck

# 前端、后端、桌面测试
make test

# 本地完整质量检查
make check

# 后端 OpenAPI schema 对应的前端类型生成
make app-gen-types

# Windows 桌面安装包构建
make desktop-build-windows
```

## 文档

- `docs/README.md`：发布自动化、发布附件、Windows 打包、Docker 与 Web 部署
- `app/README.md`：客户端工作区、桌面客户端、连接配置
- `core/README.md`：后端工作区、API、Worker、部署配置
- `app/AI_INSTRUCTIONS.md`：前端工作区结构、模块与命令说明
- `core/AI_INSTRUCTIONS.md`：后端工作区结构、模块与 API 说明

## License

MIT License：[LICENSE](./LICENSE)
