"""Assigned credentials and canonical Nicaraguan employee phones."""

import pytest
from pydantic import ValidationError

from app.modules.staff.schemas import EmployeeCreate, EmployeePatch


@pytest.mark.parametrize(
    "phone",
    [
        "8000000",
        "800000000",
        "60000000",
        "8000-0000",
        " 80000000",
        "80000000 ",
        "áéíóúüñ?",
        "8a000000",
        80000000,
        True,
    ],
)
def test_reject_noncanonical_employee_phone(phone):
    with pytest.raises(ValidationError):
        EmployeePatch(phone_number=phone)


@pytest.mark.parametrize("phone", ["70000000", "80000000"])
def test_assigned_password_and_no_email(phone):
    payload = EmployeeCreate(
        username="synthetic",
        password=" abcde ",
        first_names="Test",
        last_names="Test",
        phone_number=phone,
    )
    assert payload.password.get_secret_value() == " abcde "
    assert "work_email" not in payload.model_dump()
    with pytest.raises(ValidationError):
        EmployeeCreate(**{**payload.model_dump(), "work_email": "test@example.invalid"})
    with pytest.raises(ValidationError):
        EmployeePatch(password="short")
