# Docker y PostgreSQL para desarrollo local

## Inicio reproducible

Requisito: Docker con contenedores Linux, BuildKit y Compose moderno (2.20 o
posterior). En Windows, Docker Desktop debe tener el motor iniciado. No hace falta
instalar Python, uv, PostgreSQL ni ODBC en el equipo para usar este entorno.
Ejecutar desde la raiz del repositorio:

```powershell
./infra/scripts/Initialize-LocalEnvironment.ps1
docker compose --env-file .env.docker -f compose.yaml -f compose.dev.yaml config --quiet
docker compose --env-file .env.docker -f compose.yaml -f compose.dev.yaml up --build -d --wait --wait-timeout 180
docker compose --env-file .env.docker -f compose.yaml -f compose.dev.yaml exec -T backend uv run --locked python -m alembic upgrade head
docker compose --env-file .env.docker -f compose.yaml -f compose.dev.yaml ps
Invoke-RestMethod http://127.0.0.1:8001/health/ready
```

El script genera dos claves aleatorias distintas en `.env.docker`, ignorado por
Git. Si el archivo existe lo conserva. No copiar el `.env` legacy ni publicar
`docker compose config` sin --quiet: su salida expandida contiene claves.
En Linux/macOS crear `.env.docker` a partir de `.env.docker.example`, completar
ambas claves con valores aleatorios propios y limitar sus permisos locales.

| Recurso | Acceso en desarrollo |
| --- | --- |
| FastAPI / Swagger | http://127.0.0.1:8001/docs |
| Proceso | http://127.0.0.1:8001/health/live; scope=process |
| Conexion PostgreSQL | http://127.0.0.1:8001/health/ready; scope=database |
| PostgreSQL desde el equipo | 127.0.0.1:5433; base hdboutique, usuario hdboutique_app |
| PostgreSQL desde backend | db:5432; no usar localhost dentro del contenedor |
| Django y frontend legacy | Conservan sus comandos y SQL Server; no forman parte de Compose |

BACKEND_PORT y POSTGRES_PORT se pueden cambiar en `.env.docker` si hay conflictos.
Los puertos publicados estan restringidos a 127.0.0.1. El proxy de Vite sigue
apuntando a Django en 8000; esta fase no migra endpoints de negocio ni cambia CORS.

## Imagenes y configuracion

`backend/Dockerfile` usa Python 3.13.15 slim-bookworm y uv 0.12.10 desde sus
imagenes oficiales, fijadas tambien por digest. Copia manifiestos antes del
codigo para aprovechar cache BuildKit. uv crea `/opt/venv` dentro de Linux;
la .venv de Windows nunca entra al contexto.

| Objetivo/archivo | Uso |
| --- | --- |
| development | uv sync --locked con grupos dev/legacy, uv, pruebas y fuentes Django aisladas |
| runtime (por defecto del Dockerfile) | uv sync --locked --no-default-groups; solo dependencias principales y app |
| compose.yaml | Imagen runtime, modo production, sin publicar el puerto de PostgreSQL, backend de solo lectura |
| compose.dev.yaml | Superposicion explicita: development, recarga de app y puerto local de PostgreSQL |

Ambos objetivos ejecutan FastAPI con usuario app (UID/GID 10001). La imagen final
runtime excluye uv, Django, pruebas y herramientas de calidad. No es una propuesta
de despliegue publico completa: TLS, gestion de secretos y operacion productiva
se definiran en su alcance. No usar el archivo de claves de desarrollo en produccion.

Compose transmite solo variables necesarias; no copia archivos secretos a la
imagen. La configuracion nueva requiere HDB_DATABASE_HOST, NAME, USER y PASSWORD
juntos, con HDB_DATABASE_PORT=5432 por defecto. La contraseña usa SecretStr y la URL
SQLAlchemy se construye por campos. No se importa la configuracion Django.

`/health/live` nunca consulta una base. Con configuracion PostgreSQL, `/health/ready`
ejecuta SELECT 1 y devuelve 200/database o 503/unavailable sin detalles de conexion.
Sin configuracion de base mantiene el contrato 200/process de fase 3. No comprueba
tablas ni version de esquema. El engine es perezoso y se libera al cerrar la API.

PostgreSQL 17.10-bookworm esta fijado por digest. La inicializacion del volumen
crea `hdboutique_app` sin privilegios de superusuario, creacion de bases o roles.
Tiene acceso al esquema public para aplicar migraciones versionadas. La cuenta
administrativa separada `hdboutique_owner` solo se usa para operacion local.
El init solo crea roles: desde fase 5 las 17 tablas del esquema inicial se crean
con el comando Alembic explicito, nunca por el arranque. Ver
[modelo](data-model.md) y [migraciones](migration.md).

## Desarrollo y calidad dentro de Linux

El codigo app/ y alembic.ini se montan en solo lectura; Uvicorn recarga app/.
migrations/ se monta en escritura para generar revisiones en el repositorio.
Los tests y las fuentes Django se copian al construir: reconstruir backend cuando cambien, igual
que cuando cambien pyproject.toml o uv.lock. No montar todo backend/ sobre /opt/venv.

```powershell
docker compose --env-file .env.docker -f compose.yaml -f compose.dev.yaml exec -T backend uv run --locked python -m pytest --cov=app --cov-report=term-missing
docker compose --env-file .env.docker -f compose.yaml -f compose.dev.yaml exec -T backend uv run --locked ruff check .
docker compose --env-file .env.docker -f compose.yaml -f compose.dev.yaml exec -T backend uv run --locked ruff format --check .
docker compose --env-file .env.docker -f compose.yaml -f compose.dev.yaml exec -T backend uv run --locked mypy app
```

Las pruebas unitarias eliminan variables HDB_ heredadas y usan engines simulados.
La caracterizacion Django usa motor dummy: no conecta a SQL Server ni a PostgreSQL.
Que ready responda 200 no sustituye las pruebas de persistencia/negocio futuras.

Sin --run-postgres se omiten siete casos de integracion. La suite completa usa
el archivo independiente compose.test.yaml, sin credenciales/volumen de desarrollo:

```powershell
docker compose -p hdboutique-test -f compose.test.yaml up --build --force-recreate --abort-on-container-exit --exit-code-from backend
docker compose -p hdboutique-test -f compose.test.yaml down
```

Los requisitos y guardas de esa base desechable estan en
[migracion](migration.md#pruebas-aisladas-de-esquema-y-persistencia).

Para comprobar la imagen runtime sin cambiar la configuracion de desarrollo:

```powershell
docker build --target runtime -t hdboutique-backend:runtime backend
docker run --rm --entrypoint python hdboutique-backend:runtime -c "import os, importlib.util; assert os.getuid() == 10001; assert all(importlib.util.find_spec(name) is None for name in ('django', 'pytest', 'ruff')); print('runtime verified')"
```

## Persistencia y ciclo de vida

El proyecto de desarrollo se llama hdboutique-dev y su volumen
`hdboutique-dev_postgres_data` conserva datos al recrear contenedores o ejecutar
down. No usar down -v ni volume prune como limpieza rutinaria.

```powershell
docker compose --env-file .env.docker -f compose.yaml -f compose.dev.yaml stop
docker compose --env-file .env.docker -f compose.yaml -f compose.dev.yaml start --wait
docker compose --env-file .env.docker -f compose.yaml -f compose.dev.yaml down
docker compose --env-file .env.docker -f compose.yaml -f compose.dev.yaml up -d --wait
```

El script init-app.sh corre solo con volumen vacio. Cambiar contraseñas en el
archivo no cambia las almacenadas en PostgreSQL. Si ya hay datos, rotar las claves
mediante un procedimiento administrativo coordinado; no borrar el volumen para
resolver autenticacion. Un arranque con configuracion incorrecta debe fallar.

## Respaldo y restauracion local

Respaldar con pg_dump dentro del contenedor y copiar el archivo binario; evitar
redireccion binaria `>` en PowerShell antiguo. `backups/` esta ignorado por Git.
Los comandos siguientes usan la base local creada por esta fase, nunca SQL Server:

```powershell
New-Item -ItemType Directory -Force backups | Out-Null
docker compose --env-file .env.docker -f compose.yaml -f compose.dev.yaml exec -T db pg_dump -U hdboutique_owner -d hdboutique -Fc --no-owner --file=/tmp/hdboutique.dump
docker compose --env-file .env.docker -f compose.yaml -f compose.dev.yaml cp db:/tmp/hdboutique.dump ./backups/hdboutique.dump
```

El ejemplo usa POSTGRES_DB=hdboutique. Si se cambia, ajustar -d. Conservar copias
fechadas, controlar cada codigo de salida y proteger los archivos: un respaldo
futuro puede contener datos personales. Un volumen persistente no es un respaldo.

Para ensayar recuperacion en una base **nueva** del mismo servidor local:

```powershell
docker compose --env-file .env.docker -f compose.yaml -f compose.dev.yaml exec -T db createdb -U hdboutique_owner hdboutique_restore_check
docker compose --env-file .env.docker -f compose.yaml -f compose.dev.yaml exec -T db pg_restore -U hdboutique_owner -d hdboutique_restore_check --no-owner --no-privileges --exit-on-error /tmp/hdboutique.dump
```

El archivo de /tmp debe existir; si procede de otro equipo, copiarlo primero con
`docker compose ... cp ./backups/hdboutique.dump db:/tmp/hdboutique.dump`.
Verificar contenido antes de dar la recuperacion por valida. El ensayo no restaura
roles/globales; usa el propietario local y omite privilegios originales. No repetir
createdb si ya existe ese destino ni usar --clean contra una base con datos.
La migracion y conciliacion de datos historicos pertenece a fases 6/15.

## Diagnostico

| Problema | Comprobacion |
| --- | --- |
| No conecta Docker | Iniciar Docker Desktop y seleccionar contenedores Linux |
| Variable requerida ausente | Generar .env.docker y pasar siempre --env-file; no sustituir con .env legacy |
| Puerto ocupado | Ajustar BACKEND_PORT/POSTGRES_PORT antes de recrear |
| db saludable pero backend no | Revisar ready y logs de backend; pg_isready no comprueba la clave de la aplicacion |
| ready 503 al detener db | Es el resultado esperado; live sigue 200 y ready se recupera al iniciar db |
| Cambio de clave no aplicado | El volumen conserva roles; init no se repite sobre datos existentes |
| Windows bloquea una DLL SQLAlchemy | Usar los comandos dentro de Linux; no modificar la politica del equipo |

Referencias: [uv en Docker](https://docs.astral.sh/uv/guides/integration/docker/),
[orden de inicio Compose](https://docs.docker.com/compose/how-tos/startup-order/) y
[imagen oficial PostgreSQL](https://hub.docker.com/_/postgres).

## Estado de la entrega

Docker Desktop con motor Linux amd64. Ambos servicios de desarrollo quedan
activos y saludables. Fase 4 verifico imagenes, persistencia y restauracion
sintetica; fase 5 incorpora las 17 tablas vacias del esquema inicial y Alembic.
Los resultados concretos viven en [caracterizacion](characterization.md).
No se ha migrado SQL Server ni habilitado escritura de negocio en FastAPI.
