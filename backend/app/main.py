"""FastAPI entry point, independent from the existing Django application."""

from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response

from app.api.health import router as health_router
from app.core.config import Settings
from app.core.errors import install_error_handlers
from app.infrastructure.database.connection import build_engine
from app.infrastructure.database.session import create_session_factory
from app.modules.cash.router import router as cash_router
from app.modules.catalog.router import router as catalog_router
from app.modules.customers.router import router as customers_router
from app.modules.identity.router import router as identity_router
from app.modules.inventory.router import router as inventory_router
from app.modules.locations.router import router as locations_router
from app.modules.purchases.router import router as purchases_router
from app.modules.reporting.router import router as reporting_router
from app.modules.sales.router import router as sales_router
from app.modules.suppliers.router import router as suppliers_router


def create_app(settings: Settings | None = None) -> FastAPI:
    config = settings if settings is not None else Settings()
    engine = build_engine(config)

    @asynccontextmanager
    async def lifespan(application: FastAPI) -> AsyncIterator[None]:
        try:
            yield
        finally:
            if engine is not None:
                engine.dispose()

    expose_docs = config.environment != "production"
    application = FastAPI(
        title=config.app_name,
        version="0.1.0",
        debug=config.debug,
        lifespan=lifespan,
        docs_url="/docs" if expose_docs else None,
        redoc_url="/redoc" if expose_docs else None,
        openapi_url="/openapi.json" if expose_docs else None,
    )
    application.state.database_engine = engine
    application.state.settings = config
    application.state.session_factory = (
        create_session_factory(engine) if engine is not None else None
    )
    application.include_router(health_router)
    install_error_handlers(application)

    @application.middleware("http")
    async def protect_api_responses(
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        response = await call_next(request)
        if request.url.path.startswith("/api/v1/"):
            response.headers["Cache-Control"] = "no-store"
            response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    if config.business_api_enabled:
        application.include_router(identity_router)
        for router in (
            locations_router,
            catalog_router,
            customers_router,
            suppliers_router,
            purchases_router,
            sales_router,
            cash_router,
            inventory_router,
            reporting_router,
        ):
            application.include_router(router)
    return application


app = create_app()
