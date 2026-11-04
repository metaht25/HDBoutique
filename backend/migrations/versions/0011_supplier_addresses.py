"""Allow suppliers without location catalogs, preserving historical addresses.

Revision ID: 0011_supplier_addresses
Revises: 0010_optional_profile_phone
"""

import sqlalchemy as sa
from alembic import op

revision = "0011_supplier_addresses"
down_revision = "0010_optional_profile_phone"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "suppliers", "address_id", existing_type=sa.Integer(), nullable=True
    )
    op.add_column("suppliers", sa.Column("address_line", sa.String(100), nullable=True))


def downgrade() -> None:
    connection = op.get_bind()
    if connection.scalar(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM suppliers "
            "WHERE address_id IS NULL OR address_line IS NOT NULL)"
        )
    ):
        raise RuntimeError("Supplier addresses require reconciliation before downgrade")
    op.drop_column("suppliers", "address_line")
    op.alter_column(
        "suppliers", "address_id", existing_type=sa.Integer(), nullable=False
    )
