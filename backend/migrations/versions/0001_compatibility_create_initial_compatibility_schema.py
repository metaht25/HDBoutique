"""create initial compatibility schema

Revision ID: 0001_compatibility
Revises:
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001_compatibility"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # DDL revisado: compatibilidad estructural, sin carga ni inferencia de datos.
    op.create_table(
        "categories",
        sa.Column(
            "category_id", sa.Integer(), sa.Identity(always=False), nullable=False
        ),
        sa.Column("name", sa.String(length=20), nullable=True),
        sa.PrimaryKeyConstraint("category_id", name=op.f("pk_categories")),
    )
    op.create_table(
        "customer_types",
        sa.Column(
            "customer_type_id", sa.Integer(), sa.Identity(always=False), nullable=False
        ),
        sa.Column("name", sa.String(length=20), nullable=True),
        sa.PrimaryKeyConstraint("customer_type_id", name=op.f("pk_customer_types")),
    )
    op.create_table(
        "departments",
        sa.Column(
            "department_id", sa.Integer(), sa.Identity(always=False), nullable=False
        ),
        sa.Column("name", sa.String(length=40), nullable=False),
        sa.PrimaryKeyConstraint("department_id", name=op.f("pk_departments")),
    )
    op.create_table(
        "sizes",
        sa.Column("size_id", sa.Integer(), sa.Identity(always=False), nullable=False),
        sa.Column("name", sa.String(length=20), nullable=False),
        sa.PrimaryKeyConstraint("size_id", name=op.f("pk_sizes")),
    )
    op.create_table(
        "addresses",
        sa.Column(
            "address_id", sa.Integer(), sa.Identity(always=False), nullable=False
        ),
        sa.Column("department_id", sa.Integer(), nullable=False),
        sa.Column("address_line", sa.String(length=100), nullable=True),
        sa.ForeignKeyConstraint(
            ["department_id"],
            ["departments.department_id"],
            name=op.f("fk_addresses_department_id"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("address_id", name=op.f("pk_addresses")),
    )
    op.create_index(
        op.f("ix_addresses_department_id"), "addresses", ["department_id"], unique=False
    )
    op.create_table(
        "municipalities",
        sa.Column(
            "municipality_id", sa.Integer(), sa.Identity(always=False), nullable=False
        ),
        sa.Column("department_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=40), nullable=True),
        sa.ForeignKeyConstraint(
            ["department_id"],
            ["departments.department_id"],
            name=op.f("fk_municipalities_department_id"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("municipality_id", name=op.f("pk_municipalities")),
    )
    op.create_index(
        op.f("ix_municipalities_department_id"),
        "municipalities",
        ["department_id"],
        unique=False,
    )
    op.create_table(
        "products",
        sa.Column(
            "product_id", sa.Integer(), sa.Identity(always=False), nullable=False
        ),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.Column("size_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=40), nullable=True),
        sa.Column("legacy_stock_quantity", sa.Integer(), nullable=True),
        sa.Column("legacy_stock", sa.Integer(), nullable=True),
        sa.Column("unit_price", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.ForeignKeyConstraint(
            ["category_id"],
            ["categories.category_id"],
            name=op.f("fk_products_category_id"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["size_id"],
            ["sizes.size_id"],
            name=op.f("fk_products_size_id"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("product_id", name=op.f("pk_products")),
    )
    op.create_index(
        op.f("ix_products_category_id"), "products", ["category_id"], unique=False
    )
    op.create_index(op.f("ix_products_size_id"), "products", ["size_id"], unique=False)
    op.create_table(
        "customers",
        sa.Column(
            "customer_id", sa.Integer(), sa.Identity(always=False), nullable=False
        ),
        sa.Column("address_id", sa.Integer(), nullable=False),
        sa.Column("customer_type_id", sa.Integer(), nullable=False),
        sa.Column("first_names", sa.String(length=40), nullable=False),
        sa.Column("last_names", sa.String(length=40), nullable=False),
        sa.Column("phone_number", sa.String(length=10), nullable=False),
        sa.ForeignKeyConstraint(
            ["address_id"],
            ["addresses.address_id"],
            name=op.f("fk_customers_address_id"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["customer_type_id"],
            ["customer_types.customer_type_id"],
            name=op.f("fk_customers_customer_type_id"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("customer_id", name=op.f("pk_customers")),
    )
    op.create_index(
        op.f("ix_customers_address_id"), "customers", ["address_id"], unique=False
    )
    op.create_index(
        op.f("ix_customers_customer_type_id"),
        "customers",
        ["customer_type_id"],
        unique=False,
    )
    op.create_table(
        "employees",
        sa.Column(
            "employee_id", sa.Integer(), sa.Identity(always=False), nullable=False
        ),
        sa.Column("address_id", sa.Integer(), nullable=False),
        sa.Column("first_names", sa.String(length=40), nullable=False),
        sa.Column("last_names", sa.String(length=40), nullable=False),
        sa.Column("phone_number", sa.String(length=10), nullable=False),
        sa.Column("work_email", sa.String(length=20), nullable=True),
        sa.Column("job_title", sa.String(length=20), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.ForeignKeyConstraint(
            ["address_id"],
            ["addresses.address_id"],
            name=op.f("fk_employees_address_id"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("employee_id", name=op.f("pk_employees")),
    )
    op.create_index(
        op.f("ix_employees_address_id"), "employees", ["address_id"], unique=False
    )
    op.create_table(
        "supplier_products",
        sa.Column(
            "supplier_product_id",
            sa.Integer(),
            sa.Identity(always=False),
            nullable=False,
        ),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("purchase_price", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.ForeignKeyConstraint(
            ["product_id"],
            ["products.product_id"],
            name=op.f("fk_supplier_products_product_id"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint(
            "supplier_product_id", name=op.f("pk_supplier_products")
        ),
    )
    op.create_index(
        op.f("ix_supplier_products_product_id"),
        "supplier_products",
        ["product_id"],
        unique=False,
    )
    op.create_table(
        "suppliers",
        sa.Column(
            "supplier_id", sa.Integer(), sa.Identity(always=False), nullable=False
        ),
        sa.Column("address_id", sa.Integer(), nullable=False),
        sa.Column("company_name", sa.String(length=50), nullable=False),
        sa.Column("contact_first_names", sa.String(length=50), nullable=False),
        sa.Column("contact_last_names", sa.String(length=50), nullable=False),
        sa.Column("phone_number", sa.String(length=10), nullable=False),
        sa.Column("work_email", sa.String(length=40), nullable=True),
        sa.ForeignKeyConstraint(
            ["address_id"],
            ["addresses.address_id"],
            name=op.f("fk_suppliers_address_id"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("supplier_id", name=op.f("pk_suppliers")),
    )
    op.create_index(
        op.f("ix_suppliers_address_id"), "suppliers", ["address_id"], unique=False
    )
    op.create_table(
        "purchases",
        sa.Column(
            "purchase_id", sa.Integer(), sa.Identity(always=False), nullable=False
        ),
        sa.Column("supplier_id", sa.Integer(), nullable=False),
        sa.Column("employee_id", sa.Integer(), nullable=False),
        sa.Column("purchase_date", sa.Date(), nullable=False),
        sa.Column("review_date", sa.Date(), nullable=True),
        sa.Column("refill_date", sa.Date(), nullable=True),
        sa.Column("shipping_cost", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.ForeignKeyConstraint(
            ["employee_id"],
            ["employees.employee_id"],
            name=op.f("fk_purchases_employee_id"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["supplier_id"],
            ["suppliers.supplier_id"],
            name=op.f("fk_purchases_supplier_id"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("purchase_id", name=op.f("pk_purchases")),
    )
    op.create_index(
        op.f("ix_purchases_employee_id"), "purchases", ["employee_id"], unique=False
    )
    op.create_index(
        op.f("ix_purchases_supplier_id"), "purchases", ["supplier_id"], unique=False
    )
    op.create_table(
        "sales",
        sa.Column("sale_id", sa.Integer(), sa.Identity(always=False), nullable=False),
        sa.Column("customer_id", sa.Integer(), nullable=False),
        sa.Column("employee_id", sa.Integer(), nullable=False),
        sa.Column("sale_date", sa.Date(), nullable=False),
        sa.Column("total", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.ForeignKeyConstraint(
            ["customer_id"],
            ["customers.customer_id"],
            name=op.f("fk_sales_customer_id"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["employee_id"],
            ["employees.employee_id"],
            name=op.f("fk_sales_employee_id"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("sale_id", name=op.f("pk_sales")),
    )
    op.create_index(
        op.f("ix_sales_customer_id"), "sales", ["customer_id"], unique=False
    )
    op.create_index(
        op.f("ix_sales_employee_id"), "sales", ["employee_id"], unique=False
    )
    op.create_table(
        "supplier_offerings",
        sa.Column(
            "offering_id", sa.Integer(), sa.Identity(always=False), nullable=False
        ),
        sa.Column("supplier_id", sa.Integer(), nullable=False),
        sa.Column("supplier_product_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["supplier_id"],
            ["suppliers.supplier_id"],
            name=op.f("fk_supplier_offerings_supplier_id"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["supplier_product_id"],
            ["supplier_products.supplier_product_id"],
            name=op.f("fk_supplier_offerings_supplier_product_id"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("offering_id", name=op.f("pk_supplier_offerings")),
    )
    op.create_index(
        op.f("ix_supplier_offerings_supplier_id"),
        "supplier_offerings",
        ["supplier_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_supplier_offerings_supplier_product_id"),
        "supplier_offerings",
        ["supplier_product_id"],
        unique=False,
    )
    op.create_table(
        "customer_payments",
        sa.Column(
            "payment_id", sa.Integer(), sa.Identity(always=False), nullable=False
        ),
        sa.Column("customer_id", sa.Integer(), nullable=False),
        sa.Column("sale_id", sa.Integer(), nullable=False),
        sa.Column("payment_date", sa.Date(), nullable=False),
        sa.Column("amount", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.ForeignKeyConstraint(
            ["customer_id"],
            ["customers.customer_id"],
            name=op.f("fk_customer_payments_customer_id"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["sale_id"],
            ["sales.sale_id"],
            name=op.f("fk_customer_payments_sale_id"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("payment_id", name=op.f("pk_customer_payments")),
    )
    op.create_index(
        op.f("ix_customer_payments_customer_id"),
        "customer_payments",
        ["customer_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_customer_payments_sale_id"),
        "customer_payments",
        ["sale_id"],
        unique=False,
    )
    op.create_table(
        "purchase_items",
        sa.Column(
            "purchase_item_id", sa.Integer(), sa.Identity(always=False), nullable=False
        ),
        sa.Column("supplier_product_id", sa.Integer(), nullable=False),
        sa.Column("purchase_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["purchase_id"],
            ["purchases.purchase_id"],
            name=op.f("fk_purchase_items_purchase_id"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["supplier_product_id"],
            ["supplier_products.supplier_product_id"],
            name=op.f("fk_purchase_items_supplier_product_id"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("purchase_item_id", name=op.f("pk_purchase_items")),
    )
    op.create_index(
        op.f("ix_purchase_items_purchase_id"),
        "purchase_items",
        ["purchase_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_purchase_items_supplier_product_id"),
        "purchase_items",
        ["supplier_product_id"],
        unique=False,
    )
    op.create_table(
        "sale_items",
        sa.Column(
            "sale_item_id", sa.Integer(), sa.Identity(always=False), nullable=False
        ),
        sa.Column("sale_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit_price", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.ForeignKeyConstraint(
            ["product_id"],
            ["products.product_id"],
            name=op.f("fk_sale_items_product_id"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["sale_id"],
            ["sales.sale_id"],
            name=op.f("fk_sale_items_sale_id"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("sale_item_id", name=op.f("pk_sale_items")),
    )
    op.create_index(
        op.f("ix_sale_items_product_id"), "sale_items", ["product_id"], unique=False
    )
    op.create_index(
        op.f("ix_sale_items_sale_id"), "sale_items", ["sale_id"], unique=False
    )


def downgrade() -> None:
    # Solo revertir sobre destinos autorizados: se elimina la estructura y sus datos.
    op.drop_index(op.f("ix_sale_items_sale_id"), table_name="sale_items")
    op.drop_index(op.f("ix_sale_items_product_id"), table_name="sale_items")
    op.drop_table("sale_items")
    op.drop_index(
        op.f("ix_purchase_items_supplier_product_id"), table_name="purchase_items"
    )
    op.drop_index(op.f("ix_purchase_items_purchase_id"), table_name="purchase_items")
    op.drop_table("purchase_items")
    op.drop_index(op.f("ix_customer_payments_sale_id"), table_name="customer_payments")
    op.drop_index(
        op.f("ix_customer_payments_customer_id"), table_name="customer_payments"
    )
    op.drop_table("customer_payments")
    op.drop_index(
        op.f("ix_supplier_offerings_supplier_product_id"),
        table_name="supplier_offerings",
    )
    op.drop_index(
        op.f("ix_supplier_offerings_supplier_id"), table_name="supplier_offerings"
    )
    op.drop_table("supplier_offerings")
    op.drop_index(op.f("ix_sales_employee_id"), table_name="sales")
    op.drop_index(op.f("ix_sales_customer_id"), table_name="sales")
    op.drop_table("sales")
    op.drop_index(op.f("ix_purchases_supplier_id"), table_name="purchases")
    op.drop_index(op.f("ix_purchases_employee_id"), table_name="purchases")
    op.drop_table("purchases")
    op.drop_index(op.f("ix_suppliers_address_id"), table_name="suppliers")
    op.drop_table("suppliers")
    op.drop_index(
        op.f("ix_supplier_products_product_id"), table_name="supplier_products"
    )
    op.drop_table("supplier_products")
    op.drop_index(op.f("ix_employees_address_id"), table_name="employees")
    op.drop_table("employees")
    op.drop_index(op.f("ix_customers_customer_type_id"), table_name="customers")
    op.drop_index(op.f("ix_customers_address_id"), table_name="customers")
    op.drop_table("customers")
    op.drop_index(op.f("ix_products_size_id"), table_name="products")
    op.drop_index(op.f("ix_products_category_id"), table_name="products")
    op.drop_table("products")
    op.drop_index(op.f("ix_municipalities_department_id"), table_name="municipalities")
    op.drop_table("municipalities")
    op.drop_index(op.f("ix_addresses_department_id"), table_name="addresses")
    op.drop_table("addresses")
    op.drop_table("sizes")
    op.drop_table("departments")
    op.drop_table("customer_types")
    op.drop_table("categories")
