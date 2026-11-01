"""Cookie sessions, CSRF bootstrap and Administrator-only account management."""

from typing import Annotated

from fastapi import APIRouter, Query, Request, Response

from app.api.dependencies import DatabaseSession
from app.api.schemas import ErrorResponse
from app.core.config import Settings
from app.core.errors import ApplicationError
from app.modules.identity.dependencies import (
    COOKIE_NAME,
    AdministratorIdentity,
    CurrentIdentity,
    validate_origin,
)
from app.modules.identity.schemas import (
    AccountCreate,
    AccountPatch,
    AccountRead,
    CsrfResponse,
    LoginInput,
    PasswordChange,
)
from app.modules.identity.service import IdentityService, Principal

router = APIRouter(
    prefix="/api/v1",
    tags=["identity"],
    responses={
        status: {"model": ErrorResponse}
        for status in (401, 403, 404, 409, 422, 429, 503)
    },
)


def set_session_cookie(
    request: Request, response: Response, token: str, *, authenticated: bool
) -> None:
    config: Settings = request.app.state.settings
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=28800 if authenticated else 600,
        secure=config.session_cookie_secure,
        httponly=True,
        samesite="strict",
        path="/",
    )


@router.get("/auth/csrf", response_model=CsrfResponse)
def csrf(
    request: Request, response: Response, session: DatabaseSession
) -> CsrfResponse:
    config: Settings = request.app.state.settings
    origin = request.headers.get("origin")
    if (origin is not None and origin != config.auth_origin) or request.headers.get(
        "sec-fetch-site"
    ) == "cross-site":
        raise ApplicationError(403, "origin_rejected", "Origin not allowed")
    token, csrf_token = IdentityService(session).csrf(request.cookies.get(COOKIE_NAME))
    if token is not None:
        set_session_cookie(request, response, token, authenticated=False)
    return CsrfResponse(csrf_token=csrf_token)


@router.post("/auth/login", response_model=AccountRead)
def login(
    payload: LoginInput, request: Request, response: Response, session: DatabaseSession
) -> Principal:
    validate_origin(request)
    token, csrf_token, principal = IdentityService(session).login(
        request.cookies.get(COOKIE_NAME),
        request.headers.get("x-csrf-token"),
        payload.username,
        payload.password.get_secret_value(),
        request.client.host if request.client else "unknown",
    )
    set_session_cookie(request, response, token, authenticated=True)
    # El token CSRF puede recuperarse de nuevo con GET /auth/csrf.
    response.headers["X-CSRF-Token"] = csrf_token
    return principal


@router.get("/auth/me", response_model=AccountRead)
def me(principal: CurrentIdentity) -> Principal:
    return principal


@router.post("/auth/logout", status_code=204)
def logout(
    request: Request,
    response: Response,
    session: DatabaseSession,
    principal: CurrentIdentity,
) -> Response:
    IdentityService(session).logout(request.cookies[COOKIE_NAME])
    config: Settings = request.app.state.settings
    response.delete_cookie(
        COOKIE_NAME,
        path="/",
        secure=config.session_cookie_secure,
        httponly=True,
        samesite="strict",
    )
    response.status_code = 204
    return response


@router.get("/users", response_model=list[AccountRead])
def list_users(
    session: DatabaseSession,
    principal: AdministratorIdentity,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> object:
    return IdentityService(session).list_users(offset, limit)


@router.post("/users", response_model=AccountRead, status_code=201)
def create_user(
    payload: AccountCreate, session: DatabaseSession, principal: AdministratorIdentity
) -> object:
    return IdentityService(session).create_user(payload)


@router.patch("/users/{user_id}", response_model=AccountRead)
def update_user(
    user_id: int,
    payload: AccountPatch,
    session: DatabaseSession,
    principal: AdministratorIdentity,
) -> object:
    return IdentityService(session).update_user(user_id, payload)


@router.post("/auth/password", status_code=204)
def change_password(
    payload: PasswordChange, session: DatabaseSession, principal: CurrentIdentity
) -> Response:
    IdentityService(session).change_password(
        principal,
        payload.current_password.get_secret_value(),
        payload.new_password.get_secret_value(),
    )
    return Response(status_code=204)
