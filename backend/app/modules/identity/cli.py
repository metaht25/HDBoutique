"""Explicit operator bootstrap; passwords are read interactively, never from argv."""

import argparse
import json
from getpass import getpass
from pathlib import Path

from pydantic import SecretStr, ValidationError

from app.core.config import Settings
from app.core.errors import ApplicationError
from app.infrastructure.database.connection import build_engine
from app.infrastructure.database.session import create_session_factory
from app.modules.boutique.schemas import ProfileWrite
from app.modules.identity.schemas import AccountCreate
from app.modules.identity.service import IdentityService
from app.modules.identity.setup import InitialSetupService
from app.modules.staff.schemas import EmployeeCreate


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Identity administration after Alembic"
    )
    parser.add_argument(
        "command",
        choices=["bootstrap-admin", "complete-setup", "setup-status", "purge-expired"],
    )
    parser.add_argument(
        "--database", required=True, help="Exact authorized target name"
    )
    parser.add_argument("--username")
    parser.add_argument("--employee-id", type=int)
    parser.add_argument("--setup-file", type=Path)
    args = parser.parse_args()
    settings = Settings()
    if args.database != settings.database_name:
        parser.error("The explicit database must match HDB_DATABASE_NAME")
    payload: AccountCreate | None = None
    setup_employee: EmployeeCreate | None = None
    setup_profile: ProfileWrite | None = None
    if args.command in {"bootstrap-admin", "complete-setup"}:
        if not args.username:
            parser.error("--username is required for bootstrap")
        if args.command == "complete-setup" and not args.setup_file:
            parser.error("complete-setup requires --setup-file with the real identity")
        if bool(args.setup_file) == bool(args.employee_id):
            parser.error(
                "Indica --setup-file o --employee-id explícito, sin combinarlos"
            )
        password = getpass(
            "Current Administrator password: "
            if args.command == "complete-setup"
            else "New Administrator password (12-128 characters): "
        )
        if args.command == "bootstrap-admin" and password != getpass(
            "Repeat password: "
        ):
            parser.error("Passwords do not match")
        try:
            if args.setup_file:
                if args.setup_file.stat().st_size > 4 * 1024 * 1024:
                    parser.error("El archivo de preparación supera 4 MB")
                data = json.loads(args.setup_file.read_text(encoding="utf-8-sig"))
                if not isinstance(data, dict) or set(data) != {"employee", "boutique"}:
                    parser.error("El archivo requiere employee y boutique")
                if (
                    not isinstance(data["employee"], dict)
                    or {"username", "password"} & data["employee"].keys()
                ):
                    parser.error(
                        "No guardes usuario ni contraseña en el archivo de preparación"
                    )
                setup_employee = EmployeeCreate.model_validate(
                    {
                        **data["employee"],
                        "username": args.username,
                        "password": password,
                    }
                )
                setup_profile = ProfileWrite.model_validate(data["boutique"])
            else:
                payload = AccountCreate(
                    username=args.username,
                    password=SecretStr(password),
                    role="Administrator",
                    employee_id=args.employee_id,
                )
        except (ValidationError, ValueError, OSError):
            parser.error(
                "Preparación inválida; revisa identidad, domicilio, perfil "
                "y contraseña sin imprimir sus valores"
            )
    engine = build_engine(settings)
    if engine is None:
        parser.error("Configure the authorized HDB_DATABASE_* target")
    assert engine is not None
    try:
        with create_session_factory(engine)() as session:
            service = IdentityService(session)
            try:
                if args.command == "setup-status":
                    print(json.dumps(InitialSetupService(session).status()))
                elif setup_employee is not None and setup_profile is not None:
                    InitialSetupService(session).configure(
                        setup_employee,
                        setup_profile,
                        existing_account=args.command == "complete-setup",
                    )
                elif payload is not None:
                    service.create_user(payload, bootstrap=True)
                else:
                    service.purge_expired()
            except ApplicationError as error:
                parser.exit(1, error.message + "\n")
        if args.command != "setup-status":
            print("Identity operation completed")
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
