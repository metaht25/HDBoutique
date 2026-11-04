"""Reusable synthetic purchasing graph; never consult development credentials."""

from decimal import Decimal

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.modules.catalog.models import Category, Product, Size
from app.modules.identity.models import UserAccount
from app.modules.identity.security import hash_password
from app.modules.inventory.models import InventoryMovement
from app.modules.locations.models import Address, Department
from app.modules.purchases.models import Purchase, PurchaseItem
from app.modules.purchases.workflow_models import PurchaseItemCost, PurchaseWorkflow
from app.modules.staff.models import Employee
from app.modules.suppliers.models import Supplier, SupplierOffering, SupplierProduct
from tests.identity_helpers import SYNTHETIC_PASSWORD


def seed_purchasing(session: Session) -> dict[str, int]:
    department = Department(name="Synthetic purchasing")
    category, size = Category(name="Synthetic"), Size(name="M")
    session.add_all([department, category, size])
    session.flush()
    address = Address(department_id=department.department_id, address_line=None)
    session.add(address)
    session.flush()
    employees = [
        Employee(
            address_id=address.address_id,
            first_names="Synthetic",
            last_names=f"Employee {index}",
            phone_number="00000000",
        )
        for index in (1, 2)
    ]
    products = [
        Product(
            category_id=category.category_id,
            size_id=size.size_id,
            name=f"Synthetic {index}",
            legacy_stock=0,
            legacy_stock_quantity=12,
            unit_price=Decimal("199.50"),
            cost=Decimal("120.50") if index == 1 else Decimal("35.25"),
        )
        for index in (1, 2)
    ]
    suppliers = [
        Supplier(
            address_id=address.address_id,
            company_name=f"Synthetic {index}",
            contact_first_names="Synthetic",
            contact_last_names="Contact",
            phone_number="00000000",
            work_email=None,
        )
        for index in (1, 2)
    ]
    session.add_all([*employees, *products, *suppliers])
    session.flush()
    supplier_products = [
        SupplierProduct(product_id=product.product_id, purchase_price=price)
        for product, price in zip(
            products, [Decimal("120.50"), Decimal("35.25")], strict=True
        )
    ]
    session.add_all(supplier_products)
    session.flush()
    session.add_all(
        [
            SupplierOffering(
                supplier_id=suppliers[0].supplier_id,
                supplier_product_id=product.supplier_product_id,
            )
            for product in supplier_products
        ]
    )
    encoded = hash_password(SYNTHETIC_PASSWORD)
    users = [
        UserAccount(
            username="purchasing-" + role.lower(),
            password_hash=encoded,
            role=role,
            is_active=True,
            employee_id=employees[0].employee_id
            if role == "Administrator"
            else employees[1].employee_id
            if role == "Cashier"
            else None,
        )
        for role in ("Administrator", "Manager", "Cashier")
    ]
    session.add_all(users)
    session.flush()
    return {
        "department": department.department_id,
        "address": address.address_id,
        "category": category.category_id,
        "size": size.size_id,
        "employee1": employees[0].employee_id,
        "employee2": employees[1].employee_id,
        "product1": products[0].product_id,
        "product2": products[1].product_id,
        "supplier1": suppliers[0].supplier_id,
        "supplier2": suppliers[1].supplier_id,
        "supplier_product1": supplier_products[0].supplier_product_id,
        "supplier_product2": supplier_products[1].supplier_product_id,
        "admin": users[0].user_id,
        "manager": users[1].user_id,
        "cashier": users[2].user_id,
    }


def cleanup_purchasing(session: Session, graph: dict[str, int]) -> None:
    """Remove only the committed synthetic graph used by concurrency tests."""
    suppliers = [graph["supplier1"], graph["supplier2"]]
    products = [graph["product1"], graph["product2"]]
    purchase_ids = select(Purchase.purchase_id).where(
        Purchase.supplier_id.in_(suppliers)
    )
    item_ids = select(PurchaseItem.purchase_item_id).where(
        PurchaseItem.purchase_id.in_(purchase_ids)
    )
    session.execute(
        delete(InventoryMovement).where(InventoryMovement.product_id.in_(products))
    )
    session.execute(
        delete(PurchaseItemCost).where(PurchaseItemCost.purchase_item_id.in_(item_ids))
    )
    session.execute(
        delete(PurchaseWorkflow).where(PurchaseWorkflow.purchase_id.in_(purchase_ids))
    )
    session.execute(
        delete(PurchaseItem).where(PurchaseItem.purchase_id.in_(purchase_ids))
    )
    session.execute(delete(Purchase).where(Purchase.supplier_id.in_(suppliers)))
    session.execute(
        delete(SupplierOffering).where(SupplierOffering.supplier_id.in_(suppliers))
    )
    session.execute(
        delete(SupplierProduct).where(SupplierProduct.product_id.in_(products))
    )
    session.execute(delete(Supplier).where(Supplier.supplier_id.in_(suppliers)))
    session.execute(
        delete(UserAccount).where(
            UserAccount.user_id.in_(
                [graph["admin"], graph["manager"], graph["cashier"]]
            )
        )
    )
    session.execute(
        delete(Employee).where(
            Employee.employee_id.in_([graph["employee1"], graph["employee2"]])
        )
    )
    session.execute(delete(Product).where(Product.product_id.in_(products)))
    session.execute(delete(Size).where(Size.size_id == graph["size"]))
    session.execute(delete(Category).where(Category.category_id == graph["category"]))
    session.execute(delete(Address).where(Address.address_id == graph["address"]))
    session.execute(
        delete(Department).where(Department.department_id == graph["department"])
    )


def purchase_payload(graph: dict[str, int]) -> dict:
    return {
        "supplier_id": graph["supplier1"],
        "employee_id": graph["employee1"],
        "purchase_date": "2026-10-28",
        "shipping_cost": "50.00",
        "items": [
            {"supplier_product_id": graph["supplier_product1"], "quantity": 2},
            {"supplier_product_id": graph["supplier_product2"], "quantity": 3},
        ],
    }
