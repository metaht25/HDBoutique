"""Atomic immutable sales with exact historical prices and safe inventory issues."""

import json
from datetime import UTC, datetime
from decimal import Decimal
from hashlib import sha256
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.schemas import validate_mobile_phone
from app.core.errors import ApplicationError
from app.modules.boutique.audit import audit
from app.modules.cash.models import SalePayment
from app.modules.cash.schemas import PaymentRead
from app.modules.cash.service import CashService
from app.modules.catalog.models import Size
from app.modules.customers.models import Customer
from app.modules.customers.service import CustomersService, general_customer
from app.modules.identity.service import Principal
from app.modules.inventory.models import InventoryMovement
from app.modules.inventory.repository import InventoryRepository
from app.modules.locations.composition import address_text, save_inline_address
from app.modules.locations.models import Address
from app.modules.sales.models import Sale, SaleItem
from app.modules.sales.repository import SaleRepository
from app.modules.sales.schemas import SaleCreate, SaleLineRead, SaleRead
from app.modules.sales.workflow_models import SaleWorkflow
from app.modules.staff.models import Employee

MAX_TOTAL = Decimal("99999999.99")


def request_digest(payload: SaleCreate) -> str:
    values = payload.model_dump(mode="json")
    if payload.customer is None:
        values.pop("customer")
    if payload.delivery_details is None:
        values.pop("delivery_details")
    if values["payment"]["shift_id"] is None:
        values["payment"].pop("shift_id")
    return sha256(
        json.dumps(values, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


class SaleService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.repository = SaleRepository(session)
        self.inventory = InventoryRepository(session)

    def _seller_name(self, employee_id: int) -> str:
        employee = self.session.get(Employee, employee_id)
        assert employee is not None
        return f"{employee.first_names} {employee.last_names}"

    def _size_name(self, size_id: int) -> str | None:
        size = self.session.get(Size, size_id)
        return size.name if size else None

    def _employee(self, actor: Principal, requested: int | None) -> int:
        account = self.repository.account(actor.user_id)
        if (
            account is None
            or not account.is_active
            or account.role not in {"Administrator", "Cashier"}
        ):
            raise ApplicationError(403, "permission_denied", "Permission denied")
        if requested not in (
            None,
            account.employee_id,
        ):
            raise ApplicationError(422, "employee_mismatch", "Use the account employee")
        employee_id = account.employee_id
        if employee_id is None or not self.repository.employee_exists(employee_id):
            raise ApplicationError(
                422,
                "employee_required",
                "Vincula la cuenta a un empleado activo antes de operar.",
            )
        return employee_id

    def _detail(self, sale_id: int) -> SaleRead:
        sale = self.repository.get_sale(sale_id)
        if sale is None:
            raise ApplicationError(404, "not_found", "Sale not found")
        workflow = self.repository.workflow(sale_id)
        annulment = CashService(self.session).void_detail(sale_id)
        payment = self.session.scalar(
            select(SalePayment).where(SalePayment.sale_id == sale_id)
        )
        return SaleRead(
            sale_id=sale.sale_id,
            customer_id=sale.customer_id,
            employee_id=sale.employee_id,
            sale_date=sale.sale_date,
            total=sale.total,
            customer_kind=sale.customer_kind,
            customer_name=sale.customer_name,
            customer_phone=sale.customer_phone,
            customer_address=sale.customer_address,
            seller_name=sale.seller_name,
            delivery_cost=sale.delivery_cost,
            notes=sale.notes,
            status="voided" if annulment else "confirmed" if workflow else None,
            payment=PaymentRead.model_validate(payment) if payment else None,
            annulment=annulment,
            created_by_user_id=workflow.created_by_user_id if workflow else None,
            created_at=workflow.created_at if workflow else None,
            items=[
                SaleLineRead(
                    sale_item_id=item.sale_item_id,
                    product_id=item.product_id,
                    product_name=item.product_name,
                    size_name=item.size_name,
                    quantity=item.quantity,
                    unit_price=item.unit_price,
                    subtotal=item.unit_price * item.quantity,
                )
                for item in self.repository.lines(sale_id)
            ],
        )

    def get_sale(self, sale_id: int, actor: Principal | None = None) -> SaleRead:
        with self.session.begin():
            if actor and actor.role == "Cashier":
                workflow = self.repository.workflow(sale_id)
                if workflow is None or workflow.created_by_user_id != actor.user_id:
                    raise ApplicationError(404, "not_found", "Recibo no encontrado.")
            return self._detail(sale_id)

    def list_sales(
        self, offset: int, limit: int, actor: Principal | None = None
    ) -> list[SaleRead]:
        with self.session.begin():
            return [
                self._detail(sale.sale_id)
                for sale in self.repository.list_sales(
                    offset,
                    limit,
                    actor.user_id if actor and actor.role == "Cashier" else None,
                )
            ]

    def register(self, payload: SaleCreate, actor: Principal, key: str) -> SaleRead:
        key_hash = sha256(key.encode()).hexdigest()
        fingerprint = request_digest(payload)
        try:
            with self.session.begin():
                self.repository.lock_idempotency(actor.user_id, key_hash)
                existing = self.repository.by_idempotency(actor.user_id, key_hash)
                if existing is not None:
                    if existing.request_hash != fingerprint:
                        raise ApplicationError(
                            409,
                            "idempotency_conflict",
                            "Key already used for another request",
                        )
                    return self._detail(existing.sale_id)
                employee_id = self._employee(actor, payload.employee_id)
                cash = CashService(self.session)
                customer: Customer | None
                if payload.customer is not None:
                    if (
                        payload.customer_id is not None
                        or payload.customer_kind == "general"
                    ):
                        raise ApplicationError(
                            422,
                            "ambiguous_customer",
                            "Selecciona un cliente o registra uno nuevo.",
                        )
                    if payload.customer.kind != payload.customer_kind:
                        raise ApplicationError(
                            422, "invalid_customer_type", "Revisa el tipo de cliente."
                        )
                    customer = CustomersService(self.session).save_customer(
                        payload.customer, actor_id=actor.user_id, in_transaction=True
                    )
                else:
                    customer = (
                        general_customer(self.session)
                        if payload.customer_kind == "general"
                        else self.session.scalar(
                            select(Customer)
                            .where(Customer.customer_id == payload.customer_id)
                            .with_for_update()
                        )
                        if payload.customer_id
                        else None
                    )
                if customer is None or not customer.is_active:
                    raise ApplicationError(
                        422, "invalid_reference", "Selecciona un cliente activo."
                    )
                if payload.customer_kind != "general" and customer.technical_key:
                    raise ApplicationError(
                        422,
                        "invalid_customer_type",
                        "Usa Cliente general para ventas sin datos personales.",
                    )
                if (
                    payload.customer_kind == "general"
                    and payload.customer_id is not None
                ):
                    raise ApplicationError(
                        422,
                        "invalid_customer_type",
                        "Cliente general no requiere seleccionar una persona.",
                    )
                if payload.customer_kind == "delivery":
                    if payload.delivery_details is not None:
                        if payload.customer_id is None or payload.customer is not None:
                            raise ApplicationError(
                                422,
                                "invalid_delivery",
                                "Selecciona un cliente para completar sus datos.",
                            )
                        customer.phone_number = payload.delivery_details.phone_number
                        customer.address_id = save_inline_address(
                            self.session, payload.delivery_details.address
                        )
                        audit(
                            self.session,
                            "customers",
                            customer.customer_id,
                            "delivery_updated",
                            actor.user_id,
                            "phone_number,address_id",
                        )
                    address = (
                        self.session.get(Address, customer.address_id)
                        if customer.address_id
                        else None
                    )
                    try:
                        validate_mobile_phone(customer.phone_number)
                    except ValueError as error:
                        raise ApplicationError(
                            422,
                            "delivery_details_required",
                            "Completa un teléfono móvil válido para delivery.",
                        ) from error
                    if (
                        not customer.phone_number
                        or address is None
                        or not address.municipality_id
                        or not address.address_line
                    ):
                        raise ApplicationError(
                            422,
                            "delivery_details_required",
                            "Completa teléfono, departamento, municipio "
                            "y dirección para delivery.",
                        )
                elif payload.delivery_cost != 0 or payload.delivery_details is not None:
                    raise ApplicationError(
                        422,
                        "invalid_delivery",
                        "El costo de delivery solo corresponde a Cliente delivery.",
                    )
                # El mismo orden de bloqueo que recepciones evita actualizaciones
                # perdidas y ciclos entre operaciones con productos compartidos.
                products = self.inventory.lock_products(
                    {line.product_id for line in payload.items}
                )
                total = payload.delivery_cost
                for line in payload.items:
                    product = products.get(line.product_id)
                    if product is None or not product.is_active:
                        raise ApplicationError(
                            422, "invalid_reference", "Product not found"
                        )
                    price = product.unit_price
                    if price is None or not price.is_finite() or price <= 0:
                        raise ApplicationError(
                            422, "invalid_price", "A positive product price is required"
                        )
                    if product.legacy_stock is None or product.legacy_stock < 0:
                        raise ApplicationError(
                            409,
                            "stock_count_required",
                            "A valid explicit stock count is required",
                        )
                    if product.legacy_stock < line.quantity:
                        raise ApplicationError(
                            409, "insufficient_stock", "Insufficient available stock"
                        )
                    total += price * line.quantity
                if total > MAX_TOTAL:
                    raise ApplicationError(
                        422, "total_overflow", "Sale total exceeds the supported range"
                    )
                sale = Sale(
                    customer_id=customer.customer_id,
                    customer_kind=payload.customer_kind,
                    customer_name="Cliente general"
                    if payload.customer_kind == "general"
                    else f"{customer.first_names} {customer.last_names}",
                    customer_phone=customer.phone_number
                    if payload.customer_kind == "delivery"
                    else None,
                    customer_address=address_text(self.session, customer.address_id)
                    if payload.customer_kind == "delivery"
                    else None,
                    delivery_cost=payload.delivery_cost,
                    notes=payload.notes,
                    seller_name=self._seller_name(employee_id),
                    employee_id=employee_id,
                    sale_date=datetime.now(ZoneInfo("America/Managua")).date(),
                    total=total,
                )
                self.repository.add_sale(sale)
                now = datetime.now(UTC)
                for line in payload.items:
                    product = products[line.product_id]
                    assert product.unit_price is not None
                    assert product.legacy_stock is not None
                    item = SaleItem(
                        sale_id=sale.sale_id,
                        product_id=line.product_id,
                        quantity=line.quantity,
                        unit_price=product.unit_price,
                        product_name=product.name,
                        size_name=self._size_name(product.size_id),
                    )
                    self.repository.add_line(item)
                    before = product.legacy_stock
                    product.legacy_stock = before - line.quantity
                    self.inventory.append_movement(
                        InventoryMovement(
                            product_id=line.product_id,
                            sale_item_id=item.sale_item_id,
                            purchase_item_id=None,
                            movement_type="sale_issue",
                            quantity=line.quantity,
                            stock_before=before,
                            stock_after=product.legacy_stock,
                            created_at=now,
                            performed_by_user_id=actor.user_id,
                            employee_id=employee_id,
                        )
                    )
                self.repository.add_workflow(
                    SaleWorkflow(
                        sale_id=sale.sale_id,
                        created_by_user_id=actor.user_id,
                        created_at=now,
                        idempotency_hash=key_hash,
                        request_hash=fingerprint,
                    )
                )
                cash.collect(sale.sale_id, total, payload.payment, actor)
                return self._detail(sale.sale_id)
        except IntegrityError as error:
            raise ApplicationError(
                409, "integrity_conflict", "Conflicting sale data"
            ) from error
