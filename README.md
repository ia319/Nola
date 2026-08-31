<div align="center">

# Nola

[English](./README.md) · [简体中文](./README.zh-CN.md)

Local-first speech transcription and subtitle processing application

FastAPI, React, SQLite, Faster-Whisper, WhisperStreaming, and Tauri stack; offline file transcription, realtime audio transcription, model management, task history, and subtitle export.

<img src="./docs/media/nola-app-en.png" alt="Nola application screenshot" width="920" />

[Transcription flow demo](./docs/media/nola-task-transcription-flow.gif)

[Client and desktop docs](./app/README.md) · [Backend docs](./core/README.md) · [Release and deployment docs](./docs/README.en.md)

</div>

## Core Features

- File transcription: audio/video upload, task creation, progress tracking, cancellation, retry, record deletion
- Batch processing: multi-file queue, batch task actions, batch subtitle export
- Realtime transcription: microphone input, system audio input, WebSocket audio stream, realtime text output
- Model management: model list, model download, download progress, cache state, default model selection, model deletion
- History management: transcription tasks, uploaded files, realtime session records
- Subtitle export: SRT, VTT, TXT, ASS, single-item export, batch ZIP export
- Configuration: backend connection target, transcription defaults, realtime transcription defaults, export defaults, model storage settings
- Windows desktop support: Tauri desktop client, Windows audio device enumeration, WASAPI audio capture, remote backend connection

## Platform Support

| Platform | Web Client | Desktop Client | Realtime Audio |
| --- | --- | --- | --- |
| Windows 10/11 | Available; browser capabilities apply | Supported; Windows x64 installer and portable package | Native microphone and system audio capture through WASAPI |
| macOS | Available; browser capabilities apply | No official desktop package | Browser capture only; native desktop capture is not implemented |
| Linux | Available; browser capabilities apply | Experimental source code; the Rust shell is compiled and tested in Ubuntu CI, with no official package or real-device validation | Browser capture only; native desktop capture is not implemented |

Linux Core delivery is separate from Linux desktop support. Nola publishes Core Docker images for `linux/amd64` and `linux/arm64`.

## Downloads

[GitHub Releases](https://github.com/ia319/Nola/releases) provides the Windows x64 NSIS installer, Windows x64 portable package, Web static package, and SHA-256 checksums.

- Windows installer: download `Nola-<version>-windows-x64-setup.exe` and run the installer.
- Windows portable package: extract `Nola-<version>-windows-x64-portable.zip`, then run `Nola.exe`.
- Web deployment: deploy `Nola-<version>-web.zip` with a Core API and Worker by following the [Web deployment guide](./docs/deploy/web.en.md).
- macOS and Linux: use the Web client or the source development setup below. Official macOS and Linux desktop packages are not published.

Windows desktop packages are unsigned, so Windows SmartScreen may display a warning. Verify downloaded files with `Nola-<version>-checksums.sha256` before running them.

## First Use

1. Start the Windows desktop application, or start the Core API, Worker, and Web client.
2. Open model management, download a model, and select the default model.
3. Upload an audio or video file, create a transcription task, and wait for processing to finish.
4. Review the result in history and export subtitles as SRT, VTT, TXT, or ASS.
5. For realtime transcription, select a microphone or system-audio source. Native desktop capture requires Windows 10/11; Web capture depends on browser and operating-system capabilities.

## Development Requirements

- Python 3.10+
- Poetry 2.x
- GNU Make
- Node.js 20.19+, 22.13+, or 24+
- pnpm 10+
- Rust stable
- Windows 10/11 for desktop audio capture and Windows installer builds
- CPU inference: no CUDA
- NVIDIA GPU inference: CUDA 12.x, cuBLAS for CUDA 12, and cuDNN 9 for CUDA 12

## Development Quick Start

Run long-lived services in separate terminals.

```bash
# Backend and frontend dependency installation
make install
```

```bash
# FastAPI backend service startup
make api
```

```text
API address: http://127.0.0.1:8000
API docs: http://127.0.0.1:8000/docs
```

```bash
# Background transcription worker startup
make worker
```

```bash
# Web frontend development server startup
make app-dev
```

```text
Frontend address: http://localhost:5173
```

```bash
# Tauri desktop development client startup
make desktop-dev
```

```text
Default desktop backend: http://127.0.0.1:8000
Remote backend setup: app/README.md
```

## Running Modes

- Local Web: backend API, Worker, and Web frontend on one development machine
- Windows Local Desktop: Tauri desktop client with local backend
- Windows Desktop With Remote Backend: local desktop audio capture with configured remote backend
- Backend Deployment: API service and Worker processes for Web or desktop clients

## Current Limits

- Maximum file size: 500 MB
- Upload formats: mp3, wav, flac, m4a, ogg, webm, aac, mp4, wma
- Export formats: srt, vtt, txt, ass
- Official desktop release: Windows x64
- Desktop audio capture: Windows 10/11
- Remote/public deployment boundary: trusted network or external authentication layer required

## Project Shape

Backend and client workspaces:

- `core/`: FastAPI API, transcription worker, SQLite data, model cache, realtime transcription runtime
- `app/`: React Web frontend, Tauri desktop client, realtime audio capture UI

Root README: short project overview. Detailed client and backend docs: `app/README.md` and `core/README.md`.

## Development Commands

```bash
# Frontend, backend, and desktop lint checks
make lint

# TypeScript and Mypy type checks
make typecheck

# Frontend, backend, and desktop tests
make test

# Full local quality check
make check

# Frontend type generation from backend OpenAPI schema
make app-gen-types

# Windows desktop installer build
make desktop-build-windows
```

## Documentation

- `docs/README.en.md`: release automation, release artifacts, Windows packaging, Docker, and Web deployment
- `app/README.md`: client workspace setup, desktop client, connection settings
- `core/README.md`: backend workspace setup, API, worker, deployment settings
- `app/AI_INSTRUCTIONS.md`: frontend workspace structure, modules, command reference
- `core/AI_INSTRUCTIONS.md`: backend workspace structure, modules, API reference

## License

MIT License: [LICENSE](./LICENSE)
