"""Measure connected API reads over synthetic history in canonical Compose only."""

import json
from datetime import date, timedelta
from decimal import Decimal
from http.cookiejar import CookieJar
from statistics import median
from time import perf_counter
from urllib.request import HTTPCookieProcessor, Request, build_opener

from sqlalchemy import insert, select, text

from app.modules.catalog.models import Product
from app.modules.customers.models import Customer
from app.modules.purchases.models import Purchase, PurchaseItem
from app.modules.sales.models import Sale, SaleItem
from data_migration.target import target_engine
from tests.identity_helpers import SYNTHETIC_PASSWORD
from tests.rehearsal_helpers import require_isolated_rehearsal


def seed_volume() -> None:
    engine = target_engine("hdboutique_test")
    try:
        with engine.begin() as connection:
            if connection.scalar(
                select(Product.product_id).where(Product.name == "Volume synthetic 0")
            ):
                raise RuntimeError("Volume rehearsal already seeded; nothing removed")
            product = connection.execute(select(Product).limit(1)).mappings().one()
            customer = connection.execute(select(Customer).limit(1)).mappings().one()
            purchase = connection.execute(select(Purchase).limit(1)).mappings().one()
            supplier_product = connection.scalar(
                select(PurchaseItem.supplier_product_id).limit(1)
            )
            product_ids = list(
                connection.scalars(
                    insert(Product).returning(Product.product_id),
                    [
                        dict(
                            category_id=product["category_id"],
                            size_id=product["size_id"],
                            name=f"Volume synthetic {index}",
                            legacy_stock=[None, -1, 0, 5, 20][index % 5],
                            legacy_stock_quantity=100,
                            unit_price=Decimal("99.75"),
                        )
                        for index in range(2000)
                    ],
                )
            )
            customer_ids = list(
                connection.scalars(
                    insert(Customer).returning(Customer.customer_id),
                    [
                        dict(
                            address_id=customer["address_id"],
                            customer_type_id=customer["customer_type_id"],
                            first_names="Volume",
                            last_names=f"Synthetic {index}",
                            phone_number="0000000000",
                        )
                        for index in range(1000)
                    ],
                )
            )
            for start in range(0, 5000, 500):
                sale_ids = list(
                    connection.scalars(
                        insert(Sale).returning(Sale.sale_id),
                        [
                            dict(
                                customer_id=customer_ids[index % 1000],
                                employee_id=purchase["employee_id"],
                                sale_date=date(2026, 1, 1) + timedelta(days=index % 90),
                                total=Decimal("199.50"),
                            )
                            for index in range(start, start + 500)
                        ],
                    )
                )
                connection.execute(
                    insert(SaleItem),
                    [
                        dict(
                            sale_id=sale_id,
                            product_id=product_ids[(index * 2 + line) % 2000],
                            quantity=1,
                            unit_price=Decimal("99.75"),
                        )
                        for index, sale_id in enumerate(sale_ids)
                        for line in (0, 1)
                    ],
                )
                purchase_ids = list(
                    connection.scalars(
                        insert(Purchase).returning(Purchase.purchase_id),
                        [
                            dict(
                                supplier_id=purchase["supplier_id"],
                                employee_id=purchase["employee_id"],
                                purchase_date=date(2026, 1, 1)
                                + timedelta(days=index % 90),
                                shipping_cost=Decimal("1.25"),
                            )
                            for index in range(start, start + 500)
                        ],
                    )
                )
                # Compatibility history deliberately has no invented cost/workflow.
                connection.execute(
                    insert(PurchaseItem),
                    [
                        dict(
                            purchase_id=purchase_id,
                            supplier_product_id=supplier_product,
                            quantity=2,
                        )
                        for purchase_id in purchase_ids
                    ],
                )
        with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
            conn.execute(text("ANALYZE"))
    finally:
        engine.dispose()


def main() -> None:
    require_isolated_rehearsal()
    seed_volume()
    opener = build_opener(HTTPCookieProcessor(CookieJar()))

    def request(path: str, body: dict[str, str] | None = None) -> dict:
        headers = {"Origin": "http://127.0.0.1:4173"}
        if body is not None:
            headers.update({"Content-Type": "application/json", "X-CSRF-Token": csrf})
        req = Request(
            "http://api:8000/api/v1/" + path,
            data=json.dumps(body).encode() if body is not None else None,
            headers=headers,
        )
        with opener.open(req, timeout=15) as response:
            return json.load(response)

    csrf = request("auth/csrf")["csrf_token"]
    request(
        "auth/login",
        {"username": "purchasing-manager", "password": SYNTHETIC_PASSWORD},
    )
    report = request("reports/sales?end_date=2026-03-31&limit=20")
    assert report["summary"]["total_count"] == 5000
    assert report["summary"]["total_amount"] == "997500.00"
    assert len(report["items"]) == 20
    purchases = request("reports/purchases?end_date=2026-03-31&limit=20")
    assert purchases["summary"]["unknown_merchandise_count"] == 5000
    assert purchases["summary"]["known_shipping_total"] == "6250.00"
    print(
        "Synthetic volume: +2000 products, +1000 customers, +5000 sales, "
        "+5000 purchases, +15000 lines; exact global totals verified"
    )
    for path in (
        "dashboard",
        "reports/sales",
        "reports/purchases",
        "reports/inventory",
        "reports/customers",
        "sales?limit=21&offset=4980",
        "purchases?limit=21&offset=4980",
        "products?q=Volume&limit=21",
    ):
        request(path)  # Warm-up is excluded from timings.
        samples = []
        for _ in range(10):
            started = perf_counter()
            request(path)
            samples.append((perf_counter() - started) * 1000)
        print(
            f"{path}: n=10 p50={median(samples):.1f}ms p95={sorted(samples)[-1]:.1f}ms"
        )


if __name__ == "__main__":
    main()
