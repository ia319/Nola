# AI Instructions - Nola Project

> This file helps AI quickly understand the project structure.

## Project Overview

| Key | Value |
|-----|-------|
| Name | Nola - Speech-to-text Software |
| Stack | Python (FastAPI) + React (Tauri) |

---

## Code Style

> [!IMPORTANT]
> **Comments must be:**
> - In English
> - Brief and objective
> - Imperative mood (e.g., "Return the config" not "Returns the config")

---

## Directory Structure

```
Nola/
├── core/                      # Python backend (Flat Layout)
│   ├── pyproject.toml         # Poetry config + ruff/mypy settings
│   ├── README.md              # Backend docs
│   ├── nola/                  # Main package
│   │   ├── __init__.py        # Version info (v0.1.0)
│   │   ├── main.py            # FastAPI entry point
│   │   ├── core/              # Config and utilities
│   │   │   └── config.py      # Settings via pydantic-settings
│   │   ├── engines/           # Transcription engines
│   │   │   ├── base.py        # Segment, EngineConfig, TranscriptionEngine
│   │   │   └── faster_whisper.py  # FasterWhisperEngine implementation
│   │   ├── services/          # Business logic
│   │   └── models/            # Pydantic schemas
│   └── tests/                 # Test directory
├── app/                       # Frontend GUI (TODO)
├── .pre-commit-config.yaml    # Pre-commit hooks (root level)
├── .editorconfig              # Editor config
├── .gitignore
└── AI_INSTRUCTIONS.md         # This file
```

---

## Dependencies

| Package | Version |
|---------|---------|
| fastapi | 0.128.0 |
| uvicorn | 0.40.0 |
| faster-whisper | 1.2.1 |
| pydantic-settings | 2.12.0 |
| Python | ^3.10 |

### Dev Dependencies

| Package | Version |
|---------|---------|
| ruff | 0.14.11 |
| mypy | 1.19.1 |
| pre-commit | 4.5.1 |
| pytest | 9.0.2 |

---

## Key Files

### core/nola/main.py
FastAPI entry point:
- `GET /` - API info
- `GET /health` - Health check

### core/nola/core/config.py
Config management via `pydantic-settings`:
- `model_size`: Whisper model size (default "base")
- `device`: Runtime device (default "auto")
- `host/port`: Server config

### core/nola/engines/
Transcription engine layer:
- `Segment`: Data class for transcribed segment with timing
- `EngineConfig`: Engine initialization configuration
- `TranscribeOptions`: Full transcription options (language, beam_size, vad_filter, etc.)
- `TranscriptionEngine`: Abstract interface for transcription engines
- `FasterWhisperEngine`: Faster-Whisper implementation

---

## Dev Commands

```bash
# Install dependencies
cd core && poetry install

# Start dev server
poetry run uvicorn nola.main:app --reload

# Run linter
poetry run ruff check .

# Run type checker
poetry run mypy nola

# Run tests
poetry run pytest
```