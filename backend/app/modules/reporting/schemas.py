"""Explicit report contracts: global summaries and bounded detail pages."""

from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal, Self

from pydantic import BaseModel, PlainSerializer, model_validator

ReportMoney = Annotated[
    Decimal, PlainSerializer(lambda value: format(value, ".2f"), return_type=str)
]


class DateRange(BaseModel):
    start_date: date | None = None
    end_date: date | None = None

    @model_validator(mode="after")
    def validate_order(self) -> Self:
        if self.start_date and self.end_date and self.start_date > self.end_date:
            raise ValueError("Start date must not follow end date")
        return self


class ReportContext(DateRange):
    business_date: date
    timezone: str
    generated_at: datetime
    currency: Literal["NIO"] = "NIO"


class SalesSummary(BaseModel):
    total_count: int
    total_amount: ReportMoney
    legacy_count: int


class SaleRow(BaseModel):
    sale_id: int
    sale_date: date
    customer_id: int
    customer_name: str
    total: ReportMoney
    source: Literal["confirmed", "legacy"]


class SalesReport(BaseModel):
    context: ReportContext
    summary: SalesSummary
    offset: int
    limit: int
    items: list[SaleRow]


class PurchasesSummary(BaseModel):
    total_count: int
    known_merchandise_total: ReportMoney
    unknown_merchandise_count: int
    known_shipping_total: ReportMoney
    unknown_shipping_count: int
    known_total: ReportMoney
    unknown_total_count: int
    legacy_count: int


class PurchaseRow(BaseModel):
    purchase_id: int
    purchase_date: date
    supplier_id: int
    supplier_name: str
    status: Literal["registered", "received", "legacy"]
    merchandise_total: ReportMoney | None
    shipping_cost: ReportMoney | None
    total: ReportMoney | None


class PurchasesReport(BaseModel):
    context: ReportContext
    summary: PurchasesSummary
    offset: int
    limit: int
    items: list[PurchaseRow]


class CustomerGroup(BaseModel):
    customer_type_id: int
    name: str | None
    customer_count: int


class CustomersReport(BaseModel):
    context: ReportContext
    total_count: int
    group_count: int
    offset: int
    limit: int
    items: list[CustomerGroup]


StockStatus = Literal["out_of_stock", "low_stock", "available", "unknown", "invalid"]


class StockSummary(BaseModel):
    out_of_stock: int
    low_stock: int
    available: int
    unknown: int
    invalid: int


class InventoryRow(BaseModel):
    product_id: int
    name: str | None
    available_stock: int | None
    historical_stock: int | None
    status: StockStatus


class InventoryReport(BaseModel):
    context: ReportContext
    summary: StockSummary
    total_count: int
    low_stock_threshold: int
    offset: int
    limit: int
    items: list[InventoryRow]


class StaffDashboard(BaseModel):
    supplier_count: int
    purchases_today: int


class DashboardRead(BaseModel):
    context: ReportContext
    product_count: int
    customer_count: int
    stock: StockSummary
    low_stock_threshold: int
    sales: SalesSummary
    recent_sales: list[SaleRow]
    staff: StaffDashboard | None = None
