.PHONY: setup install \
	core-lint core-format core-typecheck core-test core-check \
	app-lint app-typecheck app-test app-build app-check \
	lint format typecheck test check \
	api worker dev clean

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

core-format:
	poetry -C core run ruff format --check nola tests

core-typecheck:
	poetry -C core run mypy nola

core-test:
	poetry -C core run pytest tests -v --tb=short

core-check: core-lint core-format core-typecheck core-test

# Frontend quality commands
app-lint:
	pnpm --dir app lint

app-typecheck:
	pnpm --dir app typecheck

app-test:
	pnpm --dir app test

app-build:
	pnpm --dir app build

app-check:
	pnpm --dir app check

# Unified repository commands
lint: core-lint app-lint

format:
	poetry -C core run ruff format --check nola tests
	pnpm --dir app format:check

typecheck: core-typecheck app-typecheck

test: core-test app-test

check: core-check app-check

# Runtime commands
api:
	poetry -C core run uvicorn nola.main:app --reload --host 127.0.0.1 --port 8000

worker:
	poetry -C core run python -m nola.services.worker

dev: api

# Clean cache files
clean:
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type d -name .pytest_cache -exec rm -rf {} +
	find . -type d -name .mypy_cache -exec rm -rf {} +
	find . -type d -name .ruff_cache -exec rm -rf {} +
