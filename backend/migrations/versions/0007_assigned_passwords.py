"""Owner-assigned passwords without rewriting existing hashes."""

from alembic import op

revision = "0007_assigned_passwords"
down_revision = "0006_boutique_experience"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        INSERT INTO management_events (resource, record_id, action, created_at, detail)
        SELECT 'user_accounts', user_id, 'password_policy_released', CURRENT_TIMESTAMP,
               'Phase 16: assigned password; existing hash preserved'
        FROM user_accounts WHERE must_change_password = true
    """)
    op.execute(
        "UPDATE user_accounts SET must_change_password = false "
        "WHERE must_change_password = true"
    )


def downgrade() -> None:
    op.execute("""
        DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM management_events
                   WHERE action = 'password_policy_released')
        THEN RAISE EXCEPTION 'Restore a separate backup; preserve password audit';
        END IF;
        END $$
    """)
