"""All monetary entry points reject inexact JSON numbers before persistence."""

from decimal import Decimal

import pytest
from pydantic import BaseModel, ValidationError

from app.modules.cash.schemas import PaymentCreate
from app.modules.suppliers.schemas import SupplierProductCreate, SupplierProductPatch


@pytest.mark.parametrize(
    ("schema", "payload", "field"),
    [
        (PaymentCreate, {"method": "cash"}, "received_amount"),
        (SupplierProductCreate, {"product_id": 1}, "purchase_price"),
        (SupplierProductPatch, {}, "purchase_price"),
    ],
)
def test_money_commands_require_exact_values(
    schema: type[BaseModel], payload: dict[str, object], field: str
) -> None:
    for value in (1.25, True, "1.001", "NaN", "Infinity", "1000000000000.00"):
        with pytest.raises(ValidationError):
            schema.model_validate({**payload, field: value})
    for value in ("1.25", Decimal("1.25"), 1):
        result = schema.model_validate({**payload, field: value})
        assert getattr(result, field) == Decimal(str(value))
