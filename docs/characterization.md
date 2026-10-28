# Pruebas de caracterizacion y regresion

## Proposito y alcance

Preparar una base verificable antes de reemplazar Django o los servicios frontend.
Se protege el comportamiento valido de los [contratos actuales](legacy-api-contracts.md)
y se identifican defectos que deben corregirse. La fase 1 no inicio FastAPI ni
modifico codigo de aplicacion. La fase 3 agrega la base nueva e integra estas
pruebas con uv/Pytest manteniendo los contratos Django.

Las muestras se encuentran en
`backend/tests/characterization/fixtures/legacy_contracts.json`: 17 recursos con
IDs y datos sinteticos relacionados. `baseline_commit` identifica el codigo de
aplicacion de referencia, no una exportacion de SQL Server.

## Ejecucion actual desde backend/

### Declaraciones backend, sin dependencias externas

```powershell
uv run --locked python -m pytest tests/characterization/test_source_contracts.py -v
```

Tres pruebas comparan el inventario con las rutas declaradas y los campos de
modelos: nombres, PK esperada por Django, nulabilidad, entradas requeridas y
categorias JSON de los ejemplos. Recorren los 17 recursos con subcasos.

Se analiza el AST de Python; no se importa Django, no se leen `.env` ni se ejecuta
codigo de modelos. Es verificacion estatica del contrato, no una prueba HTTP ni
una confirmacion del esquema fisico. En particular la PK `id` de Ofrece se infiere
como haria Django: sigue pendiente verificar la identidad real en SQL Server.

### Servicios frontend, con Node y sin instalar paquetes

```powershell
node --test --test-reporter=spec ../frontend/tests/characterization/services.test.js
```

Las 41 pruebas ejecutan los siete modulos reales de servicios:

- 30 funciones de lectura: rutas GET y conservacion de valores de respuesta.
- 7 escrituras: POST/PATCH, URL, Content-Type, payload JSON y respuesta.
- Rechazo HTTP en las 37 funciones; no leer JSON de exito tras un rechazo.
- Propagacion de errores de red en las 37 funciones.
- Conservacion de un envoltorio paginado y de la ruta exportada de abonos.

`fetch` se sustituye mediante el mock de cada prueba y se restaura al terminar.
No hay solicitudes HTTP reales. Las pruebas no montan React, no envian ventas a
un servidor y no demuestran que las pantallas recorran todas las paginas.
La ejecucion verificada utilizo Node 24.22.1; la version oficial se fijara en la
fase de entorno.

### Adaptadores HTTP y serializers Django, ejecutados en fase 3

```powershell
uv run --locked python tests/characterization/run_django_tests.py
```

El ejecutor comprueba primero si Django y DRF ya estan disponibles. Si faltan,
informa que no se ejecutaron las pruebas y termina con codigo 2; no instala nada,
no omite silenciosamente toda la suite y no reporta exito.
Desde fase 3, uv sync --locked incluye legacy por defecto y permite ejecutarla.

Cuando esten disponibles, usa `isolated_settings.py`, independiente de settings
productivos, `python-decouple`, ODBC y `.env`. Solo configura
`django.db.backends.dummy`. Los casos derivan de SimpleTestCase con
`databases = set()`: una consulta SQL falla; no hay base de pruebas, tablas ni
migraciones. Se simulan `get_queryset` y `get_object`, no se prueba persistencia.

Hay siete pruebas normales (varias con subcasos por recurso):

1. Resolucion de rutas y metodos CRUD.
2. GET lista con nombres, IDs planos, fechas y decimales.
3. GET lista vacia.
4. GET detalle.
5. Campos requeridos, anulables y de solo lectura del serializer.
6. POST vacio: 400 y codigos `required`, sin consultar una base.
7. Precision decimal de producto y rechazo de fecha invalida.

Se prepara ademas una regresion D03 con `expectedFailure`: un detalle de venta
deberia admitir precio 199.50. En fase 3 se ejecuto como fallo esperado. Al corregir
D03, se debe
retirar expectedFailure y actualizar el contrato intencionadamente; un exito
inesperado fuerza esa revision.

Las lecturas usan una identidad simulada. No se exige preservar acceso anonimo
ni se certifica autenticacion. No ejecutar estos casos mediante el `manage.py test`
productivo; utilizar su ejecutor aislado.

### Relacion con uv

En fase 1 se ejecutaban Python/Node existentes sin instalar dependencias. Desde
fase 3, pyproject.toml y uv.lock son la fuente del entorno; uv run --locked
ejecuta las herramientas. El grupo legacy mantiene las versiones Django y el
grupo dev incluye Pytest. No usar pip para preparar este entorno.

Pytest descubre las tres pruebas estaticas y un caso que ejecuta la suite Django
en un subproceso independiente. La suite interna usa SimpleTestCase y conserva
su expectedFailure. No se agrego pytest-django ni se configuro una base de prueba.

Para ejecutar toda la base nueva y la caracterizacion desde backend/:

```powershell
uv run --locked python -m pytest --cov=app --cov-report=term-missing
```

Los parametros, requisitos y comandos restantes estan en
[development.md](development.md).

## Matriz de caracterizacion

| ID | Comportamiento valido | Proteccion preparada | Limite |
| --- | --- | --- | --- |
| C01 | Rutas actuales y 17 recursos | Prueba estatica + resolucion Django | Sin servidor ni base real |
| C02 | Nombres, campos y relaciones por ID | Fixture, estatico y serializers | No prueba FK fisica |
| C03 | Decimal como texto con 2 decimales; fecha ISO | Fixture + serializer Django | Lectura de objetos sinteticos, sin SQL |
| C04 | Listas y objetos de detalle | Pruebas Django con objetos sin guardar | No consulta SQL |
| C05 | Errores de campos requeridos | POST vacio aislado | No prueba errores de FK inexistente |
| C06 | Peticiones de servicios frontend existentes | 41 pruebas Node | No renderiza paginas |
| C07 | Escrituras y respuesta de producto/cliente/venta | POST/PATCH con fetch simulado | No demuestra atomicidad ni persistencia |
| C08 | Historicos y relaciones en la base | Escenario definido para fase de datos | No ejecutado; requiere copia autorizada |

## Defectos conocidos: no son requisitos de compatibilidad

| ID | Evidencia | Reproduccion o prueba pendiente | Resultado futuro esperado |
| --- | --- | --- | --- |
| D01 | `Productos.jsx:34` frente a `Ventas.jsx:97` | Producto con `cantidadstock=12`, `stock=3`; comparar pantallas. Pendiente de UI | Una semantica coherente aprobada B01 |
| D02 | `Ventas.jsx:384` y `:396` | Simular exito de cabecera y fallo del segundo detalle; verificar registros parciales. Pendiente de integracion | Transaccion completa y reintento sin duplicado |
| D03 | `ventas/models.py:22` | Regresion Django ejecutada como fallo esperado: precio 199.50 debe conservar centavos | Precio de linea exacto y total 399.00 para 2 unidades |
| D04 | `Clientes.jsx:379`, `ubicaciones/models.py:12` | Enviar payload del formulario; comprobar texto/municipio recibido frente a validado. Pendiente de serializer/UI | Ningun dato solicitado se pierde silenciosamente; B08 |
| D05 | `Productos.jsx:232`, `Clientes.jsx:315` | Desactivar, navegar fuera y volver. Pendiente de UI | Estado persistente y politica B07 |
| D06 | `Clientes.jsx:375` | Crear direccion y rechazar cliente. Pendiente de integracion | Operacion consistente sin direccion abandonada |
| D07 | `ventas/api/serializers.py:5` | Enviar total que no coincide con lineas. Pendiente de integracion | Servidor calcula total segun B03 |
| D08 | `Ventas.jsx:148`, `Compras.jsx:180` | Fijar 18:30 en Managua; comparar fecha comercial y UTC. Pendiente de UI | Fecha comercial acordada para Nicaragua |
| D09 | `Productos.jsx:321`, `Dashboard.jsx:91` | Existencia cero cambia conteo de bajo stock. Pendiente de UI | Agotado/bajo stock segun B14 |
| D10 | `compras/models.py:19`, `proveedores/models.py:31` | Cambiar precio proveedor despues de compra. Pendiente de copia de datos | Coste historico preservado, sin inventar el anterior |
| D11 | `ventas/api/views.py:9`, `compras/api/views.py:9` | Dos ventas de ultima unidad; fallo de compra a mitad. Pendiente de PostgreSQL | No stock negativo ni movimientos duplicados |
| D12 | `settings.py`, ViewSets sin permisos | Peticiones anonimas y de distintos roles en entorno aislado futuro | Acceso restringido con politica B09 |

La ausencia de transacciones e inventario en el codigo no demuestra que no haya
triggers SQL Server. Verificarlos antes de replicar movimientos o sumar existencias.
No ejecutar estas reproducciones contra una base operativa.

## Resultados historicos de fase 1

| Verificacion | Resultado registrado |
| --- | --- |
| Estaticas Python | 3 pruebas aprobadas, con subcasos para 17 recursos |
| Servicios Node | 41 pruebas aprobadas; 0 fallos y 0 omitidas |
| Suite Django | No ejecutada: faltan Django y DRF; preflight informa impedimento |
| SQL Server/PostgreSQL, UI y E2E | No ejecutados |

No presentar las 44 pruebas aprobadas como 44 pruebas de endpoints reales. Los
resultados corresponden exclusivamente a declaraciones y servicios con mocks.

## Verificacion de fase 3

| Verificacion | Resultado |
| --- | --- |
| Pytest integrado | 16 pruebas aprobadas: 12 de FastAPI/configuracion, 3 estaticas y 1 ejecutor Django |
| Suite interna Django, ejecutada tambien por separado | 8 casos: 7 aprobados y D03 como fallo esperado; subcasos sobre los 17 recursos |
| Base nueva | 100% de cobertura de app (36 sentencias); no mide Django, frontend ni negocio |
| Ruff y formato | Aprobados para app y pruebas; no se reformateo la aplicacion Django |
| mypy | app verificada en modo estricto |
| uv | Sincronizacion bloqueada y lock actualizado verificados; resolucion solo runtime comprobada con dry-run |
| Arranque HTTP | Uvicorn temporal: live, ready y OpenAPI respondieron 200; proceso detenido |
| SQL Server/PostgreSQL, UI y E2E | No ejecutados |

El ejecutor Django cuenta como una prueba de Pytest; no sumar sus ocho casos como
si fueran ocho items adicionales de la coleccion. La cobertura de salud/configuracion
no certifica compras, ventas, concurrencia ni datos. En fase 3 los endpoints de
salud declaraban scope=process y no abrian conexiones de base.

## Verificacion de fase 4

Ejecucion local del 28 de octubre de 2026, rama Cris-develop. Docker Desktop
4.92.0, motor Linux amd64 29.8.0 y Compose 5.5.1. Los comandos reproducibles y
sus requisitos estan en [docker.md](docker.md).

| Verificacion | Resultado ejecutado |
| --- | --- |
| Compose | Base runtime y superposicion development validan; puertos publicados solo en 127.0.0.1 |
| Construccion | Ambas imagenes construidas con Python 3.13.15, uv 0.12.10 y uv.lock; reconstruccion aprovecha cache |
| Aislamiento runtime | UID 10001; sin uv, Django, Pytest, Ruff, mypy, tests ni fuentes Django; HTTP funciona con filesystem de solo lectura |
| API runtime sin base | ready 200/process y /docs 404; contenedor temporal retirado |
| API/PostgreSQL reales | Ambos servicios saludables; PostgreSQL 17.10; ready 200/database; Swagger 200 en desarrollo y 404 en runtime |
| Cuenta de aplicacion | Conexion real; rolsuper, rolcreatedb, rolcreaterole y rolreplication falsos |
| Fallo de autenticacion PostgreSQL | Contenedor temporal con clave sintetica invalida: live 200, ready 503/unavailable; API principal saludable |
| Persistencia | Marca sintetica conservada al recrear db/backend para pasar de runtime a development con el mismo volumen |
| Respaldo/restauracion | pg_dump custom, copia binaria al equipo y pg_restore en una base local nueva; marca restaurada e igual al origen sintetico |
| Limpieza de sondas | Tabla y base de ensayo retiradas; public sin tablas de negocio; volumen de desarrollo conservado |
| Pytest en Linux | 28 aprobadas en imagen development y en el servicio Compose con configuracion real; fixtures no consultan esa base |
| Cobertura | 100% de app: 78 sentencias y 10 ramas; no mide Django, frontend, persistencia de negocio ni migracion |
| Caracterizacion Django | Ejecutor integrado y tambien separado: 8 casos, 7 aprobados y D03 como fallo esperado; motor dummy |
| Calidad en contenedor | Ruff, formato y mypy estricto aprobados; lock sin cambios |
| Configuracion local | Generador crea claves sin imprimirlas; segunda ejecucion conserva el archivo; .env.docker y backups ignorados |

La ejecucion nativa Windows de Pytest no pudo completar la coleccion: Control de
aplicaciones bloqueo una DLL de SQLAlchemy. Lint, formato, mypy y lock se
verificaron tambien en el host. No se cambio la politica de Windows; las pruebas
completas y el arranque PostgreSQL se verificaron en Linux mediante Docker.

La revision automatica rechazo la prueba que detenia db con el motivo
`blocked by policy`, sin mas detalle. No se ejecuto esa detencion; se comprobo
el fallo real con credenciales sinteticas invalidas en un contenedor aislado.
No se afirma haber ensayado caida/reconexion del mismo proceso de API.

Los servicios de desarrollo quedaron activos: API 127.0.0.1:8001 y PostgreSQL
127.0.0.1:5433. El respaldo local backups/phase-four-synthetic.dump solo contiene
la sonda sintetica y esta excluido de Git. No se consulto SQL Server, trasladaron
historicos ni crearon modelos/migraciones Alembic. Frontend, UI/E2E y concurrencia
de negocio no se verificaron nuevamente en esta fase.

## Verificacion de fase 5

Ejecucion local del 28 de octubre de 2026 en Cris-develop. El usuario confirmo
preservar la estructura inicial ambigua; B01-B14 no se dan por resueltas.

| Verificacion | Resultado ejecutado |
| --- | --- |
| Modelos y registro | 17 modelos tipados en siete funcionalidades, metadata comun, nombres ingleses y session factory |
| Primera revision | 0001_compatibility generada contra PostgreSQL temporal vacio y revisada; DDL explicito, 17 PK Identity, 21 FK RESTRICT e indices de referencia |
| Suite completa Linux/PostgreSQL | 38 aprobadas, 0 omitidas, mediante compose.test.yaml independiente con proyecto hdboutique-test |
| Alembic real | Upgrade desde base vacia, downgrade a base y nuevo upgrade; check sin diferencias antes/despues en PostgreSQL temporal |
| Roundtrip | Datos sinteticos en las 17 tablas; Decimal, centavos, fechas, nulos y existencias 12/3 independientes preservados |
| Rango de precio legacy | sale_items.unit_price preserva ambos extremos INTEGER firmado como Decimal con escala 2 |
| Integridad referencial | FK rechaza direccion huérfana y borrado de departamento referenciado; savepoints permiten seguir validando |
| Sesiones/transacciones | Commit visible desde otra conexion; excepcion despues de flush revierte toda la unidad; registro de prueba retirado |
| Identidades | PK explicita preservada y nueva identidad generada; no equivale a haber ensayado el realineado ETL de secuencias |
| Suite sin PostgreSQL | 31 aprobadas y 7 omitidas intencionalmente sin --run-postgres; el SQL offline si se ejecuta |
| Django | Ejecutor aislado integrado aprobado; D03 legacy conserva expectedFailure, no se corrige Django por crear la columna decimal nueva |
| Cobertura app | 100% de 236 sentencias y 10 ramas; incluye declaraciones ORM, no mide todos los DDL ni reglas pendientes |
| Calidad | Ruff, formato, mypy estricto sobre 27 archivos app y uv lock --check aprobados; no se agregaron dependencias ni cambio uv.lock |
| Authoring Alembic | Plantilla y hooks Ruff verificados generando una revision en directorio temporal; no se agrego ese ensayo al historial |
| Imagen runtime | Construida; SQL offline de 17 tablas mas alembic_version funciona con filesystem de solo lectura; sigue sin uv/Django/pruebas/Ruff |
| Base de desarrollo | hdboutique de fase 4 verificada vacia, respaldada y migrada explicitamente; 17 tablas de negocio vacias y current --check-heads en 0001_compatibility |

El respaldo previo local backups/phase-five-before-schema.dump esta excluido de
Git. El proyecto de pruebas usa tmpfs, sin volumen persistente ni puertos; sus
contenedores/red se retiraron al finalizar. El proyecto de desarrollo conserva
su volumen y servicios saludables. No se borraron datos o volumenes de desarrollo.

Pytest nativo Windows no se reintento por el bloqueo de DLL SQLAlchemy ya observado
en fase 4; no se alteraron politicas del sistema. Las suites completas se ejecutaron
en Linux. Las comprobaciones de host usaron Ruff, formato, mypy y uv lock.

No se consulto ni migro SQL Server. No se probaron nuevamente frontend/UI/E2E,
concurrencia comercial, sesiones de usuario ni casos de uso atomicos de compras,
ventas o cobros: aun no estan implementados. No convertir este resultado de
persistencia estructural en aprobacion de B01-B14 ni de historicos existentes.
Comandos y limites en [migraciones](migration.md).

## Verificacion de fase 6

Ejecucion local del 28 de octubre de 2026 en Cris-develop. Se completaron las
herramientas y ensayos sinteticos. El usuario confirmo que no existe una instancia
o copia SQL Server ni historicos a trasladar; por eso el inventario y ensayo real
no aplican al cierre actual. No se conecto a SQL Server ni se usaron credenciales
o bases de desarrollo.

| Verificacion | Resultado ejecutado |
| --- | --- |
| Suite Linux completa | 60 aprobadas, 0 omitidas; 11 PostgreSQL reales en compose.test.yaml independiente |
| Traslado sintetico | 17 tablas cargadas y conciliadas por IDs/campos exactos, ambas existencias independientes, Decimal, fechas y nulos |
| Protecciones | Destino no vacio rechazado sin eliminar registros; conversion monetaria con perdida, PK duplicadas, huerfanos y campos ausentes rechazados |
| Rollback | Fallo despues de cargar y fallo tardio por identidad agotada revierten todas las filas y reinicios transaccionales; nuevo ensayo funciona |
| Secuencias | Tras preservar ID 101, PostgreSQL genera 102 |
| Extraccion | Catalogo/driver simulados verifican consultas SELECT, PK Ofrece explicita, readonly, rollback y cierre; no equivalen a SQL Server real |
| Respaldo/restauracion | Carga sintetica confirmada en hdboutique_test, pg_dump custom y pg_restore en hdboutique_restore_test; las 17 tablas concilian exactamente tras restauracion |
| Calidad | Ruff y formato: aprobados, 57 archivos; mypy estricto: 35 archivos app/data_migration aprobados; uv lock --check aprobado sin cambios de dependencias |
| Cobertura | app 100% de 236 sentencias y 10 ramas; no mide data_migration ni certifica datos historicos |
| Django | Caracterizacion integrada aprobada; D03 sigue como fallo esperado |
| Destino canonico | Servicio Compose `db`, puerto interno `5432`, base `hdboutique_test`, usuario sintetico `hdboutique_app`; conexion mediante HDB_MIGRATION_DATABASE_* comprobada |
| Aislamiento | Proyecto hdboutique-test sin puertos publicados ni volumen persistente; contenedores/red de pruebas retirados, desarrollo intacto |

Herramientas, matriz ejecutable, comandos y plan de ensayo/corte/retorno en
[data-transfer.md](data-transfer.md). El driver SQL Server, inventario fisico,
perfilado real, restauracion SQL Server y conciliacion historica no se ejecutaron
porque no existe un origen. Esto no certifica una base que aparezca posteriormente.
B01-B14 siguen pendientes; el corte y la retirada de Django permanecen en fase 15.
No se inicia fase 7.

## Criterio de mantenimiento

Al corregir un defecto, agregar su prueba real en la capa adecuada, actualizar
fixture/documentacion si cambia el contrato y registrar la incompatibilidad
intencionada. No volver todas las pruebas expectedFailure ni convertir todos los
defectos en snapshots inmutables. Migrar la cobertura util junto con cada modulo.
