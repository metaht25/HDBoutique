"""catalog use cases with explicit service-owned transactions."""

from datetime import UTC, datetime
from decimal import ROUND_HALF_UP, Decimal
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import ApplicationError
from app.modules.boutique.audit import audit
from app.modules.catalog.models import Category, Product, Size
from app.modules.catalog.repository import CatalogRepository
from app.modules.catalog.schemas import (
    CategoryCreate,
    CategoryPatch,
    ProductCreate,
    ProductPatch,
    SizeCreate,
    SizePatch,
)
from app.modules.identity.service import Principal
from app.modules.inventory.models import InventoryMovement
from app.modules.suppliers.models import Supplier, SupplierOffering, SupplierProduct


class CatalogService:
    def __init__(self, session: Session) -> None:

        self.session = session

        self.repository = CatalogRepository(session)

    def list_category(self, offset: int, limit: int) -> list[Category]:

        with self.session.begin():
            return self.repository.list_category(offset, limit)

    def get_category(self, record_id: int) -> Category:

        with self.session.begin():
            record = self.repository.get_category(record_id)

            if record is None:
                raise ApplicationError(404, "not_found", "Record not found")

            return record

    def save_category(
        self, payload: CategoryCreate | CategoryPatch, record_id: int | None = None
    ) -> Category:

        try:
            with self.session.begin():
                values = payload.model_dump(exclude_unset=True)

                if record_id is None:
                    record = Category(**values)

                else:
                    existing = self.repository.get_category(record_id)

                    if existing is None:
                        raise ApplicationError(404, "not_found", "Record not found")

                    record = existing

                if not self.repository.validate_category_references(values):
                    raise ApplicationError(
                        422, "invalid_reference", "Related record not found"
                    )

                for field, value in values.items():
                    setattr(record, field, value)

                self.repository.add_category(record)

            return record

        except IntegrityError as error:
            raise ApplicationError(
                409, "integrity_conflict", "Conflicting related data"
            ) from error

    def delete_category(self, record_id: int) -> None:

        try:
            with self.session.begin():
                record = self.repository.get_category(record_id)

                if record is None:
                    raise ApplicationError(404, "not_found", "Record not found")

                self.repository.delete_category(record)

        except IntegrityError as error:
            raise ApplicationError(
                409, "integrity_conflict", "Record is referenced"
            ) from error

    def list_size(self, offset: int, limit: int) -> list[Size]:

        with self.session.begin():
            return self.repository.list_size(offset, limit)

    def get_size(self, record_id: int) -> Size:

        with self.session.begin():
            record = self.repository.get_size(record_id)

            if record is None:
                raise ApplicationError(404, "not_found", "Record not found")

            return record

    def save_size(
        self, payload: SizeCreate | SizePatch, record_id: int | None = None
    ) -> Size:

        try:
            with self.session.begin():
                values = payload.model_dump(exclude_unset=True)

                if record_id is None:
                    record = Size(**values)

                else:
                    existing = self.repository.get_size(record_id)

                    if existing is None:
                        raise ApplicationError(404, "not_found", "Record not found")

                    record = existing

                if not self.repository.validate_size_references(values):
                    raise ApplicationError(
                        422, "invalid_reference", "Related record not found"
                    )

                for field, value in values.items():
                    setattr(record, field, value)

                self.repository.add_size(record)

            return record

        except IntegrityError as error:
            raise ApplicationError(
                409, "integrity_conflict", "Conflicting related data"
            ) from error

    def delete_size(self, record_id: int) -> None:

        try:
            with self.session.begin():
                record = self.repository.get_size(record_id)

                if record is None:
                    raise ApplicationError(404, "not_found", "Record not found")

                self.repository.delete_size(record)

        except IntegrityError as error:
            raise ApplicationError(
                409, "integrity_conflict", "Record is referenced"
            ) from error

    def list_product(
        self, offset: int, limit: int, query: str | None = None
    ) -> list[Product]:

        with self.session.begin():
            return self.repository.list_product(offset, limit, query)

    def get_product(self, record_id: int) -> Product:

        with self.session.begin():
            record = self.repository.get_product(record_id)

            if record is None:
                raise ApplicationError(404, "not_found", "Record not found")

            return record

    def save_product(
        self,
        payload: ProductCreate | ProductPatch,
        record_id: int | None = None,
        actor: Principal | None = None,
    ) -> Product:

        if actor is None or actor.role != "Administrator":
            raise ApplicationError(
                403, "permission_denied", "Solo la dueña puede gestionar productos."
            )

        try:
            with self.session.begin():
                values = payload.model_dump(exclude_unset=True)

                initial = values.pop("initial_stock", 0)

                if record_id is None:
                    record = Product(
                        legacy_stock=initial,
                        created_date=datetime.now(ZoneInfo("America/Managua")).date(),
                        **values,
                    )

                else:
                    existing = self.session.scalar(
                        select(Product)
                        .where(Product.product_id == record_id)
                        .with_for_update()
                    )

                    if existing is None:
                        raise ApplicationError(
                            404, "not_found", "Producto no encontrado."
                        )

                    record = existing

                if not self.repository.validate_product_references(values):
                    raise ApplicationError(
                        422, "invalid_reference", "Revisa la categoría y talla."
                    )

                supplier_id = values.get("supplier_id", record.supplier_id)

                if supplier_id is not None:
                    supplier = self.session.get(Supplier, supplier_id)

                    if supplier is None or not supplier.is_active:
                        raise ApplicationError(
                            422, "inactive_supplier", "Selecciona un proveedor activo."
                        )

                for field, value in values.items():
                    setattr(record, field, value)

                if "cost" in values:
                    assert record.cost is not None
                    record.unit_price = (record.cost * Decimal("1.15")).quantize(
                        Decimal("0.01"), rounding=ROUND_HALF_UP
                    )

                self.repository.add_product(record)

                if record_id is None:
                    self.session.add(
                        InventoryMovement(
                            product_id=record.product_id,
                            movement_type="initial_stock",
                            quantity=initial,
                            stock_before=0,
                            stock_after=initial,
                            created_at=datetime.now(UTC),
                            performed_by_user_id=actor.user_id,
                            employee_id=actor.employee_id,
                        )
                    )

                if record.supplier_id and record.cost is not None:
                    offered = self.session.scalar(
                        select(SupplierProduct)
                        .join(
                            SupplierOffering,
                            SupplierOffering.supplier_product_id
                            == SupplierProduct.supplier_product_id,
                        )
                        .where(
                            SupplierProduct.product_id == record.product_id,
                            SupplierOffering.supplier_id == record.supplier_id,
                        )
                        .order_by(SupplierProduct.supplier_product_id)
                        .with_for_update()
                    )

                    if offered is None:
                        offered = SupplierProduct(
                            product_id=record.product_id, purchase_price=record.cost
                        )

                        self.session.add(offered)

                        self.session.flush()

                        self.session.add(
                            SupplierOffering(
                                supplier_id=record.supplier_id,
                                supplier_product_id=offered.supplier_product_id,
                            )
                        )

                    elif "cost" in values:
                        assert record.cost is not None
                        offered.purchase_price = record.cost

                audit(
                    self.session,
                    "products",
                    record.product_id,
                    "created" if record_id is None else "updated",
                    actor.user_id,
                    ",".join(sorted(values)),
                )

            return record

        except IntegrityError as error:
            raise ApplicationError(
                409,
                "integrity_conflict",
                "No se pudo guardar el producto por un conflicto de datos.",
            ) from error

    def delete_product(self, record_id: int) -> None:

        try:
            with self.session.begin():
                record = self.repository.get_product(record_id)

                if record is None:
                    raise ApplicationError(404, "not_found", "Record not found")

                raise ApplicationError(
                    409,
                    "history_preserved",
                    "Desactiva el producto para conservar su historia.",
                )

        except IntegrityError as error:
            raise ApplicationError(
                409, "integrity_conflict", "Record is referenced"
            ) from error
