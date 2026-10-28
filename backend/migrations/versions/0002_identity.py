"""Add independent accounts, revocable sessions and login throttling."""

import sqlalchemy as sa
from alembic import op

revision = "0002_identity"
down_revision = "0001_compatibility"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_accounts",
        sa.Column("user_id", sa.Integer(), sa.Identity(), nullable=False),
        sa.Column("username", sa.String(64), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("employee_id", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("user_id", name="pk_user_accounts"),
        sa.UniqueConstraint("username", name="uq_user_accounts_username"),
        sa.CheckConstraint(
            "role IN ('Administrator', 'Manager', 'Cashier')",
            name=op.f("ck_user_accounts_valid_role"),
        ),
        sa.ForeignKeyConstraint(
            ["employee_id"],
            ["employees.employee_id"],
            name="fk_user_accounts_employee_id",
            ondelete="RESTRICT",
        ),
    )
    op.create_index(
        "ix_user_accounts_employee_id", "user_accounts", ["employee_id"], unique=True
    )
    op.create_table(
        "web_sessions",
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("csrf_hash", sa.String(64), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("token_hash", name="pk_web_sessions"),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["user_accounts.user_id"],
            name="fk_web_sessions_user_id",
            ondelete="RESTRICT",
        ),
    )
    op.create_index("ix_web_sessions_user_id", "web_sessions", ["user_id"])
    op.create_index("ix_web_sessions_expires_at", "web_sessions", ["expires_at"])
    op.create_table(
        "login_throttles",
        sa.Column("subject_hash", sa.String(64), nullable=False),
        sa.Column("failures", sa.Integer(), nullable=False),
        sa.Column("window_start", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("subject_hash", name="pk_login_throttles"),
    )
    op.create_index(
        "ix_login_throttles_window_start", "login_throttles", ["window_start"]
    )


def downgrade() -> None:
    op.drop_table("login_throttles")
    op.drop_table("web_sessions")
    op.drop_table("user_accounts")
