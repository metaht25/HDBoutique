"""Fingerprint continuity without exporting any synthetic record values."""

import json
from decimal import Decimal

import pytest
from sqlalchemy import Engine, update
from sqlalchemy.orm import sessionmaker

from app.modules.catalog.models import Product
from app.operations.snapshot import capture
from tests.sales_helpers import cleanup_sales, seed_sales

pytestmark = pytest.mark.postgres


def test_snapshot_fingerprints(postgres_engine: Engine) -> None:
    factory = sessionmaker(bind=postgres_engine, expire_on_commit=False)
    with factory.begin() as session:
        graph = seed_sales(session)
    try:
        before = capture(postgres_engine)
        assert before["tables"]["products"]["count"] == 2
        assert capture(postgres_engine) == before
        assert "Synthetic-password" not in json.dumps(before)
        assert "199.50" not in json.dumps(before)
        with factory.begin() as session:
            session.execute(
                update(Product)
                .where(Product.product_id == graph["product1"])
                .values(unit_price=Decimal("88.25"))
            )
        after = capture(postgres_engine)
        assert (
            before["tables"]["products"]["count"]
            == after["tables"]["products"]["count"]
        )
        assert (
            before["tables"]["products"]["sha256"]
            != after["tables"]["products"]["sha256"]
        )
        assert before["sequences"] == after["sequences"]
    finally:
        with factory.begin() as session:
            cleanup_sales(session, graph)
