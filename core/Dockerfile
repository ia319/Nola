# syntax=docker/dockerfile:1.7

ARG PYTHON_IMAGE=python:3.11.14-slim-bookworm

FROM ${PYTHON_IMAGE} AS builder

ENV POETRY_VERSION=2.2.1 \
    POETRY_VIRTUALENVS_IN_PROJECT=true \
    POETRY_NO_INTERACTION=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN python -m pip install --no-cache-dir "poetry==${POETRY_VERSION}"

COPY pyproject.toml poetry.lock README.md ./
COPY nola ./nola

RUN poetry install --only main --no-root --no-ansi \
    && poetry build -f wheel --no-ansi

FROM ${PYTHON_IMAGE} AS runtime

ENV NOLA_DATA_DIR=/data \
    NOLA_HOST=0.0.0.0 \
    NOLA_MODEL_DIR=/models \
    NOLA_PORT=8000 \
    PATH=/app/.venv/bin:$PATH \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg libgomp1 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system nola \
    && useradd --system --gid nola --home-dir /app --shell /usr/sbin/nologin nola

COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/dist/*.whl /tmp/

RUN /app/.venv/bin/pip install --no-cache-dir --no-deps /tmp/nola_core-*.whl \
    && rm -f /tmp/nola_core-*.whl \
    && mkdir -p /data /models \
    && chown -R nola:nola /app /data /models

USER nola

EXPOSE 8000
VOLUME ["/data", "/models"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD ["python", "-c", "import json, os, urllib.request; port=os.environ.get('NOLA_PORT', '8000'); data=json.load(urllib.request.urlopen(f'http://127.0.0.1:{port}/health', timeout=3)); raise SystemExit(0 if data.get('status') == 'ok' else 1)"]

CMD ["nola-core", "api"]
