# Backend H&D Boutique

El backend contiene dos aplicaciones durante la transicion:

- `app/`: FastAPI con salud, PostgreSQL y modulos fundamentales de fase 7
  deshabilitados por defecto; contrato en [API fundamental](../docs/foundation-api.md).
- `hdboutique/`: Django/DRF con los contratos existentes y SQL Server.

Python 3.13.15 y uv 0.12.10 estan fijados. pyproject.toml define las dependencias;
uv.lock fija la resolucion. Los grupos dev y legacy se instalan por defecto para
poder verificar ambos backends.

Desde este directorio:

```powershell
uv sync --locked
uv run --locked python -m pytest --cov=app --cov-report=term-missing
uv run --locked ruff check .
uv run --locked ruff format --check .
uv run --locked mypy
uv run --locked python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
```

requirements.txt es una exportacion generada del grupo legacy, no una segunda
lista para editar manualmente. Regenerarlo con:

```powershell
uv export --locked --only-group legacy --no-hashes --no-emit-project --output-file requirements.txt
```

SQLAlchemy y Psycopg comprueban conectividad PostgreSQL en readiness cuando hay
configuracion de base. Dockerfile ofrece objetivos development/runtime usando uv;
Compose y sus comandos estan en la [guia Docker](../docs/docker.md).
Desde fase 5 hay 17 modelos SQLAlchemy tipados en app/modules/, metadata comun,
session factory y revision Alembic 0001_compatibility. La base PostgreSQL local de
desarrollo tiene el esquema inicial vacio; los historicos no se han trasladado.
Los 17 modelos Django siguen siendo unmanaged e independientes de ese esquema.
Las reglas ambiguas se conservan pendientes, con ambas existencias y direccion
ligada solo a departamento.

Alembic se ejecuta explicitamente con `uv run --locked python -m alembic ...`.
Desde fase 8 head es 0002_identity, con tres modelos/tablas nuevos de identidad
(20 en total). Se verifico exclusivamente en PostgreSQL aislado; no se aplico
sobre desarrollo. Sesiones, roles, CSRF y bootstrap del primer administrador en
[autenticacion](../docs/authentication.md).
Fase 9 agrega head 0003_purchase_receipts: 23 modelos/tablas en total, compras
atomicas, costes historicos y recepcion unica de inventario. Los stocks del CRUD
de productos son de solo lectura; producto nuevo inicia disponible en cero.
Contrato, limites y operacion en [compras e inventario](../docs/purchases-inventory.md).
Comandos, guardas y pruebas PostgreSQL desechables en
[migraciones](../docs/migration.md). Pytest sin --run-postgres omite la integracion;
usar compose.test.yaml para ejecutarla. En este Windows usar Docker por el bloqueo
de la extension nativa de SQLAlchemy; no modificar la politica del equipo.

- [Guia de desarrollo y uv](../docs/development.md).
- [Contratos actuales](../docs/legacy-api-contracts.md).
- [Pruebas de caracterizacion](../docs/characterization.md), ejecutadas desde la raiz.
- [Arquitectura](../docs/architecture.md) y [convenciones](../docs/conventions.md).
- [Datos](../docs/data-model.md) y [migracion](../docs/migration.md).

No ejecutar las pruebas de caracterizacion con settings productivos ni usar
`manage.py migrate` como instalacion automatica de las tablas de negocio. El
ejecutor de pruebas aislado y sus limites estan en la guia de caracterizacion.
