"""Private owner profile and owner-scoped receipt preview/PDF."""

from fastapi import APIRouter, Response

from app.api.dependencies import DatabaseSession
from app.modules.boutique.schemas import ProfileRead, ProfileWrite, ReceiptRead
from app.modules.boutique.service import BoutiqueService
from app.modules.identity.dependencies import AdministratorIdentity, SalesIdentity

router = APIRouter(prefix="/api/v1", tags=["boutique"])


@router.get("/boutique-profile", response_model=ProfileRead)
def profile(session: DatabaseSession, actor: AdministratorIdentity) -> ProfileRead:
    return BoutiqueService(session).profile()


@router.put("/boutique-profile", response_model=ProfileRead)
def save_profile(
    payload: ProfileWrite, session: DatabaseSession, actor: AdministratorIdentity
) -> ProfileRead:
    return BoutiqueService(session).save(payload, actor)


@router.get("/receipts/{sale_id}", response_model=ReceiptRead)
def receipt(
    sale_id: int, session: DatabaseSession, actor: SalesIdentity
) -> ReceiptRead:
    return BoutiqueService(session).receipt(sale_id, actor)


@router.get("/receipts/{sale_id}/pdf")
def receipt_pdf(
    sale_id: int, session: DatabaseSession, actor: SalesIdentity
) -> Response:
    from app.modules.boutique.pdf import receipt_pdf as render_pdf

    receipt = BoutiqueService(session).receipt(sale_id, actor)
    return Response(
        render_pdf(receipt),
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{receipt.receipt_number}.pdf"'
            )
        },
    )
