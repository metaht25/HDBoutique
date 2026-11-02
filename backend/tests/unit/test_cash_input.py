"""Money formatting and explicit manual confirmation at the cash boundary."""

import pytest
from pydantic import TypeAdapter, ValidationError

from app.modules.cash.schemas import CashMoney, PaymentCreate, VoidCreate


def test_cash_money_always_serializes_two_decimal_places():
    adapter = TypeAdapter(CashMoney)
    assert adapter.dump_json(adapter.validate_python("0")) == b'"0.00"'
    assert adapter.dump_json(adapter.validate_python("10.1")) == b'"10.10"'


@pytest.mark.parametrize("confirmed", [False, 1, "true", None])
def test_manual_transfer_requires_an_explicit_boolean_confirmation(confirmed):
    with pytest.raises(ValidationError):
        PaymentCreate(
            method="transfer",
            received_amount="1.00",
            reference="synthetic",
            transfer_confirmed=confirmed,
        )
    with pytest.raises(ValidationError):
        VoidCreate(
            reason="Synthetic",
            refund_confirmed=confirmed,
            items=[{"sale_item_id": 1, "returned_quantity": 0}],
        )
