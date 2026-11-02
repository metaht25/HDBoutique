# Backend H&D Boutique

FastAPI, Pydantic, SQLAlchemy y PostgreSQL. Django/DRF y sus drivers SQL Server se
retiraron en fase 15; [corte local y evidencia](../docs/cutover.md).
Python 3.13.15, uv 0.12.10, pyproject.toml y uv.lock son la base reproducible.
Solo dev se instala por defecto; runtime usa --no-default-groups.

Desde backend/:

```powershell
uv sync --locked
uv lock --check
uv run --locked ruff check .
uv run --locked ruff format --check .
uv run --locked python -m mypy
uv run --locked python -m pytest --cov=app --cov-report=term-missing
```

En este Windows ejecutar API y pruebas SQLAlchemy dentro de Linux/Docker. Pytest
sin --run-postgres omite PostgreSQL. La suite completa usa exclusivamente
compose.test.yaml, base tmpfs y datos sinteticos; no apuntarla a desarrollo.
[Comandos de desarrollo](../docs/development.md).

app/modules/ agrupa catalogo, ubicaciones, clientes, proveedores, identidad,
compras, ventas, caja, inventario y reportes por capas. Servicios controlan transacciones;
repositorios no confirman por su cuenta. Dinero Decimal y salida textual exacta.
Empleados gestiona personal y cuenta de Colaborador en una transacción; boutique
gestiona perfil/logo y recibos PDF de 80 mm. Solo Dueña y Colaborador pueden
iniciar sesión. Abonos/crédito quedan excluidos permanentemente.
[Pagos completos e historia de caja](../docs/cash-register.md).

32 modelos/tablas, Alembic head 0009_shiftless_payments. Revisiones anteriores intactas.
La base local hdboutique se actualizo desde 0001 tras respaldo restaurado y
conciliacion, sin carga comercial: no existe origen/historicos SQL Server.
Fase 16 retira caja/turnos operativos, conserva su historia y admite ventas/anulaciones
sin turno. Contraseña asignada por Dueña, maestros permanentes y recibos decimales.
No se ejecutan migraciones ni bootstrap al arrancar la API.

La CLI identity bootstrap-admin exige destino exacto y contrasena mediante getpass;
el corte actual ya creo el primer Administrator. Cuentas siguientes via /api/v1/users.
app.operations.snapshot genera huellas de lectura para un destino explicito, sin
exportar valores ni sobreescribir evidencia. data_migration conserva mapeos y
ensayos offline historicos; no se distribuyen pyodbc ni drivers ODBC.

- [Autenticacion](../docs/authentication.md) y [API fundamental](../docs/foundation-api.md).
- [Compras](../docs/purchases-inventory.md), [ventas](../docs/sales.md), [reportes](../docs/reporting.md).
- [Migraciones](../docs/migration.md), [datos](../docs/data-model.md) y [calidad](../docs/quality.md).
- [Docker](../docs/docker.md) y [resultado del corte](../docs/cutover.md).
