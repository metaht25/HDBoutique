"""Sale boundaries reject client money, duplicate products and invalid quantities."""

import pytest
from pydantic import ValidationError

from app.modules.sales.schemas import SaleCreate
from app.modules.sales.service import request_digest


def payload() -> dict:
    return {
        "customer_id": 1,
        "employee_id": 2,
        "sale_date": "2026-10-28",
        "payment": {"shift_id": 1, "method": "cash", "received_amount": "1000.00"},
        "items": [{"product_id": 3, "quantity": 2}],
    }


@pytest.mark.parametrize("quantity", [True, "2", 0, -1, 1.5, 2147483648])
def test_quantity_is_a_bounded_positive_integer(quantity) -> None:
    values = payload()
    values["items"][0]["quantity"] = quantity
    with pytest.raises(ValidationError):
        SaleCreate(**values)


@pytest.mark.parametrize(
    "mutation",
    ["price", "total", "discount", "duplicate", "empty", "too_many", "boolean_id"],
)
def test_sale_rejects_ambiguous_or_client_controlled_data(mutation) -> None:
    values = payload()
    if mutation == "price":
        values["items"][0]["unit_price"] = "0.01"
    elif mutation in {"total", "discount"}:
        values[mutation] = "0.01"
    elif mutation == "duplicate":
        values["items"] *= 2
    elif mutation == "empty":
        values["items"] = []
    elif mutation == "too_many":
        values["items"] = [{"product_id": i + 1, "quantity": 1} for i in range(101)]
    else:
        values["customer_id"] = True
    with pytest.raises(ValidationError):
        SaleCreate(**values)


def test_digest_normalizes_defaults_and_preserves_order_and_quantities() -> None:
    first = SaleCreate(**payload())
    values = payload()
    values["items"].append({"product_id": 4, "quantity": 1})
    second = SaleCreate(**values)
    assert request_digest(first) != request_digest(second)
    assert request_digest(second) != request_digest(
        second.model_copy(update={"items": list(reversed(second.items))})
    )
    values.pop("employee_id")
    assert request_digest(SaleCreate(**values)) == request_digest(
        SaleCreate(**{**values, "employee_id": None})
    )
