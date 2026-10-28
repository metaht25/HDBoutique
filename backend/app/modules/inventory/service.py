"""Movement history with service-owned read transactions."""

from sqlalchemy.orm import Session

from app.modules.inventory.repository import InventoryRepository
from app.modules.inventory.schemas import MovementRead


class InventoryService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.repository = InventoryRepository(session)

    def list_movements(
        self, offset: int, limit: int, product_id: int | None, purchase_id: int | None
    ) -> list[MovementRead]:
        with self.session.begin():
            return [
                MovementRead.model_validate(row)
                for row in self.repository.list_movements(
                    offset,
                    limit,
                    product_id,
                    purchase_id,
                )
            ]
