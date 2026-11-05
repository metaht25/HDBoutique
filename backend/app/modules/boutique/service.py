"""Owner-managed durable logo, sanitized to PNG; no executable uploads."""

import base64
import binascii
import os
import subprocess
import sys
from contextlib import nullcontext
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.errors import ApplicationError
from app.modules.boutique.audit import audit
from app.modules.boutique.logo_worker import MAX_LOGO_BYTES, WORKER_TIMEOUT
from app.modules.boutique.models import BoutiqueProfile
from app.modules.boutique.schemas import ProfileRead, ProfileWrite, ReceiptRead
from app.modules.identity.service import Principal
from app.modules.sales.service import SaleService


def clean_logo(encoded: str) -> bytes:
    try:
        if len(encoded) > 4 * ((MAX_LOGO_BYTES + 2) // 3):
            raise ValueError("size")
        raw = base64.b64decode(encoded, validate=True)
        if not raw or len(raw) > MAX_LOGO_BYTES:
            raise ValueError("size")
        # No database credentials or application environment enter the decoder.
        environment = {
            key: value
            for key in ("SYSTEMROOT", "WINDIR")
            if (value := os.environ.get(key)) is not None
        }
        result = subprocess.run(
            [sys.executable, "-I", str(Path(__file__).with_name("logo_worker.py"))],
            input=raw,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            timeout=WORKER_TIMEOUT,
            check=False,
            env=environment,
        )
        if result.returncode == 2 or result.returncode < 0:
            raise ValueError("invalid or resource-limited image")
        if (
            result.returncode
            or not result.stdout.startswith(b"\x89PNG\r\n\x1a\n")
            or len(result.stdout) > MAX_LOGO_BYTES
        ):
            raise ApplicationError(
                503,
                "logo_processing_unavailable",
                "No se pudo procesar el logo. Intenta nuevamente.",
            )
        return result.stdout
    except (ValueError, binascii.Error, subprocess.TimeoutExpired) as error:
        raise ApplicationError(
            422,
            "invalid_logo",
            "Usa una imagen PNG, JPEG o WebP de hasta 2 MB y 3000 píxeles por lado.",
        ) from error
    except OSError as error:
        raise ApplicationError(
            503,
            "logo_processing_unavailable",
            "El procesamiento de logos no está disponible.",
        ) from error


def profile_read(profile: BoutiqueProfile | None) -> ProfileRead:
    if profile is None:
        return ProfileRead()
    return ProfileRead(
        name=profile.name,
        phone_number=profile.phone_number,
        address_line=profile.address_line,
        logo_base64=base64.b64encode(profile.logo).decode() if profile.logo else None,
        ready=bool(profile.name and profile.address_line),
    )


class BoutiqueService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def profile(self) -> ProfileRead:
        with self.session.begin():
            return profile_read(self.session.get(BoutiqueProfile, 1))

    def save(
        self, payload: ProfileWrite, actor: Principal, *, in_transaction: bool = False
    ) -> ProfileRead:
        logo = clean_logo(payload.logo_base64) if payload.logo_base64 else None
        with nullcontext() if in_transaction else self.session.begin():
            self.session.execute(text("SELECT pg_advisory_xact_lock(671443120621)"))
            profile = self.session.get(BoutiqueProfile, 1, with_for_update=True)
            if profile is None:
                profile = BoutiqueProfile(profile_id=1)
                self.session.add(profile)
            profile.name, profile.phone_number, profile.address_line = (
                payload.name,
                payload.phone_number,
                payload.address_line,
            )
            if payload.remove_logo:
                profile.logo = None
            elif logo is not None:
                profile.logo = logo
            audit(self.session, "boutique_profiles", 1, "updated", actor.user_id)
            self.session.flush()
            return profile_read(profile)

    def receipt(self, sale_id: int, actor: Principal) -> ReceiptRead:
        sale = SaleService(self.session).get_sale(sale_id, actor)
        if sale.payment is None:
            raise ApplicationError(
                409,
                "receipt_unavailable",
                "Esta venta histórica no tiene un pago registrado; no se emite un "
                "recibo de cobro.",
            )
        return ReceiptRead(
            receipt_number=str(sale.payment.payment_id),
            sale_number=f"V-{sale_id:05d}",
            boutique=self.profile(),
            sale=sale,
        )
