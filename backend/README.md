# Backend H&D Boutique

El backend actual esta en `hdboutique/` y utiliza Django/DRF con SQL Server.
`requirements.txt` conserva sus dependencias legacy. Los 17 modelos de negocio
son unmanaged: el repositorio no reconstruye el esquema SQL Server mediante sus
migraciones Django.

La migracion a FastAPI, SQLAlchemy, Alembic y PostgreSQL se realiza por fases.
uv sera el gestor oficial; su configuracion se implementa en fase 3. Todavia no
hay pyproject.toml, uv.lock ni una aplicacion FastAPI.

- [Guia de desarrollo y uv](../docs/development.md).
- [Contratos actuales](../docs/legacy-api-contracts.md).
- [Pruebas de caracterizacion](../docs/characterization.md), ejecutadas desde la raiz.
- [Arquitectura](../docs/architecture.md) y [convenciones](../docs/conventions.md).
- [Datos](../docs/data-model.md) y [migracion](../docs/migration.md).

No ejecutar las pruebas de caracterizacion con settings productivos ni usar
`manage.py migrate` como instalacion automatica de las tablas de negocio. El
ejecutor de pruebas aislado y sus limites estan en la guia de caracterizacion.
