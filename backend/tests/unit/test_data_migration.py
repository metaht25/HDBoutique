"""Migration regressions: preserve history, reject lossy conversion and omissions."""

import copy
import sys
from decimal import Decimal
from pathlib import Path

import pytest

from data_migration.__main__ import main
from data_migration.files import (
    MigrationError,
    bundle,
    read_bundle,
    read_document,
    write_document,
)
from data_migration.mapping import MAPPINGS
from data_migration.reconciliation import profile, reconcile
from data_migration.source import (
    CATALOG_QUERIES,
    compare_schema,
    quote,
    source_connection,
)
from data_migration.target import target_engine
from data_migration.validation import transform
from tests.migration_helpers import synthetic_source


def test_lossless_roundtrip_and_profile(tmp_path: Path) -> None:
    path = tmp_path / "source.json"
    write_document(path, bundle(synthetic_source(), stage="source"))
    tables, issues = transform(read_bundle(path, stage="source"))
    assert not issues and len(tables) == 17
    assert tables["products"][0]["legacy_stock_quantity"] == 12
    assert tables["products"][0]["legacy_stock"] == 3
    assert tables["products"][0]["name"] is None
    assert tables["sale_items"][0]["unit_price"] == Decimal("199.00")
    assert reconcile(tables, copy.deepcopy(tables))["fidelity_equal"] is True
    assert profile(tables)["business_rules_validated"] is False
    with pytest.raises(FileExistsError):
        write_document(path, {})


@pytest.mark.parametrize(
    "value", ["1.001", "NaN", "Infinity", 1.2, True, "100000000.00"]
)
def test_money_rejection_never_returns_partial_data(value: object) -> None:
    source = synthetic_source()
    source["Productos"][0]["PrecioUnitario"] = value
    tables, issues = transform(source)
    assert not tables and issues
    assert "value" not in str(issues)


@pytest.mark.parametrize(
    "mutation,code",
    [("duplicate", "duplicate_pk"), ("orphan", "orphan"), ("missing", "field_set")],
)
def test_rejections_identify_table_and_row(mutation: str, code: str) -> None:
    source = synthetic_source()
    if mutation == "duplicate":
        source["Departamento"].append(source["Departamento"][0].copy())
    elif mutation == "orphan":
        source["Direccion"][0]["ID_Departamento"] = 999
    else:
        del source["Clientes"][0]["Nombres"]
    _, issues = transform(source)
    assert code in {issue["code"] for issue in issues}


def test_reconcile_detects_offsetting_money_changes_and_text_changes() -> None:
    tables, issues = transform(synthetic_source())
    assert not issues
    changed = copy.deepcopy(tables)
    changed["sales"][0]["total"] = Decimal("399.00")
    changed["customer_payments"][0]["amount"] = Decimal("99.50")
    changed["customers"][0]["first_names"] = "Changed synthetic"
    assert reconcile(tables, changed)["fidelity_equal"] is False


def test_physical_inventory_does_not_assume_offering_identity() -> None:
    issues = compare_schema({"columns": [], "indexes": []}, "dbo", "ActualKey")
    assert any(issue["table"] == "Ofrece" for issue in issues)
    assert all(sql.lstrip().startswith("SELECT") for sql in CATALOG_QUERIES.values())
    assert quote("x]; DELETE") == "[x]]; DELETE]"


def test_no_source_connection_without_authorization(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("HDB_MIGRATION_SQLSERVER_ODBC", raising=False)
    with pytest.raises(MigrationError), source_connection(authorized=False):
        pass
    with pytest.raises(MigrationError), source_connection(authorized=True):
        pass


def test_no_target_fallback(monkeypatch: pytest.MonkeyPatch) -> None:
    for suffix in ("HOST", "PORT", "NAME", "USER", "PASSWORD"):
        monkeypatch.delenv("HDB_MIGRATION_DATABASE_" + suffix, raising=False)
    with pytest.raises(MigrationError):
        target_engine("hdboutique_test")
    with pytest.raises(MigrationError):
        target_engine("hdboutique")


def test_cli_transform_then_profile_and_rejection(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    source = tmp_path / "source.json"
    target = tmp_path / "target.json"
    report = tmp_path / "report.json"
    write_document(source, bundle(synthetic_source(), stage="source"))
    monkeypatch.setattr(
        sys,
        "argv",
        ["migration", "transform", "--input", str(source), "--output", str(target)],
    )
    assert main() == 0
    monkeypatch.setattr(
        sys,
        "argv",
        ["migration", "profile", "--input", str(target), "--output", str(report)],
    )
    assert main() == 0
    assert isinstance(read_document(report), dict)
    assert len(read_bundle(target, stage="target")) == len(MAPPINGS)


def test_duplicate_json_keys_and_missing_tables_are_rejected(tmp_path: Path) -> None:
    path = tmp_path / "bad.json"
    path.write_text('{"a": 1, "a": 2}')
    with pytest.raises(MigrationError):
        read_document(path)
    path.write_text("{}")
    with pytest.raises(MigrationError):
        read_bundle(path, stage="source")
