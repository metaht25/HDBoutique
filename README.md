# H&D Boutique

Sistema web administrativo para inventarios, compras y ventas de una tienda de
ropa. Incluye gestion de productos, clientes y proveedores, consultas de reportes
y un prototipo de caja. Su alcance es la administracion interna de la tienda.

## Estado del proyecto

La aplicacion existente utiliza Django/DRF, SQL Server y React/Vite en JavaScript.
Ya existe una base FastAPI independiente con endpoints de salud y pruebas. La
refactorizacion conserva los datos y el comportamiento valido del sistema.

| Area | Implementacion existente | Objetivo de la refactorizacion |
| --- | --- | --- |
| Backend | Django/DRF y base FastAPI con salud | Migracion funcional a FastAPI, Pydantic y Python tipado |
| Persistencia | Django ORM activo; conexion SQLAlchemy para salud PostgreSQL | Modelo PostgreSQL y migraciones versionadas |
| Base de datos | SQL Server legacy y PostgreSQL local sin tablas de negocio | PostgreSQL con esquema versionado y datos conciliados |
| Dependencias Python | uv, pyproject.toml y uv.lock; exportacion requirements.txt legacy | Retirar el grupo legacy al completar la sustitucion |
| Frontend | React 19.2.5, Vite 8.0.10 y JavaScript/JSX | Conservar React/Vite; incorporar TypeScript y organizacion por funcionalidades |
| Entorno | Docker/Compose para FastAPI y PostgreSQL; legacy conserva SQL Server | Completar integracion funcional progresiva |

Python 3.13.15 y uv 0.12.10 estan fijados para el backend. Las versiones resueltas
estan en uv.lock; las de frontend, en package-lock.json. Docker/PostgreSQL local
estan preparados; no hay endpoints de negocio FastAPI. Django sigue atendiendo los contratos
actuales y el frontend conserva su integracion con ese backend.

## Empezar

Trabajar sobre esta copia local del repositorio y revisar primero
[AGENTS.md](AGENTS.md). Participa un solo desarrollador en `Cris-develop`.
Codex crea commits locales; el propietario realiza el push manualmente.

Desde la raiz, con uv 0.12.10 disponible:

```powershell
cd backend
uv sync --locked
uv run --locked python -m pytest
uv run --locked python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
```

El ultimo comando inicia FastAPI en el puerto 8001; Django conserva el 8000.
La nueva API publica `/health/live`, `/health/ready` y documentacion `/docs` en
desarrollo. Readiness comprueba PostgreSQL si esta configurado; sin base mantiene
scope=process. Las pruebas aisladas no consultan SQL Server.

Para trabajar sin instalar Python/PostgreSQL en el equipo, desde la raiz:

```powershell
./infra/scripts/Initialize-LocalEnvironment.ps1
docker compose --env-file .env.docker -f compose.yaml -f compose.dev.yaml up --build -d --wait --wait-timeout 180
```

Requiere Docker en modo Linux. Ver [Docker](docs/docker.md) para claves locales,
puertos, persistencia, pruebas y respaldos; [desarrollo](docs/development.md) para uv.

## Documentacion

| Documento | Contenido |
| --- | --- |
| [Plan por fases](docs/roadmap.md) | Estado, entregables y criterios para avanzar |
| [Desarrollo](docs/development.md) | Requisitos, comandos y preparacion del entorno |
| [Docker](docs/docker.md) | FastAPI/PostgreSQL local, persistencia y recuperacion |
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
| [ADR 0002](docs/decisions/0002-backend-foundation.md) | Base uv/FastAPI y convivencia temporal con Django |
| [ADR 0003](docs/decisions/0003-local-containers.md) | Contenedores locales y conectividad PostgreSQL |

Las guias de backend y frontend se encuentran en
[backend/README.md](backend/README.md) y [frontend/README.md](frontend/README.md).

## Datos y configuracion

`.env.example` documenta la configuracion legacy y contiene valores de ejemplo.
Los archivos `.env`, `.env.docker`, los respaldos y los datos personales no se versionan. La guia
de desarrollo explica cuando configurar una copia autorizada de SQL Server.

Las decisiones pendientes del negocio no se consideran aprobadas por iniciar una
fase documental. Se avanza unicamente en la fase solicitada y se informa su cierre
con verificaciones, limites y commits locales.
