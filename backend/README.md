# Backend H&D Boutique

El backend contiene dos aplicaciones durante la transicion:

- `app/`: base FastAPI con configuracion tipada y salud del proceso.
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
uv run --locked mypy app
uv run --locked python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
```

requirements.txt es una exportacion generada del grupo legacy, no una segunda
lista para editar manualmente. Regenerarlo con:

```powershell
uv export --locked --only-group legacy --no-hashes --no-emit-project --output-file requirements.txt
```

SQLAlchemy, Alembic y Psycopg estan instalados; no hay conexion PostgreSQL,
modelos nuevos ni migraciones ejecutadas. Los 17 modelos Django son unmanaged.
La preparacion de Docker/PostgreSQL y del esquema corresponde a fases 4/5.

- [Guia de desarrollo y uv](../docs/development.md).
- [Contratos actuales](../docs/legacy-api-contracts.md).
- [Pruebas de caracterizacion](../docs/characterization.md), ejecutadas desde la raiz.
- [Arquitectura](../docs/architecture.md) y [convenciones](../docs/conventions.md).
- [Datos](../docs/data-model.md) y [migracion](../docs/migration.md).

No ejecutar las pruebas de caracterizacion con settings productivos ni usar
`manage.py migrate` como instalacion automatica de las tablas de negocio. El
ejecutor de pruebas aislado y sus limites estan en la guia de caracterizacion.
