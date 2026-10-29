"""Fail closed before any connection in the canonical synthetic rehearsals."""

import os


def require_isolated_rehearsal() -> None:
    expected = {
        "HOST": "db",
        "PORT": "5432",
        "NAME": "hdboutique_test",
        "USER": "hdboutique_app",
        "PASSWORD": "isolated-test-app-password",
    }
    for prefix in ("HDB_TEST_DATABASE_", "HDB_MIGRATION_DATABASE_"):
        if any(
            os.environ.get(prefix + suffix) != value
            for suffix, value in expected.items()
        ):
            raise RuntimeError(
                "Only canonical synthetic Compose rehearsal settings allowed"
            )
