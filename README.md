# H&D Boutique

Sistema web administrativo para inventarios, compras y ventas de una tienda de
ropa. Incluye gestion de productos, clientes y proveedores, consultas de reportes
y un prototipo de caja. Su alcance es la administracion interna de la tienda.

## Estado del proyecto

El candidato modernizado utiliza FastAPI, PostgreSQL y React/Vite con TypeScript.
Django/DRF y sus contratos SQL Server se conservan hasta un corte expresamente
autorizado. La refactorizacion conserva datos y comportamiento valido; no existe
una instancia/copia SQL Server ni historicos disponibles para trasladar.

| Area | Implementacion existente | Objetivo de la refactorizacion |
| --- | --- | --- |
| Backend | FastAPI autenticado con catalogo/clientes/proveedores, compras, ventas y reportes; Django conservado | Completar funciones pendientes y retirada autorizada |
| Persistencia | Django ORM activo; 24 modelos SQLAlchemy y Alembic hasta 0004_atomic_sales | Ampliar reglas y restricciones por funcionalidad |
| Base de datos | SQL Server legacy y PostgreSQL local con esquema inicial vacio | PostgreSQL con datos conciliados y reglas confirmadas |
| Dependencias Python | uv, pyproject.toml y uv.lock; exportacion requirements.txt legacy | Retirar el grupo legacy al completar la sustitucion |
| Frontend | Siete pantallas operativas TS/FastAPI; Caja JSX como prototipo | Caja solo tras aprobar B10; adaptadores legacy hasta fase 15 |
| Entorno | Docker/Compose para FastAPI y PostgreSQL; legacy conserva SQL Server | Completar integracion funcional progresiva |

Python 3.13.15 y uv 0.12.10 estan fijados para el backend. Las versiones resueltas
estan en uv.lock; las de frontend, en package-lock.json. Docker/PostgreSQL local
estan preparados; los [modulos fundamentales FastAPI](docs/foundation-api.md)
estan implementados para desarrollo/pruebas, deshabilitados por defecto.
La [fase 8](docs/authentication.md) agrega sesiones, CSRF y permisos de los tres
roles aprobados. Migracion y primer administrador se preparan explicitamente.
La [fase 9](docs/purchases-inventory.md) implementa compras atomicas, costes
historicos y recepcion unica de inventario con las reglas confirmadas.
La [fase 10](docs/sales.md) implementa ventas atomicas e idempotentes, precios
historicos y salidas de inventario seguras ante concurrencia.
La [fase 11](docs/frontend-foundation.md) agrega URLs, cliente HTTP, contexto de
sesion, CSS aislado, componentes compartidos y pruebas frontend.
Las fases 12/13 y la [fase 14](docs/stabilization.md) integran las siete pantallas
operativas con FastAPI y verifican concurrencia, E2E conectadas, seguridad,
volumen sintetico y restauracion. Caja, empleados y otras reglas pendientes
conservan sus limites; el negocio sigue deshabilitado por defecto. Django y
adaptadores se conservan, sin iniciar automaticamente fase 15.

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
docker compose --env-file .env.docker -f compose.yaml -f compose.dev.yaml exec -T backend uv run --locked python -m alembic upgrade head
```

Requiere Docker en modo Linux. Ver [Docker](docs/docker.md) para claves locales,
puertos, persistencia, pruebas y respaldos; [desarrollo](docs/development.md) para uv.
Alembic crea/actualiza explicitamente el esquema PostgreSQL local; no migra SQL
Server ni se ejecuta automaticamente al arrancar. La suite PostgreSQL completa
usa compose.test.yaml segun [migraciones](docs/migration.md).

## Documentacion

| Documento | Contenido |
| --- | --- |
| [Plan por fases](docs/roadmap.md) | Estado, entregables y criterios para avanzar |
| [Desarrollo](docs/development.md) | Requisitos, comandos y preparacion del entorno |
| [Docker](docs/docker.md) | FastAPI/PostgreSQL local, persistencia y recuperacion |
| [Arquitectura](docs/architecture.md) | Organizacion existente y monolito modular objetivo |
| [Convenciones](docs/conventions.md) | Nombres, tipado, contratos y separacion de responsabilidades |
| [Datos](docs/data-model.md) | Relaciones comprobadas y limites del modelo |
| [Migracion](docs/migration.md) | Alembic local, pruebas aisladas y estrategia de datos historicos |
| [Calidad](docs/quality.md) | Pruebas, verificaciones y definicion de tarea terminada |
| [Git y colaboracion](docs/collaboration.md) | Trabajo individual, revision y commits locales |
| [Contratos actuales](docs/legacy-api-contracts.md) | Recursos, campos y ejemplos de la API Django |
| [Compatibilidad](docs/contract-compatibility.md) | Traducciones propuestas y cambios coordinados |
| [Reglas del negocio](docs/business-rules.md) | Comportamiento observado y decisiones B01-B14 pendientes |
| [Caracterizacion](docs/characterization.md) | Ejecucion, resultados registrados y defectos D01-D12 |
| [Estabilizacion](docs/stabilization.md) | Fase 14: pruebas conectadas, restauracion, volumen y riesgos residuales |
| [ADR 0001](docs/decisions/0001-phase-one-characterization.md) | Decision de caracterizar antes de sustituir |
| [ADR 0002](docs/decisions/0002-backend-foundation.md) | Base uv/FastAPI y convivencia temporal con Django |
| [ADR 0003](docs/decisions/0003-local-containers.md) | Contenedores locales y conectividad PostgreSQL |
| [ADR 0004](docs/decisions/0004-compatible-schema-foundation.md) | Esquema inicial de compatibilidad y Alembic |

Las guias de backend y frontend se encuentran en
[backend/README.md](backend/README.md) y [frontend/README.md](frontend/README.md).

## Datos y configuracion

`.env.example` documenta la configuracion legacy y contiene valores de ejemplo.
Los archivos `.env`, `.env.docker`, los respaldos y los datos personales no se versionan. La guia
de desarrollo explica cuando configurar una copia autorizada de SQL Server.

Las decisiones pendientes del negocio no se consideran aprobadas por iniciar una
fase documental. Se avanza unicamente en la fase solicitada y se informa su cierre
con verificaciones, limites y commits locales.
