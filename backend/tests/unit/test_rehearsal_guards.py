"""Synthetic rehearsal commands must not trust unrelated test/ETL credentials."""

import pytest

from tests.rehearsal_helpers import require_isolated_rehearsal


@pytest.fixture
def isolated_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    for prefix in ("HDB_TEST_DATABASE_", "HDB_MIGRATION_DATABASE_"):
        for field, value in {
            "HOST": "db",
            "PORT": "5432",
            "NAME": "hdboutique_test",
            "USER": "hdboutique_app",
            "PASSWORD": "isolated-test-app-password",
        }.items():
            monkeypatch.setenv(prefix + field, value)


def test_rehearsal_accepts_only_canonical_settings(isolated_settings: None) -> None:
    require_isolated_rehearsal()


@pytest.mark.parametrize("prefix", ["HDB_TEST_DATABASE_", "HDB_MIGRATION_DATABASE_"])
@pytest.mark.parametrize("field", ["HOST", "NAME", "PASSWORD"])
def test_rehearsal_refuses_mixed_targets_before_connecting(
    isolated_settings: None, monkeypatch: pytest.MonkeyPatch, prefix: str, field: str
) -> None:
    monkeypatch.setenv(prefix + field, "not-the-isolated-value")
    with pytest.raises(RuntimeError, match="Only canonical"):
        require_isolated_rehearsal()
