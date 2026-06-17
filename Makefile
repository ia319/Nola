.DEFAULT_GOAL := help

.PHONY: help setup install \
	core-lint core-lint-fix core-format core-format-check core-typecheck core-test core-check \
	app-dev app-preview app-lint app-lint-fix app-format app-format-check app-typecheck app-test app-test-watch app-test-ci app-build app-storybook app-storybook-build app-gen-types app-gen-types-check app-check \
	desktop-info desktop-dev desktop-build desktop-build-windows desktop-format desktop-format-check desktop-lint desktop-test desktop-check \
	release-set-version release-check-version release-clean release-build-core-windows release-checksums \
	lint lint-fix format format-check typecheck test test-ci build check \
	api worker dev clean

help:
	@echo "Nola command targets"
	@echo ""
	@echo "Setup:"
	@echo "  make install              Install core and app dependencies"
	@echo "  make setup                Install dependencies and pre-commit hook"
	@echo ""
	@echo "Core:"
	@echo "  make core-lint            Run Ruff lint"
	@echo "  make core-lint-fix        Run Ruff lint fixes"
	@echo "  make core-format          Format core code"
	@echo "  make core-format-check    Check core formatting"
	@echo "  make core-typecheck       Run mypy"
	@echo "  make core-test            Run pytest"
	@echo "  make core-check           Run all core checks"
	@echo ""
	@echo "App:"
	@echo "  make app-dev              Start Vite dev server"
	@echo "  make app-preview          Start Vite preview server"
	@echo "  make app-lint             Run ESLint"
	@echo "  make app-lint-fix         Run ESLint fixes"
	@echo "  make app-format           Format app files"
	@echo "  make app-format-check     Check app formatting"
	@echo "  make app-typecheck        Run TypeScript check"
	@echo "  make app-test             Run Vitest"
	@echo "  make app-test-watch       Run Vitest watch mode"
	@echo "  make app-test-ci          Run Vitest CI mode"
	@echo "  make app-build            Build app bundle"
	@echo "  make app-storybook        Start Storybook"
	@echo "  make app-storybook-build  Build Storybook"
	@echo "  make app-gen-types        Generate OpenAPI types"
	@echo "  make app-gen-types-check  Check generated OpenAPI drift"
	@echo "  make app-check            Run app quality checks"
	@echo ""
	@echo "Desktop:"
	@echo "  make desktop-info         Show Tauri environment info"
	@echo "  make desktop-dev          Start Tauri dev shell"
	@echo "  make desktop-build        Build current-platform Tauri bundle"
	@echo "  make desktop-build-windows  Build Windows Tauri bundle"
	@echo "  make desktop-format       Format desktop Rust code"
	@echo "  make desktop-format-check Check desktop Rust formatting"
	@echo "  make desktop-lint         Run desktop Rust Clippy"
	@echo "  make desktop-test         Run desktop Rust tests"
	@echo "  make desktop-check        Run desktop Rust checks"
	@echo ""
	@echo "Release:"
	@echo "  make release-set-version VERSION=x.y.z  Update all project version files"
	@echo "  make release-check-version  Check release version consistency"
	@echo "  make release-clean        Rebuild release artifact staging directory"
	@echo "  make release-build-core-windows  Build Windows core sidecar"
	@echo "  make release-checksums    Generate SHA256 checksums for staged artifacts"
	@echo ""
	@echo "Unified:"
	@echo "  make lint                 Run lint checks"
	@echo "  make lint-fix             Run lint fixes"
	@echo "  make format               Format code"
	@echo "  make format-check         Check formatting"
	@echo "  make typecheck            Run type checks"
	@echo "  make test                 Run tests"
	@echo "  make test-ci              Run CI-style tests"
	@echo "  make build                Build app bundle"
	@echo "  make check                Run all local checks"
	@echo ""
	@echo "Runtime:"
	@echo "  make api                  Start FastAPI dev server"
	@echo "  make worker               Start transcription worker"
	@echo "  make dev                  Start FastAPI dev server"
	@echo ""
	@echo "Maintenance:"
	@echo "  make clean CONFIRM=1      Remove cache directories"

# Setup development environment
setup: install
	poetry -C core run pre-commit install

# Install dependencies
install:
	poetry -C core install
	pnpm --dir app install

# Backend quality commands
core-lint:
	poetry -C core run ruff check nola tests

core-lint-fix:
	poetry -C core run ruff check nola tests --fix

core-format:
	poetry -C core run ruff format nola tests

core-format-check:
	poetry -C core run ruff format --check nola tests

core-typecheck:
	poetry -C core run mypy nola

core-test:
	poetry -C core run pytest tests -v --tb=short

core-check: core-lint core-format-check core-typecheck core-test

# Frontend quality and runtime commands
app-dev:
	pnpm --dir app dev

app-preview:
	pnpm --dir app preview

app-lint:
	pnpm --dir app lint

app-lint-fix:
	pnpm --dir app lint:fix

app-format:
	pnpm --dir app format

app-format-check:
	pnpm --dir app format:check

app-typecheck:
	pnpm --dir app typecheck

app-test:
	pnpm --dir app test

app-test-watch:
	pnpm --dir app test:watch

app-test-ci:
	pnpm --dir app test:ci

app-build:
	pnpm --dir app build

app-storybook:
	pnpm --dir app storybook

app-storybook-build:
	pnpm --dir app build-storybook

app-gen-types:
	pnpm --dir app gen:types

app-gen-types-check:
	pnpm --dir app gen:types:check

app-check:
	pnpm --dir app check

# Desktop quality and runtime commands
desktop-info:
	pnpm --dir app tauri:info

desktop-dev:
	pnpm --dir app tauri:dev

desktop-build:
	pnpm --dir app tauri:build

desktop-build-windows:
	pnpm --dir app desktop:build:windows

desktop-format:
	pnpm --dir app desktop:format

desktop-format-check:
	pnpm --dir app desktop:format:check

desktop-lint:
	pnpm --dir app desktop:lint

desktop-test:
	pnpm --dir app desktop:test

desktop-check:
	pnpm --dir app desktop:check

# Release commands
release-set-version:
ifndef VERSION
	$(error VERSION is required. Usage: make release-set-version VERSION=0.1.0)
endif
	node scripts/release/set-version.mjs $(VERSION)

release-check-version:
	node scripts/release/check-version.mjs

release-clean:
	node scripts/release/clean-artifacts.mjs

release-build-core-windows:
	node scripts/release/build-core-windows.mjs

release-checksums:
	node scripts/release/generate-checksums.mjs

# Unified repository commands
lint: core-lint app-lint desktop-lint

lint-fix: core-lint-fix app-lint-fix

format: core-format app-format desktop-format

format-check: core-format-check app-format-check desktop-format-check

typecheck: core-typecheck app-typecheck

test: core-test app-test desktop-test

test-ci: core-test app-test-ci desktop-test

build: app-build

check: core-check app-check desktop-check

# Runtime commands
api:
	poetry -C core run uvicorn nola.main:app --reload --host 127.0.0.1 --port 8000

worker:
	poetry -C core run python -m nola.services.worker

# Dev starts only the backend API server. Start app and worker separately when needed.
dev: api

# Clean cache files. Deletion requires explicit confirmation.
clean:
ifeq ($(CONFIRM),1)
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type d -name .pytest_cache -exec rm -rf {} +
	find . -type d -name .mypy_cache -exec rm -rf {} +
	find . -type d -name .ruff_cache -exec rm -rf {} +
else
	@echo "clean deletes cache directories; rerun with CONFIRM=1"
endif
