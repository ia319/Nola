<div align="center">

# Nola

[English](./README.md) · [简体中文](./README.zh-CN.md)

Local-first speech transcription and subtitle processing application

FastAPI, React, SQLite, Faster-Whisper, WhisperStreaming, and Tauri stack; offline file transcription, realtime audio transcription, model management, task history, and subtitle export.

<img src="./docs/media/nola-app-en.png" alt="Nola application screenshot" width="920" />

[Transcription flow demo](./docs/media/nola-task-transcription-flow.gif)

</div>

## Core Features

- File transcription: audio/video upload, task creation, progress tracking, cancellation, retry, record deletion
- Batch processing: multi-file queue, batch task actions, batch subtitle export
- Realtime transcription: microphone input, system audio input, WebSocket audio stream, realtime text output
- Model management: model list, model download, download progress, cache state, default model selection, model deletion
- History management: transcription tasks, uploaded files, realtime session records
- Subtitle export: SRT, VTT, TXT, ASS, single-item export, batch ZIP export
- Configuration: transcription defaults, realtime transcription defaults, export defaults, model storage settings
- Desktop support: Tauri desktop client, Windows audio device enumeration, WASAPI audio capture

## Technical Details

### Transcription Engine

Current offline transcription engine: Faster-Whisper.

Runtime management: unified model registry, model cache, task runtime configuration.
Frontend model page: download state, cache state, default model selection.
Extension boundary: future local or remote transcription backend integration.

### Model Registry

Current model registry: three Faster-Whisper model families.

- Multilingual models: Tiny, Base, Small, Medium, Large V1, Large V2, Large V3, Large V3 Turbo
- English-only models: Tiny English, Base English, Small English, Medium English
- Distil Whisper models: Distil Small English, Distil Medium English, Distil Large V2, Distil Large V3, Distil Large V3.5

Model management page: download state, cache state, download progress, default model selection, cache deletion.

### Realtime Transcription

Realtime transcription runtime: WhisperStreaming LocalAgreement behavior.
Audio transport: 16 kHz mono PCM16LE frames; WebSocket JSON metadata and binary audio payloads.

Result event classes:

- `preview`: current hypothesis text
- `committed_partial`: LocalAgreement stable text
- `final`: final segment in realtime session history

### WhisperStreaming Adapter

Nola realtime module scope: algorithm state, buffer trimming, duplicate text suppression, segment commit, final-result persistence boundaries for local transcription.

Upstream exclusions: WhisperStreaming CLI, TCP server, automatic model download, OpenAI API, MLX, `whisper_timestamped`.

Full module details: [`core/nola/application/live/realtime/whisper_streaming/README.md`](core/nola/application/live/realtime/whisper_streaming/README.md).

### Current Limits

- Maximum file size: 500 MB
- Upload formats: mp3, wav, flac, m4a, ogg, webm, aac, mp4, wma
- Export formats: srt, vtt, txt, ass
- Single batch task request limit: 500 task IDs
- Single batch file request limit: 500 file IDs
- Default backend address: `127.0.0.1:8000`
- Frontend development address: `localhost:5173`

## Quick Startup

Prerequisites: `Requirements` section.

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
```

## Requirements

- Python 3.10+
- Poetry 2.x
- Node.js 20.19+, 22.13+, or 24+
- pnpm 10+
- Rust stable
- Windows 10/11 for desktop audio capture and Windows installer builds
- CPU inference: no CUDA
- NVIDIA GPU inference: CUDA 12.x, cuBLAS for CUDA 12, and cuDNN 9 for CUDA 12

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

## Related Documentation

- `app/README.md`: frontend, desktop client, realtime audio client
- `core/README.md`: backend API, worker, models, data, tests
- `app/AI_INSTRUCTIONS.md`: frontend workspace structure, modules, command reference
- `core/AI_INSTRUCTIONS.md`: backend workspace structure, modules, API reference
