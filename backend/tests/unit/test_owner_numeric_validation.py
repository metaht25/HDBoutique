"""New writes reject ambiguous numeric syntax without tightening historical reads."""

import pytest
from pydantic import ValidationError

from app.modules.cash.schemas import PaymentCreate
from app.modules.customers.schemas import CustomerCreate, CustomerRead


@pytest.mark.parametrize("amount", ["1e2", "1_000", "1,50", "1.001", "1.", True, 1.25])
def test_invalid_money_input(amount: object) -> None:
    with pytest.raises(ValidationError):
        PaymentCreate.model_validate({"method": "cash", "received_amount": amount})


@pytest.mark.parametrize("phone", ["abc", "12e4", "123-45", "１２３４", 12345678])
def test_invalid_new_customer_phone(phone: object) -> None:
    with pytest.raises(ValidationError):
        CustomerCreate.model_validate(
            {"first_names": "Ana", "last_names": "Prueba", "phone_number": phone}
        )


def test_historical_phone_remains_readable() -> None:
    row = CustomerRead.model_validate(
        {
            "customer_id": 1,
            "address_id": None,
            "customer_type_id": None,
            "kind": None,
            "first_names": "Ana",
            "last_names": "Prueba",
            "phone_number": "old-value",
            "is_active": True,
            "created_at": None,
        }
    )
    assert row.phone_number == "old-value"
