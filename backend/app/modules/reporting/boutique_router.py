"""Screen queries; each administrative directory is also protected on the API."""

from typing import Annotated, Literal

from fastapi import APIRouter, Query

from app.api.dependencies import DatabaseSession
from app.modules.identity.dependencies import AdministratorIdentity, SalesIdentity
from app.modules.reporting.boutique_schemas import (
    CustomerRow,
    EmployeeRow,
    Overview,
    ProductRow,
    PurchaseLedgerRow,
    SaleLedger,
    SupplierRow,
    ViewPage,
)
from app.modules.reporting.boutique_service import BoutiqueReportingService
from app.modules.reporting.router import Limit, Offset, Period

router = APIRouter(prefix="/api/v1", tags=["screen-reports"])
Search = Annotated[str | None, Query(max_length=100)]
Reference = Annotated[int | None, Query(gt=0)]
Active = Literal["active", "inactive"]
Stock = Literal[
    "active",
    "inactive",
    "low_stock",
    "out_of_stock",
    "available",
    "unknown",
    "invalid",
    "sellable",
]
Method = Literal["cash", "transfer", "mixed"]
Status = Literal["confirmed", "voided", "legacy"]


@router.get(
    "/reports/product-catalog",
    response_model=ViewPage[ProductRow],
    response_model_exclude_unset=True,
)
def products(
    session: DatabaseSession,
    actor: SalesIdentity,
    q: Search = None,
    category_id: Reference = None,
    supplier_id: Reference = None,
    status: Stock | None = None,
    offset: Offset = 0,
    limit: Limit = 20,
) -> object:
    if supplier_id is not None and actor.role != "Administrator":
        from app.core.errors import ApplicationError

        raise ApplicationError(
            403, "permission_denied", "Solo Dueña consulta proveedores."
        )
    return BoutiqueReportingService(session).directory(
        "products", actor, q, status, category_id, offset, limit, supplier_id
    )


@router.get("/reports/customer-directory", response_model=ViewPage[CustomerRow])
def customers(
    session: DatabaseSession,
    actor: SalesIdentity,
    q: Search = None,
    department_id: Reference = None,
    status: Active | None = None,
    offset: Offset = 0,
    limit: Limit = 20,
) -> object:
    return BoutiqueReportingService(session).directory(
        "customers", actor, q, status, department_id, offset, limit
    )


@router.get("/reports/supplier-directory", response_model=ViewPage[SupplierRow])
def suppliers(
    session: DatabaseSession,
    actor: AdministratorIdentity,
    q: Search = None,
    status: Active | None = None,
    offset: Offset = 0,
    limit: Limit = 20,
) -> object:
    return BoutiqueReportingService(session).directory(
        "suppliers", actor, q, status, None, offset, limit
    )


@router.get("/reports/employee-directory", response_model=ViewPage[EmployeeRow])
def employees(
    session: DatabaseSession,
    actor: AdministratorIdentity,
    q: Search = None,
    status: Active | None = None,
    offset: Offset = 0,
    limit: Limit = 20,
) -> object:
    return BoutiqueReportingService(session).directory(
        "employees", actor, q, status, None, offset, limit
    )


@router.get("/reports/sales-ledger", response_model=SaleLedger)
def sales(
    session: DatabaseSession,
    actor: SalesIdentity,
    period: Period,
    q: Search = None,
    customer: Search = None,
    method: Method | None = None,
    status: Status | None = None,
    receipts: bool = False,
    offset: Offset = 0,
    limit: Limit = 20,
) -> object:
    return BoutiqueReportingService(session).sales(
        actor, period, q, customer, method, status, receipts, offset, limit
    )


@router.get("/reports/purchase-ledger", response_model=ViewPage[PurchaseLedgerRow])
def purchases(
    session: DatabaseSession,
    actor: AdministratorIdentity,
    period: Period,
    q: Search = None,
    supplier_id: Reference = None,
    status: Literal["registered", "received", "legacy"] | None = None,
    offset: Offset = 0,
    limit: Limit = 20,
) -> object:
    return BoutiqueReportingService(session).purchases(
        period, q, supplier_id, status, offset, limit
    )


@router.get(
    "/dashboard/overview", response_model=Overview, response_model_exclude_unset=True
)
def overview(
    session: DatabaseSession,
    actor: SalesIdentity,
    period: Literal["week", "month", "year"] = "week",
) -> object:
    return BoutiqueReportingService(session).overview(actor, period)
