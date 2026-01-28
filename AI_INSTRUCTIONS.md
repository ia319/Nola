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
│   │   ├── models/            # Data models & Database
│   │   │   ├── database.py    # Schema & init
│   │   │   ├── files.py       # File model
│   │   │   ├── tasks.py       # Task Queue logic
│   │   │   └── utils/         # Model utilities
│   │   │       └── db.py      # SQLite version check
│   │   └── services/          # Business logic
│   └── tests/                 # Test directory
├── app/                       # Frontend GUI (TODO)
├── .pre-commit-config.yaml    # Pre-commit hooks (root level)
├── .editorconfig              # Editor config
├── .gitignore
└── AI_INSTRUCTIONS.md         # This file
```

---

## Database Conventions

> [!IMPORTANT]
> **Database Operations Must Follow:**
> 1.  **Context Managers**: Use `with sqlite3.connect(...) as conn:` to prevent leaks.
> 2.  **Atomic Updates**: Use `UPDATE ... WHERE ... RETURNING` for queue operations to avoid race conditions.
> 3.  **Poison Pill Protection**: Increment `retry_count` even when requeuing timeout/dead tasks.
> 4.  **Environment Check**: Verify `sqlite3` version >= 3.35.0 on startup.

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

## Detailed Module Overview

### core/nola/models/
Data persistence layer (SQLite):
- `database.py`: Schema initialization, connection management, and foreign key enforcement.
- `files.py`: `FileDatabase` for managing audio file metadata.
- `tasks.py`: `TaskDatabase` implementing the production-grade job queue (priority, heartbeat, retries).
- `utils/db.py`: Database utilities (e.g., `ensure_sqlite_version`).

### core/nola/engines/
Transcription engine layer:
- `Segment`: Data class for transcribed segment with timing
- `EngineConfig`: Engine initialization configuration
- `TranscribeOptions`: Full transcription options (language, beam_size, vad_filter, etc.)
- `TranscriptionEngine`: Abstract interface for transcription engines
- `FasterWhisperEngine`: Faster-Whisper implementation

### core/nola/main.py
FastAPI entry point:
- `GET /` - API info
- `GET /health` - Health check

### core/nola/core/config.py
Config management via `pydantic-settings`:
- `model_size`: Whisper model size (default "base")
- `device`: Runtime device (default "auto")
- `host/port`: Server config

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