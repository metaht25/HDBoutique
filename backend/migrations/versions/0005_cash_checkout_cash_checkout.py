"""cash checkout

Revision ID: 0005_cash_checkout
Revises: 0004_atomic_sales
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005_cash_checkout"
down_revision: str | Sequence[str] | None = "0004_atomic_sales"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "cash_requests",
        sa.Column(
            "request_id", sa.Integer(), sa.Identity(always=False), nullable=False
        ),
        sa.Column("actor_id", sa.Integer(), nullable=False),
        sa.Column("operation", sa.String(length=40), nullable=False),
        sa.Column("key_hash", sa.String(length=64), nullable=False),
        sa.Column("request_hash", sa.String(length=64), nullable=False),
        sa.Column("result_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["actor_id"],
            ["user_accounts.user_id"],
            name=op.f("fk_cash_requests_actor_id"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("request_id", name=op.f("pk_cash_requests")),
        sa.UniqueConstraint(
            "actor_id",
            "operation",
            "key_hash",
            name=op.f("uq_cash_requests_actor_id_operation_key_hash"),
        ),
    )
    op.create_index(
        op.f("ix_cash_requests_actor_id"), "cash_requests", ["actor_id"], unique=False
    )
    op.create_table(
        "cash_shifts",
        sa.Column("shift_id", sa.Integer(), sa.Identity(always=False), nullable=False),
        sa.Column("register_code", sa.String(length=20), nullable=False),
        sa.Column("employee_id", sa.Integer(), nullable=False),
        sa.Column("opened_by_user_id", sa.Integer(), nullable=False),
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("opening_amount", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("closed_by_user_id", sa.Integer(), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("counted_amount", sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column("expected_amount", sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column("difference", sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column("closing_reason", sa.String(length=300), nullable=True),
        sa.CheckConstraint(
            "register_code = 'main'", name=op.f("ck_cash_shifts_single_register")
        ),
        sa.CheckConstraint(
            "(closed_at IS NULL AND counted_amount IS NULL "
            "AND expected_amount IS NULL AND difference IS NULL "
            "AND closed_by_user_id IS NULL) OR (closed_at IS NOT NULL "
            "AND counted_amount IS NOT NULL AND counted_amount >= 0 "
            "AND expected_amount IS NOT NULL AND difference IS NOT NULL "
            "AND difference = counted_amount - expected_amount "
            "AND closed_by_user_id IS NOT NULL)",
            name=op.f("ck_cash_shifts_closure"),
        ),
        sa.CheckConstraint(
            "opening_amount >= 0", name=op.f("ck_cash_shifts_opening_amount")
        ),
        sa.ForeignKeyConstraint(
            ["closed_by_user_id"],
            ["user_accounts.user_id"],
            name=op.f("fk_cash_shifts_closed_by_user_id"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["employee_id"],
            ["employees.employee_id"],
            name=op.f("fk_cash_shifts_employee_id"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["opened_by_user_id"],
            ["user_accounts.user_id"],
            name=op.f("fk_cash_shifts_opened_by_user_id"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("shift_id", name=op.f("pk_cash_shifts")),
    )
    op.create_index(
        op.f("ix_cash_shifts_closed_by_user_id"),
        "cash_shifts",
        ["closed_by_user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_cash_shifts_employee_id"), "cash_shifts", ["employee_id"], unique=False
    )
    op.create_index(
        op.f("ix_cash_shifts_opened_by_user_id"),
        "cash_shifts",
        ["opened_by_user_id"],
        unique=False,
    )
    op.create_index(
        "uq_cash_shifts_open_register",
        "cash_shifts",
        ["register_code"],
        unique=True,
        postgresql_where=sa.text("closed_at IS NULL"),
    )
    op.create_table(
        "cash_movements",
        sa.Column(
            "movement_id", sa.Integer(), sa.Identity(always=False), nullable=False
        ),
        sa.Column("shift_id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("reason", sa.String(length=300), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("performed_by_user_id", sa.Integer(), nullable=False),
        sa.CheckConstraint(
            "amount > 0 AND kind IN ('deposit', 'withdrawal')",
            name=op.f("ck_cash_movements_valid_movement"),
        ),
        sa.ForeignKeyConstraint(
            ["performed_by_user_id"],
            ["user_accounts.user_id"],
            name=op.f("fk_cash_movements_performed_by_user_id"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["shift_id"],
            ["cash_shifts.shift_id"],
            name=op.f("fk_cash_movements_shift_id"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("movement_id", name=op.f("pk_cash_movements")),
    )
    op.create_index(
        op.f("ix_cash_movements_performed_by_user_id"),
        "cash_movements",
        ["performed_by_user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_cash_movements_shift_id"), "cash_movements", ["shift_id"], unique=False
    )
    op.create_table(
        "sale_payments",
        sa.Column(
            "payment_id", sa.Integer(), sa.Identity(always=False), nullable=False
        ),
        sa.Column("sale_id", sa.Integer(), nullable=False),
        sa.Column("shift_id", sa.Integer(), nullable=False),
        sa.Column("method", sa.String(length=16), nullable=False),
        sa.Column("amount", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("received_amount", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("change_amount", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("reference", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("performed_by_user_id", sa.Integer(), nullable=False),
        sa.CheckConstraint(
            "(method = 'cash' AND received_amount >= amount "
            "AND change_amount = received_amount - amount AND reference IS NULL) OR "
            "(method = 'transfer' AND received_amount = amount "
            "AND change_amount = 0 AND reference IS NOT NULL AND "
            "length(reference) > 0)",
            name=op.f("ck_sale_payments_full_payment"),
        ),
        sa.CheckConstraint("amount > 0", name=op.f("ck_sale_payments_positive_amount")),
        sa.ForeignKeyConstraint(
            ["performed_by_user_id"],
            ["user_accounts.user_id"],
            name=op.f("fk_sale_payments_performed_by_user_id"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["sale_id"],
            ["sales.sale_id"],
            name=op.f("fk_sale_payments_sale_id"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["shift_id"],
            ["cash_shifts.shift_id"],
            name=op.f("fk_sale_payments_shift_id"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("payment_id", name=op.f("pk_sale_payments")),
    )
    op.create_index(
        op.f("ix_sale_payments_performed_by_user_id"),
        "sale_payments",
        ["performed_by_user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_sale_payments_sale_id"), "sale_payments", ["sale_id"], unique=True
    )
    op.create_index(
        op.f("ix_sale_payments_shift_id"), "sale_payments", ["shift_id"], unique=False
    )
    op.create_table(
        "sale_voids",
        sa.Column("void_id", sa.Integer(), sa.Identity(always=False), nullable=False),
        sa.Column("sale_id", sa.Integer(), nullable=False),
        sa.Column("shift_id", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("method", sa.String(length=16), nullable=False),
        sa.Column("reference", sa.String(length=100), nullable=True),
        sa.Column("reason", sa.String(length=300), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("performed_by_user_id", sa.Integer(), nullable=False),
        sa.CheckConstraint(
            "amount > 0 AND method IN ('cash', 'transfer')",
            name=op.f("ck_sale_voids_valid_refund"),
        ),
        sa.ForeignKeyConstraint(
            ["performed_by_user_id"],
            ["user_accounts.user_id"],
            name=op.f("fk_sale_voids_performed_by_user_id"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["sale_id"],
            ["sales.sale_id"],
            name=op.f("fk_sale_voids_sale_id"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["shift_id"],
            ["cash_shifts.shift_id"],
            name=op.f("fk_sale_voids_shift_id"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("void_id", name=op.f("pk_sale_voids")),
    )
    op.create_index(
        op.f("ix_sale_voids_performed_by_user_id"),
        "sale_voids",
        ["performed_by_user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_sale_voids_sale_id"), "sale_voids", ["sale_id"], unique=True
    )
    op.create_index(
        op.f("ix_sale_voids_shift_id"), "sale_voids", ["shift_id"], unique=False
    )
    op.create_table(
        "sale_return_items",
        sa.Column(
            "return_item_id", sa.Integer(), sa.Identity(always=False), nullable=False
        ),
        sa.Column("void_id", sa.Integer(), nullable=False),
        sa.Column("sale_item_id", sa.Integer(), nullable=False),
        sa.Column("returned_quantity", sa.Integer(), nullable=False),
        sa.CheckConstraint(
            "returned_quantity >= 0",
            name=op.f("ck_sale_return_items_returned_quantity"),
        ),
        sa.ForeignKeyConstraint(
            ["sale_item_id"],
            ["sale_items.sale_item_id"],
            name=op.f("fk_sale_return_items_sale_item_id"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["void_id"],
            ["sale_voids.void_id"],
            name=op.f("fk_sale_return_items_void_id"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("return_item_id", name=op.f("pk_sale_return_items")),
    )
    op.create_index(
        op.f("ix_sale_return_items_sale_item_id"),
        "sale_return_items",
        ["sale_item_id"],
        unique=True,
    )
    op.create_index(
        op.f("ix_sale_return_items_void_id"),
        "sale_return_items",
        ["void_id"],
        unique=False,
    )
    op.add_column(
        "inventory_movements", sa.Column("return_item_id", sa.Integer(), nullable=True)
    )
    op.create_index(
        op.f("ix_inventory_movements_return_item_id"),
        "inventory_movements",
        ["return_item_id"],
        unique=True,
    )
    op.create_foreign_key(
        op.f("fk_inventory_movements_return_item_id"),
        "inventory_movements",
        "sale_return_items",
        ["return_item_id"],
        ["return_item_id"],
        ondelete="RESTRICT",
    )
    op.drop_constraint(
        op.f("ck_inventory_movements_movement_source"),
        "inventory_movements",
        type_="check",
    )
    op.drop_constraint(
        op.f("ck_inventory_movements_stock_delta"), "inventory_movements", type_="check"
    )
    op.create_check_constraint(
        op.f("ck_inventory_movements_movement_source"),
        "inventory_movements",
        "(movement_type = 'purchase_receipt' AND purchase_item_id IS "
        "NOT NULL AND sale_item_id IS NULL AND return_item_id IS "
        "NULL) OR "
        "(movement_type = 'sale_issue' AND sale_item_id IS NOT NULL "
        "AND purchase_item_id IS NULL AND return_item_id IS NULL) OR "
        "(movement_type = 'sale_return' AND return_item_id IS NOT "
        "NULL AND sale_item_id IS NULL AND purchase_item_id IS NULL)",
    )
    op.create_check_constraint(
        op.f("ck_inventory_movements_stock_delta"),
        "inventory_movements",
        "(movement_type IN ('purchase_receipt', 'sale_return') AND "
        "stock_after = stock_before + quantity) OR "
        "(movement_type = 'sale_issue' AND stock_after = stock_before - quantity)",
    )


def downgrade() -> None:
    # Never discard a used register, receipts or refunds through a downgrade.
    op.execute(
        "DO $$ BEGIN IF EXISTS (SELECT 1 FROM cash_shifts) OR EXISTS "
        "(SELECT 1 FROM cash_requests) THEN RAISE EXCEPTION 'Cash "
        "history exists; restore a verified backup instead'; END IF; "
        "END $$"
    )
    op.drop_constraint(
        op.f("ck_inventory_movements_movement_source"),
        "inventory_movements",
        type_="check",
    )
    op.drop_constraint(
        op.f("ck_inventory_movements_stock_delta"), "inventory_movements", type_="check"
    )
    op.create_check_constraint(
        op.f("ck_inventory_movements_movement_source"),
        "inventory_movements",
        "(movement_type = 'purchase_receipt' AND purchase_item_id IS "
        "NOT NULL AND sale_item_id IS NULL) OR "
        "(movement_type = 'sale_issue' AND sale_item_id IS NOT NULL "
        "AND purchase_item_id IS NULL)",
    )
    op.create_check_constraint(
        op.f("ck_inventory_movements_stock_delta"),
        "inventory_movements",
        "(movement_type = 'purchase_receipt' AND stock_after = "
        "stock_before + quantity) OR "
        "(movement_type = 'sale_issue' AND stock_after = stock_before - quantity)",
    )
    op.drop_constraint(
        op.f("fk_inventory_movements_return_item_id"),
        "inventory_movements",
        type_="foreignkey",
    )
    op.drop_index(
        op.f("ix_inventory_movements_return_item_id"), table_name="inventory_movements"
    )
    op.drop_column("inventory_movements", "return_item_id")
    op.drop_index(op.f("ix_sale_return_items_void_id"), table_name="sale_return_items")
    op.drop_index(
        op.f("ix_sale_return_items_sale_item_id"), table_name="sale_return_items"
    )
    op.drop_table("sale_return_items")
    op.drop_index(op.f("ix_sale_voids_shift_id"), table_name="sale_voids")
    op.drop_index(op.f("ix_sale_voids_sale_id"), table_name="sale_voids")
    op.drop_index(op.f("ix_sale_voids_performed_by_user_id"), table_name="sale_voids")
    op.drop_table("sale_voids")
    op.drop_index(op.f("ix_sale_payments_shift_id"), table_name="sale_payments")
    op.drop_index(op.f("ix_sale_payments_sale_id"), table_name="sale_payments")
    op.drop_index(
        op.f("ix_sale_payments_performed_by_user_id"), table_name="sale_payments"
    )
    op.drop_table("sale_payments")
    op.drop_index(op.f("ix_cash_movements_shift_id"), table_name="cash_movements")
    op.drop_index(
        op.f("ix_cash_movements_performed_by_user_id"), table_name="cash_movements"
    )
    op.drop_table("cash_movements")
    op.drop_index(
        "uq_cash_shifts_open_register",
        table_name="cash_shifts",
        postgresql_where=sa.text("closed_at IS NULL"),
    )
    op.drop_index(op.f("ix_cash_shifts_opened_by_user_id"), table_name="cash_shifts")
    op.drop_index(op.f("ix_cash_shifts_employee_id"), table_name="cash_shifts")
    op.drop_index(op.f("ix_cash_shifts_closed_by_user_id"), table_name="cash_shifts")
    op.drop_table("cash_shifts")
    op.drop_index(op.f("ix_cash_requests_actor_id"), table_name="cash_requests")
    op.drop_table("cash_requests")
