"""Add opt-in purchase workflows, historical costs and receipt movements."""

import sqlalchemy as sa
from alembic import op

revision = "0003_purchase_receipts"
down_revision = "0002_identity"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "purchase_workflows",
        sa.Column("purchase_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("created_by_user_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("idempotency_hash", sa.String(64), nullable=False),
        sa.Column("request_hash", sa.String(64), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("received_by_user_id", sa.Integer(), nullable=True),
        sa.Column("received_employee_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["purchase_id"],
            ["purchases.purchase_id"],
            name="fk_purchase_workflows_purchase_id",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_user_id"],
            ["user_accounts.user_id"],
            name="fk_purchase_workflows_created_by_user_id",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["received_by_user_id"],
            ["user_accounts.user_id"],
            name="fk_purchase_workflows_received_by_user_id",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["received_employee_id"],
            ["employees.employee_id"],
            name="fk_purchase_workflows_received_employee_id",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("purchase_id", name="pk_purchase_workflows"),
        sa.UniqueConstraint(
            "created_by_user_id",
            "idempotency_hash",
            name="uq_purchase_workflows_created_by_user_id_idempotency_hash",
        ),
        sa.CheckConstraint(
            "status IN ('registered', 'received')",
            name=op.f("ck_purchase_workflows_valid_status"),
        ),
        sa.CheckConstraint(
            "(status = 'registered' AND received_at IS NULL "
            "AND received_by_user_id IS NULL AND received_employee_id IS NULL) OR "
            "(status = 'received' AND received_at IS NOT NULL "
            "AND received_by_user_id IS NOT NULL AND received_employee_id IS NOT NULL)",
            name=op.f("ck_purchase_workflows_receipt_consistency"),
        ),
    )
    op.create_index(
        "ix_purchase_workflows_purchase_id", "purchase_workflows", ["purchase_id"]
    )
    op.create_index(
        "ix_purchase_workflows_created_by_user_id",
        "purchase_workflows",
        ["created_by_user_id"],
    )
    op.create_index(
        "ix_purchase_workflows_received_by_user_id",
        "purchase_workflows",
        ["received_by_user_id"],
    )
    op.create_index(
        "ix_purchase_workflows_received_employee_id",
        "purchase_workflows",
        ["received_employee_id"],
    )
    op.create_table(
        "purchase_item_costs",
        sa.Column("purchase_item_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("unit_cost", sa.Numeric(10, 2), nullable=False),
        sa.ForeignKeyConstraint(
            ["purchase_item_id"],
            ["purchase_items.purchase_item_id"],
            name="fk_purchase_item_costs_purchase_item_id",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["product_id"],
            ["products.product_id"],
            name="fk_purchase_item_costs_product_id",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("purchase_item_id", name="pk_purchase_item_costs"),
        sa.CheckConstraint(
            "unit_cost >= 0", name=op.f("ck_purchase_item_costs_nonnegative_cost")
        ),
    )
    op.create_index(
        "ix_purchase_item_costs_purchase_item_id",
        "purchase_item_costs",
        ["purchase_item_id"],
    )
    op.create_index(
        "ix_purchase_item_costs_product_id", "purchase_item_costs", ["product_id"]
    )
    op.create_table(
        "inventory_movements",
        sa.Column("movement_id", sa.Integer(), sa.Identity(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("purchase_item_id", sa.Integer(), nullable=False),
        sa.Column("movement_type", sa.String(24), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("stock_before", sa.Integer(), nullable=False),
        sa.Column("stock_after", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("performed_by_user_id", sa.Integer(), nullable=False),
        sa.Column("employee_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["product_id"],
            ["products.product_id"],
            name="fk_inventory_movements_product_id",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["purchase_item_id"],
            ["purchase_items.purchase_item_id"],
            name="fk_inventory_movements_purchase_item_id",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["performed_by_user_id"],
            ["user_accounts.user_id"],
            name="fk_inventory_movements_performed_by_user_id",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["employee_id"],
            ["employees.employee_id"],
            name="fk_inventory_movements_employee_id",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("movement_id", name="pk_inventory_movements"),
        sa.CheckConstraint(
            "movement_type = 'purchase_receipt'",
            name=op.f("ck_inventory_movements_receipt_type"),
        ),
        sa.CheckConstraint(
            "quantity > 0 AND stock_before >= 0 AND stock_after >= 0",
            name=op.f("ck_inventory_movements_valid_quantities"),
        ),
        sa.CheckConstraint(
            "stock_after = stock_before + quantity",
            name=op.f("ck_inventory_movements_stock_delta"),
        ),
    )
    op.create_index(
        "ix_inventory_movements_product_id", "inventory_movements", ["product_id"]
    )
    op.create_index(
        "ix_inventory_movements_purchase_item_id",
        "inventory_movements",
        ["purchase_item_id"],
        unique=True,
    )
    op.create_index(
        "ix_inventory_movements_performed_by_user_id",
        "inventory_movements",
        ["performed_by_user_id"],
    )
    op.create_index(
        "ix_inventory_movements_employee_id", "inventory_movements", ["employee_id"]
    )


def downgrade() -> None:
    op.drop_table("inventory_movements")
    op.drop_table("purchase_item_costs")
    op.drop_table("purchase_workflows")
