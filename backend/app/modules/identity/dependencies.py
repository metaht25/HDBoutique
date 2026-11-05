"""Central, explicit authorization for every foundation resource."""

from typing import Annotated

from fastapi import Depends, Header, Request
from fastapi.security import APIKeyCookie

from app.api.dependencies import DatabaseSession
from app.core.config import Settings
from app.core.errors import ApplicationError
from app.modules.identity.service import IdentityService, Principal

COOKIE_NAME = "hdb_session"

cookie_scheme = APIKeyCookie(name=COOKIE_NAME, auto_error=False)


READ_RESOURCES = frozenset(
    {
        "departments",
        "municipalities",
        "addresses",
        "categories",
        "sizes",
        "products",
        "customer-types",
        "customers",
        "suppliers",
        "supplier-products",
        "supplier-offerings",
    }
)

CASHIER_READ = frozenset(
    {
        "categories",
        "sizes",
        "products",
        "customer-types",
        "customers",
        "departments",
        "municipalities",
    }
)


def validate_origin(request: Request) -> None:

    config: Settings = request.app.state.settings

    if request.headers.get("origin") != config.auth_origin:
        raise ApplicationError(403, "origin_rejected", "Origin not allowed")


def current_identity(
    request: Request,
    session: DatabaseSession,
    token: Annotated[str | None, Depends(cookie_scheme)],
    expected_user_id: Annotated[
        int | None, Header(alias="X-Idempotency-Actor", gt=0)
    ] = None,
) -> Principal:

    write = request.method not in {"GET", "HEAD", "OPTIONS"}

    if write:
        validate_origin(request)

    principal = IdentityService(session).authenticate(
        token,
        request.headers.get("x-csrf-token"),
        write=write,
    )

    # A cookie can change accounts in another tab before the UI receives its
    # session notification. Reject the stale command before any business write.
    # This header binds an intention; it never supplies authentication or roles.
    if write and expected_user_id is not None and expected_user_id != principal.user_id:
        raise ApplicationError(
            409,
            "session_changed",
            "La cuenta cambió. Recupera la sesión original para reintentar.",
        )

    return principal


CurrentIdentity = Annotated[Principal, Depends(current_identity)]


def authorize_business_request(request: Request, principal: CurrentIdentity) -> None:

    resource = request.url.path.split("/")[3]

    read = request.method in {"GET", "HEAD", "OPTIONS"}

    if not read and (
        resource == "customers"
        or (resource == "suppliers" and request.method != "PATCH")
    ):
        raise ApplicationError(
            403,
            "contextual_creation_required",
            "Registra el contacto desde Nueva venta o Compras.",
        )

    allowed = resource in READ_RESOURCES and (
        principal.role == "Administrator"
        or (
            principal.role == "Cashier"
            and (
                (read and resource in CASHIER_READ)
                or (
                    resource == "customers"
                    and request.method in {"POST", "PUT", "PATCH"}
                )
            )
        )
    )

    if not allowed:
        raise ApplicationError(403, "permission_denied", "Permission denied")


def administrator(principal: CurrentIdentity) -> Principal:

    if principal.role != "Administrator":
        raise ApplicationError(403, "permission_denied", "Permission denied")

    return principal


AdministratorIdentity = Annotated[Principal, Depends(administrator)]


def purchasing_identity(principal: CurrentIdentity) -> Principal:

    if principal.role not in {"Administrator"}:
        raise ApplicationError(403, "permission_denied", "Permission denied")

    return principal


PurchasingIdentity = Annotated[Principal, Depends(purchasing_identity)]


def sales_identity(principal: CurrentIdentity) -> Principal:

    if principal.role not in {"Administrator", "Cashier"}:
        raise ApplicationError(403, "permission_denied", "Permission denied")

    return principal


SalesIdentity = Annotated[Principal, Depends(sales_identity)]
