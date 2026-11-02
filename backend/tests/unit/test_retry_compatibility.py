"""Freeze request fingerprints from the committed 0006 contracts.

Expected hashes were obtained by executing HEAD's pre-phase schema and digest,
so schema additions cannot invalidate a previously submitted idempotency key.
"""

from app.modules.purchases.schemas import PurchaseCreate
from app.modules.purchases.service import request_digest as purchase_digest
from app.modules.sales.schemas import SaleCreate
from app.modules.sales.service import request_digest as sale_digest


def test_previous_sale_command_fingerprint_survives_shift_retirement():
    body = {
        "customer_id": 1,
        "employee_id": 2,
        "sale_date": "2026-10-28",
        "items": [{"product_id": 3, "quantity": 2}],
        "payment": {"shift_id": 1, "method": "cash", "received_amount": "1000.00"},
    }
    assert (
        sale_digest(SaleCreate(**body))
        == "f2642d6ff10c7d6fc45455a821f6d0fcbc40f6855d8898b402277bdbcdba040c"
    )


def test_previous_purchase_command_fingerprint_survives_inline_suppliers():
    body = {
        "supplier_id": 1,
        "employee_id": 2,
        "purchase_date": "2026-10-28",
        "items": [{"supplier_product_id": 3, "quantity": 2}],
    }
    assert (
        purchase_digest(PurchaseCreate(**body))
        == "2156ef3fbcb7a932ddb47b581c2f24c401d828a3c1bc6853d8cc28f7c3bc2eea"
    )
