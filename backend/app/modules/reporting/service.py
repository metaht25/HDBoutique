"""Read transactions and shared business-clock context for dashboard/reports."""

from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.modules.reporting.repository import LOW_STOCK_THRESHOLD, ReportingRepository
from app.modules.reporting.schemas import (
    CustomersReport,
    DashboardRead,
    DateRange,
    InventoryReport,
    PurchasesReport,
    ReportContext,
    SalesReport,
    StockStatus,
)

BUSINESS_TIMEZONE = "America/Managua"


def utc_now() -> datetime:
    return datetime.now(UTC)


def report_context(period: DateRange) -> ReportContext:
    now = utc_now()
    return ReportContext(
        **period.model_dump(),
        business_date=now.astimezone(ZoneInfo(BUSINESS_TIMEZONE)).date(),
        timezone=BUSINESS_TIMEZONE,
        generated_at=now,
    )


class ReportingService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.repository = ReportingRepository(session)

    def sales(self, period: DateRange, offset: int, limit: int) -> SalesReport:
        with self.session.begin():
            summary, rows = self.repository.sales(period, offset, limit)
            return SalesReport(
                context=report_context(period),
                summary=summary,
                offset=offset,
                limit=limit,
                items=rows,
            )

    def purchases(self, period: DateRange, offset: int, limit: int) -> PurchasesReport:
        with self.session.begin():
            summary, rows = self.repository.purchases(period, offset, limit)
            return PurchasesReport(
                context=report_context(period),
                summary=summary,
                offset=offset,
                limit=limit,
                items=rows,
            )

    def inventory(
        self, status: StockStatus | None, offset: int, limit: int
    ) -> InventoryReport:
        with self.session.begin():
            summary, rows = self.repository.inventory(status, offset, limit)
            return InventoryReport(
                context=report_context(DateRange()),
                summary=summary,
                total_count=summary["total_count"],
                low_stock_threshold=LOW_STOCK_THRESHOLD,
                offset=offset,
                limit=limit,
                items=rows,
            )

    def customers(self, offset: int, limit: int) -> CustomersReport:
        with self.session.begin():
            summary, rows = self.repository.customers(offset, limit)
            return CustomersReport(
                context=report_context(DateRange()),
                **summary,
                offset=offset,
                limit=limit,
                items=rows,
            )

    def dashboard(self, staff: bool) -> DashboardRead:
        context = report_context(DateRange())
        context.start_date = context.end_date = context.business_date
        with self.session.begin():
            return DashboardRead(
                context=context,
                low_stock_threshold=LOW_STOCK_THRESHOLD,
                **self.repository.dashboard(context, staff),
            )
