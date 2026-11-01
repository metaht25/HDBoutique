"""Explicit bounded directory and ledger responses for the boutique screens."""

from datetime import date, datetime

from pydantic import BaseModel

from app.modules.reporting.schemas import ReportContext, ReportMoney


class ProductRow(BaseModel):
    product_id: int
    name: str | None
    category_id: int
    category_name: str | None
    size_id: int
    size_name: str
    unit_price: ReportMoney | None
    legacy_stock: int | None
    legacy_stock_quantity: int | None
    status: str
    is_active: bool
    description: str | None
    cost: ReportMoney | None = None
    supplier_id: int | None = None
    supplier_name: str | None = None


class AddressRow(BaseModel):
    address_id: int | None
    address_line: str | None
    department_id: int | None
    department_name: str | None
    municipality_id: int | None
    municipality_name: str | None


class CustomerRow(AddressRow):
    customer_id: int
    first_names: str
    last_names: str
    phone_number: str | None
    kind: str | None
    is_active: bool
    created_at: datetime | None


class SupplierRow(AddressRow):
    supplier_id: int
    company_name: str
    contact_first_names: str
    contact_last_names: str
    phone_number: str
    work_email: str | None
    is_active: bool


class EmployeeRow(AddressRow):
    employee_id: int
    first_names: str
    last_names: str
    phone_number: str
    work_email: str | None
    job_title: str | None
    start_date: date | None
    end_date: date | None
    is_active: bool
    username: str | None
    user_id: int | None


class SaleLedgerRow(BaseModel):
    sale_id: int
    receipt_id: int | None
    sale_date: date
    created_at: datetime | None
    customer_name: str
    seller_name: str
    units: int
    products: str | None
    method: str | None
    total: ReportMoney
    status: str


class PurchaseLedgerRow(BaseModel):
    purchase_id: int
    purchase_date: date
    supplier_id: int
    supplier_name: str
    units: int | None
    products: str | None
    shipping_cost: ReportMoney | None
    total: ReportMoney | None
    status: str


class ViewPage[Row](BaseModel):
    context: ReportContext
    summary: dict[str, int | str | None]
    items: list[Row]
    offset: int
    limit: int


class PaymentGroup(BaseModel):
    method: str | None
    total: ReportMoney
    count: int


class BestProduct(BaseModel):
    product_id: int
    name: str | None
    quantity: int
    total: ReportMoney


class SaleLedger(ViewPage[SaleLedgerRow]):
    methods: list[PaymentGroup]
    best_products: list[BestProduct]


class Overview(BaseModel):
    context: ReportContext
    summary: dict[str, int | str | None]
    recent_sales: list[SaleLedgerRow]
    low_stock: list[ProductRow]
    period: str
