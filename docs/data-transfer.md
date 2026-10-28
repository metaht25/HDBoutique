# Herramientas de traslado y conciliacion — fase 6

Implementadas en `backend/data_migration/`, fuera del runtime y de FastAPI.
No consultan settings Django, no leen .env ni reutilizan credenciales de desarrollo.
La matriz ejecutable contiene las 17 tablas y todos sus campos declarados;
`mapping` la exporta con tipos, nulabilidad y revision de destino.
Es una correspondencia basada en codigo, **no un inventario fisico certificado**.

## Estado y entorno acordado

La fase 6 queda completada para el alcance disponible. El usuario confirmo que no
existe una instancia o copia SQL Server ni datos historicos que trasladar. Por eso
no hay host, instancia, puerto, base, credenciales ni inventario SQL Server
pendientes en el proyecto actual. Las herramientas se conservan para una fuente
futura, pero su presencia no afirma que se haya migrado una base inexistente.

El destino canonico de ensayo ya esta definido en `compose.test.yaml`:

| Parametro | Valor |
| --- | --- |
| Proyecto Compose | `hdboutique-test` |
| Host desde el contenedor backend | `db` |
| Puerto PostgreSQL | `5432` |
| Base | `hdboutique_test` |
| Usuario de aplicacion | `hdboutique_app` |
| Persistencia | `tmpfs`; desechable |
| Puerto publicado al host | Ninguno |

Las variables `HDB_MIGRATION_DATABASE_*` se declaran explicitamente en el servicio
backend con esos valores y credenciales sinteticas. No usan `.env.docker`, no
reutilizan `HDB_DATABASE_*` y no alcanzan la base de desarrollo `hdboutique`, que
se publica separadamente en `127.0.0.1:5433` cuando esta activa.

No se publica otro puerto porque la herramienta y PostgreSQL se comunican en la
red interna de Compose. Si un operador necesita acceso manual desde Windows en el
futuro, debe autorizarse y documentarse una superposicion distinta; no hace falta
para las pruebas ni para cerrar esta fase.

## Fuente SQL Server futura

El propietario debe proporcionar una copia restaurada estable y una cuenta de
solo lectura (SELECT y VIEW DEFINITION). El driver pide readonly y el codigo solo
emite SELECT; readonly depende del driver y **no sustituye los permisos SQL**.
No se cambia isolation, triggers, permisos, esquema ni configuracion del origen.
No usar NOLOCK ni extraer tablas de una copia que recibe escrituras concurrentes.
El respaldo/restauracion de SQL Server lo prepara el operador, con acceso
autorizado; estas herramientas no ejecutan BACKUP/RESTORE sobre SQL Server.

Inventario captura objetos (tambien los ajenos a los 17 modelos), columnas/tipos,
nulos, collation, defaults identificados por nombre, PK, indices, FK y acciones,
CHECK, vistas, procedimientos, funciones y triggers. No exporta cuerpos SQL ni
expresiones de restricciones para evitar revelar constantes privadas; el operador
debe revisar sus definiciones y efectos en la copia antes de aprobar el mapeo.
VIEW DEFINITION se exige para evitar presentar metadata parcial como inventario.

`Ofrece` requiere un nombre explicito de PK fisica simple entera. `id` es un campo
canonico del archivo, no una PK inferida. Si no existe una PK compatible, detener
extraccion y acordar un mapeo de identidad trazable; nunca numerar filas al azar
ni fusionar ofertas. Columnas faltantes, extras, PK distintas o tipos incompatibles
bloquean extraccion; el inventario permite revisar esas diferencias.

B01-B14 siguen pendientes. En particular, revisar B05 antes de mover fechas
reales. No interpretar refill_date como recepcion; conservar DATE y nulos.
Conservar ambos stocks, direcciones solo a departamento, precios historicos de
venta y abonos. No recuperar costes de compra desde precios actuales, reconstruir
centavos, calcular deuda o corregir totales para cuadrar datos.

## Comandos del operador

Desde `backend/`, Python 3.13.15 y uv 0.12.10: `uv sync --locked`.
El acceso SQL Server necesita pyodbc del grupo legacy ya bloqueado y un driver
ODBC SQL Server instalado por el operador. No se agrega ese driver al runtime.
En este Windows sigue vigente el bloqueo nativo SQLAlchemy: usar un entorno Linux
de herramientas o el contenedor development; para SQL Server debera disponer
del driver y acceso de red autorizados. Ese acceso no se ha verificado.

Crear una carpeta privada `migration-artifacts/` (ignorada por Git) para cada
ejecucion. Los comandos crean archivos nuevos y rechazan sobrescribir evidencia.
Los exports contienen datos personales: aplicar ACL del sistema, cifrado, acceso
restringido y la retencion acordada; el modo 0600 de Python no configura ACL Windows.
Los reportes no incluyen valores originales; los hashes tampoco deben publicarse.

```powershell
uv run --locked python -m data_migration --help
uv run --locked python -m data_migration mapping --output migration-artifacts/mapping.json
```

Configurar externamente `HDB_MIGRATION_SQLSERVER_ODBC` con la cadena ODBC de la
copia autorizada. No escribirla en el historial, argumentos CLI, repositorio ni
salida. Inventario puede ejecutarse sin conocer aun la PK Ofrece; por defecto
reporta su diferencia contra el slot canonico `id`.

```powershell
uv run --locked python -m data_migration inventory --source-authorized --schema dbo --output migration-artifacts/inventory.json
```

Revisar inventario y definiciones con el operador. Solo tras aprobar mapeo y PK,
sustituir PHYSICAL_KEY por la columna verificada, sin inventar su nombre:

```powershell
uv run --locked python -m data_migration extract --source-authorized --stable-copy --schema dbo --offering-id-column PHYSICAL_KEY --output migration-artifacts/source.json
uv run --locked python -m data_migration transform --input migration-artifacts/source.json --output migration-artifacts/target.json
uv run --locked python -m data_migration profile --input migration-artifacts/target.json --output migration-artifacts/profile.json
```

Codigo de salida 0 indica exito; 2 indica rechazo/error/diferencias. Ante rechazos
de transformacion, el output contiene `status: rejected`, tabla, posicion de fila
(desde 1), columna y motivo, sin datos sensibles. El archivo de origen conserva
los valores completos para revision privada. No es un dataset parcial cargable.
Duplicados de PK, huerfanos, campos inesperados, tipos, longitudes o precision
incompatibles bloquean la carga completa. No se sustituyen nulos, recortan textos
ni redondean importes. Las observaciones de negocio (negativos, stocks distintos,
totales/cabeceras, cliente del abono) se reportan sin modificar historicos.
Duplicados textuales NFKC/casefold son una heuristica, no equivalencia de collation.

Para un ensayo futuro fuera de Compose, crear **manualmente** un PostgreSQL
exclusivo con nombre terminado en `_test` y aplicar Alembic segun
[migration.md](migration.md). La CLI no crea bases, no aplica DDL Alembic ni vacia
tablas. Las variables de proceso `HDB_MIGRATION_DATABASE_HOST`, `PORT`, `NAME`,
`USER`, `PASSWORD` son obligatorias, sin fallback a HDB_DATABASE_* ni
HDB_TEST_DATABASE_*. La cuenta debe ser propietaria de tablas/identidades para
RESTART. El ensayo canonico del proyecto no necesita esta configuracion manual:
Compose ya proporciona `db:5432/hdboutique_test`.

```powershell
uv run --locked python -m data_migration load --database rehearsal_test --input migration-artifacts/target.json --output migration-artifacts/load.json
uv run --locked python -m data_migration reconcile --database rehearsal_test --input migration-artifacts/target.json --output migration-artifacts/reconciliation.json
```

`load` verifica revision 0001_compatibility, metadata sin drift, ausencia de triggers
personalizados y tablas vacias; bloquea las 17 tablas, inserta por dependencias,
concilia y reinicia identidades a max(ID)+1 (minimo 1). Usa una sola transaccion;
un fallo revierte filas y RESTART. No usa setval, truncate, delete ni upsert.
No ejecutar junto con escrituras de aplicacion. Un ID INTEGER agotado bloquea la
carga y requiere nueva revision aprobada. El comando reconcile usa una transaccion
de lectura REPEATABLE READ. Si falla escribir evidencia despues de un commit,
volver a conciliar; no reintentar la carga sobre tablas ocupadas.

La conciliacion compara IDs y cada campo, conteos, faltantes, extras, diferencias,
hashes deterministas y perfiles agregados (dinero, cantidades, nulos y negativos).
`fidelity_equal` significa traslado identico, no aprobacion de reglas comerciales.
Los precios se normalizan a Decimal exacto; no se toleran diferencias monetarias.

Limite operativo: export/transform/profile conservan el dataset completo en memoria,
aunque las inserciones se agrupan en 500 filas. Dimensionar con el perfilado real
antes de ensayos grandes; aun no se midio volumen, duracion ni rendimiento real.

## Pruebas y respaldo/restauracion sinteticos

Desde la raiz, sin .env.docker ni datos reales:

```powershell
docker compose -p hdboutique-test -f compose.test.yaml up --build --force-recreate --abort-on-container-exit --exit-code-from backend
docker compose -p hdboutique-test -f compose.test.yaml up -d --wait db
docker compose -p hdboutique-test -f compose.test.yaml run --rm -T backend uv run --locked python -m tests.rehearse_transfer prepare
docker compose -p hdboutique-test -f compose.test.yaml exec -T db pg_dump -U hdboutique_test_owner -d hdboutique_test -Fc -f /tmp/transfer.dump
docker compose -p hdboutique-test -f compose.test.yaml exec -T db createdb -U hdboutique_test_owner -O hdboutique_app hdboutique_restore_test
docker compose -p hdboutique-test -f compose.test.yaml exec -T db pg_restore -U hdboutique_test_owner --role=hdboutique_app --no-owner --exit-on-error -d hdboutique_restore_test /tmp/transfer.dump
docker compose -p hdboutique-test -f compose.test.yaml run --rm -T backend uv run --locked python -m tests.rehearse_transfer verify --database hdboutique_restore_test
docker compose -p hdboutique-test -f compose.test.yaml down
```

El proyecto tmpfs detenido por la suite se reinicia vacio; no ejecutar prepare dos
veces sobre datos existentes. La copia dump reside en /tmp del contenedor de
pruebas y desaparece al retirar el proyecto. Este ensayo no certifica restauracion
SQL Server ni recuperacion de datos operativos. Resultados en
[characterization.md](characterization.md#verificacion-de-fase-6).

## Plan de ensayo, corte y retorno

Si aparece una instancia o copia SQL Server en el futuro, reabrir este procedimiento:

1. Identificar responsables, bases autorizadas, retencion B12 y reglas B pertinentes.
2. Verificar respaldo restaurando SQL Server en copia separada; documentar motor,
   version, fecha y consistencia, sin publicar datos ni credenciales.
3. Inventariar y perfilar copia estable; aprobar diferencias fisicas, excepciones,
   triggers y mapeos. Resolver cada rechazo sin borrar ni inventar informacion.
4. Crear destino vacio con Alembic y respaldo previo; extraer, transformar, cargar
   y conciliar. Conservar archivos y hashes privados de esa misma ejecucion.
5. Repetir en otro destino limpio; comparar resultados y medir tiempo/recursos.
6. Ensayar restauracion del respaldo en un destino adicional y volver a conciliar.
7. Preparar para fase 15 ventana, bloqueo de escrituras, carga final, conciliacion,
   pruebas funcionales y decision expresa de aceptar escrituras PostgreSQL.

Si falla el ensayo, la transaccion revierte la carga; conservar evidencia y origen.
Si ya hubo commit, abandonar ese destino de ensayo o restaurar su respaldo en una
base separada autorizada; no vaciar bases automaticamente. Para corte futuro, antes
de aceptar escrituras nuevas el retorno usa el origen conservado. Despues hay que
conciliar las operaciones nuevas: cambiar una conexion o hacer downgrade Alembic
no es rollback de datos. La fase 6 no detiene escrituras operativas, cambia la API,
retira Django ni ejecuta corte. Con el alcance actual sin SQL Server, estos pasos
futuros no bloquean el cierre de fase 6.
