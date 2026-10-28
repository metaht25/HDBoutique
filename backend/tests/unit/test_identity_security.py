"""Password and production configuration boundaries without database access."""

import pytest
from pydantic import SecretStr, ValidationError

from app.core.config import Settings
from app.modules.identity.schemas import AccountCreate, AccountPatch, LoginInput
from app.modules.identity.security import hash_password, verify_password


def test_passwords_are_salted_and_preserve_spaces() -> None:
    password = "  Synthetic-long-password!  "
    first, second = hash_password(password), hash_password(password)
    assert first != second
    assert first.startswith("$argon2id$")
    assert verify_password(first, password)
    assert not verify_password(first, password.strip())
    assert not verify_password("malformed", password)
    payload = AccountCreate(
        username=" ADMIN ", password=SecretStr(password), role="Administrator"
    )
    assert payload.username == "admin"
    assert payload.password.get_secret_value() == password
    assert AccountPatch(password=password).password.get_secret_value() == password
    assert password not in repr(payload)


@pytest.mark.parametrize(
    "origin",
    [
        "ftp://example.com",
        "https://example.com/",
        "https://example.com/path",
        "https://example.com?x=1",
        "https://user:pass@example.com",
        "example.com",
    ],
)
def test_rejects_ambiguous_origin(origin: str) -> None:
    with pytest.raises(ValidationError):
        Settings(auth_origin=origin)


def test_production_requires_https_and_secure_cookies() -> None:
    with pytest.raises(ValidationError):
        Settings(environment="production", business_api_enabled=True)
    with pytest.raises(ValidationError):
        Settings(
            environment="production",
            business_api_enabled=True,
            auth_origin="https://shop.example",
            session_cookie_secure=False,
        )
    assert Settings(
        environment="production",
        business_api_enabled=True,
        auth_origin="https://shop.example",
    ).session_cookie_secure
    assert (
        LoginInput(username="cashier", password="x").password.get_secret_value() == "x"
    )
