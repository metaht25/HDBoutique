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

Modulos activos: locations, catalog, customers, suppliers, identity, purchases, sales,
cash, inventory, reporting, staff y boutique. staff gestiona personal y cuentas de
colaborador en una transacción; boutique guarda el perfil/logo y emite recibos PDF. Las
consultas de pantallas usan snapshots REPEATABLE READ. [Pagos](cash-register.md) integra
pago completo con venta y anulación total con reposición únicamente de mercancía
devuelta; caja/turnos son historia conservada. Credito/abonos excluidos permanentemente.
La activación preserva historia y bloquea nuevas operaciones; la anulación repone
únicamente mercancía devuelta, incluido cero.

El frontend organiza app (rutas), layouts, features (modulos) y shared (HTTP,
sesion, formularios/UI). Solo /api/v1, respuestas externas validadas, dinero textual,
lecturas abortadas/ignoradas al cambiar contexto y reintentos monetarios explicitos.
Las intenciones pendientes se conservan por cuenta/operacion en sessionStorage;
no se almacenan credenciales ni tokens. CSS Modules y tablas desplazables.

Nginx sirve dist y dirige /api/v1 a FastAPI manteniendo el origen. El despliegue
local usa loopback/HTTP y cookies locales; production exige HTTPS/Secure y su
propia infraestructura. No hay proxy ni servicio Django.

32 tablas SQLAlchemy y diez revisiones Alembic hasta 0010_optional_profile_phone.
0007 libera contraseñas asignadas con auditoría sin cambiar hashes; 0008 incorpora
maestros permanentes protegidos y tallas fijas; 0009 admite pagos/anulaciones sin
turno preservando toda la historia. 0010 permite teléfono ausente en el perfil, sin convertir valores históricos.
No hay migración ni semillas al iniciar API.
0006 incorpora boutique_profiles, management_events, municipio, activación,
instantáneas de venta, componentes de pago mixto y movimientos initial_stock.
El retiro del perfil Manager desactiva y audita sin elevar privilegios. Dueña y
Colaborador tienen permisos en servidor y guardas antes de montar consultas UI.
0001_compatibility se conserva; el corte local actualizo la base existente tras
respaldo restaurado y comparacion de sus datos/identidades. No hay SQL Server ni
historicos disponibles; data_migration mantiene herramientas offline de referencia,
sin distribuir un driver SQL Server.

Python/uv y Node/npm con bloqueos; Dockerfiles separados runtime/pruebas.
La API no migra ni crea cuentas automaticamente. Configuracion externa HDB_ y
.env.docker privado; los respaldos y evidencias quedan fuera de Git.
[Desarrollo](development.md), [Docker](docker.md) y [calidad](quality.md).
