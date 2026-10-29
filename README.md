# H&D Boutique

Sistema local de inventarios, compras, ventas, clientes, proveedores y reportes.
FastAPI/PostgreSQL y React/Vite/TypeScript. Django y sus adaptadores se retiraron
en fase 15; historial y contratos anteriores conservados como referencia.

## Aplicacion local

Web activa: http://127.0.0.1:8080. Usuario inicial administrador; credenciales en
el archivo privado de la carpeta de respaldo del corte, nunca versionadas.
[Resultado, ubicacion privada y retorno](docs/cutover.md).

```powershell
docker compose --env-file .env.docker -f compose.yaml -f compose.dev.yaml up --build -d --wait --wait-timeout 180
docker compose --env-file .env.docker -f compose.yaml -f compose.dev.yaml ps
```

Conservar .env.docker y el volumen hdboutique-dev_postgres_data; no usar down -v.
El entorno local habilitado solo publica en loopback. Produccion externa requiere
HTTPS/Secure y configuracion propia; no se ha realizado despliegue publico.
Ningun servicio migra ni crea cuentas al arrancar.

## Estado

24 modelos SQLAlchemy y Alembic head 0004_atomic_sales. El corte local autorizado
actualizo hdboutique desde 0001 despues de respaldo restaurado y conciliacion;
no existe origen/historicos SQL Server y no se cargaron datos comerciales.
Administrador inicial sin empleado inventado. Empleados/abonos siguen pendientes
por confirmacion B11; Caja conserva prototipo sin persistencia hasta resolver B10.
Una compra/venta requiere previamente sus referencias validas, incluido empleado.

Siete pantallas operativas usan exclusivamente /api/v1. Ventas atomicas e
idempotentes, compra/recepcion separadas, dinero Decimal/NIO/texto, precios
historicos, permisos por rol y reportes de servidor. No se infieren deuda, pagos,
utilidad, estados o costes ausentes. [Reglas](docs/business-rules.md).

## Desarrollo y verificacion

Python 3.13.15/uv 0.12.10 y Node 24.22.2/npm, con bloqueos versionados.
Solo grupo dev por defecto; no hay requirements.txt ni dependencias Django/ODBC.

```powershell
docker compose -p hdboutique-test -f compose.test.yaml up --build --force-recreate --abort-on-container-exit --exit-code-from backend
docker compose -p hdboutique-test -f compose.test.yaml down
docker compose -f compose.frontend-test.yaml build frontend
docker compose -f compose.frontend-test.yaml run --rm -T frontend
```

Las pruebas usan datos sinteticos y proyectos aislados, nunca desarrollo. E2E
habituales interceptan API; el perfil integration verifica Nginx/FastAPI/PostgreSQL.
Comandos completos en [desarrollo](docs/development.md). Trabajar en Cris-develop,
commits locales, sin push/fetch/pull/PR; [instrucciones](AGENTS.md).

## Documentacion

- [Corte y operacion](docs/cutover.md), [Docker](docs/docker.md), [desarrollo](docs/development.md).
- [Fases](docs/roadmap.md), [pruebas/resultados](docs/characterization.md), [calidad](docs/quality.md).
- [Arquitectura](docs/architecture.md), [convenciones](docs/conventions.md), [colaboracion](docs/collaboration.md).
- [Autenticacion](docs/authentication.md), [API fundamental](docs/foundation-api.md), [frontend](docs/frontend-modules.md).
- [Compras/inventario](docs/purchases-inventory.md), [ventas](docs/sales.md), [reportes](docs/reporting.md).
- [Datos](docs/data-model.md), [migraciones](docs/migration.md), [traslado offline](docs/data-transfer.md).
- [Contratos historicos](docs/legacy-api-contracts.md), [compatibilidad](docs/contract-compatibility.md).
