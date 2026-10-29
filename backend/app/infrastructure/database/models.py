"""Explicit registry loaded by Alembic and persistence tests, without I/O."""

from app.modules.cash.models import (
    CashMovement,
    CashRequest,
    CashShift,
    SalePayment,
    SaleReturnItem,
    SaleVoid,
)
from app.modules.catalog.models import Category, Product, Size
from app.modules.customers.models import Customer, CustomerPayment, CustomerType
from app.modules.identity.models import LoginThrottle, UserAccount, WebSession
from app.modules.inventory.models import InventoryMovement
from app.modules.locations.models import Address, Department, Municipality
from app.modules.purchases.models import Purchase, PurchaseItem
from app.modules.purchases.workflow_models import PurchaseItemCost, PurchaseWorkflow
from app.modules.sales.models import Sale, SaleItem
from app.modules.sales.workflow_models import SaleWorkflow
from app.modules.staff.models import Employee
from app.modules.suppliers.models import Supplier, SupplierOffering, SupplierProduct

__all__ = [
    "CashMovement",
    "CashRequest",
    "CashShift",
    "SalePayment",
    "SaleReturnItem",
    "SaleVoid",
    "Address",
    "Category",
    "Customer",
    "CustomerPayment",
    "CustomerType",
    "Department",
    "Employee",
    "Municipality",
    "Product",
    "Purchase",
    "PurchaseItem",
    "Sale",
    "SaleItem",
    "SaleWorkflow",
    "Size",
    "Supplier",
    "SupplierOffering",
    "SupplierProduct",
    "UserAccount",
    "WebSession",
    "LoginThrottle",
    "PurchaseItemCost",
    "PurchaseWorkflow",
    "InventoryMovement",
]
