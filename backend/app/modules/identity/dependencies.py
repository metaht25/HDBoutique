"""Central, explicit authorization for every foundation resource."""

from typing import Annotated

from fastapi import Depends, Request
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
    {"categories", "sizes", "products", "customer-types", "customers"}
)


def validate_origin(request: Request) -> None:
    config: Settings = request.app.state.settings
    if request.headers.get("origin") != config.auth_origin:
        raise ApplicationError(403, "origin_rejected", "Origin not allowed")


def current_identity(
    request: Request,
    session: DatabaseSession,
    token: Annotated[str | None, Depends(cookie_scheme)],
) -> Principal:
    write = request.method not in {"GET", "HEAD", "OPTIONS"}
    if write:
        validate_origin(request)
    return IdentityService(session).authenticate(
        token,
        request.headers.get("x-csrf-token"),
        write=write,
    )


CurrentIdentity = Annotated[Principal, Depends(current_identity)]


def authorize_business_request(request: Request, principal: CurrentIdentity) -> None:
    resource = request.url.path.split("/")[3]
    read = request.method in {"GET", "HEAD", "OPTIONS"}
    allowed = resource in READ_RESOURCES and (
        principal.role == "Administrator"
        or (principal.role == "Manager" and request.method != "DELETE")
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
    if principal.role not in {"Administrator", "Manager"}:
        raise ApplicationError(403, "permission_denied", "Permission denied")
    return principal


PurchasingIdentity = Annotated[Principal, Depends(purchasing_identity)]
