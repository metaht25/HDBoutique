"""Permanent confirmed locations and fixed product sizes; preserve legacy rows."""

import sqlalchemy as sa
from alembic import op

revision = "0008_permanent_references"
down_revision = "0007_assigned_passwords"
branch_labels = None
depends_on = None

LOCATIONS = {
    "Managua": [
        "Managua",
        "Ciudad Sandino",
        "Ticuantepe",
        "Mateare",
        "El Crucero",
        "Tipitapa",
        "Villa El Carmen",
        "San Rafael del Sur",
        "San Francisco Libre",
    ],
    "Masaya": [
        "Nindirí",
        "Masaya",
        "Tisma",
        "La Concepción",
        "Masatepe",
        "Nandasmo",
        "Catarina",
        "San Juan de Oriente",
        "Niquinohomo",
    ],
    "León": [
        "Achuapa",
        "El Sauce",
        "Santa Rosa del Peñón",
        "El Jicaral",
        "Larreynaga",
        "Telica",
        "Quezalguaque",
        "León",
        "La Paz Centro",
        "Nagarote",
    ],
}


def normalized(column: str) -> str:
    return f"translate(lower(trim({column})), 'áéíóúüñ', 'aeiouun')"


def upgrade() -> None:
    for table in ("departments", "municipalities", "sizes"):
        op.add_column(
            table,
            sa.Column(
                "is_seeded",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("false"),
            ),
        )
        op.add_column(
            table,
            sa.Column(
                "is_permanent",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("false"),
            ),
        )
    # Explicit historical identities do not necessarily advance their sequence.
    # Move forward only, before inserting authorized masters.
    for table, key in (
        ("departments", "department_id"),
        ("municipalities", "municipality_id"),
        ("sizes", "size_id"),
    ):
        op.execute(f"""
            SELECT setval(pg_get_serial_sequence('{table}', '{key}'),
                GREATEST((SELECT COALESCE(MAX({key}), 1) FROM {table}),
                         (SELECT last_value FROM {table}_{key}_seq)),
                (SELECT is_called FROM {table}_{key}_seq)
                    OR EXISTS (SELECT 1 FROM {table}))
        """)
    for department, municipalities in LOCATIONS.items():
        dep = normalized("name") + " = " + normalized("'" + department + "'")
        op.execute(
            f"INSERT INTO departments(name,is_seeded) SELECT '{department}',true "
            f"WHERE NOT EXISTS (SELECT 1 FROM departments WHERE {dep})"
        )
        department_id = (
            f"(SELECT department_id FROM departments WHERE {dep} ORDER "
            f"BY department_id LIMIT 1)"
        )
        op.execute(
            f"UPDATE departments SET is_permanent=true WHERE "
            f"department_id={department_id}"
        )
        for municipality in municipalities:
            predicate = (
                f"department_id={department_id} AND "
                + normalized("name")
                + " = "
                + normalized("'" + municipality + "'")
            )
            op.execute(
                f"INSERT INTO municipalities(department_id,name,is_seeded) SELECT "
                f"{department_id}, '{municipality}',true WHERE NOT EXISTS "
                f"(SELECT 1 FROM municipalities WHERE {predicate})"
            )
            op.execute(
                f"UPDATE municipalities SET is_permanent=true WHERE "
                f"municipality_id=(SELECT municipality_id FROM "
                f"municipalities WHERE {predicate} ORDER BY "
                f"municipality_id LIMIT 1)"
            )
    for size in ("S", "M", "L", "XL", "XXL"):
        op.execute(
            f"INSERT INTO sizes(name,is_seeded) SELECT '{size}',true WHERE NOT EXISTS "
            f"(SELECT 1 FROM sizes WHERE name='{size}')"
        )
        op.execute(
            f"UPDATE sizes SET is_permanent=true WHERE size_id=(SELECT "
            f"size_id FROM sizes WHERE name='{size}' ORDER BY size_id "
            f"LIMIT 1)"
        )
    for table in ("departments", "municipalities", "sizes"):
        op.execute(f"""
            CREATE FUNCTION protect_{table}_master() RETURNS trigger AS $$
            BEGIN
                IF OLD.is_permanent THEN
                    RAISE EXCEPTION 'Permanent reference cannot be modified';
                END IF;
                IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
            CREATE TRIGGER protect_{table}_master BEFORE UPDATE OR DELETE ON {table}
            FOR EACH ROW EXECUTE FUNCTION protect_{table}_master();
        """)


def downgrade() -> None:
    # RESTRICT prevents loss if a permanent reference is already in use.
    for table in ("municipalities", "departments", "sizes"):
        op.execute(f"DROP TRIGGER protect_{table}_master ON {table}")
        op.execute(f"DROP FUNCTION protect_{table}_master()")
        op.execute(f"DELETE FROM {table} WHERE is_seeded=true")
        op.drop_column(table, "is_permanent")
        op.drop_column(table, "is_seeded")
