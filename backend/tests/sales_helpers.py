"""Synthetic sales graph shared by transaction and concurrency tests."""

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

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
    return {
        **graph,
        "customer": customer.customer_id,
        "customer_type": customer_type.customer_type_id,
    }


def cleanup_sales(session: Session, graph: dict[str, int]) -> None:
    sale_ids = select(Sale.sale_id).where(Sale.customer_id == graph["customer"])
    item_ids = select(SaleItem.sale_item_id).where(SaleItem.sale_id.in_(sale_ids))
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
        "employee_id": graph["employee1"],
        "sale_date": "2026-10-28",
        "items": [
            {"product_id": graph["product1"], "quantity": 2},
            {"product_id": graph["product2"], "quantity": 3},
        ],
    }
