"""Real HTTP authentication, CSRF, permissions and revocation on isolated PostgreSQL."""

from collections.abc import Iterator
from datetime import timedelta
from unittest.mock import patch

import pytest
from argon2 import PasswordHasher
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import Connection, select
from sqlalchemy.orm import sessionmaker

from app.core.config import Settings
from app.core.errors import ApplicationError
from app.main import create_app
from app.modules.identity.dependencies import COOKIE_NAME
from app.modules.identity.models import LoginThrottle, UserAccount, WebSession
from app.modules.identity.schemas import AccountCreate, AccountPatch
from app.modules.identity.security import digest_token, hash_password, verify_password
from app.modules.identity.service import IdentityService, utc_now
from app.modules.locations.models import Address, Department
from app.modules.staff.models import Employee
from tests.identity_helpers import SYNTHETIC_PASSWORD, TEST_ORIGIN, login

pytestmark = pytest.mark.postgres
ROLES = ("Administrator", "Cashier")
RESOURCES = (
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
)


@pytest.fixture
def identity_app(database_connection: Connection):
    application = create_app(
        Settings(
            environment="test",
            business_api_enabled=True,
            auth_origin=TEST_ORIGIN,
        )
    )
    application.state.session_factory = sessionmaker(
        bind=database_connection,
        expire_on_commit=False,
        join_transaction_mode="create_savepoint",
    )
    with application.state.session_factory.begin() as session:
        encoded = hash_password(SYNTHETIC_PASSWORD)
        for role in ROLES:
            session.add(
                UserAccount(
                    username=role.lower(),
                    password_hash=encoded,
                    role=role,
                    is_active=True,
                    employee_id=None,
                )
            )
    return application


@pytest.fixture
def identity_client(identity_app) -> Iterator[TestClient]:
    with TestClient(
        identity_app, base_url=TEST_ORIGIN, headers={"Origin": TEST_ORIGIN}
    ) as client:
        yield client


def test_login_rotation_logout_and_cookie_flags(
    identity_client: TestClient, database_connection: Connection
) -> None:
    client = identity_client
    initial = client.get("/api/v1/auth/csrf")
    preauth = client.cookies[COOKIE_NAME]
    cookie = initial.headers["set-cookie"]
    for flag in ("HttpOnly", "Secure", "SameSite=strict", "Path=/"):
        assert flag in cookie
    response = client.post(
        "/api/v1/auth/login",
        json={
            "username": "ADMINISTRATOR",
            "password": SYNTHETIC_PASSWORD,
        },
        headers={"X-CSRF-Token": initial.json()["csrf_token"]},
    )
    assert response.status_code == 200
    authenticated = client.cookies[COOKIE_NAME]
    assert authenticated != preauth
    assert (
        "password_hash" not in response.text and SYNTHETIC_PASSWORD not in response.text
    )
    assert response.json()["employee_id"] is None
    assert response.headers["cache-control"] == "no-store"
    client.headers["X-CSRF-Token"] = response.headers["X-CSRF-Token"]
    assert client.get("/api/v1/auth/me").json()["role"] == "Administrator"
    assert (
        database_connection.scalar(
            select(WebSession.token_hash).where(
                WebSession.token_hash == digest_token(preauth),
            )
        )
        is None
    )
    stored = database_connection.execute(select(WebSession)).first()
    assert stored and authenticated not in str(stored)
    assert client.post("/api/v1/auth/logout").status_code == 204
    assert COOKIE_NAME not in client.cookies
    client.cookies.set(COOKIE_NAME, authenticated)
    assert client.get("/api/v1/auth/me").status_code == 401


@pytest.mark.parametrize("role", ROLES)
def test_role_matrix_all_business_operations(
    identity_client: TestClient, role: str
) -> None:
    client = identity_client
    login(client, role.lower())
    cashier_read = {
        "categories",
        "sizes",
        "products",
        "customer-types",
        "customers",
        "departments",
        "municipalities",
    }
    for resource in RESOURCES:
        for method in ("GET", "POST", "PUT", "PATCH", "DELETE"):
            allowed = role == "Administrator" or (
                role == "Cashier"
                and (
                    (method == "GET" and resource in cashier_read)
                    or (resource == "customers" and method in {"POST", "PUT", "PATCH"})
                )
            )
            if method != "GET" and (
                resource == "customers"
                or (resource == "suppliers" and method != "PATCH")
            ):
                allowed = False
            if resource == "suppliers" and method == "PATCH":
                # Only an explicit state patch is allowed; the matrix sends {}.
                allowed = False
            path = "/api/v1/" + resource
            if method in {"PUT", "PATCH", "DELETE"}:
                path += "/2147483647"
            response = client.request(
                method, path, json={} if method in {"POST", "PUT", "PATCH"} else None
            )
            if allowed:
                assert response.status_code in {200, 201, 404, 409, 422}, (
                    role,
                    method,
                    resource,
                    response.text,
                )
            else:
                assert response.status_code == 403, (
                    role,
                    method,
                    resource,
                    response.text,
                )
    users = client.get("/api/v1/users")
    assert users.status_code == (200 if role == "Administrator" else 403)
    response = client.post(
        "/api/v1/users",
        json={
            "username": "new-person",
            "password": SYNTHETIC_PASSWORD,
            "role": "Cashier",
        },
    )
    assert response.status_code == (201 if role == "Administrator" else 403)
    response = client.patch("/api/v1/users/2147483647", json={})
    assert response.status_code == (404 if role == "Administrator" else 403)


def test_anonymous_and_forged_sessions_denied(identity_client: TestClient) -> None:
    client = identity_client
    for resource in (*RESOURCES, "users"):
        for method in ("GET", "POST", "PUT", "PATCH", "DELETE"):
            path = "/api/v1/" + resource
            if method in {"PUT", "PATCH", "DELETE"}:
                path += "/1"
            response = client.request(method, path, json={})
            if resource == "users" and method in {"PUT", "DELETE"}:
                assert response.status_code == 405
            else:
                assert response.status_code == 401
    for token in ("forged", "x" * 129):
        client.cookies.set(COOKIE_NAME, token)
        assert client.get("/api/v1/auth/me").status_code == 401


def test_csrf_origin_and_session_binding(identity_client: TestClient) -> None:
    client = identity_client
    payload = {"username": "administrator", "password": SYNTHETIC_PASSWORD}
    assert client.post("/api/v1/auth/login", json=payload).status_code == 403
    login(client, "administrator")
    valid_csrf = client.headers.pop("X-CSRF-Token")
    assert client.post("/api/v1/categories", json={"name": "Denied"}).status_code == 403
    assert client.post("/api/v1/auth/logout").status_code == 403
    client.headers["X-CSRF-Token"] = "forged"
    assert client.delete("/api/v1/categories/1").status_code == 403
    client.headers["X-CSRF-Token"] = valid_csrf
    for origin in ("https://testserver.evil", "null"):
        assert (
            client.post(
                "/api/v1/categories", json={}, headers={"Origin": origin}
            ).status_code
            == 403
        )
    del client.headers["Origin"]
    assert client.post("/api/v1/categories", json={}).status_code == 403
    client.headers["Origin"] = TEST_ORIGIN
    rotated = client.get("/api/v1/auth/csrf").json()["csrf_token"]
    assert client.post("/api/v1/categories", json={}).status_code == 403
    client.headers["X-CSRF-Token"] = rotated
    assert (
        client.post("/api/v1/categories", json={"name": "CSRF test"}).status_code == 201
    )


@pytest.mark.parametrize("username", ["administrator", "unknown"])
def test_generic_failures_throttle_and_window_reset(
    identity_client: TestClient, username: str
) -> None:
    client = identity_client
    csrf = client.get("/api/v1/auth/csrf").json()["csrf_token"]
    for _ in range(5):
        response = client.post(
            "/api/v1/auth/login",
            json={
                "username": username,
                "password": "invalid-password",
            },
            headers={"X-CSRF-Token": csrf},
        )
        assert response.status_code == 401
        assert response.json()["error"]["code"] == "invalid_credentials"
        assert username not in response.text and "password" not in response.text
    response = client.post(
        "/api/v1/auth/login",
        json={
            "username": username,
            "password": SYNTHETIC_PASSWORD,
        },
        headers={"X-CSRF-Token": csrf},
    )
    assert response.status_code == 429
    later = utc_now() + timedelta(minutes=16)
    with patch("app.modules.identity.service.utc_now", return_value=later):
        csrf = client.get("/api/v1/auth/csrf").json()["csrf_token"]
        response = client.post(
            "/api/v1/auth/login",
            json={
                "username": username,
                "password": SYNTHETIC_PASSWORD,
            },
            headers={"X-CSRF-Token": csrf},
        )
        assert response.status_code == (200 if username == "administrator" else 401)


@pytest.mark.parametrize("elapsed", [timedelta(minutes=31), timedelta(hours=9)])
def test_expiry_is_server_enforced(
    identity_client: TestClient, elapsed: timedelta
) -> None:
    client = identity_client
    login(client, "cashier")
    with patch(
        "app.modules.identity.service.utc_now", return_value=utc_now() + elapsed
    ):
        assert client.get("/api/v1/auth/me").status_code == 401
        assert client.get("/api/v1/products").status_code == 401


def test_user_changes_revoke_sessions_and_guard_last_administrator(
    identity_client: TestClient, identity_app
) -> None:
    client = identity_client
    login(client, "administrator")
    users = {user["username"]: user for user in client.get("/api/v1/users").json()}
    admin_id = users["administrator"]["user_id"]
    cashier_id = users["cashier"]["user_id"]
    for payload in ({"is_active": False}, {"role": "Cashier"}):
        assert (
            client.patch(f"/api/v1/users/{admin_id}", json=payload).status_code == 409
        )
    with TestClient(
        identity_app, base_url=TEST_ORIGIN, headers={"Origin": TEST_ORIGIN}
    ) as cashier:
        login(cashier, "cashier")
        response = client.patch(
            f"/api/v1/users/{cashier_id}", json={"role": "Administrator"}
        )
        assert response.status_code == 200
        assert cashier.get("/api/v1/auth/me").status_code == 401
        login(cashier, "cashier")
        assert cashier.get("/api/v1/suppliers").status_code == 200
        response = client.patch(
            f"/api/v1/users/{cashier_id}",
            json={
                "password": "Replacement-password-42!",
                "is_active": False,
            },
        )
        assert response.status_code == 200
        assert cashier.get("/api/v1/products").status_code == 401
        assert (
            client.patch(
                f"/api/v1/users/{cashier_id}", json={"is_active": True}
            ).status_code
            == 200
        )
        response = cashier.get("/api/v1/auth/csrf")
        csrf = response.json()["csrf_token"]
        bad = cashier.post(
            "/api/v1/auth/login",
            json={
                "username": "cashier",
                "password": SYNTHETIC_PASSWORD,
            },
            headers={"X-CSRF-Token": csrf},
        )
        assert bad.status_code == 401
        login(cashier, "cashier", "Replacement-password-42!")


def test_account_validation_uniqueness_and_employee_link(
    identity_client: TestClient, identity_app
) -> None:
    client = identity_client
    login(client, "administrator")
    factory = identity_app.state.session_factory
    with factory.begin() as session:
        department = Department(name="Synthetic")
        session.add(department)
        session.flush()
        address = Address(department_id=department.department_id, address_line=None)
        session.add(address)
        session.flush()
        employee = Employee(
            address_id=address.address_id,
            first_names="Synthetic",
            last_names="Employee",
            phone_number="00000000",
        )
        session.add(employee)
        session.flush()
        employee_id = employee.employee_id
    payload = {
        "username": "new-cashier",
        "password": SYNTHETIC_PASSWORD,
        "role": "Cashier",
        "employee_id": employee_id,
    }
    response = client.post("/api/v1/users", json=payload)
    assert response.status_code == 201
    user_id = response.json()["user_id"]
    assert response.json()["employee_id"] == employee_id
    assert (
        client.post(
            "/api/v1/users", json={**payload, "username": "NEW-CASHIER"}
        ).status_code
        == 409
    )
    assert (
        client.post("/api/v1/users", json={**payload, "username": "other"}).status_code
        == 409
    )
    assert (
        client.patch(
            f"/api/v1/users/{user_id}", json={"employee_id": 2147483647}
        ).status_code
        == 422
    )
    assert (
        client.patch(f"/api/v1/users/{user_id}", json={"employee_id": None}).status_code
        == 200
    )
    assert (
        client.post("/api/v1/users", json={**payload, "username": "other"}).status_code
        == 201
    )
    assert (
        client.post(
            "/api/v1/users",
            json={**payload, "employee_id": 2147483647, "username": "missing"},
        ).status_code
        == 422
    )
    for invalid in (
        {"role": "Owner"},
        {"password": "short"},
        {"is_active": False},
        {"user_id": 10},
        {"password_hash": "raw"},
    ):
        response = client.post("/api/v1/users", json={**payload, **invalid})
        assert response.status_code == 422
        assert SYNTHETIC_PASSWORD not in response.text
    assert (
        client.patch(f"/api/v1/users/{user_id}", json={"role": None}).status_code == 422
    )
    assert client.get("/api/v1/users?limit=101").status_code == 422
    assert (
        client.patch(
            f"/api/v1/users/{user_id}",
            json={
                "employee_id": employee_id,
            },
        ).status_code
        == 409
    )
    with factory() as session:
        user = session.get(UserAccount, user_id)
        assert user.password_hash.startswith("$argon2id$")
        assert verify_password(user.password_hash, SYNTHETIC_PASSWORD)


def test_bootstrap_rejection_purge_and_password_rehash(
    identity_client: TestClient, identity_app
) -> None:
    factory = identity_app.state.session_factory
    with factory() as session:
        service = IdentityService(session)
        with pytest.raises(ApplicationError) as error:
            service.create_user(
                AccountCreate(
                    username="bootstrap",
                    password=SecretStr(SYNTHETIC_PASSWORD),
                    role="Administrator",
                ),
                bootstrap=True,
            )
        assert error.value.status == 409
    login(identity_client, "cashier")
    with factory.begin() as session:
        user = session.scalar(
            select(UserAccount).where(UserAccount.username == "cashier")
        )
        user.password_hash = PasswordHasher(time_cost=2).hash(SYNTHETIC_PASSWORD)
    login(identity_client, "cashier")
    with factory() as session:
        user = session.scalar(
            select(UserAccount).where(UserAccount.username == "cashier")
        )
        assert not PasswordHasher().check_needs_rehash(user.password_hash)
    later = utc_now() + timedelta(hours=9)
    with patch("app.modules.identity.service.utc_now", return_value=later):
        with factory() as session:
            IdentityService(session).purge_expired()
        with factory() as session:
            assert session.scalar(select(WebSession)) is None
            assert session.scalar(select(LoginThrottle)) is None


def test_cli_bootstrap_uses_explicit_database_and_no_defaults(
    database_connection: Connection,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from unittest.mock import MagicMock

    from app.modules.identity import cli

    factory = sessionmaker(
        bind=database_connection,
        expire_on_commit=False,
        join_transaction_mode="create_savepoint",
    )
    settings = Settings(
        environment="test",
        database_host="synthetic",
        database_name="hdboutique_test",
        database_user="synthetic",
        database_password=SecretStr("synthetic"),
    )
    monkeypatch.setattr(cli, "Settings", lambda: settings)
    engine = MagicMock()
    monkeypatch.setattr(cli, "build_engine", lambda config: engine)
    monkeypatch.setattr(cli, "create_session_factory", lambda configured: factory)
    monkeypatch.setattr(cli, "getpass", lambda prompt: SYNTHETIC_PASSWORD)
    employee_id = synthetic_employee(factory, active=True)
    monkeypatch.setattr(
        "sys.argv",
        [
            "identity",
            "bootstrap-admin",
            "--database",
            "hdboutique_test",
            "--username",
            "first-admin",
            "--employee-id",
            str(employee_id),
        ],
    )
    cli.main()
    with factory() as session:
        user = session.scalar(select(UserAccount))
        assert user.username == "first-admin" and user.role == "Administrator"
        assert user.employee_id == employee_id and user.is_active
        assert verify_password(user.password_hash, SYNTHETIC_PASSWORD)
    engine.dispose.assert_called_once()
    with pytest.raises(SystemExit) as error:
        cli.main()
    assert error.value.code == 1
    monkeypatch.setattr(
        "sys.argv", ["identity", "purge-expired", "--database", "hdboutique_test"]
    )
    cli.main()
    monkeypatch.setattr(
        "sys.argv", ["identity", "purge-expired", "--database", "unauthorized"]
    )
    with pytest.raises(SystemExit) as error:
        cli.main()
    assert error.value.code == 2


def test_expired_and_disabled_accounts_cannot_login(
    identity_client: TestClient, identity_app
) -> None:
    client = identity_client
    factory = identity_app.state.session_factory
    login(client, "cashier")
    with factory.begin() as session:
        user = session.scalar(
            select(UserAccount).where(UserAccount.username == "cashier")
        )
        user.is_active = False
    assert client.get("/api/v1/auth/me").status_code == 401
    token = client.get("/api/v1/auth/csrf").json()["csrf_token"]
    response = client.post(
        "/api/v1/auth/login",
        json={
            "username": "cashier",
            "password": SYNTHETIC_PASSWORD,
        },
        headers={"X-CSRF-Token": token},
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_credentials"


def test_session_csrf_cannot_be_reused_by_another_client(
    identity_client: TestClient, identity_app
) -> None:
    client = identity_client
    stolen_csrf = client.get("/api/v1/auth/csrf").json()["csrf_token"]
    assert (
        client.get(
            "/api/v1/auth/csrf",
            headers={
                "Sec-Fetch-Site": "cross-site",
            },
        ).status_code
        == 403
    )
    assert (
        client.get(
            "/api/v1/auth/csrf",
            headers={
                "Origin": "https://untrusted.example",
            },
        ).status_code
        == 403
    )
    with TestClient(
        identity_app, base_url=TEST_ORIGIN, headers={"Origin": TEST_ORIGIN}
    ) as other:
        other.get("/api/v1/auth/csrf")
        assert (
            other.post(
                "/api/v1/auth/login",
                json={
                    "username": "cashier",
                    "password": SYNTHETIC_PASSWORD,
                },
                headers={"X-CSRF-Token": stolen_csrf},
            ).status_code
            == 403
        )


def test_production_routes_are_protected_without_publishing_docs(
    identity_app,
) -> None:
    application = create_app(
        Settings(
            environment="production", business_api_enabled=True, auth_origin=TEST_ORIGIN
        )
    )
    application.state.session_factory = identity_app.state.session_factory
    with TestClient(
        application, base_url=TEST_ORIGIN, headers={"Origin": TEST_ORIGIN}
    ) as client:
        assert client.get("/docs").status_code == 404
        assert client.get("/api/v1/products").status_code == 401
        login(client, "administrator")
        assert client.get("/api/v1/products").status_code == 200


def test_concurrent_demotions_preserve_one_administrator(postgres_engine) -> None:
    from concurrent.futures import ThreadPoolExecutor

    from sqlalchemy import delete

    factory = sessionmaker(bind=postgres_engine, expire_on_commit=False)
    with factory.begin() as session:
        encoded = hash_password(SYNTHETIC_PASSWORD)
        accounts = [
            UserAccount(
                username=f"concurrent-admin-{index}",
                password_hash=encoded,
                role="Administrator",
                is_active=True,
                employee_id=None,
            )
            for index in range(2)
        ]
        session.add_all(accounts)
    ids = [account.user_id for account in accounts]

    def demote(user_id: int) -> int:
        with factory() as session:
            try:
                IdentityService(session).update_user(
                    user_id, AccountPatch(role="Cashier")
                )
                return 200
            except ApplicationError as error:
                return error.status

    try:
        with ThreadPoolExecutor(max_workers=2) as executor:
            assert sorted(executor.map(demote, ids)) == [200, 409]
        with factory() as session:
            remaining = session.scalars(
                select(UserAccount).where(
                    UserAccount.user_id.in_(ids),
                    UserAccount.role == "Administrator",
                    UserAccount.is_active.is_(True),
                )
            ).all()
            assert len(remaining) == 1
    finally:
        with factory.begin() as session:
            session.execute(delete(UserAccount).where(UserAccount.user_id.in_(ids)))


def synthetic_employee(factory, *, active: bool) -> int:
    with factory.begin() as session:
        department = Department(name="F02 synthetic")
        session.add(department)
        session.flush()
        address = Address(department_id=department.department_id, address_line=None)
        session.add(address)
        session.flush()
        employee = Employee(
            address_id=address.address_id,
            first_names="Synthetic",
            last_names="F02",
            phone_number="80000000",
            is_active=active,
        )
        session.add(employee)
        session.flush()
        return employee.employee_id


@pytest.mark.parametrize("action", ["create", "link", "reactivate", "promote"])
def test_f02_active_account_requires_active_employee(
    identity_client: TestClient, identity_app, action: str
) -> None:
    client, factory = identity_client, identity_app.state.session_factory
    login(client, "administrator")
    employee_id = synthetic_employee(factory, active=False)
    if action == "create":
        response = client.post(
            "/api/v1/users",
            json={
                "username": "f02-new-admin",
                "password": SYNTHETIC_PASSWORD,
                "role": "Administrator",
                "employee_id": employee_id,
            },
        )
    elif action == "link":
        user_id = client.get("/api/v1/auth/me").json()["user_id"]
        response = client.patch(
            f"/api/v1/users/{user_id}", json={"employee_id": employee_id}
        )
    else:
        with factory.begin() as session:
            user = UserAccount(
                username="f02-legacy",
                password_hash=hash_password(SYNTHETIC_PASSWORD),
                role="Cashier" if action == "promote" else "Administrator",
                is_active=action == "promote",
                employee_id=employee_id,
            )
            session.add(user)
            session.flush()
            user_id = user.user_id
        response = client.patch(
            f"/api/v1/users/{user_id}",
            json={"role": "Administrator"}
            if action == "promote"
            else {"is_active": True},
        )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "employee_inactive"
    assert client.get("/api/v1/auth/me").status_code == 200


@pytest.mark.parametrize("mutation", [{"is_active": False}, {"role": "Cashier"}])
def test_f02_unusable_legacy_admin_cannot_replace_last_accessible_admin(
    identity_client: TestClient, identity_app, mutation: dict
) -> None:
    client, factory = identity_client, identity_app.state.session_factory
    login(client, "administrator")
    admin_id = client.get("/api/v1/auth/me").json()["user_id"]
    employee_id = synthetic_employee(factory, active=False)
    with factory.begin() as session:
        session.add(
            UserAccount(
                username="f02-unusable",
                password_hash=hash_password(SYNTHETIC_PASSWORD),
                role="Administrator",
                is_active=True,
                employee_id=employee_id,
            )
        )
    response = client.patch(f"/api/v1/users/{admin_id}", json=mutation)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "last_administrator"
    assert client.get("/api/v1/auth/me").status_code == 200


def test_f02_employee_deactivation_rolls_back_and_reactivation_restores_access(
    identity_client: TestClient, identity_app
) -> None:
    client, factory = identity_client, identity_app.state.session_factory
    login(client, "administrator")
    admin_id = client.get("/api/v1/auth/me").json()["user_id"]
    active_id = synthetic_employee(factory, active=True)
    inactive_id = synthetic_employee(factory, active=False)
    assert (
        client.patch(
            f"/api/v1/users/{admin_id}", json={"employee_id": active_id}
        ).status_code
        == 200
    )
    login(client, "administrator")
    with factory.begin() as session:
        backup = UserAccount(
            username="f02-backup",
            password_hash=hash_password(SYNTHETIC_PASSWORD),
            role="Administrator",
            is_active=True,
            employee_id=inactive_id,
        )
        session.add(backup)
    assert (
        client.patch(
            f"/api/v1/employees/{active_id}", json={"is_active": False}
        ).status_code
        == 409
    )
    assert client.get("/api/v1/auth/me").status_code == 200
    assert client.get(f"/api/v1/employees/{active_id}").json()["is_active"] is True
    assert (
        client.patch(
            f"/api/v1/employees/{inactive_id}", json={"is_active": True}
        ).status_code
        == 200
    )
    # The repaired second administrator can now really log in, so removing the
    # first is safe. All transitions still use the ordinary authenticated API.
    with TestClient(
        identity_app, base_url=TEST_ORIGIN, headers={"Origin": TEST_ORIGIN}
    ) as other:
        login(other, "f02-backup")
        assert other.get("/api/v1/auth/me").status_code == 200
        assert (
            client.patch(
                f"/api/v1/employees/{active_id}", json={"is_active": False}
            ).status_code
            == 200
        )
        assert client.get("/api/v1/auth/me").status_code == 401
        assert other.get("/api/v1/auth/me").status_code == 200
