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

Reconstrucción visual y funcional basada en las 26 capturas del sistema anterior.
Dos perfiles: Dueña (Administrator) y Colaborador (Cashier). La preparación se
realiza desde el perfil del encabezado, Productos y los directorios;
[guía contextual](docs/initial-setup.md), sin Configuración en el menú.

32 modelos SQLAlchemy y Alembic head 0006_boutique_experience. El corte local autorizado
actualizo hdboutique desde 0001 despues de respaldo restaurado y conciliacion;
no existe origen/historicos SQL Server y no se cargaron datos comerciales.
Administrador inicial sin empleado inventado. [Empleados](docs/employees.md)
implementado y [Configuracion inicial](docs/initial-setup.md) completada. [Caja](docs/cash-register.md)
registra turnos, apertura/cierre,
cobros completos y correcciones supervisadas. Abonos/credito excluidos permanentemente.
Una compra/venta requiere previamente sus referencias validas, incluido empleado.

Diez pantallas de Dueña y cinco de Colaborador usan exclusivamente /api/v1.
Dashboard/Inicio, Nueva venta, Productos, Clientes y Recibos; Dueña también dispone
de Ventas, Historial de ventas, Compras, Proveedores y Empleados. Caja se integra
en Dashboard/Nueva venta y los reportes en Ventas/Historial.

Ventas atómicas con pago completo en efectivo, transferencia o mixto; cliente
general estable, regular o delivery. Ticket imprimible y PDF real de 80 mm con
perfil/logo durable. Producto con precio costo × 1.15 y existencia inicial auditada;
stock bajo 1–5. Activación persistente y alta empleado/cuenta atómica con cambio de
contraseña temporal. Anulación total auditada. Operaciones
idempotentes, compra/recepcion separadas, dinero Decimal/NIO/texto, precios
historicos, permisos por rol y reportes de servidor. No se infieren pagos historicos,
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
