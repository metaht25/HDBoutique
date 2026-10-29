# Arquitectura del sistema

## Implementacion activa tras fase 15

Monolito FastAPI por funcionalidades, PostgreSQL y React/Vite/TypeScript.
Django, DRF y los adaptadores frontend se retiraron despues de verificar los
consumidores y confirmar que no se utiliza /admin/. [Corte](cutover.md).
El codigo anterior permanece en Git; los contratos historicos siguen como
[referencia](legacy-api-contracts.md), sin endpoints activos.

| Capa | Responsabilidad | Limite |
| --- | --- | --- |
| router/schemas | HTTP, validacion, identidad/permisos | Sin commits ni calculos monetarios del cliente |
| service | Casos de uso y transacciones completas | No depende del frontend |
| repository | Consultas ORM concretas y bloqueos | No confirma transacciones propias |
| infrastructure/core | Configuracion, engine/session, seguridad, errores | Sin Session global compartida |
| operations | Acciones expresas de operador, snapshots de lectura | Nunca se ejecutan al arrancar |

Una solicitud usa una sesion SQLAlchemy sincrona. Compra/venta coordinan cabecera,
lineas, snapshots monetarios y movimientos en una transaccion. Se bloquean productos
por ID; claves idempotentes evitan duplicados de reintentos. Dinero Decimal/NIO y
texto decimal en JSON. No se reconstruyen precios o movimientos historicos.

Modulos activos: locations, catalog, customers, suppliers, identity, purchases,
sales, cash, inventory y reporting. staff conserva modelos/relaciones, sin CRUD.
[Caja](cash-register.md) agrega turnos y pago completo con venta, correcciones
mediante anulacion total y movimientos compensatorios. Credito/abonos excluidos
permanentemente; activacion y ampliaciones de devolucion siguen fuera del alcance.

El frontend organiza app (rutas), layouts, features (modulos) y shared (HTTP,
sesion, formularios/UI). Solo /api/v1, respuestas externas validadas, dinero textual,
lecturas abortadas/ignoradas al cambiar contexto y reintentos monetarios explicitos.
Las intenciones pendientes se conservan por cuenta/operacion en sessionStorage;
no se almacenan credenciales ni tokens. CSS Modules y tablas desplazables.

Nginx sirve dist y dirige /api/v1 a FastAPI manteniendo el origen. El despliegue
local usa loopback/HTTP y cookies locales; production exige HTTPS/Secure y su
propia infraestructura. No hay proxy ni servicio Django.

30 tablas SQLAlchemy y cinco revisiones Alembic hasta 0005_cash_checkout.
0001_compatibility se conserva; el corte local actualizo la base existente tras
respaldo restaurado y comparacion de sus datos/identidades. No hay SQL Server ni
historicos disponibles; data_migration mantiene herramientas offline de referencia,
sin distribuir un driver SQL Server.

Python/uv y Node/npm con bloqueos; Dockerfiles separados runtime/pruebas.
La API no migra ni crea cuentas automaticamente. Configuracion externa HDB_ y
.env.docker privado; los respaldos y evidencias quedan fuera de Git.
[Desarrollo](development.md), [Docker](docker.md) y [calidad](quality.md).
