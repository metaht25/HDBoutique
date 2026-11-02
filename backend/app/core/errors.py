"""Safe, consistent HTTP errors without SQL, credentials or input values."""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException


class ApplicationError(Exception):
    def __init__(self, status: int, code: str, message: str) -> None:
        self.status = status
        self.code = code
        self.message = message


def install_error_handlers(application: FastAPI) -> None:
    @application.exception_handler(ApplicationError)
    async def application_error(
        request: Request, error: ApplicationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=error.status,
            content={"error": {"code": error.code, "message": error.message}},
        )

    @application.exception_handler(RequestValidationError)
    async def validation_error(
        request: Request, error: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "validation_error",
                    "message": (
                        "El teléfono debe tener ocho dígitos y comenzar con 7 u 8."
                        if request.url.path.startswith("/api/v1/employees")
                        and any(
                            item["loc"][-1] == "phone_number" for item in error.errors()
                        )
                        else "Invalid request"
                    ),
                    "fields": [
                        {"location": list(item["loc"]), "type": item["type"]}
                        for item in error.errors()
                    ],
                }
            },
        )

    @application.exception_handler(HTTPException)
    async def http_error(request: Request, error: HTTPException) -> JSONResponse:
        return JSONResponse(
            status_code=error.status_code,
            content={
                "error": {
                    "code": "http_error",
                    "message": "Request could not be completed",
                }
            },
            headers=error.headers,
        )

    @application.exception_handler(SQLAlchemyError)
    async def database_error(request: Request, error: SQLAlchemyError) -> JSONResponse:
        return JSONResponse(
            status_code=503,
            content={
                "error": {
                    "code": "database_unavailable",
                    "message": "Database unavailable",
                }
            },
        )
