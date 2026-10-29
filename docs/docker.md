# Docker y operacion local

## Entorno activo

El corte local de fase 15 usa hdboutique-dev y el volumen existente
hdboutique-dev_postgres_data. [Resultado, respaldo y retorno](cutover.md).

```powershell
docker compose --env-file .env.docker -f compose.yaml -f compose.dev.yaml config --quiet
docker compose --env-file .env.docker -f compose.yaml -f compose.dev.yaml up --build -d --wait --wait-timeout 180
docker compose --env-file .env.docker -f compose.yaml -f compose.dev.yaml ps
```

No imprimir config expandida: contiene claves. .env.docker y backups/ son privados
e ignorados; no se sustituyeron las claves del volumen durante el corte.

| Recurso | Direccion |
| --- | --- |
| Web Nginx y API del mismo origen | http://127.0.0.1:8080 |
| FastAPI directo y docs de desarrollo | http://127.0.0.1:8001/docs |
| PostgreSQL local | 127.0.0.1:5433, base hdboutique |
| Conexion interna | db:5432, cuenta hdboutique_app |

WEB_PORT, BACKEND_PORT y POSTGRES_PORT ajustan puertos locales. La web debe usarse
con 127.0.0.1 y el puerto configurado, que forman el HDB_AUTH_ORIGIN exacto.
No hay servicio Django ni destino a 8000 en el host. Ninguna pantalla usa Django.

## Imagenes y seguridad

Python 3.13.15/uv 0.12.10 y Node 24.22.2 estan fijados por version/digest.
backend development instala runtime+dev y herramientas; runtime excluye dev/uv.
Ambos carecen de Django/DRF/mssql-django/pyodbc. uv es el unico gestor Python.
El incremento de caja incorpora 30 modelos y head 0005_cash_checkout, conservando
las revisiones anteriores sin reescritura. [Contrato y operacion](cash-register.md).

frontend/Dockerfile construye con npm ci y sirve solo dist desde Nginx 1.30.6,
fijado por digest. Ejecuta como nginx, puerto interno 8080, raiz de solo lectura y
/tmp tmpfs. No lleva Node ni dependencias de pruebas en runtime.
La web admite recarga de rutas SPA, sirve assets existentes y devuelve 404 para
endpoints Django y archivos inexistentes. El proxy /api/v1 conserva Origin,
cookies y CSRF; no reintenta escrituras ni almacena respuestas API.
Referencias: [imagen oficial](https://hub.docker.com/_/nginx) y
[proxy Nginx](https://nginx.org/en/docs/http/ngx_http_proxy_module.html).

compose.dev.yaml habilita negocio, origen HTTP local y cookie Secure=false solo
para desarrollo. Todo puerto publicado se limita a 127.0.0.1. Compose base usa
production con negocio false por defecto; cualquier habilitacion requiere origen
HTTPS y cookies Secure. El corte local no publica un servicio productivo externo.
TLS, secretos productivos y retencion de logs requieren su propia preparacion.

Los servicios no migran al arrancar. Alembic se ejecuta expresamente despues de
respaldo y autorizacion del destino. La inicializacion db solo crea roles sobre
volumen vacio, nunca borra ni migra los datos existentes.

## Ciclo de vida

```powershell
docker compose --env-file .env.docker -f compose.yaml -f compose.dev.yaml stop
docker compose --env-file .env.docker -f compose.yaml -f compose.dev.yaml start --wait
docker compose --env-file .env.docker -f compose.yaml -f compose.dev.yaml down
docker compose --env-file .env.docker -f compose.yaml -f compose.dev.yaml up -d --wait
```

No usar down -v, prune ni borrar volumenes. Cambiar .env.docker no rota claves ya
almacenadas en PostgreSQL; no regenerarlo para corregir autenticacion. Recrear web
si se cambia el backend; depends_on/restart coordina cambios Compose explicitos.

## Respaldo y conciliacion

En el destino autorizado hdboutique, usar un nombre de respaldo nuevo:

```powershell
docker compose --env-file .env.docker -f compose.yaml -f compose.dev.yaml exec -T db pg_dump -U hdboutique_owner -d hdboutique -Fc -f /tmp/authorized-backup.dump
docker compose --env-file .env.docker -f compose.yaml -f compose.dev.yaml cp db:/tmp/authorized-backup.dump ./backups/authorized-backup.dump
```

No usar redireccion binaria PowerShell. Proteger ACL y retencion; no sobrescribir
copias anteriores. Restaurar solo en una base nueva nombrada/autorizada, nunca
--clean sobre desarrollo. pg_restore debe terminar con --exit-on-error.
`python -m app.operations.snapshot --database NOMBRE --output RUTA_NUEVA` genera
huellas por campo/tablas y estado de identidades en transaccion de solo lectura.
El nombre debe coincidir con HDB_DATABASE_NAME, sin credenciales en argumentos.
Guardar la salida en carpeta privada montada: /tmp tmpfs desaparece al detener el
contenedor. Comparar los JSON del original y su restauracion antes de aceptar.

Los snapshots contienen conteos/hashes, no valores de registros; los dumps si
contienen datos sensibles. La restauracion no crea roles globales; conservar las
claves/roles existentes. Plan de retorno y evidencia concreta en [corte](cutover.md).

## Pruebas aisladas

Nunca usar datos/volumen/credenciales de desarrollo para Pytest o semillas.
Compose.test.yaml siempre con -p hdboutique-test: PostgreSQL tmpfs y sin puertos,
cuentas sinteticas y guardas antes de conectar. Comandos en [desarrollo](development.md).
compose.frontend-test.yaml ejecuta tipos/lint/Vitest/build/80 E2E sin red/backend.
El perfil integration prueba la imagen Nginx real con FastAPI y PostgreSQL.
