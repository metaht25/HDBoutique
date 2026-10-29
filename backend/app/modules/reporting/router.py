"""Authenticated read-only aggregates; purchase data is never sent to Cashier."""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.api.dependencies import DatabaseSession
from app.api.schemas import ErrorResponse
from app.core.errors import ApplicationError
from app.modules.identity.dependencies import PurchasingIdentity, SalesIdentity
from app.modules.reporting.schemas import (
    CustomersReport,
    DashboardRead,
    DateRange,
    InventoryReport,
    PurchasesReport,
    SalesReport,
    StockStatus,
)
from app.modules.reporting.service import ReportingService

router = APIRouter(
    prefix="/api/v1",
    tags=["reporting"],
    responses={status: {"model": ErrorResponse} for status in (401, 403, 422, 503)},
)
Offset = Annotated[int, Query(ge=0)]
Limit = Annotated[int, Query(ge=1, le=100)]


def date_range(
    start_date: date | None = None, end_date: date | None = None
) -> DateRange:
    if start_date and end_date and start_date > end_date:
        raise ApplicationError(
            422,
            "invalid_date_range",
            "La fecha inicial no puede ser posterior a la final",
        )
    return DateRange(start_date=start_date, end_date=end_date)


Period = Annotated[DateRange, Depends(date_range)]


@router.get(
    "/dashboard", response_model=DashboardRead, response_model_exclude_none=True
)
def dashboard(session: DatabaseSession, actor: SalesIdentity) -> DashboardRead:
    return ReportingService(session).dashboard(actor.role != "Cashier")


@router.get("/reports/sales", response_model=SalesReport)
def sales(
    session: DatabaseSession,
    actor: SalesIdentity,
    period: Period,
    offset: Offset = 0,
    limit: Limit = 20,
) -> SalesReport:
    return ReportingService(session).sales(period, offset, limit)


@router.get("/reports/purchases", response_model=PurchasesReport)
def purchases(
    session: DatabaseSession,
    actor: PurchasingIdentity,
    period: Period,
    offset: Offset = 0,
    limit: Limit = 20,
) -> PurchasesReport:
    return ReportingService(session).purchases(period, offset, limit)


@router.get("/reports/inventory", response_model=InventoryReport)
def inventory(
    session: DatabaseSession,
    actor: SalesIdentity,
    status: Annotated[StockStatus | None, Query()] = None,
    offset: Offset = 0,
    limit: Limit = 20,
) -> InventoryReport:
    return ReportingService(session).inventory(status, offset, limit)


@router.get("/reports/customers", response_model=CustomersReport)
def customers(
    session: DatabaseSession,
    actor: SalesIdentity,
    offset: Offset = 0,
    limit: Limit = 20,
) -> CustomersReport:
    return ReportingService(session).customers(offset, limit)
