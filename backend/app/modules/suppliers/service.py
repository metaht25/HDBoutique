"""suppliers use cases with explicit service-owned transactions."""

from contextlib import nullcontext
from datetime import UTC, datetime
from hashlib import sha256

from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import ApplicationError
from app.modules.boutique.audit import audit
from app.modules.boutique.models import ManagementEvent
from app.modules.catalog.models import Product
from app.modules.locations.composition import save_inline_address
from app.modules.suppliers.models import Supplier, SupplierOffering, SupplierProduct
from app.modules.suppliers.repository import SuppliersRepository
from app.modules.suppliers.schemas import (
    SupplierCreate,
    SupplierOfferingCreate,
    SupplierOfferingPatch,
    SupplierPatch,
    SupplierProductCreate,
    SupplierProductPatch,
)


class SuppliersService:
    def register_contextual(
        self, payload: SupplierCreate, actor_id: int, key: str
    ) -> Supplier:
        key_hash = sha256(f"supplier:{actor_id}:{key}".encode()).hexdigest()
        fingerprint = sha256(payload.model_dump_json().encode()).hexdigest()
        with self.session.begin():
            self.session.execute(
                text("SELECT pg_advisory_xact_lock(:key)"),
                {"key": int(key_hash[:15], 16)},
            )
            event = self.session.scalar(
                select(ManagementEvent).where(
                    ManagementEvent.resource == "suppliers",
                    ManagementEvent.action == "contextual_created",
                    ManagementEvent.actor_id == actor_id,
                    ManagementEvent.detail.startswith(key_hash + ":"),
                )
            )
            if event is not None:
                if event.detail != key_hash + ":" + fingerprint:
                    raise ApplicationError(
                        409, "idempotency_conflict", "Reintenta con los mismos datos."
                    )
                existing = self.repository.get_supplier(event.record_id)
                if existing is None:
                    raise ApplicationError(
                        409, "supplier_unavailable", "Proveedor no disponible."
                    )
                return existing
            record = self.save_supplier(payload, actor_id=actor_id, in_transaction=True)
            audit(
                self.session,
                "suppliers",
                record.supplier_id,
                "contextual_created",
                actor_id,
                key_hash + ":" + fingerprint,
            )
            return record

    def __init__(self, session: Session) -> None:

        self.session = session

        self.repository = SuppliersRepository(session)

    def list_supplier(
        self, offset: int, limit: int, query: str | None = None
    ) -> list[Supplier]:

        with self.session.begin():
            return self.repository.list_supplier(offset, limit, query)

    def get_supplier(self, record_id: int) -> Supplier:

        with self.session.begin():
            record = self.repository.get_supplier(record_id)

            if record is None:
                raise ApplicationError(404, "not_found", "Record not found")

            return record

    def save_supplier(
        self,
        payload: SupplierCreate | SupplierPatch,
        record_id: int | None = None,
        actor_id: int | None = None,
        *,
        in_transaction: bool = False,
    ) -> Supplier:

        if record_id is not None and payload.model_fields_set != {"is_active"}:
            raise ApplicationError(
                403,
                "directory_read_only",
                "Solo se permite activar o desactivar proveedores.",
            )
        try:
            with nullcontext() if in_transaction else self.session.begin():
                values = payload.model_dump(exclude_unset=True)

                values.pop("address", None)

                if payload.address is not None:
                    if payload.address_id is not None:
                        raise ApplicationError(
                            422, "ambiguous_address", "Indica un único domicilio."
                        )

                    values["address_id"] = save_inline_address(
                        self.session, payload.address
                    )

                if record_id is None:
                    record = Supplier(created_at=datetime.now(UTC), **values)

                else:
                    existing = self.repository.get_supplier(record_id)

                    if existing is None:
                        raise ApplicationError(404, "not_found", "Record not found")

                    record = existing

                if not self.repository.validate_supplier_references(values):
                    raise ApplicationError(
                        422, "invalid_reference", "Related record not found"
                    )

                for field, value in values.items():
                    setattr(record, field, value)

                self.repository.add_supplier(record)

                audit(
                    self.session,
                    "suppliers",
                    record.supplier_id,
                    "created" if record_id is None else "updated",
                    actor_id,
                    ",".join(sorted(values)),
                )

            return record

        except IntegrityError as error:
            raise ApplicationError(
                409, "integrity_conflict", "Conflicting related data"
            ) from error

    def delete_supplier(self, record_id: int) -> None:

        try:
            with self.session.begin():
                record = self.repository.get_supplier(record_id)

                if record is None:
                    raise ApplicationError(404, "not_found", "Record not found")

                raise ApplicationError(
                    409,
                    "history_preserved",
                    "Desactiva el proveedor para conservar su historia.",
                )

        except IntegrityError as error:
            raise ApplicationError(
                409, "integrity_conflict", "Record is referenced"
            ) from error

    def list_supplier_product(self, offset: int, limit: int) -> list[SupplierProduct]:

        with self.session.begin():
            return self.repository.list_supplier_product(offset, limit)

    def get_supplier_product(self, record_id: int) -> SupplierProduct:

        with self.session.begin():
            record = self.repository.get_supplier_product(record_id)

            if record is None:
                raise ApplicationError(404, "not_found", "Record not found")

            return record

    def save_supplier_product(
        self,
        payload: SupplierProductCreate | SupplierProductPatch,
        record_id: int | None = None,
    ) -> SupplierProduct:

        try:
            with self.session.begin():
                values = payload.model_dump(exclude_unset=True)

                if record_id is None:
                    record = SupplierProduct(**values)

                else:
                    existing = self.repository.get_supplier_product(record_id)

                    if existing is None:
                        raise ApplicationError(404, "not_found", "Record not found")

                    record = existing

                if not self.repository.validate_supplier_product_references(values):
                    raise ApplicationError(
                        422, "invalid_reference", "Related record not found"
                    )

                for field, value in values.items():
                    setattr(record, field, value)

                self.repository.add_supplier_product(record)

            return record

        except IntegrityError as error:
            raise ApplicationError(
                409, "integrity_conflict", "Conflicting related data"
            ) from error

    def delete_supplier_product(self, record_id: int) -> None:

        try:
            with self.session.begin():
                record = self.repository.get_supplier_product(record_id)

                if record is None:
                    raise ApplicationError(404, "not_found", "Record not found")

                self.repository.delete_supplier_product(record)

        except IntegrityError as error:
            raise ApplicationError(
                409, "integrity_conflict", "Record is referenced"
            ) from error

    def list_supplier_offering(self, offset: int, limit: int) -> list[SupplierOffering]:

        with self.session.begin():
            return self.repository.list_supplier_offering(offset, limit)

    def get_supplier_offering(self, record_id: int) -> SupplierOffering:

        with self.session.begin():
            record = self.repository.get_supplier_offering(record_id)

            if record is None:
                raise ApplicationError(404, "not_found", "Record not found")

            return record

    def save_supplier_offering(
        self,
        payload: SupplierOfferingCreate | SupplierOfferingPatch,
        record_id: int | None = None,
    ) -> SupplierOffering:

        try:
            with self.session.begin():
                values = payload.model_dump(exclude_unset=True)

                if record_id is None:
                    record = SupplierOffering(**values)

                else:
                    existing = self.repository.get_supplier_offering(record_id)

                    if existing is None:
                        raise ApplicationError(404, "not_found", "Record not found")

                    record = existing

                if not self.repository.validate_supplier_offering_references(values):
                    raise ApplicationError(
                        422, "invalid_reference", "Related record not found"
                    )

                supplier_id = values.get("supplier_id", record.supplier_id)
                relation_id = values.get(
                    "supplier_product_id", record.supplier_product_id
                )
                supplier = self.session.scalar(
                    select(Supplier)
                    .where(Supplier.supplier_id == supplier_id)
                    .with_for_update()
                )
                relation = self.session.get(SupplierProduct, relation_id)
                product = (
                    self.session.get(Product, relation.product_id) if relation else None
                )
                if (
                    supplier is None
                    or not supplier.is_active
                    or product is None
                    or not product.is_active
                ):
                    raise ApplicationError(
                        422,
                        "invalid_reference",
                        "Selecciona proveedor y producto activos.",
                    )
                duplicate = self.session.scalar(
                    select(SupplierOffering.offering_id)
                    .where(
                        SupplierOffering.supplier_id == supplier_id,
                        SupplierOffering.supplier_product_id == relation_id,
                        SupplierOffering.offering_id != (record_id or 0),
                    )
                    .limit(1)
                )
                if duplicate is not None:
                    raise ApplicationError(
                        409, "duplicate_offering", "La asociación ya existe."
                    )

                for field, value in values.items():
                    setattr(record, field, value)

                self.repository.add_supplier_offering(record)

            return record

        except IntegrityError as error:
            raise ApplicationError(
                409, "integrity_conflict", "Conflicting related data"
            ) from error

    def delete_supplier_offering(self, record_id: int) -> None:

        try:
            with self.session.begin():
                record = self.repository.get_supplier_offering(record_id)

                if record is None:
                    raise ApplicationError(404, "not_found", "Record not found")

                self.repository.delete_supplier_offering(record)

        except IntegrityError as error:
            raise ApplicationError(
                409, "integrity_conflict", "Record is referenced"
            ) from error
