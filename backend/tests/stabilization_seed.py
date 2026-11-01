"""Explicit seed for connected browser tests, exclusively in canonical tmpfs DB."""

from alembic import command
from sqlalchemy import inspect
from sqlalchemy.orm import sessionmaker

from data_migration.target import target_engine
from tests.integration.conftest import migration_config
from tests.rehearsal_helpers import require_isolated_rehearsal
from tests.sales_helpers import seed_sales


def main() -> None:
    require_isolated_rehearsal()
    engine = target_engine("hdboutique_test")
    try:
        with engine.begin() as connection:
            if inspect(connection).get_table_names():
                raise RuntimeError(
                    "Seed requires an empty test database; nothing was removed"
                )
            command.upgrade(migration_config(connection), "head")
        factory = sessionmaker(bind=engine, expire_on_commit=False)
        with factory.begin() as session:
            seed_sales(session)
        print(
            "Synthetic browser seed ready: two active roles, "
            "retired role trace and catalog"
        )
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
