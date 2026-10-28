"""Keep unit and characterization tests independent from local credentials."""

import pytest


def pytest_addoption(parser: pytest.Parser) -> None:
    parser.addoption(
        "--run-postgres",
        action="store_true",
        default=False,
        help="Run integration tests on an explicitly configured PostgreSQL test DB",
    )


def pytest_collection_modifyitems(
    config: pytest.Config, items: list[pytest.Item]
) -> None:
    if config.getoption("--run-postgres"):
        return
    skip = pytest.mark.skip(
        reason="Use --run-postgres with HDB_TEST_DATABASE_* settings"
    )
    for item in items:
        if "postgres" in item.keywords:
            item.add_marker(skip)


@pytest.fixture(autouse=True)
def isolate_settings_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in (
        "APP_NAME",
        "ENVIRONMENT",
        "DEBUG",
        "BUSINESS_API_ENABLED",
        "AUTH_ORIGIN",
        "SESSION_COOKIE_SECURE",
        "DATABASE_HOST",
        "DATABASE_PORT",
        "DATABASE_NAME",
        "DATABASE_USER",
        "DATABASE_PASSWORD",
    ):
        monkeypatch.delenv(f"HDB_{name}", raising=False)
