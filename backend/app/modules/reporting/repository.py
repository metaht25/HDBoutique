"""Aggregate in SQL before pagination; one statement per report for consistency."""

from typing import Any

from sqlalchemy import Select, case, func, select, true
from sqlalchemy.orm import Session

from app.modules.cash.models import SaleVoid
from app.modules.catalog.models import Product
from app.modules.customers.models import Customer, CustomerType
from app.modules.purchases.models import Purchase, PurchaseItem
from app.modules.purchases.workflow_models import PurchaseItemCost, PurchaseWorkflow
from app.modules.reporting.schemas import DateRange, StockStatus
from app.modules.sales.models import Sale
from app.modules.sales.workflow_models import SaleWorkflow
from app.modules.suppliers.models import Supplier

LOW_STOCK_THRESHOLD = 5


def stock_status() -> Any:
    return case(
        (Product.legacy_stock.is_(None), "unknown"),
        (Product.legacy_stock < 0, "invalid"),
        (Product.legacy_stock == 0, "out_of_stock"),
        (Product.legacy_stock <= LOW_STOCK_THRESHOLD, "low_stock"),
        else_="available",
    )


def date_conditions(column: Any, period: DateRange) -> list[Any]:
    conditions = []
    if period.start_date:
        conditions.append(column >= period.start_date)
    if period.end_date:
        conditions.append(column <= period.end_date)
    return conditions


class ReportingRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def _page(
        self,
        summary: Select[*tuple[Any, ...]],
        rows: Select[*tuple[Any, ...]],
        offset: int,
        limit: int,
    ) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        # Outer join keeps the global summary even for an empty/out-of-range page.
        totals = summary.subquery()
        page = rows.offset(offset).limit(limit).subquery()
        result = (
            self.session.execute(
                select(*totals.c, *page.c).select_from(totals.outerjoin(page, true()))
            )
            .mappings()
            .all()
        )
        return (
            {name: result[0][name] for name in totals.c.keys()},
            [
                {name: row[name] for name in page.c.keys()}
                for row in result
                if row[next(iter(page.c.keys()))] is not None
            ],
        )

    def sales(
        self, period: DateRange, offset: int, limit: int
    ) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        source = case(
            (SaleVoid.sale_id.is_not(None), "voided"),
            (SaleWorkflow.sale_id.is_(None), "legacy"),
            else_="confirmed",
        )
        base = (
            select(
                Sale.sale_id,
                Sale.sale_date,
                Sale.customer_id,
                (Customer.first_names + " " + Customer.last_names).label(
                    "customer_name"
                ),
                Sale.total,
                source.label("source"),
            )
            .join(Customer, Customer.customer_id == Sale.customer_id)
            .outerjoin(SaleWorkflow, SaleWorkflow.sale_id == Sale.sale_id)
            .outerjoin(SaleVoid, SaleVoid.sale_id == Sale.sale_id)
            .where(*date_conditions(Sale.sale_date, period))
            .subquery()
        )
        summary = select(
            func.count().label("total_count"),
            func.coalesce(
                func.sum(case((base.c.source != "voided", base.c.total), else_=0)), 0
            ).label("total_amount"),
            func.count().filter(base.c.source == "legacy").label("legacy_count"),
        ).select_from(base)
        rows = select(base).order_by(base.c.sale_date.desc(), base.c.sale_id.desc())
        return self._page(summary, rows, offset, limit)

    def purchases(
        self, period: DateRange, offset: int, limit: int
    ) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        costs = (
            select(
                PurchaseItem.purchase_id,
                case(
                    (
                        func.count().filter(
                            (PurchaseItemCost.purchase_item_id.is_(None))
                            | (PurchaseItem.quantity <= 0)
                        )
                        == 0,
                        func.sum(PurchaseItem.quantity * PurchaseItemCost.unit_cost),
                    ),
                    else_=None,
                ).label("merchandise_total"),
            )
            .outerjoin(
                PurchaseItemCost,
                PurchaseItemCost.purchase_item_id == PurchaseItem.purchase_item_id,
            )
            .group_by(PurchaseItem.purchase_id)
            .subquery()
        )
        base = (
            select(
                Purchase.purchase_id,
                Purchase.purchase_date,
                Purchase.supplier_id,
                Supplier.company_name.label("supplier_name"),
                func.coalesce(PurchaseWorkflow.status, "legacy").label("status"),
                costs.c.merchandise_total,
                Purchase.shipping_cost,
                (costs.c.merchandise_total + Purchase.shipping_cost).label("total"),
            )
            .join(Supplier, Supplier.supplier_id == Purchase.supplier_id)
            .outerjoin(costs, costs.c.purchase_id == Purchase.purchase_id)
            .outerjoin(
                PurchaseWorkflow, PurchaseWorkflow.purchase_id == Purchase.purchase_id
            )
            .where(*date_conditions(Purchase.purchase_date, period))
            .subquery()
        )
        summary = select(
            func.count().label("total_count"),
            func.coalesce(func.sum(base.c.merchandise_total), 0).label(
                "known_merchandise_total"
            ),
            func.count()
            .filter(base.c.merchandise_total.is_(None))
            .label("unknown_merchandise_count"),
            func.coalesce(func.sum(base.c.shipping_cost), 0).label(
                "known_shipping_total"
            ),
            func.count()
            .filter(base.c.shipping_cost.is_(None))
            .label("unknown_shipping_count"),
            func.coalesce(func.sum(base.c.total), 0).label("known_total"),
            func.count().filter(base.c.total.is_(None)).label("unknown_total_count"),
            func.count().filter(base.c.status == "legacy").label("legacy_count"),
        ).select_from(base)
        return self._page(
            summary,
            select(base).order_by(
                base.c.purchase_date.desc(), base.c.purchase_id.desc()
            ),
            offset,
            limit,
        )

    def customers(
        self, offset: int, limit: int
    ) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        groups = (
            select(
                CustomerType.customer_type_id,
                CustomerType.name,
                func.count(Customer.customer_id).label("customer_count"),
            )
            .outerjoin(
                Customer, Customer.customer_type_id == CustomerType.customer_type_id
            )
            .group_by(CustomerType.customer_type_id, CustomerType.name)
            .subquery()
        )
        summary = select(
            func.coalesce(func.sum(groups.c.customer_count), 0).label("total_count"),
            func.count().label("group_count"),
        ).select_from(groups)
        return self._page(
            summary, select(groups).order_by(groups.c.customer_type_id), offset, limit
        )

    def inventory(
        self, status: StockStatus | None, offset: int, limit: int
    ) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        base = select(
            Product.product_id,
            Product.name,
            Product.legacy_stock.label("available_stock"),
            Product.legacy_stock_quantity.label("historical_stock"),
            stock_status().label("status"),
        ).subquery()
        summary = select(
            *[
                func.count().filter(base.c.status == name).label(name)
                for name in (
                    "out_of_stock",
                    "low_stock",
                    "available",
                    "unknown",
                    "invalid",
                )
            ],
            func.count()
            .filter(base.c.status == status if status else true())
            .label("total_count"),
        ).select_from(base)
        rows = (
            select(base)
            .where(base.c.status == status if status else true())
            .order_by(base.c.product_id)
        )
        return self._page(summary, rows, offset, limit)

    def dashboard(self, period: DateRange, staff: bool) -> dict[str, Any]:
        # A single statement shares the same MVCC snapshot across all indicators.
        stock = (
            select(
                func.count().label("product_count"),
                *[
                    func.count().filter(stock_status() == name).label(name)
                    for name in (
                        "out_of_stock",
                        "low_stock",
                        "available",
                        "unknown",
                        "invalid",
                    )
                ],
            )
            .select_from(Product)
            .subquery()
        )
        sales = (
            select(
                func.count().label("total_count"),
                func.coalesce(func.sum(Sale.total), 0).label("total_amount"),
                func.count()
                .filter(SaleWorkflow.sale_id.is_(None))
                .label("legacy_count"),
            )
            .select_from(Sale)
            .outerjoin(SaleWorkflow, SaleWorkflow.sale_id == Sale.sale_id)
            .where(*date_conditions(Sale.sale_date, period))
            .subquery()
        )
        summary = select(
            *stock.c,
            *sales.c,
            select(func.count())
            .select_from(Customer)
            .scalar_subquery()
            .label("customer_count"),
        ).select_from(stock.join(sales, true()))
        if staff:
            summary = summary.add_columns(
                select(func.count())
                .select_from(Supplier)
                .scalar_subquery()
                .label("supplier_count"),
                select(func.count())
                .select_from(Purchase)
                .where(*date_conditions(Purchase.purchase_date, period))
                .scalar_subquery()
                .label("purchases_today"),
            )
        rows = (
            select(
                Sale.sale_id,
                Sale.sale_date,
                Sale.customer_id,
                (Customer.first_names + " " + Customer.last_names).label(
                    "customer_name"
                ),
                Sale.total,
                case(
                    (SaleWorkflow.sale_id.is_(None), "legacy"), else_="confirmed"
                ).label("source"),
            )
            .join(Customer, Customer.customer_id == Sale.customer_id)
            .outerjoin(SaleWorkflow, SaleWorkflow.sale_id == Sale.sale_id)
            .where(*date_conditions(Sale.sale_date, period))
            .order_by(Sale.sale_date.desc(), Sale.sale_id.desc())
        )
        totals, recent = self._page(summary, rows, 0, 5)
        return {
            "product_count": totals["product_count"],
            "customer_count": totals["customer_count"],
            "stock": {
                name: totals[name]
                for name in (
                    "out_of_stock",
                    "low_stock",
                    "available",
                    "unknown",
                    "invalid",
                )
            },
            "sales": {
                name: totals[name]
                for name in ("total_count", "total_amount", "legacy_count")
            },
            "recent_sales": recent,
            "staff": {
                "supplier_count": totals["supplier_count"],
                "purchases_today": totals["purchases_today"],
            }
            if staff
            else None,
        }
