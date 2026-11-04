"""Server-side filters and aggregates; personal ledgers are scoped in SQL."""

from datetime import date
from typing import Any

from sqlalchemy import String, case, cast, func, literal, or_, select
from sqlalchemy.orm import Session

from app.modules.cash.models import SalePayment, SaleVoid
from app.modules.catalog.models import Category, Product, Size
from app.modules.customers.models import Customer
from app.modules.identity.models import UserAccount
from app.modules.locations.models import Address, Department, Municipality
from app.modules.purchases.models import Purchase, PurchaseItem
from app.modules.purchases.workflow_models import PurchaseItemCost, PurchaseWorkflow
from app.modules.reporting.repository import ReportingRepository, stock_status
from app.modules.sales.models import Sale, SaleItem
from app.modules.sales.workflow_models import SaleWorkflow
from app.modules.staff.models import Employee
from app.modules.suppliers.models import Supplier, SupplierOffering, SupplierProduct


def address_columns() -> list[Any]:
    return [
        Address.address_id,
        Address.address_line,
        Address.department_id,
        Department.name.label("department_name"),
        Address.municipality_id,
        Municipality.name.label("municipality_name"),
    ]


def with_address(query: Any, address_id: Any) -> Any:
    return (
        query.outerjoin(Address, Address.address_id == address_id)
        .outerjoin(Department, Department.department_id == Address.department_id)
        .outerjoin(
            Municipality, Municipality.municipality_id == Address.municipality_id
        )
    )


class BoutiqueReportingRepository(ReportingRepository):
    def __init__(self, session: Session) -> None:
        super().__init__(session)

    def products(
        self,
        owner: bool,
        q: str | None,
        category_id: int | None,
        status: str | None,
        offset: int,
        limit: int,
        supplier_id: int | None = None,
    ) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        columns = [
            Product.product_id,
            Product.name,
            Product.category_id,
            Category.name.label("category_name"),
            Product.size_id,
            Size.name.label("size_name"),
            Product.unit_price,
            Product.legacy_stock,
            Product.legacy_stock_quantity,
            Product.is_active,
            Product.description,
            stock_status().label("status"),
        ]
        if owner:
            columns += [
                Product.cost,
                Product.supplier_id,
                Supplier.company_name.label("supplier_name"),
            ]
        query = select(*columns).select_from(Product).join(Category).join(Size)
        if supplier_id is not None:
            query = query.where(
                select(SupplierOffering.offering_id)
                .join(SupplierProduct)
                .where(
                    SupplierOffering.supplier_id == supplier_id,
                    SupplierProduct.product_id == Product.product_id,
                )
                .exists()
            )
        if owner:
            query = query.outerjoin(
                Supplier, Supplier.supplier_id == Product.supplier_id
            )
        if q:
            query = query.where(Product.name.icontains(q, autoescape=True))
        if category_id:
            query = query.where(Product.category_id == category_id)
        if status in {"active", "inactive"}:
            query = query.where(Product.is_active.is_(status == "active"))
        elif status:
            if status == "sellable":
                query = query.where(
                    Product.is_active.is_(True),
                    Product.legacy_stock > 0,
                    Product.unit_price > 0,
                )
            else:
                query = query.where(stock_status() == status)
        base = query.subquery()
        aggregates = [
            func.count().label("total_count"),
            func.count().filter(base.c.legacy_stock.between(1, 5)).label("low_stock"),
            func.count().filter(base.c.legacy_stock == 0).label("out_of_stock"),
            func.count().filter(base.c.is_active).label("active_count"),
        ]
        if owner:
            aggregates += [
                func.coalesce(
                    func.sum(
                        case(
                            (
                                base.c.legacy_stock >= 0,
                                base.c.cost * base.c.legacy_stock,
                            ),
                            else_=None,
                        )
                    ),
                    0,
                ).label("inventory_value"),
                func.count()
                .filter(
                    or_(
                        base.c.cost.is_(None),
                        base.c.legacy_stock.is_(None),
                        base.c.legacy_stock < 0,
                    )
                )
                .label("unknown_value_count"),
            ]
        return self._page(
            select(*aggregates).select_from(base),
            select(base).order_by(base.c.product_id.desc()),
            offset,
            limit,
        )

    def customer_directory(
        self,
        q: str | None,
        department_id: int | None,
        status: str | None,
        month_start: date,
        offset: int,
        limit: int,
    ) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        query = with_address(
            select(
                Customer.customer_id,
                Customer.first_names,
                Customer.last_names,
                Customer.phone_number,
                Customer.kind,
                Customer.is_active,
                Customer.created_at,
                *address_columns(),
            ).select_from(Customer),
            Customer.address_id,
        ).where(Customer.technical_key.is_(None))
        if q:
            query = query.where(
                or_(
                    (Customer.first_names + " " + Customer.last_names).icontains(
                        q, autoescape=True
                    ),
                    Customer.phone_number.icontains(q, autoescape=True),
                    cast(Customer.customer_id, String) == q,
                )
            )
        if department_id:
            query = query.where(Address.department_id == department_id)
        if status in {"active", "inactive"}:
            query = query.where(Customer.is_active.is_(status == "active"))
        base = query.subquery()
        summary = select(
            func.count().label("total_count"),
            func.count().filter(base.c.is_active).label("active_count"),
            func.count().filter(base.c.address_id.is_not(None)).label("with_address"),
            func.count()
            .filter(func.timezone("America/Managua", base.c.created_at) >= month_start)
            .label("new_count"),
        ).select_from(base)
        return self._page(
            summary, select(base).order_by(base.c.customer_id.desc()), offset, limit
        )

    def suppliers(
        self, q: str | None, status: str | None, offset: int, limit: int
    ) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        query = with_address(
            select(
                Supplier.supplier_id,
                Supplier.company_name,
                Supplier.contact_first_names,
                Supplier.contact_last_names,
                Supplier.phone_number,
                Supplier.work_email,
                Supplier.is_active,
                *[
                    column
                    for column in address_columns()
                    if column is not Address.address_line
                ],
                func.coalesce(Supplier.address_line, Address.address_line).label(
                    "address_line"
                ),
            ).select_from(Supplier),
            Supplier.address_id,
        )
        if q:
            query = query.where(Supplier.company_name.icontains(q, autoescape=True))
        if status in {"active", "inactive"}:
            query = query.where(Supplier.is_active.is_(status == "active"))
        base = query.subquery()
        return self._page(
            select(
                func.count().label("total_count"),
                func.count().filter(base.c.is_active).label("active_count"),
                func.count().filter(~base.c.is_active).label("inactive_count"),
            ).select_from(base),
            select(base).order_by(base.c.supplier_id.desc()),
            offset,
            limit,
        )

    def employees(
        self, q: str | None, status: str | None, offset: int, limit: int
    ) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        query = with_address(
            select(
                Employee.employee_id,
                Employee.first_names,
                Employee.last_names,
                Employee.phone_number,
                Employee.job_title,
                Employee.start_date,
                Employee.end_date,
                Employee.is_active,
                UserAccount.username,
                UserAccount.user_id,
                *address_columns(),
            ).select_from(Employee),
            Employee.address_id,
        ).outerjoin(UserAccount, UserAccount.employee_id == Employee.employee_id)
        if q:
            query = query.where(
                (Employee.first_names + " " + Employee.last_names).icontains(
                    q, autoescape=True
                )
            )
        if status in {"active", "inactive"}:
            query = query.where(Employee.is_active.is_(status == "active"))
        base = query.subquery()
        collaborator_count = (
            select(func.count())
            .select_from(UserAccount)
            .where(UserAccount.role == "Cashier")
            .scalar_subquery()
        )
        return self._page(
            select(
                func.count().label("total_count"),
                func.count().filter(base.c.is_active).label("active_count"),
                func.count().filter(~base.c.is_active).label("inactive_count"),
                collaborator_count.label("collaborators"),
            ).select_from(base),
            select(base).order_by(base.c.employee_id.desc()),
            offset,
            limit,
        )

    def sales_base(
        self,
        user_id: int | None,
        start: date | None = None,
        end: date | None = None,
        q: str | None = None,
        customer: str | None = None,
        method: str | None = None,
        status: str | None = None,
        receipts: bool = False,
    ) -> Any:
        lines = (
            select(
                SaleItem.sale_id,
                func.sum(SaleItem.quantity).label("units"),
                func.string_agg(
                    func.coalesce(SaleItem.product_name, Product.name, "Producto"), ", "
                ).label("products"),
            )
            .select_from(SaleItem)
            .join(Product)
            .group_by(SaleItem.sale_id)
            .subquery()
        )
        state = case(
            (SaleVoid.sale_id.is_not(None), "voided"),
            (SaleWorkflow.sale_id.is_(None), "legacy"),
            else_="confirmed",
        )
        name = func.coalesce(
            Sale.customer_name, Customer.first_names + " " + Customer.last_names
        )
        query = (
            select(
                Sale.sale_id,
                SalePayment.payment_id.label("receipt_id"),
                Sale.sale_date,
                SaleWorkflow.created_at,
                name.label("customer_name"),
                func.coalesce(
                    Sale.seller_name, Employee.first_names + " " + Employee.last_names
                ).label("seller_name"),
                func.coalesce(lines.c.units, 0).label("units"),
                lines.c.products,
                SalePayment.method,
                Sale.total,
                state.label("status"),
            )
            .select_from(Sale)
            .join(Customer)
            .join(Employee)
            .outerjoin(SaleWorkflow)
            .outerjoin(SalePayment)
            .outerjoin(SaleVoid)
            .outerjoin(lines, lines.c.sale_id == Sale.sale_id)
        )
        if user_id is not None:
            query = query.where(SaleWorkflow.created_by_user_id == user_id)
        if start:
            query = query.where(Sale.sale_date >= start)
        if end:
            query = query.where(Sale.sale_date <= end)
        if customer:
            query = query.where(name.icontains(customer, autoescape=True))
        if q:
            sale_number = literal("V-") + func.lpad(cast(Sale.sale_id, String), 5, "0")
            receipt_number = literal("R-") + func.lpad(
                cast(SalePayment.payment_id, String), 5, "0"
            )
            query = query.where(
                or_(
                    name.icontains(q, autoescape=True),
                    sale_number.icontains(q, autoescape=True),
                    receipt_number.icontains(q, autoescape=True),
                    cast(SalePayment.payment_id, String).icontains(q, autoescape=True),
                    cast(Sale.sale_id, String) == q,
                    cast(SalePayment.payment_id, String) == q,
                )
            )
        if method:
            query = query.where(SalePayment.method == method)
        if status:
            query = query.where(state == status)
        if receipts:
            query = query.where(SalePayment.payment_id.is_not(None))
        return query.subquery()

    def ledger(
        self, base: Any, today: date, offset: int, limit: int
    ) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        valid = base.c.status != "voided"
        summary = select(
            func.count().label("total_count"),
            func.count().filter(valid).label("sold_count"),
            func.coalesce(func.sum(base.c.total).filter(valid), 0).label(
                "total_amount"
            ),
            func.coalesce(func.sum(base.c.units).filter(valid), 0).label("units"),
            func.coalesce(func.avg(base.c.total).filter(valid), 0).label("average"),
            func.count().filter(base.c.sale_date == today).label("today_count"),
            func.count()
            .filter(base.c.sale_date.between(today.replace(day=1), today))
            .label("month_count"),
        ).select_from(base)
        return self._page(
            summary,
            select(base).order_by(base.c.sale_date.desc(), base.c.sale_id.desc()),
            offset,
            limit,
        )

    def payment_groups(self, base: Any) -> list[dict[str, Any]]:
        return [
            dict(row)
            for row in self.session.execute(
                select(
                    base.c.method,
                    func.sum(base.c.total).label("total"),
                    func.count().label("count"),
                )
                .where(base.c.status != "voided")
                .group_by(base.c.method)
            ).mappings()
        ]

    def best_products(self, base: Any) -> list[dict[str, Any]]:
        return [
            dict(row)
            for row in self.session.execute(
                select(
                    SaleItem.product_id,
                    func.max(func.coalesce(SaleItem.product_name, Product.name)).label(
                        "name"
                    ),
                    func.sum(SaleItem.quantity).label("quantity"),
                    func.sum(SaleItem.unit_price * SaleItem.quantity).label("total"),
                )
                .select_from(SaleItem)
                .join(base, base.c.sale_id == SaleItem.sale_id)
                .join(Product)
                .where(base.c.status != "voided")
                .group_by(SaleItem.product_id)
                .order_by(func.sum(SaleItem.quantity).desc(), SaleItem.product_id)
                .limit(5)
            ).mappings()
        ]

    def purchase_ledger(
        self,
        q: str | None,
        supplier_id: int | None,
        start: date | None,
        end: date | None,
        status: str | None,
        today: date,
        offset: int,
        limit: int,
    ) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        lines = (
            select(
                PurchaseItem.purchase_id,
                func.sum(PurchaseItem.quantity).label("units"),
                case(
                    (
                        func.count().filter(PurchaseItemCost.purchase_item_id.is_(None))
                        == 0,
                        func.sum(PurchaseItemCost.unit_cost * PurchaseItem.quantity),
                    ),
                    else_=None,
                ).label("merchandise"),
                func.string_agg(Product.name, ", ").label("products"),
            )
            .select_from(PurchaseItem)
            .outerjoin(PurchaseItemCost)
            .outerjoin(Product, Product.product_id == PurchaseItemCost.product_id)
            .group_by(PurchaseItem.purchase_id)
            .subquery()
        )
        state = func.coalesce(PurchaseWorkflow.status, "legacy")
        query = (
            select(
                Purchase.purchase_id,
                Purchase.purchase_date,
                Purchase.supplier_id,
                Supplier.company_name.label("supplier_name"),
                lines.c.units,
                lines.c.products,
                Purchase.shipping_cost,
                (lines.c.merchandise + Purchase.shipping_cost).label("total"),
                state.label("status"),
            )
            .select_from(Purchase)
            .join(Supplier)
            .outerjoin(PurchaseWorkflow)
            .outerjoin(lines, lines.c.purchase_id == Purchase.purchase_id)
        )
        if q:
            query = query.where(
                or_(
                    Supplier.company_name.icontains(q, autoescape=True),
                    lines.c.products.icontains(q, autoescape=True),
                    cast(Purchase.purchase_id, String) == q,
                )
            )
        if supplier_id:
            query = query.where(Purchase.supplier_id == supplier_id)
        if start:
            query = query.where(Purchase.purchase_date >= start)
        if end:
            query = query.where(Purchase.purchase_date <= end)
        if status:
            query = query.where(state == status)
        base = query.subquery()
        suppliers = (
            select(func.count())
            .select_from(Supplier)
            .where(Supplier.is_active)
            .scalar_subquery()
        )
        summary = select(
            func.count().label("total_count"),
            func.coalesce(func.sum(base.c.total), 0).label("invested_amount"),
            func.count().filter(base.c.total.is_(None)).label("unknown_total_count"),
            func.coalesce(
                func.sum(base.c.total).filter(
                    base.c.purchase_date.between(today.replace(day=1), today)
                ),
                0,
            ).label("month_amount"),
            suppliers.label("active_suppliers"),
        ).select_from(base)
        return self._page(
            summary,
            select(base).order_by(
                base.c.purchase_date.desc(), base.c.purchase_id.desc()
            ),
            offset,
            limit,
        )
