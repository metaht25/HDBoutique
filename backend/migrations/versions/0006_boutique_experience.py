"""Boutique workflows, mixed payments and auditable initial inventory.

Revision ID: 0006_boutique_experience
Revises: 0005_cash_checkout
"""

import sqlalchemy as sa
from alembic import op

revision = "0006_boutique_experience"
down_revision = "0005_cash_checkout"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for table in ("products", "customers", "employees", "suppliers"):
        op.add_column(
            table,
            sa.Column(
                "is_active",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("true"),
            ),
        )
    for table in ("customers", "employees", "suppliers"):
        op.add_column(table, sa.Column("created_at", sa.DateTime(timezone=True)))
    op.add_column(
        "addresses",
        sa.Column(
            "municipality_id",
            sa.Integer(),
            sa.ForeignKey("municipalities.municipality_id", ondelete="RESTRICT"),
        ),
    )
    op.create_index("ix_addresses_municipality_id", "addresses", ["municipality_id"])
    for name in ("address_id", "customer_type_id", "phone_number"):
        op.alter_column("customers", name, nullable=True)
    op.add_column("customers", sa.Column("kind", sa.String(16)))
    op.add_column("customers", sa.Column("technical_key", sa.String(30)))
    op.create_unique_constraint(
        "uq_customers_technical_key", "customers", ["technical_key"]
    )
    op.alter_column(
        "employees", "work_email", type_=sa.String(100), existing_type=sa.String(20)
    )
    op.add_column(
        "user_accounts",
        sa.Column(
            "must_change_password",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column("products", sa.Column("cost", sa.Numeric(10, 2)))
    op.add_column(
        "products",
        sa.Column(
            "supplier_id",
            sa.Integer(),
            sa.ForeignKey("suppliers.supplier_id", ondelete="RESTRICT"),
        ),
    )
    op.create_index("ix_products_supplier_id", "products", ["supplier_id"])
    op.add_column("products", sa.Column("created_date", sa.Date()))
    op.add_column("products", sa.Column("description", sa.String(500)))
    for name, kind in (
        ("customer_kind", sa.String(16)),
        ("customer_name", sa.String(100)),
        ("customer_phone", sa.String(10)),
        ("customer_address", sa.String(250)),
        ("seller_name", sa.String(100)),
        ("delivery_cost", sa.Numeric(10, 2)),
        ("notes", sa.String(500)),
    ):
        op.add_column("sales", sa.Column(name, kind))
    op.add_column("sale_items", sa.Column("product_name", sa.String(40)))
    op.add_column("sale_items", sa.Column("size_name", sa.String(20)))
    op.add_column("purchases", sa.Column("description", sa.String(500)))
    for table in ("sale_payments", "sale_voids"):
        for name in ("cash_amount", "transfer_amount"):
            op.add_column(table, sa.Column(name, sa.Numeric(10, 2)))
        op.create_check_constraint(
            "payment_components",
            table,
            "(cash_amount IS NULL AND transfer_amount IS NULL AND method IN "
            "('cash', 'transfer')) OR "
            "(cash_amount IS NOT NULL AND transfer_amount IS NOT NULL AND "
            "cash_amount >= 0 "
            "AND transfer_amount >= 0 AND cash_amount + transfer_amount = amount AND "
            "((method = 'cash' AND transfer_amount = 0) OR (method = "
            "'transfer' AND cash_amount = 0) OR "
            "(method = 'mixed' AND cash_amount > 0 AND transfer_amount > 0)))",
        )
    op.drop_constraint(
        op.f("ck_sale_payments_full_payment"), "sale_payments", type_="check"
    )
    op.create_check_constraint(
        "full_payment",
        "sale_payments",
        "(method = 'cash' AND received_amount >= amount "
        "AND change_amount = received_amount - amount AND reference IS NULL) OR "
        "(method = 'transfer' AND received_amount = amount AND change_amount = 0 "
        "AND reference IS NOT NULL AND length(reference) > 0) OR "
        "(method = 'mixed' AND cash_amount > 0 AND transfer_amount > 0 "
        "AND cash_amount + transfer_amount = amount AND received_amount >= cash_amount "
        "AND change_amount = received_amount - cash_amount "
        "AND reference IS NOT NULL AND length(reference) > 0)",
    )
    op.drop_constraint(op.f("ck_sale_voids_valid_refund"), "sale_voids", type_="check")
    op.create_check_constraint(
        "valid_refund",
        "sale_voids",
        "amount > 0 AND method IN ('cash', 'transfer', 'mixed')",
    )
    op.alter_column("inventory_movements", "employee_id", nullable=True)
    for name in ("movement_source", "valid_quantities", "stock_delta"):
        op.drop_constraint(
            op.f("ck_inventory_movements_" + name), "inventory_movements", type_="check"
        )
    op.create_check_constraint(
        "movement_source",
        "inventory_movements",
        "(movement_type = 'purchase_receipt' AND purchase_item_id IS NOT NULL "
        "AND sale_item_id IS NULL AND return_item_id IS NULL) OR "
        "(movement_type = 'sale_issue' AND sale_item_id IS NOT NULL "
        "AND purchase_item_id IS NULL AND return_item_id IS NULL) OR "
        "(movement_type = 'sale_return' AND return_item_id IS NOT NULL "
        "AND sale_item_id IS NULL AND purchase_item_id IS NULL) OR "
        "(movement_type = 'initial_stock' AND purchase_item_id IS NULL "
        "AND sale_item_id IS NULL "
        "AND return_item_id IS NULL AND stock_before = 0)",
    )
    op.create_check_constraint(
        "valid_quantities",
        "inventory_movements",
        "((movement_type = 'initial_stock' AND quantity >= 0) OR "
        "(movement_type <> 'initial_stock' AND quantity > 0 AND "
        "employee_id IS NOT NULL)) "
        "AND stock_before >= 0 AND stock_after >= 0",
    )
    op.create_check_constraint(
        "stock_delta",
        "inventory_movements",
        "(movement_type IN ('purchase_receipt', 'sale_return', 'initial_stock') "
        "AND stock_after = stock_before + quantity) OR "
        "(movement_type = 'sale_issue' AND stock_after = stock_before - quantity)",
    )
    op.create_index(
        "uq_inventory_initial_product",
        "inventory_movements",
        ["product_id"],
        unique=True,
        postgresql_where=sa.text("movement_type = 'initial_stock'"),
    )
    op.create_table(
        "boutique_profiles",
        sa.Column("profile_id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("phone_number", sa.String(30), nullable=False),
        sa.Column("address_line", sa.String(250), nullable=False),
        sa.Column("logo", sa.LargeBinary()),
    )
    op.create_table(
        "management_events",
        sa.Column("event_id", sa.Integer(), sa.Identity(), primary_key=True),
        sa.Column("resource", sa.String(40), nullable=False),
        sa.Column("record_id", sa.Integer(), nullable=False),
        sa.Column("action", sa.String(40), nullable=False),
        sa.Column(
            "actor_id",
            sa.Integer(),
            sa.ForeignKey("user_accounts.user_id", ondelete="RESTRICT"),
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("detail", sa.String(300), nullable=False),
    )
    op.create_index("ix_management_events_actor_id", "management_events", ["actor_id"])
    # Preserve obsolete accounts and record why their access was disabled.
    op.execute(
        "INSERT INTO management_events (resource, record_id, action, "
        "created_at, detail) "
        "SELECT 'user_accounts', user_id, 'role_retired', CURRENT_TIMESTAMP, "
        "'Manager retired by authorized boutique increment' FROM "
        "user_accounts WHERE role = 'Manager'"
    )
    op.execute(
        "DELETE FROM web_sessions WHERE user_id IN (SELECT user_id FROM "
        "user_accounts WHERE role = 'Manager')"
    )
    op.execute("UPDATE user_accounts SET is_active = false WHERE role = 'Manager'")


def downgrade() -> None:
    # Never erase new operational data or re-enable obsolete accounts silently.
    op.execute(
        "DO $$ BEGIN IF EXISTS (SELECT 1 FROM management_events) OR "
        "EXISTS (SELECT 1 FROM boutique_profiles) OR "
        "EXISTS (SELECT 1 FROM inventory_movements WHERE movement_type = "
        "'initial_stock') OR "
        "EXISTS (SELECT 1 FROM sales WHERE customer_kind IS NOT NULL) OR "
        "EXISTS (SELECT 1 FROM customers WHERE address_id IS NULL OR "
        "customer_type_id IS NULL OR phone_number IS NULL) OR "
        "EXISTS (SELECT 1 FROM addresses WHERE municipality_id IS NOT NULL) OR "
        "EXISTS (SELECT 1 FROM products WHERE cost IS NOT NULL OR "
        "supplier_id IS NOT NULL "
        "OR created_date IS NOT NULL OR description IS NOT NULL OR NOT is_active) OR "
        "EXISTS (SELECT 1 FROM customers WHERE kind IS NOT NULL OR "
        "technical_key IS NOT NULL "
        "OR created_at IS NOT NULL OR NOT is_active) OR "
        "EXISTS (SELECT 1 FROM employees WHERE created_at IS NOT NULL OR NOT is_active "
        "OR length(work_email) > 20) OR "
        "EXISTS (SELECT 1 FROM suppliers WHERE created_at IS NOT "
        "NULL OR NOT is_active) OR "
        "EXISTS (SELECT 1 FROM user_accounts WHERE must_change_password) OR "
        "EXISTS (SELECT 1 FROM purchases WHERE description IS NOT NULL) OR "
        "EXISTS (SELECT 1 FROM sale_items WHERE product_name IS NOT "
        "NULL OR size_name IS NOT NULL) OR "
        "EXISTS (SELECT 1 FROM sale_payments WHERE cash_amount IS "
        "NOT NULL OR transfer_amount IS NOT NULL) OR "
        "EXISTS (SELECT 1 FROM sale_voids WHERE cash_amount IS NOT "
        "NULL OR transfer_amount IS NOT NULL) THEN "
        "RAISE EXCEPTION 'Restore to a separate verified database; "
        "operational data must be preserved'; END IF; END $$"
    )
    op.drop_table("management_events")
    op.drop_table("boutique_profiles")
    op.drop_index("uq_inventory_initial_product", "inventory_movements")
    for name in ("movement_source", "valid_quantities", "stock_delta"):
        op.drop_constraint(
            op.f("ck_inventory_movements_" + name), "inventory_movements", type_="check"
        )
    op.create_check_constraint(
        "movement_source",
        "inventory_movements",
        "(movement_type = 'purchase_receipt' AND purchase_item_id IS NOT "
        "NULL AND sale_item_id IS NULL AND return_item_id IS NULL) OR "
        "(movement_type = 'sale_issue' AND sale_item_id IS NOT NULL AND "
        "purchase_item_id IS NULL AND return_item_id IS NULL) OR "
        "(movement_type = 'sale_return' AND return_item_id IS NOT NULL "
        "AND sale_item_id IS NULL AND purchase_item_id IS NULL)",
    )
    op.create_check_constraint(
        "valid_quantities",
        "inventory_movements",
        "quantity > 0 AND stock_before >= 0 AND stock_after >= 0",
    )
    op.create_check_constraint(
        "stock_delta",
        "inventory_movements",
        "(movement_type IN ('purchase_receipt', 'sale_return') AND "
        "stock_after = stock_before + quantity) OR "
        "(movement_type = 'sale_issue' AND stock_after = stock_before - quantity)",
    )
    op.alter_column("inventory_movements", "employee_id", nullable=False)
    op.drop_constraint(
        op.f("ck_sale_payments_full_payment"), "sale_payments", type_="check"
    )
    op.create_check_constraint(
        "full_payment",
        "sale_payments",
        "(method = 'cash' AND received_amount >= amount AND change_amount "
        "= received_amount - amount AND reference IS NULL) OR "
        "(method = 'transfer' AND received_amount = amount AND "
        "change_amount = 0 AND reference IS NOT NULL AND "
        "length(reference) > 0)",
    )
    op.drop_constraint(op.f("ck_sale_voids_valid_refund"), "sale_voids", type_="check")
    op.create_check_constraint(
        "valid_refund", "sale_voids", "amount > 0 AND method IN ('cash', 'transfer')"
    )
    for table in ("sale_payments", "sale_voids"):
        op.drop_constraint(
            op.f("ck_" + table + "_payment_components"), table, type_="check"
        )
        for name in ("cash_amount", "transfer_amount"):
            op.drop_column(table, name)
    for table, names in {
        "sales": (
            "customer_kind",
            "customer_name",
            "customer_phone",
            "customer_address",
            "seller_name",
            "delivery_cost",
            "notes",
        ),
        "sale_items": ("product_name", "size_name"),
        "purchases": ("description",),
        "products": ("cost", "supplier_id", "created_date", "description"),
        "customers": ("kind", "technical_key", "created_at"),
        "employees": ("created_at",),
        "suppliers": ("created_at",),
        "user_accounts": ("must_change_password",),
        "addresses": ("municipality_id",),
    }.items():
        for name in names:
            op.drop_column(table, name)
    for name in ("address_id", "customer_type_id", "phone_number"):
        op.alter_column("customers", name, nullable=False)
    op.alter_column(
        "employees", "work_email", type_=sa.String(20), existing_type=sa.String(100)
    )
    for table in ("products", "customers", "employees", "suppliers"):
        op.drop_column(table, "is_active")
