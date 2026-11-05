"""First-installation preparation uses only the isolated migrated database."""

from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import func, select
from sqlalchemy.orm import sessionmaker

from app.core.config import Settings
from app.core.errors import ApplicationError
from app.main import create_app
from app.modules.boutique.models import BoutiqueProfile
from app.modules.boutique.schemas import ProfileWrite
from app.modules.identity.models import UserAccount
from app.modules.identity.schemas import AccountCreate
from app.modules.identity.security import hash_password
from app.modules.identity.service import IdentityService
from app.modules.identity.setup import InitialSetupService
from app.modules.locations.models import Address
from app.modules.staff.models import Employee
from app.modules.staff.schemas import EmployeeCreate
from tests.identity_helpers import SYNTHETIC_PASSWORD, TEST_ORIGIN, login

pytestmark = pytest.mark.postgres


@pytest.fixture
def setup_factory(postgres_engine):
    with postgres_engine.connect().execution_options(
        isolation_level="REPEATABLE READ"
    ) as connection:
        transaction = connection.begin()
        try:
            yield sessionmaker(
                bind=connection,
                expire_on_commit=False,
                join_transaction_mode="create_savepoint",
            )
        finally:
            transaction.rollback()


def identity_input() -> EmployeeCreate:
    return EmployeeCreate(
        username="setup-owner",
        password=SecretStr(SYNTHETIC_PASSWORD),
        first_names="Synthetic",
        last_names="Owner",
        phone_number="80000000",
        address={
            "department_id": 1,
            "municipality_id": 1,
            "address_line": "Synthetic home",
        },
    )


def profile_input(**changes) -> ProfileWrite:
    return ProfileWrite.model_validate(
        {
            "name": "Synthetic boutique",
            "address_line": "Synthetic shop",
            **changes,
        }
    )


def test_f06_initial_setup_is_operational_for_purchase_sale_and_receipt(setup_factory):
    with setup_factory() as session:
        user = InitialSetupService(session).configure(identity_input(), profile_input())
        assert user.employee_id is not None
        assert InitialSetupService(session).status() == {
            "administrator_can_login": True,
            "administrator_can_operate": True,
            "boutique_ready": True,
            "ready": True,
        }
    app = create_app(
        Settings(environment="test", business_api_enabled=True, auth_origin=TEST_ORIGIN)
    )
    app.state.session_factory = setup_factory
    with TestClient(
        app, base_url=TEST_ORIGIN, headers={"Origin": TEST_ORIGIN}
    ) as client:
        login(client, "setup-owner")
        category = client.post(
            "/api/v1/categories", json={"name": "Synthetic setup"}
        ).json()
        supplier_response = client.post(
            "/api/v1/purchases/suppliers",
            headers={"Idempotency-Key": "setup-supplier"},
            json={
                "company_name": "Synthetic supplier",
                "contact_first_names": "Test",
                "contact_last_names": "Person",
                "phone_number": "80000001",
            },
        )
        assert supplier_response.status_code == 201
        product_response = client.post(
            "/api/v1/products",
            json={
                "name": "Synthetic product",
                "category_id": category["category_id"],
                "size_id": 1,
                "cost": "100.00",
                "initial_stock": 0,
                "supplier_ids": [supplier_response.json()["supplier_id"]],
            },
        )
        assert product_response.status_code == 201
        product_id = product_response.json()["product_id"]
        business_date = client.get("/api/v1/dashboard/overview").json()["context"][
            "business_date"
        ]
        purchase = client.post(
            "/api/v1/purchases",
            headers={"Idempotency-Key": "setup-purchase"},
            json={
                "supplier_id": supplier_response.json()["supplier_id"],
                "purchase_date": business_date,
                "items": [{"product_id": product_id, "quantity": 2}],
            },
        )
        assert purchase.status_code == 201, purchase.text
        assert (
            client.post(
                f"/api/v1/purchases/{purchase.json()['purchase_id']}/receive", json={}
            ).status_code
            == 200
        )
        sale = client.post(
            "/api/v1/sales",
            headers={"Idempotency-Key": "setup-sale"},
            json={
                "customer_kind": "general",
                "items": [{"product_id": product_id, "quantity": 1}],
                "payment": {"method": "cash", "received_amount": "200.00"},
            },
        )
        assert sale.status_code == 201, sale.text
        receipt = client.get(f"/api/v1/receipts/{sale.json()['sale_id']}")
        assert receipt.status_code == 200
        assert receipt.json()["boutique"]["ready"] is True
        assert client.get(f"/api/v1/products/{product_id}").json()["legacy_stock"] == 1
    with setup_factory() as session:
        assert session.scalar(select(func.count()).select_from(UserAccount)) == 1


def test_f06_failed_profile_rolls_back_employee_account_and_address(setup_factory):
    with setup_factory() as session:
        with pytest.raises(ApplicationError) as error:
            InitialSetupService(session).configure(
                identity_input(), profile_input(logo_base64="not-base64")
            )
        assert error.value.code == "invalid_logo"
        for model in (UserAccount, Employee, Address, BoutiqueProfile):
            assert session.scalar(select(func.count()).select_from(model)) == 0


def test_f06_completes_legacy_account_without_replacing_password_or_link(setup_factory):
    encoded = hash_password(SYNTHETIC_PASSWORD)
    with setup_factory.begin() as session:
        user = UserAccount(
            username="setup-owner",
            password_hash=encoded,
            role="Administrator",
            is_active=True,
            employee_id=None,
        )
        session.add(user)
    with setup_factory() as session:
        saved = InitialSetupService(session).configure(
            identity_input(), profile_input(), existing_account=True
        )
        assert saved.user_id == user.user_id
        assert saved.password_hash == encoded
        assert saved.employee_id is not None
        employee_id = saved.employee_id
        with pytest.raises(ApplicationError) as error:
            InitialSetupService(session).configure(
                identity_input(), profile_input(name="Changed"), existing_account=True
            )
        assert error.value.code == "setup_already_linked"
        assert session.get(UserAccount, user.user_id).employee_id == employee_id
        assert session.scalar(select(func.count()).select_from(Employee)) == 1


def test_f06_existing_account_requires_its_current_password(setup_factory):
    with setup_factory.begin() as session:
        session.add(
            UserAccount(
                username="setup-owner",
                password_hash=hash_password("Different-password-123"),
                role="Administrator",
                is_active=True,
                employee_id=None,
            )
        )
    with setup_factory() as session:
        with pytest.raises(ApplicationError) as error:
            InitialSetupService(session).configure(
                identity_input(), profile_input(), existing_account=True
            )
        assert error.value.status == 403
        assert session.scalar(select(func.count()).select_from(Employee)) == 0


def test_f06_rejects_unlinked_bootstrap_even_outside_cli(setup_factory):
    with setup_factory() as session:
        with pytest.raises(ApplicationError) as error:
            IdentityService(session).create_user(
                AccountCreate(
                    username="setup-owner",
                    password=SecretStr(SYNTHETIC_PASSWORD),
                    role="Administrator",
                ),
                bootstrap=True,
            )
        assert error.value.code == "bootstrap_employee_required"


def test_f06_cli_requires_explicit_configuration_and_reports_readiness(
    setup_factory, tmp_path, monkeypatch, capsys
):
    import json

    from app.modules.identity import cli

    settings = Settings(
        environment="test",
        database_host="synthetic",
        database_name="hdboutique_test",
        database_user="synthetic",
        database_password=SecretStr("synthetic"),
    )
    engine = MagicMock()
    monkeypatch.setattr(cli, "Settings", lambda: settings)
    monkeypatch.setattr(cli, "build_engine", lambda configured: engine)
    monkeypatch.setattr(cli, "create_session_factory", lambda configured: setup_factory)
    monkeypatch.setattr(cli, "getpass", lambda prompt: SYNTHETIC_PASSWORD)
    args = [
        "identity",
        "bootstrap-admin",
        "--database",
        "hdboutique_test",
        "--username",
        "setup-owner",
    ]
    monkeypatch.setattr("sys.argv", args)
    with pytest.raises(SystemExit) as error:
        cli.main()
    assert error.value.code == 2
    path = tmp_path / "initial-setup.json"
    path.write_text(
        json.dumps(
            {
                "employee": identity_input().model_dump(
                    mode="json", exclude={"username", "password"}
                ),
                "boutique": profile_input().model_dump(mode="json"),
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr("sys.argv", [*args, "--setup-file", str(path)])
    monkeypatch.setattr(cli, "getpass", lambda prompt: "x" * 11)
    with pytest.raises(SystemExit) as weak_password:
        cli.main()
    assert weak_password.value.code == 1
    with setup_factory() as session:
        assert session.scalar(select(func.count()).select_from(UserAccount)) == 0
        assert session.scalar(select(func.count()).select_from(Employee)) == 0
    monkeypatch.setattr(cli, "getpass", lambda prompt: SYNTHETIC_PASSWORD)
    cli.main()
    monkeypatch.setattr(
        "sys.argv", ["identity", "setup-status", "--database", "hdboutique_test"]
    )
    cli.main()
    captured = capsys.readouterr()
    assert '"ready": true' in captured.out
    assert SYNTHETIC_PASSWORD not in captured.out + captured.err
    assert "x" * 11 not in captured.out + captured.err


@pytest.mark.parametrize("length", [6, 11, 12, 128])
def test_f07_bootstrap_password_boundaries_and_atomic_rollback(setup_factory, length):
    employee = identity_input().model_copy(update={"password": SecretStr("x" * length)})
    with setup_factory() as session:
        service = InitialSetupService(session)
        if length < 12:
            with pytest.raises(ApplicationError) as error:
                service.configure(employee, profile_input())
            assert error.value.code == "invalid_bootstrap_password"
            assert error.value.status == 422
            for model in (UserAccount, Employee, Address, BoutiqueProfile):
                assert session.scalar(select(func.count()).select_from(model)) == 0
        else:
            user = service.configure(employee, profile_input())
            from app.modules.identity.security import verify_password

            assert verify_password(user.password_hash, "x" * length)
            assert user.employee_id is not None


def test_f07_regular_account_and_legacy_completion_still_accept_six_characters(
    setup_factory,
):
    password = SecretStr("xxxxxx")
    with setup_factory() as session:
        legacy = IdentityService(session).create_user(
            AccountCreate(
                username="setup-owner", password=password, role="Administrator"
            )
        )
        original_hash = legacy.password_hash
        linked = InitialSetupService(session).configure(
            identity_input().model_copy(update={"password": password}),
            profile_input(),
            existing_account=True,
        )
        assert linked.password_hash == original_hash
        assert linked.employee_id is not None
        cashier = IdentityService(session).create_user(
            AccountCreate(
                username="ordinary-cashier", password=password, role="Cashier"
            )
        )
        assert cashier.role == "Cashier"
