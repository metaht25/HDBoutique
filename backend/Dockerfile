# syntax=docker/dockerfile:1
ARG PYTHON_IMAGE=python:3.13.15-slim-bookworm@sha256:2325bb286ec344af3e5898cc224b5844e2707ac6e26b1632516fd3edc84a5e26
ARG UV_IMAGE=ghcr.io/astral-sh/uv:0.12.10@sha256:2bb3ebca0a796a155094a27773d290c4b074572e6107f171d88d086682fd2500

FROM ${UV_IMAGE} AS uv

FROM ${PYTHON_IMAGE} AS dependencies
COPY --from=uv /uv /usr/local/bin/uv
ENV UV_PROJECT_ENVIRONMENT=/opt/venv \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never
WORKDIR /build
COPY pyproject.toml uv.lock .python-version README.md ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-default-groups

FROM dependencies AS development-dependencies
RUN --mount=type=cache,target=/root/.cache/uv uv sync --locked

FROM ${PYTHON_IMAGE} AS base
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
RUN groupadd --gid 10001 app && \
    useradd --uid 10001 --gid app --create-home app && \
    mkdir -p /workspace/backend && chown app:app /workspace/backend
WORKDIR /workspace/backend
COPY --from=dependencies /opt/venv /opt/venv
COPY --chown=app:app app ./app
USER app
EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=5 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health/ready', timeout=4).close()"]
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

FROM base AS development
COPY --from=uv /uv /usr/local/bin/uv
COPY --from=development-dependencies --chown=app:app /opt/venv /opt/venv
COPY --chown=app:app pyproject.toml uv.lock .python-version README.md ./
COPY --chown=app:app tests ./tests
COPY --chown=app:app hdboutique ./hdboutique
ENV UV_PROJECT_ENVIRONMENT=/opt/venv \
    UV_CACHE_DIR=/tmp/uv-cache \
    UV_PYTHON_DOWNLOADS=never \
    UV_LINK_MODE=copy
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload", "--reload-dir", "app"]

# El objetivo por defecto excluye uv, pruebas, Django y herramientas de desarrollo.
FROM base AS runtime
