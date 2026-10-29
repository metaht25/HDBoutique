"""Synthetic backup/restore probe, exclusively for compose.test.yaml."""

import argparse
import os

from data_migration.reconciliation import reconcile
from data_migration.target import load, read_target, target_engine
from data_migration.validation import transform
from tests.integration.conftest import migration_config
from tests.migration_helpers import synthetic_source
from tests.rehearsal_helpers import require_isolated_rehearsal


def main() -> None:
    from alembic import command

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("operation", choices=("prepare", "verify"))
    parser.add_argument("--database", default="hdboutique_test")
    args = parser.parse_args()
    if args.database not in ("hdboutique_test", "hdboutique_restore_test"):
        raise RuntimeError("Only synthetic Compose rehearsal databases allowed")
    require_isolated_rehearsal()
    for suffix in ("HOST", "PORT", "NAME", "USER", "PASSWORD"):
        os.environ["HDB_MIGRATION_DATABASE_" + suffix] = os.environ[
            "HDB_TEST_DATABASE_" + suffix
        ]
    os.environ["HDB_MIGRATION_DATABASE_NAME"] = args.database
    engine = target_engine(args.database)
    tables, issues = transform(synthetic_source())
    assert not issues
    try:
        with engine.begin() as connection:
            if args.operation == "prepare":
                command.upgrade(migration_config(connection), "head")
                load(connection, tables)
            assert reconcile(tables, read_target(connection))["fidelity_equal"]
        print("Synthetic rehearsal: 17 tables reconciled exactly")
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
