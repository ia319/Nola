# AI Instructions - Nola Project

> This file helps AI quickly understand the project structure and status.
> Update after each development phase.

## Project Overview

| Key | Value |
|-----|-------|
| Stack | Python (FastAPI) + React (Tauri) |
| Current Phase | Phase 1.1 - Project Init |
| Last Updated | 2026-01-10 |

---

## Workflow Principles

> [!IMPORTANT]
> 1. `target/implementation_plan.md` is the master plan, keep unchanged
> 2. Create `target/phase_X_plan.md` before each Phase
> 3. Wait for user review and confirmation before execution
> 4. Explain and confirm major decisions during execution
> 5. Update this file after each phase

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
│   ├── pyproject.toml         # Poetry config
│   ├── README.md              # Backend docs
│   ├── nola/                  # Main package
│   │   ├── __init__.py        # Version info (v0.1.0)
│   │   ├── main.py            # FastAPI entry point
│   │   └── config.py          # Config management (pydantic-settings)
│   └── tests/                 # Test directory
│       ├── __init__.py
│       └── conftest.py        # pytest fixtures
├── app/                       # Frontend GUI (TODO)
├── target/                    # Project docs (git ignored, Chinese)
│   ├── ROADMAP.md             # Development roadmap
│   └── implementation_plan.md # Master plan
├── task_plan.md               # Task tracking (Chinese)
├── notes.md                   # Research notes (Chinese)
├── .gitignore
└── AI_INSTRUCTIONS.md         # This file (English)
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

---

## Key Files

### core/nola/main.py
FastAPI entry point:
- `GET /` - API info
- `GET /health` - Health check

### core/nola/config.py
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

# Run tests
poetry run pytest
```