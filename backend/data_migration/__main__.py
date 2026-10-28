"""Operator CLI: no automatic credentials, database creation or source writes."""

import argparse
import sys
from pathlib import Path

from sqlalchemy import text

from data_migration.files import MigrationError, bundle, read_bundle, write_document
from data_migration.mapping import mapping_document
from data_migration.reconciliation import profile, reconcile
from data_migration.source import compare_schema, extract, inventory, source_connection
from data_migration.target import load, read_target, target_engine
from data_migration.validation import transform


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "command",
        choices=(
            "mapping",
            "inventory",
            "extract",
            "transform",
            "profile",
            "load",
            "reconcile",
        ),
    )
    parser.add_argument("--input", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--source-authorized", action="store_true")
    parser.add_argument("--stable-copy", action="store_true")
    parser.add_argument("--schema", default="dbo")
    parser.add_argument("--offering-id-column")
    parser.add_argument("--database")
    args = parser.parse_args()
    try:
        if args.output.exists():
            raise MigrationError("Output exists; choose a new evidence path")
        if args.command == "mapping":
            write_document(args.output, mapping_document())
        elif args.command in ("inventory", "extract"):
            if args.command == "extract" and not args.offering_id_column:
                raise MigrationError(
                    "Specify physical --offering-id-column; never inferred"
                )
            if args.command == "extract" and not args.stable_copy:
                raise MigrationError("Extraction requires an authorized stable copy")
            with source_connection(authorized=args.source_authorized) as connection:
                if args.command == "inventory":
                    catalog = inventory(connection)
                    write_document(
                        args.output,
                        {
                            "catalog": catalog,
                            "mapping_differences": compare_schema(
                                catalog, args.schema, args.offering_id_column or "id"
                            ),
                        },
                    )
                else:
                    write_document(
                        args.output,
                        bundle(
                            extract(connection, args.schema, args.offering_id_column),
                            stage="source",
                        ),
                    )
        else:
            if args.input is None:
                raise MigrationError("--input required")
            source_names = args.command == "transform"
            tables, rejected = transform(
                read_bundle(args.input, stage="source" if source_names else "target"),
                source_names=source_names,
            )
            if rejected:
                write_document(args.output, {"status": "rejected", "issues": rejected})
                return 2
            if args.command == "transform":
                write_document(args.output, bundle(tables, stage="target"))
            elif args.command == "profile":
                write_document(args.output, profile(tables))
            else:
                if not args.database:
                    raise MigrationError("--database required")
                engine = target_engine(args.database)
                try:
                    with engine.begin() as connection:
                        if args.command == "load":
                            report = load(connection, tables)
                        else:
                            connection.execute(
                                text(
                                    "SET TRANSACTION ISOLATION LEVEL "
                                    "REPEATABLE READ READ ONLY"
                                )
                            )
                            actual, issues = transform(
                                read_target(connection), source_names=False
                            )
                            if issues:
                                raise MigrationError(
                                    "Target structural validation failed"
                                )
                            report = reconcile(tables, actual)
                    write_document(args.output, report)
                    if not report["fidelity_equal"]:
                        return 2
                finally:
                    engine.dispose()
        return 0
    except MigrationError as error:
        print(str(error), file=sys.stderr)
        return 2
    except Exception:
        # Driver exceptions can contain passwords, SQL parameters and personal data.
        print(
            "Migration command failed; no sensitive details logged. "
            "Check inputs, permissions and private evidence.",
            file=sys.stderr,
        )
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
