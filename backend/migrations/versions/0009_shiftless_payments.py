"""Retire operational shifts while preserving all historical cash records."""

from alembic import op

revision = "0009_shiftless_payments"
down_revision = "0008_permanent_references"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for table in ("sale_payments", "sale_voids"):
        op.alter_column(table, "shift_id", nullable=True)


def downgrade() -> None:
    # NOT NULL fails safely when shiftless operations exist. Never infer a shift.
    for table in ("sale_voids", "sale_payments"):
        op.alter_column(table, "shift_id", nullable=False)
