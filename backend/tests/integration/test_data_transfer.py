"""Load, reconcile, rollback and realign identities on isolated PostgreSQL only."""

import pytest
from sqlalchemy import Connection, insert, select, text

from app.infrastructure.database import models
from data_migration.files import MigrationError
from data_migration.mapping import MAPPINGS
from data_migration.target import load, read_target, target_engine
from data_migration.validation import transform
from tests.migration_helpers import synthetic_source

pytestmark = pytest.mark.postgres


def test_canonical_migration_target_settings_connect() -> None:
    engine = target_engine("hdboutique_test")
    try:
        with engine.connect() as connection:
            assert connection.scalar(text("SELECT current_database()")) == (
                "hdboutique_test"
            )
    finally:
        engine.dispose()


def test_transfer_all_tables_and_reject_nonempty_target(
    database_connection: Connection,
) -> None:
    tables, issues = transform(synthetic_source())
    assert not issues
    report = load(database_connection, tables)
    assert report["fidelity_equal"] is True
    assert len(read_target(database_connection)) == 17
    generated = database_connection.scalar(
        insert(models.Department)
        .values(name="New synthetic")
        .returning(models.Department.department_id)
    )
    assert generated == 102
    with pytest.raises(MigrationError, match="not empty"):
        load(database_connection, tables)


def test_failed_transfer_rolls_back_rows_and_identity_restart(
    database_connection: Connection,
) -> None:
    tables, _ = transform(synthetic_source())
    with (
        pytest.raises(RuntimeError, match="synthetic"),
        database_connection.begin_nested(),
    ):
        load(database_connection, tables)
        raise RuntimeError("synthetic failure after load")
    assert all(not rows for rows in read_target(database_connection).values())
    assert load(database_connection, tables)["fidelity_equal"] is True


def test_late_identity_failure_rolls_back_whole_load(
    database_connection: Connection,
) -> None:
    tables, _ = transform(synthetic_source())
    tables["customer_payments"][0]["payment_id"] = 2**31 - 1
    with (
        pytest.raises(MigrationError, match="exhausted"),
        database_connection.begin_nested(),
    ):
        load(database_connection, tables)
    for item in MAPPINGS:
        assert database_connection.execute(select(item.table)).first() is None


def test_transfer_rejects_destination_with_identity_data(
    database_connection: Connection,
) -> None:
    database_connection.execute(
        insert(models.UserAccount).values(
            username="existing-synthetic",
            password_hash="synthetic-unused-hash",
            role="Administrator",
            is_active=True,
            employee_id=None,
        )
    )
    tables, _ = transform(synthetic_source())
    with pytest.raises(MigrationError, match="not empty"):
        load(database_connection, tables)
    assert all(not rows for rows in read_target(database_connection).values())
