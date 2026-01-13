.PHONY: setup install lint typecheck test dev clean

# Setup development environment
setup: install
	poetry -C core run pre-commit install

# Install dependencies
install:
	cd core && poetry install

# Run linter
lint:
	poetry -C core run ruff check core/

# Run type checker
typecheck:
	poetry -C core run mypy core/nola

# Run tests
test:
	poetry -C core run pytest core/

# Start development server
dev:
	poetry -C core run uvicorn nola.main:app --reload --app-dir core

# Clean cache files
clean:
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type d -name .pytest_cache -exec rm -rf {} +
	find . -type d -name .mypy_cache -exec rm -rf {} +
	find . -type d -name .ruff_cache -exec rm -rf {} +
