"""Inventory persistence; writes share their purchase or sale transaction."""

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.modules.cash.models import SaleReturnItem
from app.modules.catalog.models import Product
from app.modules.inventory.models import InventoryMovement
from app.modules.purchases.models import PurchaseItem
from app.modules.sales.models import SaleItem


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
        self,
        offset: int,
        limit: int,
        product_id: int | None,
        purchase_id: int | None,
        sale_id: int | None = None,
    ) -> list[InventoryMovement]:
        statement = select(InventoryMovement)
        if product_id is not None:
            statement = statement.where(InventoryMovement.product_id == product_id)
        if purchase_id is not None:
            statement = statement.join(PurchaseItem).where(
                PurchaseItem.purchase_id == purchase_id
            )
        if sale_id is not None:
            item_ids = select(SaleItem.sale_item_id).where(SaleItem.sale_id == sale_id)
            return_ids = select(SaleReturnItem.return_item_id).where(
                SaleReturnItem.sale_item_id.in_(item_ids)
            )
            statement = statement.where(
                or_(
                    InventoryMovement.sale_item_id.in_(item_ids),
                    InventoryMovement.return_item_id.in_(return_ids),
                )
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
