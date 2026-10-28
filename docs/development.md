# Guia de desarrollo

## Entorno backend disponible desde fase 3

Desde la raiz, entrar a backend/. Instalar uv 0.12.10 desde una
[fuente oficial](https://docs.astral.sh/uv/getting-started/installation/) si aun no
esta disponible. pyproject.toml exige esa version; no actualizarla silenciosamente.

```powershell
cd backend
uv sync --locked
```

uv crea .venv automaticamente; no hace falta activarla para uv run. Si Python
3.13.15 ya esta disponible, como en la verificacion de esta fase, se reutiliza el
interprete local. No instalar otra copia innecesariamente. .python-version fija
el interprete y requires-python limita el proyecto a la linea 3.13 compatible.
Si falta ese interprete, instalarlo primero con `uv python install 3.13.15`.

| Archivo/grupo | Responsabilidad |
| --- | --- |
| pyproject.toml | Fuente editable de metadatos, dependencias y calidad |
| uv.lock | Resolucion completa versionada; no editar a mano |
| .python-version | Python 3.13.15 |
| tool.uv.required-version | uv 0.12.10 |
| project.dependencies | FastAPI, Pydantic, configuracion, Uvicorn y herramientas de persistencia |
| dev | Pytest, cobertura, HTTPX2, Ruff y mypy |
| legacy | Las nueve versiones congeladas del backend anterior |
| requirements.txt | Exportacion generada de legacy para compatibilidad |
| .venv y caches | Archivos locales excluidos de Git |

dev y legacy se instalan por defecto durante la transicion. Django sigue en
hdboutique/; FastAPI vive en app/. No se crea un segundo proyecto Django ni se
reemplazan sus endpoints.

## Versiones verificadas

Estas versiones son una fotografia de fase 3. uv.lock y los manifiestos son la
fuente actual; cualquier actualizacion requiere cambio intencionado y pruebas.

| Herramienta/paquete | Version |
| --- | --- |
| Python / uv | 3.13.15 / 0.12.10 |
| FastAPI / Pydantic / pydantic-settings | 0.162.0 / 2.14.1 / 2.16.1 |
| Uvicorn | 0.54.0 |
| SQLAlchemy / Alembic / Psycopg | 2.1.6 / 1.20.1 / 3.3.6 |
| Pytest / pytest-cov | 9.2.0 / 7.1.0 |
| Ruff / mypy | 0.17.3 / 2.4.0 |
| HTTPX2 | 2.16.0 |
| Django / DRF / mssql-django | 6.0.4 / 3.17.1 / 1.7.1 |
| pyodbc / python-decouple | 5.3.0 / 3.8 |

SQLAlchemy y Psycopg disponen de engine perezoso. Desde fase 5 hay 17 modelos,
session factory y Alembic con revision inicial 0001_compatibility. Se mantiene la
estructura legacy ambigua segun el acuerdo del usuario; reglas y datos historicos
siguen pendientes. Ver [modelo](data-model.md), [migraciones](migration.md) y
[Docker](docker.md).

## Comandos backend

Los incrementos de fase 7 incorporan ubicaciones, catalogo, clientes y proveedores.
Rutas y limites de habilitacion en [API fundamental](foundation-api.md).
HDB_BUSINESS_API_ENABLED es false por defecto. Fase 8 incorpora cuentas, sesiones,
CSRF y permisos; production exige origen HTTPS y cookies Secure.
Bootstrap y contrato en [autenticacion](authentication.md).
Fase 9 agrega compras y recepcion de inventario para Administrator/Manager,
head 0003_purchase_receipts y stock de solo lectura en CRUD. El producto nuevo
inicia en cero; los nulos historicos no se convierten. Ver
[compras e inventario](purchases-inventory.md).

Todos los comandos de esta seccion parten de backend/:

```powershell
uv sync --locked
uv run --locked python -m pytest
uv run --locked python -m pytest --cov=app --cov-report=term-missing
uv run --locked ruff check .
uv run --locked ruff format --check .
uv run --locked mypy
uv lock --check
```

La suite de Django tambien puede ejecutarse de forma independiente:

```powershell
uv run --locked python tests/characterization/run_django_tests.py
```

Pytest incluye esa suite mediante un subproceso con settings dummy. No usa SQL
Server, no crea una base y no ejecuta migraciones. Ver
[characterization.md](characterization.md) para limites y el fallo esperado D03.

Los comandos Pytest anteriores, sin --run-postgres, omiten los once casos de
integracion PostgreSQL. Para la suite completa usar compose.test.yaml con proyecto
aislado, configuracion HDB_TEST_DATABASE_* y PostgreSQL temporal, segun
[migracion](migration.md#pruebas-aisladas-de-esquema-y-persistencia).

En este Windows el lanzador pytest.exe fue bloqueado por Control de aplicaciones.
El comando python -m pytest dentro de uv fue verificado; no requiere cambiar la
politica de Windows. Se utiliza el mismo patron para Uvicorn.

Desde fase 4, Control de aplicaciones de este equipo tambien bloquea una DLL de
SQLAlchemy. Las pruebas actuales y la API con persistencia deben ejecutarse dentro
del contenedor Linux; el cambio de lanzador no resuelve ese bloqueo nativo.

## Iniciar FastAPI

```powershell
uv run --locked python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
```

| Ruta | Comportamiento |
| --- | --- |
| GET /health/live | 200 con status=ok y scope=process |
| GET /health/ready | Sin base: 200/process. Con base: SELECT 1, 200/database o 503/unavailable |
| /docs, /redoc, /openapi.json | Documentacion en desarrollo/test; deshabilitada en modo production |

El puerto 8001 evita sustituir Django en 8000, al que sigue apuntando el proxy
frontend. No se migraron endpoints de negocio ni se expuso la API fuera de
127.0.0.1. Detener el servidor con Ctrl+C al terminar la sesion de desarrollo.

## Configuracion de FastAPI

La aplicacion solo consulta variables del proceso con prefijo HDB_. No carga
automaticamente el .env legacy ni necesita credenciales de base para arrancar.

| Variable | Valor por defecto | Validacion |
| --- | --- | --- |
| HDB_APP_NAME | HDBoutique API | Texto no vacio |
| HDB_ENVIRONMENT | development | development, test o production |
| HDB_DEBUG | False | Booleano; True se rechaza en production |
| HDB_BUSINESS_API_ENABLED | False | Habilita identidad y negocio autenticado |
| HDB_AUTH_ORIGIN | http://localhost:8001 | Origen exacto sin path; HTTPS en production con negocio habilitado |
| HDB_SESSION_COOKIE_SECURE | True | No se permite False con negocio habilitado en production |
| HDB_DATABASE_HOST, HDB_DATABASE_NAME, HDB_DATABASE_USER, HDB_DATABASE_PASSWORD | Sin configurar | Se requieren juntos; contraseña oculta en representacion/errores |
| HDB_DATABASE_PORT | 5432 | Entero entre 1 y 65535 |

Ejemplo local PowerShell, antes de iniciar la API:

```powershell
$env:HDB_ENVIRONMENT = 'development'
$env:HDB_DEBUG = 'False'
```

.env.example contiene las variables basicas junto con las legacy como referencia;
no sobrescribir un .env existente. Los contenedores usan un archivo independiente
.env.docker generado desde .env.docker.example; ver [Docker](docker.md).
No poner secretos en variables publicas del frontend.

## Dependencias con uv

Agregar/eliminar paquetes desde backend/, revisar pyproject.toml y uv.lock juntos
y repetir las pruebas del area afectada:

```powershell
uv add package_name
uv add --dev package_name
uv add --group legacy package_name
uv remove package_name
uv sync --locked
```

Usar uv sync sin --locked solo al resolver cambios deliberados. No mantener otro
gestor Python o una segunda lista manual. Si cambia legacy, regenerar su exportacion:

```powershell
uv export --locked --only-group legacy --no-hashes --no-emit-project --output-file requirements.txt
```

Para instalar solo dependencias principales:

```powershell
uv sync --locked --no-default-groups
```

Ese comando retira herramientas de desarrollo y Django del entorno seleccionado;
volver con uv sync --locked para desarrollar. --no-dev por si solo deja legacy
activo. Docker/CI deben respetar esa diferencia. La resolucion sin grupos se
comprobo con --dry-run sin alterar el entorno de desarrollo.

## Usar Django temporalmente

El grupo legacy conserva todas las versiones de requirements.txt anterior.
Para ejecutar el backend real hace falta ODBC Driver 17 y una copia SQL Server
autorizada; instalar pyodbc no instala ese driver del sistema.

| Variable legacy | Funcion |
| --- | --- |
| SECRET_KEY, DEBUG, ALLOWED_HOSTS | Configuracion Django; valores de ejemplo solo para desarrollo |
| DB_NAME, DB_HOST, DB_PORT | Base y servidor autorizados |
| DB_DRIVER | Nombre del driver ODBC instalado |
| DB_TRUSTED_CONNECTION | Autenticacion integrada de Windows actual |

Desde backend/, solo con esa copia/configuracion y dentro del alcance autorizado:

```powershell
uv run --locked python hdboutique/manage.py runserver 127.0.0.1:8000
```

Ese comando puede acceder a SQL Server al atender peticiones y no se uso en las
pruebas de fase 3. No ejecutar manage.py migrate como paso automatico: los 17
modelos de negocio unmanaged no se reconstruyen con sus migraciones.

## Frontend existente

No se cambia su entorno en fase 3. Desde frontend/, cuando esten preparadas sus
dependencias: npm ci instala package-lock.json; npm run dev inicia Vite,
npm run lint ejecuta ESLint, npm run build genera dist y npm run preview permite
vista local de la construccion. Preview no es el servidor de produccion.

Node 24 satisface los rangos del lock de Vite y ESLint; el proyecto aun no fija
un parche oficial de Node. No hay TypeScript ni script npm test todavia.
La caracterizacion Node puede ejecutarse desde la raiz sin instalar paquetes:

```powershell
node --test --test-reporter=spec frontend/tests/characterization/services.test.js
```

## Docker disponible y CI posterior

Desde fase 4, [docker.md](docker.md) documenta construccion, arranque, pruebas,
persistencia, respaldo y restauracion local. Se usan Python/uv fijados,
sincronizacion bloqueada, cache y usuario sin privilegios. Runtime excluye dev y
legacy; development los incluye para pruebas. No se inician migraciones durante
el arranque y no se conecta SQL Server desde este entorno.

Alembic se ejecuta explicitamente despues de arrancar PostgreSQL; los comandos
y la generacion/revision de cambios estan en [migration.md](migration.md).
CI utilizara los comandos de calidad de esta guia y el mismo bloqueo. Su
configuracion y ejecucion remota no se afirman implementadas. Las pruebas de
persistencia ya usan PostgreSQL aislado en Compose. Ver [quality.md](quality.md) y
[migration.md](migration.md).

## Problemas frecuentes

| Situacion | Accion |
| --- | --- |
| uv rechaza su version | Usar 0.12.10 o realizar una actualizacion explicita de herramientas verificada |
| Falta Python 3.13.15 | Instalarlo con uv python install 3.13.15 |
| Falta Django durante pruebas | Ejecutar uv sync --locked; no usar --no-default-groups para la suite completa |
| pytest.exe bloqueado | Usar uv run --locked python -m pytest |
| Readiness devuelve ok | Comprobar scope: process sin base; database comprueba conexion, nunca esquema |
| SQLAlchemy bloqueado por Control de aplicaciones Windows | Ejecutar API/pruebas dentro del contenedor Linux segun [Docker](docker.md) |
| SQL Server/ODBC no disponible | La nueva API y las pruebas aisladas siguen siendo independientes |
| Cambios ajenos o rama distinta | Seguir [collaboration.md](collaboration.md) y preservar el trabajo |
