"""FastAPI entry point, independent from the existing Django application."""

from fastapi import FastAPI

from app.api.health import router as health_router
from app.core.config import Settings


def create_app(settings: Settings | None = None) -> FastAPI:
    config = settings if settings is not None else Settings()
    expose_docs = config.environment != "production"
    application = FastAPI(
        title=config.app_name,
        version="0.1.0",
        debug=config.debug,
        docs_url="/docs" if expose_docs else None,
        redoc_url="/redoc" if expose_docs else None,
        openapi_url="/openapi.json" if expose_docs else None,
    )
    application.include_router(health_router)
    return application


app = create_app()
