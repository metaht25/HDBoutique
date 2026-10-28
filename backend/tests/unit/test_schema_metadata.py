"""Verify structural safeguards and deliberate legacy compatibility limits."""

from sqlalchemy.orm import configure_mappers

from app.infrastructure.database import models
from app.infrastructure.database.base import Base


def test_complete_registry_has_named_constraints_and_indexed_foreign_keys() -> None:
    configure_mappers()
    assert len(Base.metadata.tables) == 23
    assert len(Base.registry.mappers) == 23
    for table in Base.metadata.sorted_tables:
        assert table.primary_key.name == f"pk_{table.name}"
        for foreign_key in table.foreign_key_constraints:
            assert foreign_key.name is not None
            assert foreign_key.ondelete == "RESTRICT"
            assert any(
                list(index.columns) == list(foreign_key.columns)
                for index in table.indexes
            )


def test_stock_fields_remain_distinct_nullable_and_without_invented_defaults() -> None:
    columns = models.Product.__table__.c
    for name in ("legacy_stock_quantity", "legacy_stock"):
        assert columns[name].nullable
        assert columns[name].default is None
        assert columns[name].server_default is None
    assert "municipality_id" not in models.Address.__table__.c
    assert "principal" not in models.CustomerPayment.__table__.c
    assert "balance" not in models.CustomerPayment.__table__.c
