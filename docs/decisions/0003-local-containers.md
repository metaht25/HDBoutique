# ADR 0003 - Contenedores y PostgreSQL local

Estado: implementado y verificado en fase 4. Los resultados se registran en [Docker](../docker.md)
y [caracterizacion](../characterization.md).

## Decision

Conservar Django/SQL Server y el proxy React actuales fuera de este Compose. La
API FastAPI aun no ofrece sus contratos de negocio. Contenerizar frontend ahora
no aportaria una integracion funcional nueva.

Crear PostgreSQL 17.10 en un volumen propio y una cuenta de aplicacion separada
del administrador. Fijar imagenes oficiales por version y digest, sin usar latest.
No instalar ODBC, trasladar datos ni crear tablas del futuro modelo en esta fase.

Usar un Dockerfile multietapa: uv sincroniza el bloqueo con cache; runtime excluye
todos los grupos predeterminados. Development incluye legacy para ejecutar su
suite dummy, no para iniciar Django contra SQL Server. Python 3.13.15 y uv 0.12.10
siguen siendo las versiones del proyecto.

Separar Compose base runtime y superposicion de desarrollo; usar usuario sin
privilegios y puertos de loopback. Generar claves locales sin versionarlas ni
cargarlas durante build. El contexto excluye .env, entornos, caches y datos.

Esperar health de PostgreSQL antes de iniciar backend, usando
[service_healthy de Compose](https://docs.docker.com/compose/how-tos/startup-order/).
Readiness comprueba la conexion real mediante SELECT 1; liveness solo el proceso.
La configuracion sin base conserva scope=process. No se confunde conectividad con
disponibilidad del esquema o migracion completada.

## Consecuencias

El entorno funciona sin Python/uv/PostgreSQL instalados en el host; necesita Docker
y acceso a los registros oficiales la primera vez. La configuracion .env.docker
pertenece solo al desarrollo local. El volumen requiere respaldo independiente.
El init de roles solo corre con volumen vacio: rotar claves no equivale a editar
un archivo ni justifica eliminar datos.

Modelos, sesiones de casos de uso y Alembic quedan en fase 5. Autenticacion y un
despliegue publico completo conservan sus fases; no se publica este entorno fuera
del equipo. Se sigue la [integracion oficial uv/Docker](https://docs.astral.sh/uv/guides/integration/docker/).
