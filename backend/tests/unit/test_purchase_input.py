"""Financial and idempotency boundaries independent of a database."""

from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.modules.purchases.schemas import PurchaseCreate
from app.modules.purchases.service import request_digest


def payload(**changes: object) -> dict[str, object]:
    return {
        "supplier_id": 1,
        "employee_id": 2,
        "purchase_date": "2026-10-28",
        "items": [{"supplier_product_id": 3, "quantity": 2}],
        **changes,
    }


@pytest.mark.parametrize(
    "value", [0.1, True, "NaN", "Infinity", "0.001", "100000000.00"]
)
def test_shipping_cost_never_rounds_or_uses_binary_money(value: object) -> None:
    with pytest.raises(ValidationError):
        PurchaseCreate(**payload(shipping_cost=value))


def test_idempotency_normalizes_money_without_reordering_lines() -> None:
    first = PurchaseCreate(**payload(shipping_cost="1.00"))
    second = PurchaseCreate(**payload(shipping_cost=1))
    assert first.shipping_cost == Decimal("1.00")
    assert str(second.shipping_cost) == "1.00"
    assert request_digest(first) == request_digest(second)
    assert PurchaseCreate(**payload()).shipping_cost == Decimal("0.00")
