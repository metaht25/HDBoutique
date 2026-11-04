"""Synthetic sales graph shared by transaction and concurrency tests."""

from datetime import UTC, datetime

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.modules.cash.models import (
    CashMovement,
    CashRequest,
    CashShift,
    SalePayment,
    SaleReturnItem,
    SaleVoid,
)
from app.modules.catalog.models import Product
from app.modules.customers.models import Customer, CustomerType
from app.modules.inventory.models import InventoryMovement
from app.modules.sales.models import Sale, SaleItem
from app.modules.sales.workflow_models import SaleWorkflow
from tests.purchase_helpers import cleanup_purchasing, seed_purchasing


def seed_sales(session: Session) -> dict[str, int]:
    graph = seed_purchasing(session)
    customer_type = CustomerType(name="Synthetic")
    session.add(customer_type)
    session.flush()
    customer = Customer(
        address_id=graph["address"],
        customer_type_id=customer_type.customer_type_id,
        first_names="Synthetic",
        last_names="Customer",
        phone_number="00000000",
    )
    session.add(customer)
    for key in ("product1", "product2"):
        session.get(Product, graph[key]).legacy_stock = 12
    session.flush()
    shift = CashShift(
        register_code="main",
        employee_id=graph["employee1"],
        opened_by_user_id=graph["cashier"],
        opened_at=datetime.now(UTC),
        opening_amount="1000.00",
    )
    session.add(shift)
    session.flush()
    return {
        **graph,
        "customer": customer.customer_id,
        "customer_type": customer_type.customer_type_id,
        "shift": shift.shift_id,
    }


def cleanup_sales(session: Session, graph: dict[str, int]) -> None:
    sale_ids = select(Sale.sale_id).where(Sale.customer_id == graph["customer"])
    item_ids = select(SaleItem.sale_item_id).where(SaleItem.sale_id.in_(sale_ids))
    void_ids = select(SaleVoid.void_id).where(SaleVoid.sale_id.in_(sale_ids))
    return_ids = select(SaleReturnItem.return_item_id).where(
        SaleReturnItem.void_id.in_(void_ids)
    )
    session.execute(
        delete(InventoryMovement).where(
            InventoryMovement.return_item_id.in_(return_ids)
        )
    )
    session.execute(delete(SaleReturnItem).where(SaleReturnItem.void_id.in_(void_ids)))
    session.execute(delete(SaleVoid).where(SaleVoid.sale_id.in_(sale_ids)))
    session.execute(delete(SalePayment).where(SalePayment.sale_id.in_(sale_ids)))
    session.execute(
        delete(CashRequest).where(
            CashRequest.actor_id.in_(
                [graph["admin"], graph["manager"], graph["cashier"]]
            )
        )
    )
    session.execute(delete(CashMovement).where(CashMovement.shift_id == graph["shift"]))
    session.execute(delete(CashShift).where(CashShift.shift_id == graph["shift"]))
    session.execute(
        delete(InventoryMovement).where(InventoryMovement.sale_item_id.in_(item_ids))
    )
    session.execute(delete(SaleWorkflow).where(SaleWorkflow.sale_id.in_(sale_ids)))
    session.execute(delete(SaleItem).where(SaleItem.sale_id.in_(sale_ids)))
    session.execute(delete(Sale).where(Sale.sale_id.in_(sale_ids)))
    session.execute(delete(Customer).where(Customer.customer_id == graph["customer"]))
    session.execute(
        delete(CustomerType).where(
            CustomerType.customer_type_id == graph["customer_type"]
        )
    )
    cleanup_purchasing(session, graph)


def sale_payload(graph: dict[str, int]) -> dict:
    return {
        "customer_id": graph["customer"],
        "sale_date": "2026-10-28",
        "payment": {
            "method": "cash",
            "received_amount": "99999999.99",
        },
        "items": [
            {"product_id": graph["product1"], "quantity": 2},
            {"product_id": graph["product2"], "quantity": 3},
        ],
    }
