"""Explicit owner-authorized profile update; never run at application startup."""

import argparse

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.infrastructure.database.connection import build_engine
from app.modules.boutique.schemas import ProfileWrite
from app.modules.boutique.service import BoutiqueService
from app.modules.identity.models import UserAccount
from app.modules.identity.service import principal_from_user


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", required=True)
    parser.add_argument("--actor-id", required=True, type=int)
    parser.add_argument("--name", required=True)
    parser.add_argument("--address", required=True)
    parser.add_argument("--apply", action="store_true", required=True)
    args = parser.parse_args()
    settings = Settings()
    if args.database != settings.database_name:
        raise ValueError("Explicit database must match the configured destination")
    engine = build_engine(settings)
    if engine is None:
        raise ValueError("Configured database required")
    try:
        with Session(engine, expire_on_commit=False) as session:
            with session.begin():
                user = session.get(UserAccount, args.actor_id)
                if user is None or not user.is_active or user.role != "Administrator":
                    raise ValueError(
                        "An existing active owner must authorize the audit"
                    )
                actor = principal_from_user(user)
            profile = BoutiqueService(session).save(
                ProfileWrite(
                    name=args.name,
                    address_line=args.address,
                    phone_number=None,
                    remove_logo=True,
                ),
                actor,
            )
            if (
                not profile.ready
                or profile.phone_number is not None
                or profile.logo_base64
            ):
                raise ValueError("Profile verification failed")
            print("Owner profile updated and audited; no commercial records modified")
        return 0
    finally:
        engine.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
