# Migraciones de esquema y estrategia de datos

Estado desde fase 5: Alembic implementado para el esquema PostgreSQL inicial de
compatibilidad, revision `0001_compatibility`. Aplicada explicitamente en la base
local vacia hdboutique de fase 4, con respaldo previo. Fase 6 incorpora herramientas
de inventario, extraccion, transformacion, carga y conciliacion; procedimiento en
[data-transfer.md](data-transfer.md). El usuario confirmo que no existe instancia
o copia SQL Server ni datos historicos disponibles, por lo que el inventario y
traslado real no aplican al cierre de fase 6. Si aparece un origen futuro, debe
tratarse como un nuevo ensayo autorizado. El corte operativo corresponde a fase 15.

## Operar el esquema con Alembic

Fase 10 lleva head a 0004_atomic_sales, 24 tablas: sale_workflows para autoria/
idempotencia y salidas por sale_item_id en inventory_movements. Conserva las
entradas existentes y los historicos, sin estados ni salidas inferidos. Upgrade,
downgrade desde vacio, conservacion y drift se verifican en PostgreSQL aislado;
no se migra desarrollo. Downgrade con salidas se rechaza antes de descartarlas;
no restaura stock ni constituye anulacion de ventas. Requiere respaldo y plan
operativo incluso sin salidas, pues elimina auditoria. Ver [ventas](sales.md).

Fase 9 lleva head a 0003_purchase_receipts: tres tablas nuevas de workflow, coste
historico y movimientos. No cambia el contenido de las tablas legacy, no asigna
estados/precios a compras previas ni convierte stock null en cero. Upgrade desde
0002 con datos sinteticos preserva existencias 12/3 y nulos; las nuevas tablas
permanecen vacias. Detalles en [compras e inventario](purchases-inventory.md).

Fase 8 agrega head 0002_identity: tres tablas de cuentas, sesiones y limites de
login, sin editar 0001_compatibility. La nueva revision se verifico en PostgreSQL
aislado, desde vacio y desde 0001 con datos sinteticos conservados. No se aplico
contra desarrollo ni datos operativos. Ver [autenticacion](authentication.md).

Fuentes: backend/alembic.ini, backend/migrations/ y el registro de modelos
backend/app/infrastructure/database/models.py. Las revisiones contienen DDL
explicito independiente de los modelos vivos. Alembic es la autoridad de esquema;
no usar create_all ni stamp para presentar una base como migrada.

Desde backend/, con uv y el destino PostgreSQL autorizado configurado mediante
HDB_DATABASE_* del proceso:

```powershell
uv run --locked python -m alembic heads
uv run --locked python -m alembic history
uv run --locked python -m alembic upgrade head --sql
uv run --locked python -m alembic upgrade head
uv run --locked python -m alembic current --check-heads
uv run --locked python -m alembic check
```

heads/history y la generacion --sql no necesitan conexion ni credenciales. Online
usa la misma configuracion tipada que FastAPI, sin URL en alembic.ini ni lectura
automatica de .env. check compara el destino con metadata, pero no sustituye la
revision de DDL, los datos o las pruebas de reglas y restricciones.

En este Windows usar el contenedor Linux por el bloqueo nativo de SQLAlchemy.
Desde la raiz, despues del arranque indicado en [Docker](docker.md):

```powershell
docker compose --env-file .env.docker -f compose.yaml -f compose.dev.yaml exec -T backend uv run --locked python -m alembic upgrade head
docker compose --env-file .env.docker -f compose.yaml -f compose.dev.yaml exec -T backend uv run --locked python -m alembic current --check-heads
docker compose --env-file .env.docker -f compose.yaml -f compose.dev.yaml exec -T backend uv run --locked python -m alembic check
```

Estos comandos son pasos explicitos del operador; ni Uvicorn, ni health checks,
ni entrypoint de PostgreSQL aplican revisiones. La imagen runtime incluye el DDL
y puede ejecutar `python -m alembic ...`; uv se utiliza durante su construccion,
no esta instalado en esa imagen final.

## Evolucionar el esquema

1. Resolver la regla B pertinente y revisar compatibilidad/datos antes del cambio.
2. Cambiar modelos tipados y registrar nuevos modelos en database/models.py.
3. Generar una revision **nueva** sobre una copia local autorizada en la revision
   anterior; nunca autogenerar tomando SQL Server como destino ni sobre datos operativos.
4. Revisar upgrade/downgrade, conversiones, nulos, defaults, FK e indices. Ruff
   ordena imports y formatea mediante post_write_hooks; no decide reglas ni datos.
5. Probar desde base vacia, upgrade y drift; probar reversion solo en un destino
   descartable. Si una reversion pierde datos, documentar el procedimiento adecuado.
6. Versionar modelos y revision, sin modificar una revision ya aplicada/compartida.

Generacion desde backend/ o con el mismo prefijo Docker:

```powershell
uv run --locked python -m alembic revision --autogenerate -m "add approved schema change"
uv run --locked ruff check .
uv run --locked ruff format --check .
```

En desarrollo Compose monta migrations/ en escritura para guardar revisiones en el
repositorio y alembic.ini en solo lectura. Los hooks de authoring requieren Ruff
del grupo dev. El runtime permite aplicar revisiones existentes, no es el entorno
para generarlas. No crear revisiones de relleno cuando check no detecte cambios.

El downgrade inicial elimina las 17 tablas; no es un rollback de datos ni debe
ejecutarse contra la base de desarrollo con informacion a conservar. La prueba
de fase 5 lo ejecuta exclusivamente en el PostgreSQL temporal de pruebas.
Antes de cambiar una base con datos, respaldar y validar recuperacion, revisar
el alcance y disponer de un plan de retorno. Nunca borrar un volumen para
resolver un error de revision o autenticacion.

## Pruebas aisladas de esquema y persistencia

Desde la raiz, sin .env.docker ni instalar dependencias en el host:

```powershell
docker compose -p hdboutique-test -f compose.test.yaml up --build --force-recreate --abort-on-container-exit --exit-code-from backend
docker compose -p hdboutique-test -f compose.test.yaml down
```

compose.test.yaml es **independiente**, no una superposicion de desarrollo. -p fija
el proyecto aislado incluso si hay COMPOSE_PROJECT_NAME en el entorno. PostgreSQL
no publica puertos, usa tmpfs sin volumen persistente y solo datos/claves sinteticos.
El proceso termina con el codigo de Pytest y detiene sus servicios; down retira
solo los contenedores/red de ese proyecto. No usar ese archivo contra volumenes
de desarrollo ni combinarlo con compose.yaml/compose.dev.yaml.

La suite --run-postgres exige todos los valores HDB_TEST_DATABASE_* por separado,
base con nombre terminado en _test y esquema vacio; falla antes de migrar si
encuentra tablas. No hereda HDB_DATABASE_* como alternativa. Las pruebas de
persistencia usan transacciones/savepoints y datos sinteticos; el caso de commit
comprueba visibilidad desde otra conexion. Las pruebas Django siguen con dummy.

Sin --run-postgres, Pytest ejecuta las pruebas sin base y **omite** once casos
de integracion. No presentar esas omisiones como integracion aprobada. La prueba
de SQL offline si se ejecuta sin PostgreSQL. Resultados reales en
[caracterizacion](characterization.md#verificacion-de-fase-5).

## Limite entre esquema y datos historicos

Las FK del destino no prueban que el origen no tenga huerfanos. Las identidades
BY DEFAULT permiten IDs explicitos pero su secuencia debe realinearse tras cargar
datos. offering_id no confirma la PK fisica de Ofrece. No completar costes de
compra ausentes con precios actuales ni inventar municipios o valores de stock.
Las restricciones comerciales futuras requieren perfilado y decision pertinente.

## Dependencias

- Modelo y limites: [data-model.md](data-model.md).
- Diccionario de campos y traducciones: [legacy-api-contracts.md](legacy-api-contracts.md)
  y [contract-compatibility.md](contract-compatibility.md).
- Decisiones que condicionan transformaciones: [business-rules.md](business-rules.md).
- Fase 5: esquema nuevo y Alembic; fase 6: herramientas/ensayos de datos;
  fase 15: corte operativo. Ver [roadmap.md](roadmap.md).

## Procedimiento previsto

| Paso | Evidencia o resultado necesario |
| --- | --- |
| Identificar origen y destino autorizados | Motor/version, ubicacion, responsables, permisos y confirmacion de que la prueba usa copia |
| Respaldar y ensayar restauracion | Copia recuperable y resultado real de restauracion; no basta con que exista un archivo |
| Inventariar esquema fisico | Tablas de negocio y Django, PK/FK, tipos, nulos, defaults, indices, vistas, procedimientos y triggers |
| Perfilar informacion | Conteos, huérfanos, duplicados, negativos, faltantes y discrepancias de totales |
| Aprobar mapeos | Campo origen/destino, conversion, excepciones y decisiones B pendientes resueltas cuando afecten datos |
| Crear destino con Alembic | Base PostgreSQL nueva y version de esquema conocida |
| Extraer, transformar y cargar | Proceso repetible, IDs preservados y rechazos registrados sin exponer datos sensibles |
| Ajustar identidades | Secuencias preparadas para nuevas filas sin colisiones |
| Conciliar y probar aplicacion | Datos comparados y recorridos de negocio verificados |
| Ensayar corte y rollback | Ventana, responsables, escritura final y punto de retorno definidos |

Alembic versiona el esquema del destino; no convierte automaticamente SQL Server
ni sus procedimientos. SQLAlchemy puede ayudar a conectar ambos motores. Las
herramientas de extraccion no deben entrar como dependencia obligatoria de la
imagen final de aplicacion.

## Conciliacion requerida

- Contar todas las filas por tabla y documentar cada diferencia.
- Verificar PK, relaciones y correspondencia de IDs; detectar relaciones huérfanas.
- Comparar importes exactos, lineas/cabeceras, envio y abonos; no aceptar diferencias
  silenciosas de redondeo.
- Comparar ambas existencias legacy hasta que se resuelva su significado.
- Revisar fechas, nulos, textos, caracteres, longitudes y duplicados que colisiones
  de collation pudieran introducir.
- Comprobar preservacion de precios y costes historicos, y reconocer valores que
  el origen no permite reconstruir.
- Verificar usuarios/hashes y tareas de admin si forman parte del alcance B09/B11.
- Confirmar efectos de triggers antes de replicar movimientos desde la aplicacion.

No corregir historicos por suposicion ni omitir registros para cuadrar conteos.
Los datos sinteticos de pruebas son ejemplos de contratos, no validacion del origen.

## Corte y recuperacion

Usar una ventana de escritura controlada: detener escrituras del sistema anterior,
cargar cambios finales, conciliar y cambiar configuracion. Evitar escritura doble
sin una estrategia implementada y probada.

Antes de aceptar escrituras nuevas, el retorno puede usar el origen conservado.
Despues de aceptar operaciones en PostgreSQL, volver a SQL Server requiere
reconciliar esas operaciones; cambiar una cadena de conexion no basta. Definir
antes del corte el punto de no retorno, respaldo, estrategia y tiempo aceptable.

Un downgrade de Alembic no sustituye una restauracion ni garantiza recuperar datos
eliminados. Conservar el origen segun el periodo acordado en B12. Ejecutar el corte
solo al solicitar expresamente su fase y disponer de sus verificaciones.
