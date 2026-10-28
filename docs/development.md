# Guia de desarrollo

## Estado y ubicaciones

Esta guia distingue los comandos disponibles del entorno objetivo. El orden de
implementacion se encuentra en [roadmap.md](roadmap.md).

| Ubicacion | Contenido actual |
| --- | --- |
| Raiz | Documentacion, configuracion de ejemplo y control de versiones |
| `backend/requirements.txt` | Dependencias del backend Django legacy |
| `backend/hdboutique/` | manage.py, proyecto Django y seis aplicaciones de negocio |
| `backend/tests/characterization/` | Muestras y pruebas independientes de una base real |
| `frontend/` | Aplicacion React/Vite, package.json y package-lock.json |

No existe todavia un entorno reproducible completo para el backend. No se conoce
la version de Python originalmente usada por el proyecto: requirements.txt fija
paquetes, pero no Python ni las herramientas del sistema.

## Requisitos segun tarea

| Tarea | Requisitos |
| --- | --- |
| Documentacion y Git | Esta copia local, Git y editor |
| Caracterizacion estatica | Python existente; biblioteca estandar |
| Servicios frontend | Node con node:test y fetch; fase 1 comprobada con Node 24.22.1 |
| Adaptadores Django aislados | Django y DRF ya disponibles; no necesita SQL Server ni pyodbc |
| Frontend completo | Node/npm compatibles con el lock y dependencias instaladas |
| Entorno backend objetivo | Python y uv con versiones fijadas en fase 3 |
| Contenedores y PostgreSQL | Docker Engine/Desktop y Compose v2, preparados en fase 4 |
| Datos historicos | Copia o acceso de lectura de SQL Server expresamente autorizado |

El lock de frontend requiere para Vite `^20.19.0 || >=22.12.0` y para ESLint
`^20.19.0 || ^22.13.0 || >=24`. Node 24 satisface ambos; el proyecto todavia no fija
un parche oficial. Verificar y fijar versiones al implementar el entorno.

## Comprobaciones disponibles

Desde la raiz, sin instalar paquetes ni iniciar servicios:

```powershell
git branch --show-current
git status --short
python -B -m unittest discover -s backend/tests/characterization -p test_source_contracts.py -v
node --test --test-reporter=spec frontend/tests/characterization/services.test.js
```

El ejecutor opcional de Django es:

```powershell
python -B backend/tests/characterization/run_django_tests.py
```

Si faltan dependencias termina con codigo 2 y declara que no se ejecuto la suite.
Consultar [characterization.md](characterization.md) para cobertura y limites.

## Uso del backend legacy

Solo si ya existe un entorno con las dependencias de requirements.txt y una copia
SQL Server autorizada, preparar la configuracion local a partir de `.env.example`.
Conservar un `.env` existente: no sobrescribirlo automaticamente.

| Variable | Funcion legacy |
| --- | --- |
| `SECRET_KEY` | Clave privada de Django; el ejemplo no es una clave de despliegue |
| `DEBUG` | Depuracion local; no usar el valor de ejemplo para produccion |
| `ALLOWED_HOSTS` | Nombres permitidos por Django |
| `DB_NAME`, `DB_HOST`, `DB_PORT` | Base y servidor autorizados |
| `DB_DRIVER` | Nombre del driver ODBC instalado; ejemplo Driver 17 |
| `DB_TRUSTED_CONNECTION` | Autenticacion integrada de Windows configurada actualmente |

Los comandos de Django se ejecutan desde `backend/hdboutique/`.
`python manage.py runserver` carga esa configuracion y puede conectar a SQL Server al atender
peticiones; no forma parte de las verificaciones documentales. No ejecutar
`manage.py migrate` como paso automatico: los 17 modelos de negocio son unmanaged
y ese comando no reconstruye su esquema externo.

La instalacion legacy se consolidara con uv durante la fase 3. Esta guia no
propone crear otro entorno ni mantener un flujo paralelo de instalacion con pip.

## Frontend existente

Tras preparar dependencias en la fase autorizada, desde `frontend/`:

| Comando existente | Uso |
| --- | --- |
| `npm ci` | Instalar respetando package-lock.json; altera node_modules |
| `npm run dev` | Iniciar Vite; el proxy `/api` apunta a `http://127.0.0.1:8000` |
| `npm run lint` | ESLint |
| `npm run build` | Generar dist; requiere dependencias |
| `npm run preview` | Vista local de la construccion; no es servidor de produccion |

No hay script `npm test`, comprobacion TypeScript ni runner de componentes todavia.
Las pruebas Node de fase 1 se ejecutan por separado desde la raiz. No mezclar
package-lock.json con bloqueos de otros gestores.

## Guia de uv de Astral: flujo previsto para fase 3

Estos comandos se documentan para la implementacion futura. No funcionan como
arranque del proyecto actual mientras falten pyproject.toml y uv.lock.

Desde `backend/`, fijar Python mediante `uv python install` y `uv python pin` con
la version acordada. Usar `uv init` solo si se necesita inicializar los metadatos,
revisando su salida para no reemplazar el codigo Django existente.

| Operacion | Comando previsto |
| --- | --- |
| Agregar dependencia principal | `uv add fastapi` |
| Agregar herramienta de desarrollo | `uv add --dev pytest` |
| Retirar dependencia | `uv remove package_name` |
| Resolver/sincronizar cambios deliberados | `uv sync` |
| Reproducir entorno y comprobar bloqueo | `uv sync --locked` |
| Iniciar nueva API | `uv run --locked uvicorn app.main:app --reload` |
| Pruebas | `uv run --locked pytest` |
| Lint/formato | `uv run --locked ruff check .` y `uv run --locked ruff format --check .` |
| Tipado | `uv run --locked mypy app` |

pyproject.toml sera la fuente de dependencias directas y configuracion. uv.lock
se versionara junto con cada cambio de dependencias. .python-version fijara
Python, y .venv sera generado por uv y excluido de Git. Instalar las herramientas
de pruebas/calidad en el grupo de desarrollo; dependencias de extraccion SQL
Server quedaran separadas de la aplicacion final cuando se necesiten.

Mantener requirements.txt solo mientras tenga consumidores legacy; no editar dos
listas manuales para el mismo entorno. uv sera el mecanismo comun de desarrollo,
Docker y CI. Fijar tambien la version de uv al preparar esos entornos.

## Guia de Docker: preparacion prevista para fase 4

Todavia no hay Dockerfile ni archivos Compose. La fase 4 debe proporcionar:

- Backend construido con Python y uv fijados, pyproject.toml/uv.lock copiados antes
  del codigo, cache de dependencias y sincronizacion bloqueada sin desarrollo.
- Imagen final sin secretos, caches locales, herramientas de pruebas ni privilegios
  administrativos; arranque sin resolver dependencias de nuevo.
- PostgreSQL oficial con version fijada, volumen persistente y health check.
- Configuraciones de desarrollo/produccion, .dockerignore y .env.example revisado.
- Frontend con Vite en desarrollo y estaticos en produccion cuando corresponda.
- Migraciones como paso explicito, no una carrera entre todos los procesos web.

Los comandos Compose exactos se agregaran y verificaran con los nombres reales
de servicios. Documentar respaldo y restauracion junto con ellos; un volumen no
sustituye un respaldo. No publicar la base por defecto fuera del entorno local.

## Problemas frecuentes

| Situacion | Accion |
| --- | --- |
| Django no disponible en caracterizacion | Registrar pendiente; preparar dependencias con uv en fase 3, no cambiar a settings productivos |
| No existe pyproject.toml | El flujo uv del proyecto aun no esta implementado; usar solo comprobaciones disponibles |
| SQL Server u ODBC no disponible | Las pruebas estaticas y Node siguen siendo independientes |
| npm no disponible | Se puede ejecutar la caracterizacion de servicios con Node; el frontend completo requiere preparar npm |
| Cambios ajenos o rama distinta | Seguir [collaboration.md](collaboration.md) y preservar el trabajo |
| Error de integridad o totales | No reparar datos a ciegas; contrastar reglas, contratos y [migration.md](migration.md) |
