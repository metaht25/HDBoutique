"""Owner-managed durable logo, sanitized to PNG; no executable uploads."""

import base64
import binascii
import warnings
from io import BytesIO

from PIL import Image, UnidentifiedImageError
from sqlalchemy.orm import Session

from app.core.errors import ApplicationError
from app.modules.boutique.audit import audit
from app.modules.boutique.models import BoutiqueProfile
from app.modules.boutique.schemas import ProfileRead, ProfileWrite, ReceiptRead
from app.modules.identity.service import Principal
from app.modules.sales.service import SaleService


def clean_logo(encoded: str) -> bytes:
    try:
        raw = base64.b64decode(encoded, validate=True)
        if len(raw) > 2 * 1024 * 1024:
            raise ValueError("size")
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(raw)) as image:
                if image.format not in {"PNG", "JPEG", "WEBP"}:
                    raise ValueError("format")
                if (
                    image.width > 3000
                    or image.height > 3000
                    or image.width * image.height > 4000000
                ):
                    raise ValueError("dimensions")
                image.load()
                image.thumbnail((600, 600))
                output = BytesIO()
                image.convert("RGBA").save(output, format="PNG", optimize=True)
                return output.getvalue()
    except (
        ValueError,
        OSError,
        binascii.Error,
        UnidentifiedImageError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ) as error:
        raise ApplicationError(
            422,
            "invalid_logo",
            "Usa una imagen PNG, JPEG o WebP de hasta 2 MB y 3000 píxeles por lado.",
        ) from error


def profile_read(profile: BoutiqueProfile | None) -> ProfileRead:
    if profile is None:
        return ProfileRead()
    return ProfileRead(
        name=profile.name,
        phone_number=profile.phone_number,
        address_line=profile.address_line,
        logo_base64=base64.b64encode(profile.logo).decode() if profile.logo else None,
        ready=bool(profile.name and profile.phone_number and profile.address_line),
    )


class BoutiqueService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def profile(self) -> ProfileRead:
        with self.session.begin():
            return profile_read(self.session.get(BoutiqueProfile, 1))

    def save(self, payload: ProfileWrite, actor: Principal) -> ProfileRead:
        logo = clean_logo(payload.logo_base64) if payload.logo_base64 else None
        with self.session.begin():
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
            receipt_number=f"R-{sale.payment.payment_id:05d}",
            sale_number=f"V-{sale_id:05d}",
            boutique=self.profile(),
            sale=sale,
        )
