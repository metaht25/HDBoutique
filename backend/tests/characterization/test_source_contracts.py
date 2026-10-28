"""Check declared public contracts without importing Django or opening a database."""

import ast
import json
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[3]
LEGACY_ROOT = PROJECT_ROOT / "backend" / "hdboutique"
FIXTURE_PATH = Path(__file__).parent / "fixtures" / "legacy_contracts.json"
CONTRACTS = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))["resources"]


def parse_source(path: Path) -> ast.Module:
    return ast.parse(path.read_text(encoding="utf-8-sig"), filename=str(path))


def declared_fields(model_label: str) -> dict[str, dict[str, str | bool]]:
    app_name, model_name = model_label.split(".")
    tree = parse_source(LEGACY_ROOT / app_name / "models.py")
    model = next(
        node
        for node in tree.body
        if isinstance(node, ast.ClassDef) and node.name == model_name
    )
    fields = {}
    for node in model.body:
        if not isinstance(node, ast.Assign) or not isinstance(node.value, ast.Call):
            continue
        call = node.value
        if not isinstance(call.func, ast.Attribute):
            continue
        if not isinstance(call.func.value, ast.Name) or call.func.value.id != "models":
            continue
        options = {keyword.arg: keyword.value for keyword in call.keywords}
        fields[node.targets[0].id] = {
            "type": call.func.attr,
            "nullable": ast.literal_eval(options["null"])
            if "null" in options
            else False,
            "blank": ast.literal_eval(options["blank"])
            if "blank" in options
            else False,
            "primary_key": (
                ast.literal_eval(options["primary_key"])
                if "primary_key" in options
                else False
            ),
        }
    # El modelo Ofrece espera una PK implicita de Django; no confirma la PK fisica.
    if not any(field["primary_key"] for field in fields.values()):
        fields["id"] = {
            "type": "AutoField",
            "nullable": False,
            "blank": False,
            "primary_key": True,
        }
    return fields


class DeclaredApiContractTests(unittest.TestCase):
    def test_all_registered_resource_paths_are_documented(self):
        paths = set()
        root_tree = parse_source(LEGACY_ROOT / "hdboutique" / "urls.py")
        for call in ast.walk(root_tree):
            if not (
                isinstance(call, ast.Call)
                and isinstance(call.func, ast.Name)
                and call.func.id == "path"
                and len(call.args) >= 2
                and isinstance(call.args[1], ast.Call)
                and isinstance(call.args[1].func, ast.Name)
                and call.args[1].func.id == "include"
            ):
                continue
            prefix = ast.literal_eval(call.args[0])
            module_name = ast.literal_eval(call.args[1].args[0])
            router_path = LEGACY_ROOT.joinpath(*module_name.split("."))
            router_tree = parse_source(router_path.with_suffix(".py"))
            for registration in ast.walk(router_tree):
                if (
                    isinstance(registration, ast.Call)
                    and isinstance(registration.func, ast.Attribute)
                    and registration.func.attr == "register"
                ):
                    resource = ast.literal_eval(registration.args[0])
                    paths.add(f"/{prefix}{resource}/")
        expected_paths = [contract["path"] for contract in CONTRACTS]
        self.assertEqual(
            len(expected_paths),
            len(set(expected_paths)),
            "Duplicate paths in fixture",
        )
        self.assertEqual(paths, set(expected_paths))

    def test_public_field_names_and_required_inputs_match_declared_models(self):
        for contract in CONTRACTS:
            with self.subTest(resource=contract["path"]):
                fields = declared_fields(contract["model"])
                self.assertEqual(set(fields), set(contract["example"]))
                self.assertEqual(
                    {name for name, field in fields.items() if field["primary_key"]},
                    {contract["primary_key"]},
                )
                self.assertEqual(
                    {name for name, field in fields.items() if field["nullable"]},
                    set(contract["nullable_fields"]),
                )
                self.assertEqual(
                    {
                        name
                        for name, field in fields.items()
                        if not (
                            field["primary_key"] or field["nullable"] or field["blank"]
                        )
                    },
                    set(contract["required_fields"]),
                )

    def test_synthetic_examples_preserve_json_value_categories(self):
        for contract in CONTRACTS:
            for name, field in declared_fields(contract["model"]).items():
                with self.subTest(resource=contract["path"], field=name):
                    value = contract["example"][name]
                    if value is None:
                        self.assertTrue(field["nullable"])
                    elif field["type"] in {"AutoField", "IntegerField", "ForeignKey"}:
                        self.assertIs(type(value), int)
                    else:
                        self.assertIsInstance(value, str)


if __name__ == "__main__":
    unittest.main()
