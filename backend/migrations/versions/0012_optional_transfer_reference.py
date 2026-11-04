"""Allow optional transfer references while retaining full payment invariants."""

import sqlalchemy as sa
from alembic import op

revision = "0012_optional_transfer_reference"
down_revision = "0011_supplier_addresses"
branch_labels = None
depends_on = None


def payment_constraint(optional: bool) -> str:
    reference = (
        "(reference IS NULL OR length(reference) > 0)"
        if optional
        else "reference IS NOT NULL AND length(reference) > 0"
    )
    return (
        "(method = 'cash' AND received_amount >= amount "
        "AND change_amount = received_amount - amount AND reference IS NULL) OR "
        "(method = 'transfer' AND received_amount = amount "
        f"AND change_amount = 0 AND {reference}) OR "
        "(method = 'mixed' AND cash_amount > 0 AND transfer_amount > 0 "
        "AND cash_amount + transfer_amount = amount "
        "AND received_amount >= cash_amount "
        "AND change_amount = received_amount - cash_amount "
        f"AND {reference})"
    )


def upgrade() -> None:
    op.drop_constraint(
        op.f("ck_sale_payments_full_payment"), "sale_payments", type_="check"
    )
    op.create_check_constraint(
        "full_payment", "sale_payments", payment_constraint(True)
    )


def downgrade() -> None:
    if op.get_bind().scalar(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM sale_payments WHERE method IN "
            "('transfer','mixed') AND reference IS NULL)"
        )
    ):
        raise RuntimeError("Payments without a reference require reconciliation")
    op.drop_constraint(
        op.f("ck_sale_payments_full_payment"), "sale_payments", type_="check"
    )
    op.create_check_constraint(
        "full_payment", "sale_payments", payment_constraint(False)
    )
