"""Explicit registry loaded by Alembic and persistence tests, without I/O."""

from app.modules.catalog.models import Category, Product, Size
from app.modules.customers.models import Customer, CustomerPayment, CustomerType
from app.modules.locations.models import Address, Department, Municipality
from app.modules.purchases.models import Purchase, PurchaseItem
from app.modules.sales.models import Sale, SaleItem
from app.modules.staff.models import Employee
from app.modules.suppliers.models import Supplier, SupplierOffering, SupplierProduct

__all__ = [
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
    "Size",
    "Supplier",
    "SupplierOffering",
    "SupplierProduct",
]
