"""Allow an absent boutique phone without inventing contact information."""

from alembic import op

revision = "0010_optional_profile_phone"
down_revision = "0009_shiftless_payments"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("boutique_profiles", "phone_number", nullable=True)


def downgrade() -> None:
    # Fails safely if absent phones exist; never fabricate a contact value.
    op.alter_column("boutique_profiles", "phone_number", nullable=False)
