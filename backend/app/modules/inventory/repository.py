"""Inventory persistence; all writes share the purchase receipt transaction."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.catalog.models import Product
from app.modules.inventory.models import InventoryMovement
from app.modules.purchases.models import PurchaseItem


class InventoryRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def lock_products(self, product_ids: set[int]) -> dict[int, Product]:
        products = self.session.scalars(
            select(Product)
            .where(
                Product.product_id.in_(product_ids),
            )
            .order_by(Product.product_id)
            .with_for_update()
        )
        return {product.product_id: product for product in products}

    def append_movement(self, movement: InventoryMovement) -> None:
        self.session.add(movement)
        self.session.flush()

    def list_movements(
        self, offset: int, limit: int, product_id: int | None, purchase_id: int | None
    ) -> list[InventoryMovement]:
        statement = select(InventoryMovement)
        if product_id is not None:
            statement = statement.where(InventoryMovement.product_id == product_id)
        if purchase_id is not None:
            statement = statement.join(PurchaseItem).where(
                PurchaseItem.purchase_id == purchase_id
            )
        return list(
            self.session.scalars(
                statement.order_by(
                    InventoryMovement.movement_id,
                )
                .offset(offset)
                .limit(limit)
            )
        )
