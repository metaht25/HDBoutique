# ADR 0002 - Base FastAPI reproducible junto a Django

Estado: implementado en fase 3. No incluye migracion de reglas, datos ni endpoints
de negocio.

## Contexto

La fase 3 autoriza uv, FastAPI y calidad conservando Django. El sistema tiene
contratos caracterizados y decisiones B01-B14 pendientes. Se dispone de Python
3.13.15 y uv 0.12.10 en la maquina; las versiones resueltas se verifican mediante
el nuevo entorno, no se consideran instaladas por aparecer en requirements.txt.

## Decision

- Proyecto de aplicacion no empaquetado (package=false) en backend/, con Python
  3.13.15 y required-version de uv 0.12.10. No generar otra aplicacion Django,
  setup.py ni paquetes vacios para funcionalidades futuras.
- Dependencias principales FastAPI/Pydantic, configuracion, Uvicorn y herramientas
  de persistencia previstas. SQLAlchemy/Alembic/Psycopg quedan instalados, sin
  crear engine, tablas o conexiones durante esta fase.
- Grupo dev para pruebas/calidad y grupo legacy con las nueve versiones anteriores
  congeladas. Ambos son predeterminados durante la transicion. La instalacion de
  runtime excluye todos los grupos con --no-default-groups.
- pyproject.toml es la fuente editable y uv.lock la resolucion reproducible.
  requirements.txt se conserva como exportacion generada exclusivamente de legacy.
- FastAPI en app/, puertos locales separados: FastAPI 8001 y Django 8000. No se
  monta la API Django ni se cambia el proxy frontend.
- Configuracion Pydantic con prefijo HDB_, sin lectura automatica de .env legacy;
  debug=False por defecto y error al activar debug en produccion. Documentacion
  OpenAPI/Swagger/ReDoc deshabilitada en modo produccion.
- GET /health/live y /health/ready devuelven scope=process. No afirman disponibilidad
  de PostgreSQL o SQL Server; la fase de infraestructura ampliara readiness.
- Pytest con advertencias como errores, Ruff en app/pruebas, mypy estricto en app
  y cobertura minima del 90% solo para app. Django legacy no se reformatea.
- Integrar las pruebas Django por subproceso con el ejecutor de settings dummy;
  mantener la regresion esperada D03 hasta corregir su contrato en otra fase.

## Compatibilidad de herramientas comprobada

Starlette 1.10.0 prefiere HTTPX2 para TestClient y depreca el cliente HTTPX anterior.
Se reemplaza la dependencia de desarrollo httpx por httpx2, sin mantener dos
clientes. Es el comportamiento de la version instalada y de la
[documentacion de Starlette](https://starlette.dev/testclient/).

Windows bloqueo el lanzador pytest.exe generado. Ejecutar
`uv run --locked python -m pytest` utiliza el interprete del entorno y fue probado
sin cambiar politicas de Windows. Se usa el mismo patron para Uvicorn.

La separacion de grupos y la sincronizacion siguen los mecanismos oficiales de
[dependencias de uv](https://docs.astral.sh/uv/concepts/projects/dependencies/) y
[sincronizacion bloqueada](https://docs.astral.sh/uv/concepts/projects/sync/).

## Consecuencias

Los contratos Django siguen intactos y ahora sus pruebas preparadas pueden
ejecutarse. El grupo legacy temporal conserva sus versiones; no implica una
actualizacion de seguridad de Django. El entorno local incluye herramientas que
no deben entrar a una futura imagen de runtime; --no-dev por si solo no basta.

Se verifican la base y sus endpoints de salud, no funcionalidades de inventario,
operaciones financieras ni migracion de datos. Docker/PostgreSQL, permisos y
casos de uso se implementan en las fases correspondientes. Las versiones exactas
y los resultados vigentes estan en la guia de desarrollo y caracterizacion.
