# Guia de desarrollo

El sistema activo usa FastAPI/PostgreSQL y React/Vite/TypeScript. Django y sus
adaptadores se retiraron en fase 15. Resultado y limites: [corte](cutover.md).

## Backend con uv

Python 3.13.15 y uv 0.12.10 estan fijados en backend/. uv.lock es el bloqueo unico;
no hay requirements.txt ni grupo legacy. dev incluye Pytest, Ruff y mypy.

```powershell
cd backend
uv sync --locked
uv lock --check
uv run --locked ruff check .
uv run --locked ruff format --check .
uv run --locked python -m mypy
uv run --locked python -m pytest --cov=app --cov-report=term-missing
```

Sin --run-postgres se omite la integracion PostgreSQL. Para runtime usar
`uv sync --locked --no-default-groups`. Cambios de paquetes con uv add/remove,
revisando pyproject.toml y uv.lock. No cambiar las versiones de herramientas
silenciosamente ni editar migraciones aplicadas.

En este Windows algunos lanzadores están bloqueados; usar python -m para mypy
y los contenedores Linux para API/DB/integración; no cambiar la politica del equipo. Desde la raiz:

```powershell
docker compose -p hdboutique-test -f compose.test.yaml up --build --force-recreate --abort-on-container-exit --exit-code-from backend
docker compose -p hdboutique-test -f compose.test.yaml down
```

La base de pruebas es tmpfs, sin puertos ni credenciales de desarrollo. No ejecutar
Pytest ni semillas sinteticas contra desarrollo. [Calidad](quality.md).

## Aplicacion local autorizada

```powershell
docker compose --env-file .env.docker -f compose.yaml -f compose.dev.yaml up --build -d --wait --wait-timeout 180
```

Web: http://127.0.0.1:8080; API: http://127.0.0.1:8001. Abrir la web con ese host
exacto: el origen y CSRF son estrictos. El archivo privado .env.docker se conserva;
el script Initialize-LocalEnvironment.ps1 solo lo genera si falta. No ejecutar
migraciones automaticamente. Antes de otro destino: autorizarlo y respaldarlo.
El desarrollo habilita negocio con cookies HTTP exclusivamente en loopback.
Compose base mantiene negocio deshabilitado y exige HTTPS/Secure para production.

```powershell
docker compose --env-file .env.docker -f compose.yaml -f compose.dev.yaml exec -T backend uv run --locked python -m alembic current
docker compose --env-file .env.docker -f compose.yaml -f compose.dev.yaml exec -T backend uv run --locked python -m app.modules.identity.cli purge-expired --database hdboutique
```

La creacion inicial de Administrator usa la CLI bootstrap-admin con --database y
--username y --setup-file con la identidad real y perfil, contrasena por getpass.
Consultar [preparación atómica y verificación](initial-setup.md); --employee-id
solo selecciona explícitamente una identidad activa existente sin cuenta.
No usar argumentos ni logs para contrasenas.
El corte actual ya creo su primera cuenta; no repetir bootstrap. Administracion
de cuentas posterior via /api/v1/users, con sesion Administrator y CSRF.

## Frontend

Node >=24 <25, npm y package-lock.json. Desde frontend/:

```powershell
npm ci
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

Vite solo dirige /api/v1 a HDB_FASTAPI_TARGET (defecto 127.0.0.1:8001); no tiene
proxy Django. Vite dev/preview requieren configurar el origen exacto del backend
si se usan en lugar de la web 8080. No usar variables VITE_* para secretos.
La imagen runtime sirve dist con Nginx sin privilegios; preview es solo de pruebas.

Sin Node nativo: construir compose.frontend-test.yaml y ejecutar su servicio
frontend. `npm run verify` comprueba tipos, lint, Vitest, build y E2E interceptadas
sin red/backend. Las pruebas conectadas usan Nginx/FastAPI/PostgreSQL sinteticos:

```powershell
docker compose -p hdboutique-test -f compose.test.yaml --profile integration build backend web
docker compose -f compose.frontend-test.yaml build frontend
docker compose -p hdboutique-test -f compose.test.yaml --profile integration up -d --wait web
docker compose -p hdboutique-test -f compose.test.yaml --profile integration run --rm --no-deps -T browser
docker compose -p hdboutique-test -f compose.test.yaml --profile integration down
```

Ejecutar sobre proyecto de pruebas nuevo, separado de la suite backend. La semilla
rechaza bases pobladas. Playwright conectado exige el destino interno canonico; no tiene
fallback a una base local real. [Docker](docker.md), [contratos
frontend](frontend-modules.md).

## Repetir pruebas sobre un tmpfs ya utilizado

La suite backend y stabilization_seed requieren base vacía. Detener web/api del
proyecto de prueba, comprobar que hdboutique-test-db-1 pertenece a hdboutique-test
con /var/lib/postgresql/data en tmpfs, detener y retirar solo ese servicio db.
Nunca aplicar este procedimiento al volumen de desarrollo.

```powershell
docker compose -p hdboutique-test -f compose.test.yaml --profile integration stop web api
docker compose -p hdboutique-test -f compose.test.yaml stop db
docker compose -p hdboutique-test -f compose.test.yaml rm -f db
docker compose -p hdboutique-test -f compose.test.yaml up -d db
docker compose -p hdboutique-test -f compose.test.yaml run --rm backend
```

Repetir la preparación del tmpfs antes del perfil integration. Construir backend,
web y frontend de prueba con los cambios finales. Para conservar capturas fuera
de Git, montar una carpeta temporal en /workspace/frontend/test-results del
servicio browser; ejecutarlo con --no-deps después de comprobar API/web saludables.
La configuración conectada usa 1440×1000 y recorre también 390×844; no apunta a 8080.
