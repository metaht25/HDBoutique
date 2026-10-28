"""Explicit operator bootstrap; passwords are read interactively, never from argv."""

import argparse
from getpass import getpass

from pydantic import SecretStr, ValidationError

from app.core.config import Settings
from app.core.errors import ApplicationError
from app.infrastructure.database.connection import build_engine
from app.infrastructure.database.session import create_session_factory
from app.modules.identity.schemas import AccountCreate
from app.modules.identity.service import IdentityService


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Identity administration after Alembic"
    )
    parser.add_argument("command", choices=["bootstrap-admin", "purge-expired"])
    parser.add_argument(
        "--database", required=True, help="Exact authorized target name"
    )
    parser.add_argument("--username")
    args = parser.parse_args()
    settings = Settings()
    if args.database != settings.database_name:
        parser.error("The explicit database must match HDB_DATABASE_NAME")
    payload: AccountCreate | None = None
    if args.command == "bootstrap-admin":
        if not args.username:
            parser.error("--username is required for bootstrap")
        password = getpass("New Administrator password: ")
        if password != getpass("Repeat password: "):
            parser.error("Passwords do not match")
        try:
            payload = AccountCreate(
                username=args.username,
                password=SecretStr(password),
                role="Administrator",
            )
        except ValidationError:
            parser.error("Invalid username or password (minimum 12 characters)")
    engine = build_engine(settings)
    if engine is None:
        parser.error("Configure the authorized HDB_DATABASE_* target")
    assert engine is not None
    try:
        with create_session_factory(engine)() as session:
            service = IdentityService(session)
            try:
                if payload is not None:
                    service.create_user(payload, bootstrap=True)
                else:
                    service.purge_expired()
            except ApplicationError as error:
                parser.exit(1, error.message + "\n")
        print("Identity operation completed")
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
