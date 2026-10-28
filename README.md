# H&D Boutique

Sistema web administrativo para inventarios, compras y ventas de una tienda de
ropa. Incluye gestion de productos, clientes y proveedores, consultas de reportes
y un prototipo de caja. Su alcance es la administracion interna de la tienda.

## Estado del proyecto

La aplicacion existente utiliza Python con Django/DRF, SQL Server y un frontend
React/Vite en JavaScript. La refactorizacion se desarrolla por fases para conservar
los datos y el comportamiento valido del sistema.

| Area | Implementacion existente | Objetivo de la refactorizacion |
| --- | --- | --- |
| Backend | Django 6.0.4 y DRF 3.17.1 | FastAPI, Pydantic y Python tipado |
| Persistencia | Django ORM, mssql-django y pyodbc | SQLAlchemy 2.x y Alembic |
| Base de datos | SQL Server; esquema externo a las migraciones del repositorio | PostgreSQL con esquema versionado |
| Dependencias Python | requirements.txt legacy | uv, pyproject.toml y uv.lock versionado |
| Frontend | React 19.2.5, Vite 8.0.10 y JavaScript/JSX | Conservar React/Vite; incorporar TypeScript y organizacion por funcionalidades |
| Entorno | Configuracion local dependiente de SQL Server | Docker y Docker Compose reproducibles |

Las versiones de frontend de la tabla proceden de package-lock.json. Las versiones
exactas del stack nuevo se fijaran y comprobaran durante la preparacion del entorno.
Todavia no existen FastAPI, configuracion de uv, PostgreSQL ni Docker en el codigo
del proyecto. Hay pruebas de caracterizacion; sus limites estan documentados.

## Empezar

Trabajar sobre esta copia local del repositorio y revisar primero
[AGENTS.md](AGENTS.md). Participa un solo desarrollador en `Cris-develop`.
Codex crea commits locales; el propietario realiza el push manualmente.

Las comprobaciones disponibles sin instalar dependencias de aplicacion son:

```powershell
python -B -m unittest discover -s backend/tests/characterization -p test_source_contracts.py -v
node --test --test-reporter=spec frontend/tests/characterization/services.test.js
```

Se ejecutan desde la raiz con Python y Node ya disponibles. No inician servicios
ni consultan una base de datos. Para requisitos, arranque legacy y comandos futuros
de uv/Docker, consultar la [guia de desarrollo](docs/development.md).

## Documentacion

| Documento | Contenido |
| --- | --- |
| [Plan por fases](docs/roadmap.md) | Estado, entregables y criterios para avanzar |
| [Desarrollo](docs/development.md) | Requisitos, comandos y preparacion del entorno |
| [Arquitectura](docs/architecture.md) | Organizacion existente y monolito modular objetivo |
| [Convenciones](docs/conventions.md) | Nombres, tipado, contratos y separacion de responsabilidades |
| [Datos](docs/data-model.md) | Relaciones comprobadas y limites del modelo |
| [Migracion](docs/migration.md) | Conservacion, ensayo, conciliacion y corte futuro |
| [Calidad](docs/quality.md) | Pruebas, verificaciones y definicion de tarea terminada |
| [Git y colaboracion](docs/collaboration.md) | Trabajo individual, revision y commits locales |
| [Contratos actuales](docs/legacy-api-contracts.md) | Recursos, campos y ejemplos de la API Django |
| [Compatibilidad](docs/contract-compatibility.md) | Traducciones propuestas y cambios coordinados |
| [Reglas del negocio](docs/business-rules.md) | Comportamiento observado y decisiones B01-B14 pendientes |
| [Caracterizacion](docs/characterization.md) | Ejecucion, resultados registrados y defectos D01-D12 |
| [ADR 0001](docs/decisions/0001-phase-one-characterization.md) | Decision de caracterizar antes de sustituir |

Las guias de backend y frontend se encuentran en
[backend/README.md](backend/README.md) y [frontend/README.md](frontend/README.md).

## Datos y configuracion

`.env.example` documenta la configuracion legacy y contiene valores de ejemplo.
El archivo `.env`, los respaldos y los datos personales no se versionan. La guia
de desarrollo explica cuando configurar una copia autorizada de SQL Server.

Las decisiones pendientes del negocio no se consideran aprobadas por iniciar una
fase documental. Se avanza unicamente en la fase solicitada y se informa su cierre
con verificaciones, limites y commits locales.
