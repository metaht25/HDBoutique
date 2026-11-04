"""Shared mobile phone validation leaves optional customer phones optional."""

import pytest
from pydantic import ValidationError

from app.modules.customers.schemas import CustomerCreate
from app.modules.suppliers.schemas import SupplierCreate


@pytest.mark.parametrize("phone", ["8123-4567", "7123-4567", "81234567"])
def test_phone_is_canonical(phone):
    value = CustomerCreate(
        first_names="Synthetic", last_names="Customer", phone_number=phone
    )
    assert value.phone_number == phone.replace("-", "")


@pytest.mark.parametrize(
    "phone", ["8123456", "812345678", "812A4567", "61234567", "", 81234567, "８1234567"]
)
def test_invalid_phone_is_rejected_everywhere(phone):
    for model, body in [
        (CustomerCreate, {"first_names": "Synthetic", "last_names": "Customer"}),
        (
            SupplierCreate,
            {
                "company_name": "Synthetic",
                "contact_first_names": "Synthetic",
                "contact_last_names": "Contact",
            },
        ),
    ]:
        with pytest.raises(ValidationError):
            model.model_validate({**body, "phone_number": phone})


def test_regular_customer_needs_only_name():
    assert (
        CustomerCreate(first_names="Synthetic", last_names="Customer").phone_number
        is None
    )
