"""Add sale audit/idempotency and sale inventory issues without altering history.

Revision ID: 0004_atomic_sales
Revises: 0003_purchase_receipts
"""

import sqlalchemy as sa
from alembic import op

revision = "0004_atomic_sales"
down_revision = "0003_purchase_receipts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sale_workflows",
        sa.Column("sale_id", sa.Integer(), nullable=False),
        sa.Column("created_by_user_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("idempotency_hash", sa.String(64), nullable=False),
        sa.Column("request_hash", sa.String(64), nullable=False),
        sa.ForeignKeyConstraint(
            ["sale_id"],
            ["sales.sale_id"],
            name="fk_sale_workflows_sale_id",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_user_id"],
            ["user_accounts.user_id"],
            name="fk_sale_workflows_created_by_user_id",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("sale_id", name="pk_sale_workflows"),
        sa.UniqueConstraint(
            "created_by_user_id",
            "idempotency_hash",
            name="uq_sale_workflows_created_by_user_id_idempotency_hash",
        ),
    )
    for column in ("sale_id", "created_by_user_id"):
        op.create_index(f"ix_sale_workflows_{column}", "sale_workflows", [column])
    op.drop_constraint(
        op.f("ck_inventory_movements_receipt_type"),
        "inventory_movements",
        type_="check",
    )
    op.drop_constraint(
        op.f("ck_inventory_movements_stock_delta"), "inventory_movements", type_="check"
    )
    op.alter_column("inventory_movements", "purchase_item_id", nullable=True)
    op.add_column("inventory_movements", sa.Column("sale_item_id", sa.Integer()))
    op.create_foreign_key(
        "fk_inventory_movements_sale_item_id",
        "inventory_movements",
        "sale_items",
        ["sale_item_id"],
        ["sale_item_id"],
        ondelete="RESTRICT",
    )
    op.create_index(
        "ix_inventory_movements_sale_item_id",
        "inventory_movements",
        ["sale_item_id"],
        unique=True,
    )
    op.create_check_constraint(
        op.f("ck_inventory_movements_movement_source"),
        "inventory_movements",
        "(movement_type = 'purchase_receipt' AND purchase_item_id IS NOT NULL "
        "AND sale_item_id IS NULL) OR "
        "(movement_type = 'sale_issue' AND sale_item_id IS NOT NULL "
        "AND purchase_item_id IS NULL)",
    )
    op.create_check_constraint(
        op.f("ck_inventory_movements_stock_delta"),
        "inventory_movements",
        "(movement_type = 'purchase_receipt' "
        "AND stock_after = stock_before + quantity) "
        "OR (movement_type = 'sale_issue' AND stock_after = stock_before - quantity)",
    )


def downgrade() -> None:
    # No descartar movimientos ni fingir una devolucion al bajar la revision.
    # NOT NULL impide el downgrade si existen salidas: requiere plan y respaldo.
    op.alter_column("inventory_movements", "purchase_item_id", nullable=False)
    op.drop_constraint(
        op.f("ck_inventory_movements_movement_source"),
        "inventory_movements",
        type_="check",
    )
    op.drop_constraint(
        op.f("ck_inventory_movements_stock_delta"), "inventory_movements", type_="check"
    )
    op.drop_index("ix_inventory_movements_sale_item_id", "inventory_movements")
    op.drop_constraint(
        "fk_inventory_movements_sale_item_id", "inventory_movements", type_="foreignkey"
    )
    op.drop_column("inventory_movements", "sale_item_id")
    op.create_check_constraint(
        op.f("ck_inventory_movements_receipt_type"),
        "inventory_movements",
        "movement_type = 'purchase_receipt'",
    )
    op.create_check_constraint(
        op.f("ck_inventory_movements_stock_delta"),
        "inventory_movements",
        "stock_after = stock_before + quantity",
    )
    op.drop_table("sale_workflows")
