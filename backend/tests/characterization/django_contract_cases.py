"""HTTP adapter and serializer characterization without persistence."""

import json
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace
from unittest import expectedFailure
from unittest.mock import patch

from django.apps import apps
from django.test import SimpleTestCase
from django.urls import resolve
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIRequestFactory, force_authenticate

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "legacy_contracts.json"
CONTRACTS = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))["resources"]


def sample_instance(contract):
    model = apps.get_model(contract["model"])
    values = {}
    for name, value in contract["example"].items():
        field = model._meta.get_field(name)
        values[field.attname] = None if value is None else field.to_python(value)
    return model(**values)


class LegacyAdapterContractTests(SimpleTestCase):
    databases = set()

    def setUp(self):
        self.factory = APIRequestFactory()
        self.user = SimpleNamespace(is_authenticated=True, is_active=True)

    def authenticated_request(self, method, path, data=None):
        request = getattr(self.factory, method)(path, data=data, format="json")
        force_authenticate(request, user=self.user)
        return request

    def test_collection_and_detail_routes_expose_existing_crud_methods(self):
        for contract in CONTRACTS:
            with self.subTest(resource=contract["path"]):
                collection = resolve(contract["path"]).func
                detail = resolve(f"{contract['path']}101/").func
                self.assertEqual(collection.actions["get"], "list")
                self.assertEqual(collection.actions["post"], "create")
                self.assertEqual(detail.actions["get"], "retrieve")
                self.assertEqual(detail.actions["put"], "update")
                self.assertEqual(detail.actions["patch"], "partial_update")
                self.assertEqual(detail.actions["delete"], "destroy")

    def test_list_response_keeps_fields_decimal_strings_and_flat_foreign_keys(self):
        for contract in CONTRACTS:
            with self.subTest(resource=contract["path"]):
                view = resolve(contract["path"]).func
                with patch.object(
                    view.cls,
                    "get_queryset",
                    return_value=[sample_instance(contract)],
                ):
                    response = view(self.authenticated_request("get", contract["path"]))
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data, [contract["example"]])

    def test_empty_list_remains_an_array(self):
        for contract in CONTRACTS:
            with self.subTest(resource=contract["path"]):
                view = resolve(contract["path"]).func
                with patch.object(view.cls, "get_queryset", return_value=[]):
                    response = view(self.authenticated_request("get", contract["path"]))
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data, [])

    def test_detail_returns_one_flat_object(self):
        for contract in CONTRACTS:
            with self.subTest(resource=contract["path"]):
                path = (
                    f"{contract['path']}{contract['example'][contract['primary_key']]}/"
                )
                match = resolve(path)
                with patch.object(
                    match.func.cls,
                    "get_object",
                    return_value=sample_instance(contract),
                ):
                    response = match.func(
                        self.authenticated_request("get", path), **match.kwargs
                    )
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data, contract["example"])

    def test_serializer_required_nullable_and_read_only_fields(self):
        for contract in CONTRACTS:
            with self.subTest(resource=contract["path"]):
                serializer = resolve(contract["path"]).func.cls.serializer_class()
                self.assertEqual(set(serializer.fields), set(contract["example"]))
                self.assertEqual(
                    {
                        name
                        for name, field in serializer.fields.items()
                        if field.required
                    },
                    set(contract["required_fields"]),
                )
                self.assertEqual(
                    {
                        name
                        for name, field in serializer.fields.items()
                        if field.allow_null
                    },
                    set(contract["nullable_fields"]),
                )
                self.assertEqual(
                    {
                        name
                        for name, field in serializer.fields.items()
                        if field.read_only
                    },
                    {contract["primary_key"]},
                )

    def test_missing_required_inputs_return_field_errors_without_database_access(self):
        for contract in CONTRACTS:
            if not contract["required_fields"]:
                continue
            with self.subTest(resource=contract["path"]):
                view = resolve(contract["path"]).func
                response = view(
                    self.authenticated_request("post", contract["path"], {})
                )
                self.assertEqual(response.status_code, 400)
                self.assertEqual(set(response.data), set(contract["required_fields"]))
                for errors in response.data.values():
                    self.assertEqual(errors[0].code, "required")

    def test_product_decimal_and_date_field_validation(self):
        product = resolve("/api/productos/productos/").func.cls.serializer_class()
        sale = resolve("/api/ventas/ventas/").func.cls.serializer_class()
        self.assertEqual(
            product.fields["preciounitario"].run_validation("199.50"),
            Decimal("199.50"),
        )
        with self.assertRaises(ValidationError) as price_error:
            product.fields["preciounitario"].run_validation("199.501")
        self.assertEqual(price_error.exception.detail[0].code, "max_decimal_places")
        with self.assertRaises(ValidationError) as date_error:
            sale.fields["fechaventa"].run_validation("not-a-date")
        self.assertEqual(date_error.exception.detail[0].code, "invalid")


class KnownDefectRegressionTests(SimpleTestCase):
    databases = set()

    @expectedFailure
    def test_sale_item_supports_fractional_unit_prices_defect_d03(self):
        """D03: expected failure until sale item prices support decimals."""
        serializer = resolve("/api/ventas/detalles-ventas/").func.cls.serializer_class()
        self.assertEqual(
            serializer.fields["preciounitario"].run_validation("199.50"),
            Decimal("199.50"),
        )
