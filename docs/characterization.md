# Pruebas de caracterizacion y regresion

## Fase 16: verificación final (2 de noviembre de 2026)

Implementación y migración local de B15–B21: empleados con teléfono canónico y
contraseña asignada por Dueña, maestros protegidos, combobox dependientes,
directorios de consulta y altas contextuales atómicas, tallas fijas, costos por
proveedor, recibos decimales y retirada operativa de caja/turnos.

Código verificado: backend `3b376ae` y frontend `dc4b1e4`.

| Grupo | Resultado ejecutado |
| --- | --- |
| Backend Python 3.13.15/Linux | 290 aprobadas, cero omitidas, --run-postgres, 238.84 s |
| Cobertura app | 92.99%, umbral 90% |
| Ruff / formato / mypy / lock | Aprobados; 166 archivos con formato y 107 fuentes tipadas |
| Frontend | TypeScript estricto, ESLint y build Vite aprobados |
| Vitest | 94 aprobadas en 12 archivos |
| E2E interceptadas | 22 aprobadas, escritorio/móvil, 46.4 s |
| E2E conectadas | 9 aprobadas con Nginx/FastAPI/PostgreSQL, 1.5 min |
| Restauración sintética | 32 tablas, hashes exactos, identidades y head mediante tests.rehearse_stabilization |
| Revisión visual | 61 capturas y tres renders PDF inspeccionados; quince rutas en dos tamaños |
| Migración local | 0006→0007→0008→0009, sin drift; 32 tablas más alembic_version |
| Respaldo | Previo/final restaurados en bases separadas y conciliados exactamente |
| Runtime | Web 8080, FastAPI 8001, PostgreSQL 5433 saludables, solo loopback |

Regresiones: teléfono inválido, edición/pegado/borrado, contraseña de seis caracteres,
mostrar/ocultar y limpieza; rechazo de cambio propio por Cashier y revocación por
Dueña; maestros protegidos, normalización y reutilización histórica; costos de varios
proveedores sin alterar precios ni compras anteriores; rollback de altas contextuales;
reutilización del cliente tras la primera venta; números de recibo; venta/anulación
sin turno, concurrencia y endpoints retirados; downgrade bloqueado cuando perdería
actividad y huellas idempotentes anteriores conservadas, incluido el cuerpo recuperado
por el frontend. Se conserva la regresión de operaciones inciertas tras recarga.

La ejecución unitaria inicial de 91 casos pasó, pero su cobertura parcial no alcanzó
el umbral global; no se usó como aprobación de integración. Las nuevas pruebas de
migración requirieron corregir fixtures y retirar Result.tuples() obsoleto; la tabla
registra la ejecución completa posterior aprobada, sin bajar el umbral ni omitir casos.

La carga local añadió solo 1 departamento, 25 municipios y 4 tallas: reutilizó las
coincidencias existentes para completar 3 departamentos/28 municipios/5 tallas
permanentes. Una cuenta se liberó de must_change_password con auditoría y hash intacto.
No se insertó comercio sintético ni se modificó credencial alguna en desarrollo.
Humo local: diez rutas SPA, salud web/API, anónimos 401 y caja 404. El propietario
realiza la comprobación de login/logout con su contraseña vigente; no se leyó ni
usó la credencial inicial histórica. [Corte y evidencias](cutover.md).

PDF mixto/anulado: una página, 226.772 pt de ancho; impresión Chromium 227.04 pt.
Poppler avisó de fuentes de sustitución sin glifos perdidos en los renders.
Sin prueba de impresora física ni despliegue público. [Revisión visual](visual-reconstruction.md).

Los resultados siguientes son hitos históricos anteriores a Fase 16.

## Reconstrucción boutique: verificación final (2 de noviembre de 2026)

El incremento autorizado el 31 de octubre incorpora dos perfiles, navegación
contextual, clientes regular/delivery/general, pago mixto, precio costo × 1.15,
existencia inicial auditada, activación y empleado/cuenta atómicos, perfil/logo,
ticket PDF de 80 mm y anulación supervisada. Conserva transacciones e idempotencia.

Ejecución final sobre el código de ac0277e:

| Grupo | Resultado ejecutado |
| --- | --- |
| Backend Linux/Python 3.13.15 | 273 aprobadas, 0 omitidas, --run-postgres, 291.24 s |
| Cobertura app | 94.68%, umbral 90% |
| Ruff / formato | Aprobados; 161 archivos formateados |
| mypy / bloqueo | 108 archivos sin errores; uv lock --check aprobado |
| Frontend Node 24 | TypeScript, ESLint y build aprobados |
| Vitest | 91 pruebas, 11 archivos, aprobadas |
| E2E con API interceptada | 20 aprobadas, escritorio/móvil, 30.2 s |
| E2E conectadas reales | 9 aprobadas, Nginx/FastAPI/PostgreSQL, 1.5 min |
| Restauración sintética | 32 tablas con operaciones, hashes exactos, identidades y head conciliados con tests.rehearse_stabilization |
| Revisión visual | 26 referencias, 63 capturas conectadas y tres renders PDF inspeccionados |
| Desarrollo local | Diez rutas SPA HTTP 200, readiness 200; tres servicios saludables |
| Datos locales | 0005→0006, sin drift; respaldo final restaurado y 33 tablas con Alembic conciliadas exactamente |

La suite PostgreSQL verifica dinero inválido, autorización, CSRF, revocación,
retiro de Manager, upgrade/downgrade seguro, conservación de historia,
idempotencia, fallo parcial y concurrencia de venta/recepción/caja. No usa la base
de desarrollo. Detalle de respaldo y excepciones de autenticación en [corte](cutover.md).

Las nueve conectadas cubren perfil/logo persistido, producto y movimiento inicial,
precio de 15%, ingresos/retiros y cierre/apertura visibles, tres medios de pago,
tres tipos de cliente y alta inline, cambio, stock, PDF, compra/recepción única,
anulación mixta sin devolución de mercancía, permisos propios/globales,
identidad general estable, activación/desactivación/reactivación y operaciones
bloqueadas, personal/cuenta, cambio temporal y revocación. Cada ruta principal
tiene capturas escritorio y móvil; [comparación y límites](visual-reconstruction.md).
Todas las escrituras sintéticas quedaron exclusivamente en hdboutique-test/tmpfs.

No se repitió auditoría de vulnerabilidades de dependencias ni prueba de carga:
los resultados históricos de esas auditorías no se presentan como actuales.
La impresión se verificó por Chromium/PDF, no con equipo físico.

Los apartados siguientes conservan resultados históricos de entregas anteriores.

## Configuracion inicial y cierre funcional de v1 (29 de octubre de 2026)

[Configuracion inicial](initial-setup.md) completa las pantallas solicitadas:
preparacion con referencias faltantes, catalogos/ubicaciones/costes/ofertas y
cuentas con permisos existentes. Diez pantallas TS/FastAPI. No cambia backend,
esquema, dependencias ni datos comerciales de desarrollo.

Verificacion ejecutada sobre imagenes reconstruidas:

- Node 24: TypeScript, ESLint sin avisos, 84 Vitest y build aprobados.
- 110 E2E Chromium aprobadas en escritorio y movil (26 de Configuracion).
  Incluyen alta/edicion de los siete catalogos, null, paginacion/recarga,
  errores de preparacion, permisos, vinculo exclusivo y desactivacion de cuentas,
  ultimo Administrator y retirada de acceso al modificar la cuenta actual.
- Ocho E2E conectadas Nginx/FastAPI/PostgreSQL aprobadas en proyecto aislado
  hdboutique-test, con base tmpfs desde vacio y semilla sintetica existente.
  El nuevo recorrido prepara departamento/direccion/categoria/talla/tipo,
  empleado/cuenta, cambia su contrasena, producto/proveedor/costo/oferta/cliente,
  registra y recibe compra, abre caja con la nueva cuenta y vende por C$99.50.
  Verifica stock final 1 tras recibir 2 y vender 1.
- Se corrigio una notificacion de sesion que desmontaba la pantalla del actor
  al guardar otra cuenta; la regresion valida que la confirmacion se conserve.
  Cambiar la cuenta propia revalida sesion y notifica a las otras pestanas.
- Capturas de preparacion, direcciones y cuentas revisadas en escritorio/movil.
  Entorno local actualizado: /settings y /settings?section=accounts responden 200,
  /api/v1/users sin sesion 401 y live/ready 200. Solo actualizacion de web;
  backend y volumen de desarrollo conservados, sin migraciones ni bootstrap.
- Backend sin cambios: la suite de 255 y su cobertura de Empleados son el hito
  anterior, no se repitieron en este incremento. Las ocho pruebas conectadas
  verifican persistencia y permisos reales de los flujos usados por la interfaz.

Alcance funcional de la v1 local cerrado. Los datos reales se preparan por el
propietario desde la interfaz. No se declara despliegue publico ni se amplian
los alcances excluidos. Enlaces locales y diff revisados; commits solo locales.

## Incremento Empleados (29 de octubre de 2026)

API y pantalla /employees, selector minimo integrado en compras/recepcion,
ventas y apertura de caja. Contrato y reglas confirmadas: [Empleados](employees.md).

Verificacion ejecutada:

- Backend Linux/Python 3.13.15: 255 pruebas con --run-postgres aprobadas en
  hdboutique-test/compose.test.yaml (base tmpfs vacia); cobertura 97.60%.
  Incluye permisos, privacidad, CSRF, referencias, null/omision y vinculo exclusivo
  cuenta/empleado. Ruff, formato (146 archivos), mypy (96) y uv lock --check aprobados.
- Frontend en imagen Node 24: tipos, ESLint sin avisos y build aprobados;
  80 Vitest aprobados. 80 E2E previas aprobadas; cuatro nuevas de Empleados
  aprobadas en escritorio/movil. Tras corregir la simulacion CSRF de Cashier,
  repeticion focal Empleados/transacciones: 12 aprobadas. Capturas revisadas.
- Siete pruebas conectadas Nginx/FastAPI/PostgreSQL aprobadas, incluida persistencia
  y privacidad de Empleados y selector de compras. Se actualizo el selector de
  la prueba de venta para usar combobox en lugar del antiguo ID escrito.
- Aplicacion local actualizada sin migraciones ni cargas comerciales; salud
  live/ready y /employees responden 200, API de empleados/selector sin sesion 401.
  Volumen y archivo privado conservados. No se leyeron credenciales ni expedientes
  reales. Sin nuevas dependencias; head 0005 y 30 tablas se conservan.
- Enlaces locales de documentos modificados y diff revisados. Commits locales
  de implementacion: 46fb956 (backend), 981ebe6 (frontend). Sin remoto/push.

Configuracion inicial y su pantalla de cuentas/catalogos siguen pendientes.

## Verificacion de fase 15

El 29 de octubre de 2026 se ejecuto el [corte local autorizado](cutover.md): base
hdboutique de 0001 a head 0004, sin origen/historicos SQL Server ni carga comercial.
Respaldo previo/final restaurados en bases separadas y conciliados por filas,
columnas, conteos, hashes e identidades; siete rutas/login/logout/lecturas reales
aprobados sin escrituras comerciales. Primer Administrator creado expresamente.

221 pruebas backend con --run-postgres aprobadas, cobertura app 97.62%; Ruff,
formato (130 archivos), mypy (86), uv lock --check aprobados. Frontend tipos/lint,
77 Vitest/componentes, build y 80 E2E Chromium escritorio/movil aprobados. Cinco
E2E conectadas contra la imagen Nginx real/FastAPI/PostgreSQL aprobadas: ventas,
recepciones, permisos, sesion entre pestanas, recarga SPA y rechazo de endpoints
retirados. Las escrituras de esas pruebas permanecen en hdboutique-test/tmpfs.

Se retiraron cuatro pruebas Pytest de caracterizacion Django y 41 pruebas Node
de sus adaptadores junto con el codigo sin consumidores; se agregaron tres
regresiones de snapshots/destinos y un rechazo de ruta legacy en cliente HTTP.
No se declara que D03 haya sido corregido en Django: ya no se distribuye ese backend.
Un primer ensayo detecto un error de preparacion en la prueba nueva de snapshots;
se corrigio usando datos sinteticos confirmados y se repitio la suite completa.
Las E2E Nginx usan relay TCP para conservar el origen loopback del entorno real,
sin desactivar seguridad del navegador. Runtime y development sin Django/DRF/ODBC
comprobados mediante imports; revisiones y datos comerciales se conservan intactos.

No hubo push ni acceso al remoto. Los resultados de fases anteriores siguientes
son historicos; comandos vigentes en [desarrollo](development.md).

## Verificacion de fase 14

El 29 de octubre de 2026 se retomo y cerro la estabilizacion del alcance disponible.
Informe, comandos y riesgos residuales en [stabilization.md](stabilization.md).
222 pruebas backend con `--run-postgres`, cobertura app 98.38%; 76 Vitest/componentes,
41 legacy, 80 E2E con API interceptada y cuatro E2E conectadas aprobadas. Tipos,
lint, formato, mypy, build y lock verificados. Se repitieron 16 E2E de URL/recarga
tras ampliar capturas; Ventas/Compras/Proveedores escritorio/movil inspeccionados.

Se verifico restauracion de 24 tablas con operaciones y volumen sinteticos,
campos/hashes, identidades y head 0004; ensayo ETL separado de 17 tablas tambien
restaurado/conciliado. Auditorias Python/npm sin vulnerabilidades conocidas,
Gitleaks redactado sobre historial/cambios preparados, runtime sin Django/dev.
No se certifican capacidad productiva, datos SQL Server, corte ni funciones
excluidas. Los resultados por fase que siguen conservan su contexto historico.

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

## Verificacion de fase 7: incrementos solicitados

28 de octubre de 2026, Cris-develop. Ubicaciones/catalogo y clientes/proveedores
implementados; empleados fuera del incremento solicitado.

| Comprobacion | Resultado real |
| --- | --- |
| Suite completa Linux | 86 aprobadas, 92 subtests aprobados, 0 omitidas; incluye 34 PostgreSQL |
| HTTP/Persistencia | Once recursos: alta, listado estable y limites, detalle, PUT, PATCH, borrado, ausencia, FK invalidas, null y campos desconocidos |
| Integridad | Borrados referenciados devuelven 409 con rollback; commit de servicio visible desde otra conexion |
| Contrato | Dinero 199.50 sin float, stock 12/3 independiente, PATCH preserva omitidos, PUT restablece opcionales, direccion incompatible rechazada |
| Seguridad de exposicion | Opt-in de desarrollo/pruebas, bloqueo de habilitacion production, errores sin SQL ni valores sensibles |
| Cobertura app | 98.49%, 1305 sentencias y 152 ramas; no certifica reglas comerciales pendientes ni frontend |
| Calidad Windows | Ruff check aprobado; formato: 67 archivos; mypy estricto: 54 archivos app/data_migration; uv lock --check aprobado |
| Legacy | Caracterizacion Django integrada aprobada; D03 permanece fallo esperado |

Se uso exclusivamente compose.test.yaml, proyecto hdboutique-test, base tmpfs vacia
db:5432/hdboutique_test, usuario sintetico hdboutique_app, sin puertos publicados.
Las fuentes app/ y tests/ actuales se montaron de solo lectura en la imagen
development para verificar exactamente el cambio local. No se consultaron bases
de desarrollo ni SQL Server; sin migraciones nuevas o cambios de dependencias.
La suite creo el esquema con Alembic y tambien verifico ausencia de drift.

Comandos de reproduccion desde la raiz, con el proyecto de pruebas detenido y
su tmpfs vacio:

```powershell
docker compose -p hdboutique-test -f compose.test.yaml build backend
docker compose -p hdboutique-test -f compose.test.yaml up -d --wait db
docker compose -p hdboutique-test -f compose.test.yaml run --rm backend uv run --locked python -m pytest --run-postgres --cov=app --cov-report=term-missing -q
docker compose -p hdboutique-test -f compose.test.yaml down
```

El usuario confirmo el contrato inicial de compatibilidad para estas escrituras.
Limites, habilitacion y campos en [API fundamental](foundation-api.md). No se
habilitaron rutas en la configuracion existente ni se implementaron permisos de
fase 8, activacion, movimientos, saldos o pantallas nuevas.

## Verificacion de fase 8: identidad y permisos

28 de octubre de 2026. B09 confirmado expresamente por el usuario: tres roles,
permisos de gestion y vinculo cuenta/empleado opcional y exclusivo.

| Comprobacion | Resultado real |
| --- | --- |
| Suite Linux completa | 114 aprobadas, 92 subtests aprobados, 0 omitidas; 54 PostgreSQL |
| Autenticacion | Login real con Argon2id, errores genericos, hash renovado al cambiar parametros, logout y rechazo de tokens revocados/falsificados |
| CSRF | Proteccion en login y escrituras, origen exacto, rechazo cross-site, token ligado a sesion y rotacion tras login |
| Permisos | Matriz de los 3 roles por cada uno de los 11 recursos y operaciones; gestion de cuentas exclusiva de Administrator; solicitudes anonimas rechazadas |
| Persistencia/seguridad | Solo digests de tokens; contraseñas saladas; espacios conservados en altas y cambios de contraseña; cookies HttpOnly/Secure/SameSite; no-store |
| Ciclo de vida | Expiracion absoluta e inactividad en servidor; revocacion al cambiar rol, contraseña, vinculo o estado; limpieza explicita de vencidas |
| Intentos de login | Limite persistente en PostgreSQL para usuario e IP; rechazo 429 y restablecimiento de ventana sin sleeps |
| Cuentas | Bootstrap explicito verificado, sin administrador por defecto, usuario/empleado unicos, FK y ultimo administrador protegido; dos degradaciones concurrentes dejan un activo |
| Migraciones | Alembic vacio -> head, downgrade/upgrade y check sin drift; 0001 con datos -> 0002 conserva datos comerciales; identidad inicial vacia |
| ETL | Mantiene 17 tablas mapeadas; head actual exige 20 tablas vacias; rechaza destino con cuentas sin insertar negocio |
| Produccion | Rutas protegidas con HTTPS/Secure configurados, docs ocultas, configuraciones inseguras rechazadas |
| Calidad Windows | Ruff check/formato aprobados (90 archivos), mypy estricto aprobado (63 archivos), uv lock --check aprobado |
| Cobertura app | 98.16%, 1725 sentencias y 230 ramas; no mide frontend ni aprueba reglas comerciales pendientes |

Se uso exclusivamente compose.test.yaml, proyecto hdboutique-test, con base tmpfs
vacia hdboutique_test, claves sinteticas y sin puertos. Fuentes finales app/,
tests/, migrations/ y data_migration/ montadas de solo lectura para comprobar el
cambio local exacto. Imagen development reconstruida con el bloqueo actualizado.
La suite Django integrada conserva D03 como fallo esperado.

Reproduccion desde raiz sobre el entorno de pruebas vacio:

```powershell
docker compose -p hdboutique-test -f compose.test.yaml build backend
docker compose -p hdboutique-test -f compose.test.yaml up -d --wait db
docker compose -p hdboutique-test -f compose.test.yaml run --rm backend uv run --locked python -m pytest --run-postgres --cov=app --cov-report=term-missing -q
docker compose -p hdboutique-test -f compose.test.yaml down
```

La revision 0002_identity no se aplico en desarrollo ni en bases reales. No se
crearon cuentas operativas, se cambiaron secretos ni se habilitaron rutas en los
.env/Compose existentes. React permanece con Django; empleados sigue pendiente
de su incremento de fase 7. [Contrato y operacion](authentication.md).

## Verificacion de fase 9: compras e inventario

28 de octubre de 2026, reglas B01/B02/B05 y alcance de compras B03 confirmados
expresamente por el usuario. Contrato en [compras e inventario](purchases-inventory.md).

| Comprobacion | Resultado real |
| --- | --- |
| Suite completa en imagen development final | 152 aprobadas, 92 subtests aprobados, 0 omitidas; incluye 85 PostgreSQL |
| Registro | Cabecera, lineas, coste/producto historicos y autoria atomicos; no suma existencias |
| Recepcion | Completa registered -> received, movimientos antes/despues y aumento disponible; cantidadstock legado se conserva |
| Reintentos | Registro por cuenta/clave con mismo cuerpo devuelve misma compra; otro cuerpo 409; recepcion repetida no duplica |
| Concurrencia real | Dos registros con una clave crean una compra; cuerpo distinto produce un conflicto; segunda recepcion espera el bloqueo y no suma otra vez |
| Productos compartidos | Dos recepciones de compras distintas con orden inverso de lineas conservan todas las unidades y sus movimientos |
| Rollback | Fallos despues de flush de costes/movimientos revierten toda la unidad; stock nulo, negativo o desbordado en una linea revierte tambien las anteriores |
| Fidelidad D10 en FastAPI | Cambiar precio y product_id del producto del proveedor no cambia los snapshots ni el producto que recibe stock |
| Dinero | Decimal/NIO/dos decimales, envio separado sin prorrateo; rechaza float y redondeo implicito; entero y texto decimal tienen representacion e idempotencia estables |
| Proteccion | Administrator/Manager permitidos; Cashier/anonimo denegados; CSRF y empleado requerido/vinculado verificados; stocks no editables en CRUD |
| DDL y conservacion | Vacio/downgrade/upgrade/check sin drift; upgrade desde 0002 con las 17 tablas sinteticas conserva stock 12/3 y null; no fabrica costes, estados o movimientos |
| Integridad | Una entrada por linea, delta de stock, cantidades, costes y referencias protegidos; compra incompleta no se recibe |
| Legacy/ETL | Lectura de historicos sin snapshots con costes/estado desconocidos; recepcion bloqueada; matriz de 17 tablas conservada y destino head de 23 tablas vacias |
| Calidad Windows | Ruff/formato: 106 archivos aprobados; mypy estricto: 74 archivos app/data_migration; uv lock --check aprobado, sin dependencias nuevas |
| Cobertura app | 98.21%, 2074 sentencias y 278 ramas; no certifica frontend ni reglas de venta pendientes |

Se verifico la imagen reconstruida sin montajes que sustituyan sus fuentes. Se uso
solo compose.test.yaml, proyecto hdboutique-test, PostgreSQL tmpfs db:5432/
hdboutique_test y claves sinteticas, sin puerto publicado. Los casos concurrentes
emplean conexiones independientes con datos sinteticos confirmados y limpieza
limitada a sus IDs. No se usaron SQLite ni mocks para simular los bloqueos.
La caracterizacion Django integrada conserva D03 como fallo esperado.

Comandos desde raiz, con el entorno de pruebas vacio:

```powershell
docker compose -p hdboutique-test -f compose.test.yaml build backend
docker compose -p hdboutique-test -f compose.test.yaml up -d --wait db
docker compose -p hdboutique-test -f compose.test.yaml run --rm backend uv run --locked python -m pytest --run-postgres --cov=app --cov-report=term-missing -q
docker compose -p hdboutique-test -f compose.test.yaml down
```

La revision 0003_purchase_receipts no se aplico a desarrollo ni datos reales.
No se crearon compras operativas, se consulto SQL Server, cambiaron secretos ni
habilitaron rutas en la configuracion local. Las regresiones D01/D10 y compras
de D11 corresponden al nuevo flujo FastAPI: Django y el frontend permanecen
pendientes de sustitucion y no se declaran corregidos. Ventas/ultima unidad,
ajustes, anulaciones y UI siguen fuera de esta fase.

## Verificacion de fase 10: ventas atomicas

28 de octubre de 2026, B03 de ventas, B04 y extension B09 confirmados expresamente
por el usuario. Contrato y limites en [ventas](sales.md).

| Comprobacion | Resultado real |
| --- | --- |
| Suite completa en imagen development final | 200 aprobadas y 92 subtests aprobados, 0 omitidas; incluye 119 PostgreSQL |
| Venta integral D02 | Cabecera, lineas, precio historico, total, salida y auditoria se confirman en una transaccion |
| Dinero exacto D03 | 199.50 por dos unidades produce 399.00; precio/total de servidor y salida decimal textual; probado 0.01 y limite 99999999.99 |
| Rechazos | Cantidades no enteras/no positivas/fuera de rango, productos repetidos, precio/total/descuento impuesto, referencias invalidas, precio null/no positivo y total desbordado no dejan filas ni efectos |
| Existencias | Stock null/negativo exige conteo; insuficiente devuelve 409; cantidadstock permanece inmutable |
| Idempotencia | Misma cuenta/clave/cuerpo devuelve la misma venta incluso con precio de catalogo cambiado; cuerpo u orden distinto 409; otra cuenta o compra tiene alcance separado |
| Rollback | Fallo tras el segundo movimiento o tras workflow revierte cabecera, lineas, stock, movimientos y clave; IntegrityError se traduce a 409; reintento posterior funciona |
| Concurrencia D11 | Dos ventas de ultima unidad producen un exito y un 409, stock final cero y una salida; misma clave no duplica, distinta carga entra en conflicto |
| Bloqueos compartidos | Ventas con productos compartidos y orden inverso no pierden actualizaciones; una venta espera la recepcion y conserva sus entradas/salidas |
| Precio concurrente | La venta espera un cambio de precio bloqueado y copia el precio confirmado, sin usar el consultado antes |
| Permisos/autoria | Los tres roles registran/consultan; empleado vinculado o explicito existente; cuenta auditada. Anonimo/CSRF/origen invalido denegados; inventario general sigue denegado a Cashier |
| Inmutabilidad B04 | Sin PUT/PATCH/DELETE ni escrituras de lineas separadas; no se implementan anulaciones, devoluciones o cobros |
| Historicos | Lectura conserva precio y total guardados; sin autoria/estado/instante inferidos ni movimientos de apertura |
| Migraciones/integridad | 0004_atomic_sales, 24 tablas: vacio/downgrade/upgrade/check sin drift; entradas de 0003 conservadas; downgrade con salidas rechazado, duplicados/deltas/origen invalidos rechazados |
| ETL | Matriz de 17 tablas conservada y destino head con 24 tablas vacias; suite de traslado sintetico aprobada |
| Calidad en imagen final | Ruff aprobado; formato 117 archivos; mypy estricto 79 archivos app/data_migration; uv lock --check aprobado, sin dependencias nuevas |
| Cobertura app | 98.30%, 2280 sentencias y 312 ramas; no certifica frontend, datos reales ni reglas pendientes |

La imagen development se reconstruyo y la suite final se ejecuto sin montajes
que sustituyan sus fuentes. Entorno exclusivo compose.test.yaml, proyecto
hdboutique-test, PostgreSQL tmpfs db:5432/hdboutique_test, credenciales sinteticas,
sin puertos ni acceso a datos de desarrollo. Las carreras usan sesiones/conexiones
independientes y datos sinteticos confirmados, con limpieza limitada a sus IDs.
La caracterizacion Django integrada mantiene D03 como fallo esperado: las
correcciones D02/D03/D11 son del flujo FastAPI, no del backend/frontend legacy.

Comandos finales desde raiz, partiendo del entorno de pruebas vacio:

```powershell
docker compose -p hdboutique-test -f compose.test.yaml build backend
docker compose -p hdboutique-test -f compose.test.yaml run --rm backend uv run --locked python -m pytest --run-postgres --cov=app --cov-report=term-missing -q
docker compose -p hdboutique-test -f compose.test.yaml run --rm --no-deps backend uv run --locked ruff check .
docker compose -p hdboutique-test -f compose.test.yaml run --rm --no-deps backend uv run --locked ruff format --check .
docker compose -p hdboutique-test -f compose.test.yaml run --rm --no-deps backend uv run --locked mypy
docker compose -p hdboutique-test -f compose.test.yaml run --rm --no-deps backend uv lock --check
docker compose -p hdboutique-test -f compose.test.yaml down
```

No se aplico 0004_atomic_sales a desarrollo ni se registraron ventas operativas.
No se consulto SQL Server, cambiaron secretos, habilitaron rutas locales ni
migraron pantallas. Correcciones, devoluciones, cobros/deuda/caja y frontend
quedan fuera del alcance confirmado. No se inicia fase 11.

## Verificacion de fase 11: base frontend

28 de octubre de 2026. React/Vite conservados; base TypeScript estricta con
allowJs para vistas/adaptadores legacy. [Contrato y limites](frontend-foundation.md).

| Comprobacion | Resultado real |
| --- | --- |
| Entorno | Node 24.22.2, TypeScript 6.0.3, React 19.2.5, Router 7.18.5, Vite 8.3.5; dependencias npm ci bloqueadas |
| Tipos/lint/build | tsc estricto sin omitir tipos de librerias, ESLint TS/JSX y build Vite aprobados; vistas lazy separadas por pantalla |
| Vitest/Testing Library | 40 aprobadas: cliente HTTP, sesion, rutas, errores de servidor, campos accesibles, paginacion y componentes compartidos |
| Caracterizacion Node | 41 aprobadas: rutas/metodos/cuerpos/IDs/decimales/nulos/envoltorios legacy conservados; ahora lee errores del backend intencionadamente |
| Playwright | 30 aprobadas, 15 por perfil Chromium escritorio/movil, sobre dist y preview; 0 omitidas/reintentos |
| URLs | Las ocho pantallas abren directamente y recargan; navegacion, atras/adelante, enlace activo y pagina desconocida recuperable |
| Sesion | Cuenta de servidor en encabezado, StrictMode sin duplicar restauracion, CSRF/rotacion/logout 204, fallo de logout, 401/503, cuenta invalida y respuesta antigua tras login |
| HTTP | Un solo fetch; dinero textual/nulos preservados, 204, errores FastAPI/DRF/HTML/JSON invalido, AbortSignal, CSRF solo versionado, origen local y sin reintentos de escritura |
| Accesibilidad/responsive | Menu movil, foco al navegar, salto al contenido por teclado, errores enlazados, paginacion/busqueda; sin desbordamiento horizontal de pagina en las ocho rutas probadas |
| CSS | 483 selectores de pantallas comprobados dentro de scope; una tabla externa conserva su estilo tras cargar Productos; tablas internas desplazables |
| Revision visual | Cuatro capturas de Productos y Dashboard, escritorio/movil, inspeccionadas; ajustes de coherencia de etiqueta compartida y boton de menu verificados |
| Dependencias | npm audit --audit-level=low: 0 vulnerabilidades reportadas al verificar; no es garantia futura |

Verificacion final desde imagen reconstruida, sin montajes de codigo y como
usuario node. compose.frontend-test.yaml ejecuta con network_mode none, sin
puertos, volumenes de datos ni servicios backend. E2E intercepta /api con fixtures
sinteticos; no certifica login real ni persistencia. El contexto Docker excluye
secretos y usa solo frontend mas el fixture de contratos legacy. Capturas/trazas
en test-results estan ignoradas; no se agregan datos reales a Git.

Comandos desde raiz:

```powershell
docker compose -p hdboutique-frontend-test -f compose.frontend-test.yaml build frontend
docker compose -p hdboutique-frontend-test -f compose.frontend-test.yaml run --rm frontend
docker compose -p hdboutique-frontend-test -f compose.frontend-test.yaml down
```

El comando predeterminado npm run verify ejecuta tipos, lint, pruebas unitarias/
componentes, caracterizacion, build y E2E. npm audit se ejecuto con acceso al
registro npm, por separado; los recorridos del navegador corren sin red.

No se modifico backend, migraciones, base de desarrollo, secretos, cuentas ni
habilitacion de FastAPI. Las vistas JSX/JS y formularios conservan contratos y
limites Django (incluidos defectos comerciales pendientes); login visual, guardas
por modulo y migracion funcional quedan para fase 12. No se afirma cobertura
frontend porcentual ni se repite la suite backend por este cambio de base web.
No se inicia fase 12 automaticamente ni se publica el frontend.

## Verificacion de fase 12 por modulos

### Fase 12, primer incremento: Productos

28 de octubre de 2026. Productos migrado a TS/FastAPI con consulta, alta y edicion;
Cashier solo consulta. Precio decimal textual exacto, stocks separados de solo
lectura, nulos preservados, sin activacion simulada. [Contrato](frontend-modules.md).
Tipos, ESLint, 52 pruebas Vitest/componentes, 41 legacy, build y 40 E2E Chromium
escritorio/movil aprobados con npm run verify en Docker. E2E usa API interceptada;
no certifica persistencia ni autenticacion reales. Build/E2E repetidos desde
imagen reconstruida sin montajes para revisar el artefacto.

24 pruebas HTTP aprobadas contra PostgreSQL aislado: nuevo filtro q literal,
insensible a mayusculas, antes de paginar, mas workflows CRUD existentes. Ruff
y mypy (79 archivos) aprobados. Sin migraciones nuevas, habilitacion operativa
ni consultas a datos reales. Clientes se aborda solo despues de cerrar Productos;
resto de fase 12 pendiente.

### Fase 12, segundo incremento: Clientes

28 de octubre de 2026. Despues de cerrar Productos en ee9766e, Clientes migrado
a TS/FastAPI con alta, edicion y consulta para los tres roles. Direcciones
existentes seleccionadas por Administrator/Manager o indicadas por ID por Cashier,
sin consultas de ubicaciones de este ultimo. Telefono textual de hasta 10
caracteres; se conserva 0012345678. Sin activacion, municipio, deuda ni borrado.

Desde imagen reconstruida sin montajes: tipos, ESLint, 59 pruebas Vitest/componentes,
41 legacy, build y 56 E2E Chromium aprobados (28 escritorio y 28 movil), sin
omisiones ni reintentos. Incluyen alta/edicion y recarga con cada rol, validacion,
CSRF, doble envio, errores 422/409 sin reintento automatico ni perdida del borrador,
listas vacias, recuperacion de opciones fallidas, busqueda/paginacion y acceso
anonimo sin consultas de clientes. Capturas de Productos/Clientes en escritorio
y movil inspeccionadas, tablas desplazables sin desbordar la pagina.

E2E intercepta API sintetica; la recarga verifica su estado simulado, sin afirmar
conexion de navegador a PostgreSQL ni corte operativo. D04/D06 se evitan en el
nuevo formulario porque solo pide una direccion existente y nunca la crea;
D05 deja de simular activacion, sin resolver B07 definitivo. D01/D09 y acceso
D12 de los modulos legacy conservan sus limites fuera de este incremento.

Backend desde imagen development reconstruida sin montajes: 202 pruebas
aprobadas con --run-postgres y cobertura app 98.31% (umbral 90%). Incluye
PostgreSQL aislado migrado desde vacio, ambos filtros q, CRUD, permisos,
rollback, idempotencia y concurrencia de compras/ventas. Ruff, formato (119
archivos), mypy (79) y uv lock --check aprobados. Los dos nuevos casos de
busqueda verifican coincidencia literal, mayusculas, offset/limit global,
q vacio/sin resultados/excesivo; Clientes verifica nombre completo y telefono.

Sin nuevas migraciones (head 0004), cambios de dependencias, habilitacion de
rutas/cuentas ni lecturas/escrituras de datos reales. PostgreSQL usa solo
hdboutique-test/compose.test.yaml y tmpfs. La fase 12 queda parcial: estos dos
modulos terminados, los demas pendientes de solicitud. No se inicia fase 13.

## Verificacion de fase 13: dashboard y reportes

28 de octubre de 2026. Alcance solicitado terminado: dashboard/reportes;
caja excluida expresamente y pendiente B10 con [propuesta no aprobada](cash-register-proposal.md).
B14, fechas America/Managua y extension B09 confirmadas expresamente por el
usuario. [Contrato completo](reporting.md).

| Comprobacion | Resultado real |
| --- | --- |
| Backend | 214 aprobadas con --run-postgres y cobertura app 98.38%, desde imagen development reconstruida sin montajes |
| Nuevos casos PostgreSQL | 12: sumas exactas y globales sobre mas de 20 filas, pagina fuera de rango, filtros inclusivos, fechas invalidas/invertidas, stock null/-1/0/1/10/11, costes guardados y faltantes, tipos con nombres repetidos, tres roles y dos limites horarios UTC/Managua |
| Contratos/permisos | GET unicamente, deshabilitado por defecto, sin base 503, anonimo 401, Cashier compras 403; dashboard Cashier sin datos de compras/proveedores/costes |
| Calidad backend | Ruff, formato 125 archivos, mypy 84 y uv lock --check aprobados |
| Tipos/lint/frontend | tsc estricto, ESLint, 67 pruebas Vitest/componentes y 41 legacy aprobadas |
| Build y navegador | Build Vite y 72 E2E Chromium aprobados, 36 escritorio y 36 movil, sin omisiones/reintentos |
| Ajuste visual final | Tarjetas monetarias en una columna movil; imagen frontend reconstruida, build/tipos y 46 E2E afectados repetidos y aprobados |
| Revision visual | Capturas dashboard/reportes escritorio/movil inspeccionadas; importes legibles y tablas desplazables, sin desbordamiento de pagina |

Cada reporte obtiene resumen y pagina en una sentencia SQL, con snapshot comun;
los totales no dependen de la pagina mostrada. La suite completa conserva pruebas
de compras/ventas atomicas, idempotencia, rollback y concurrencia, migraciones,
identidad y compatibilidad. Django conserva D03 como fallo esperado.
D01/D09/D12 de dashboard/reportes se corrigen para este contrato, sin afirmar
corte de seguridad ni migracion de todas las pantallas legacy. La fecha de hoy
no usa new Date().toISOString() en el navegador: pruebas verifican 00:30 UTC
todavia dia anterior en Managua y 06:00 UTC como inicio del siguiente.

Imagenes de pruebas sin montajes para las verificaciones finales; PostgreSQL
exclusivamente hdboutique-test/compose.test.yaml desde vacio en tmpfs, datos
sinteticos. E2E frontend intercepta API: verifica navegador/contrato/recarga,
no conexion navegador-PostgreSQL ni despliegue operativo. Sin migraciones nuevas
(head 0004), cuentas, habilitacion, consultas o escrituras de datos reales.
tzdata 2026.2 pasa a runtime sin cambiar version; lock y exportacion legacy
regenerados con uv. No se implementan caja, pagos, deuda, exportaciones o graficos.
Fase 12 conserva otros modulos pendientes. No se inicia fase 14.

## Criterio de mantenimiento

Al corregir un defecto, agregar su prueba real en la capa adecuada, actualizar
fixture/documentacion si cambia el contrato y registrar la incompatibilidad
intencionada. No volver todas las pruebas expectedFailure ni convertir todos los
defectos en snapshots inmutables. Migrar la cobertura util junto con cada modulo.


## Mejoras integrales RF-01 a RF-18 (3 de noviembre de 2026)

[Contrato, matriz de 18 requisitos y comandos](integral-improvements.md).
324 pruebas backend/PostgreSQL aprobadas, 92.26 % de cobertura (184.31 s).
Ruff/formato de 174 archivos, mypy sobre 108 archivos y bloqueo uv aprobados.
Head de código 0012_optional_transfer_reference; Alembic check aislado sin drift.
Sin modificación de revisiones 0001–0010. Se conservan 32 tablas más Alembic.

Frontend: TypeScript, ESLint y build aprobados; 102 Vitest, 22 E2E de escritorio/móvil,
12 flujos conectados y una prueba focal conectada semanal/mensual aprobados.
69 capturas finales y 3 renders PDF inspeccionados, además de las 16 capturas Word.
Exportaciones API de 80 mm; impresión Chromium aproximadamente 80.1 mm.
Se conservó el diseño de recibos y la impresora física no fue probada.

Comercio sintético exclusivamente en hdboutique_test/tmpfs. Con autorización
expresa posterior se respaldó y restauró hdboutique en una base nueva, se ensayó
0010→0012 y se aplicó a desarrollo sin drift ni cambios de filas históricas.
33 tablas/PK y 27 secuencias coinciden en cada restauración. Vínculo de empleado #2
trasladado a administrador por indicación expresa: cuentas/roles/contraseñas
conservados, 7 sesiones revocadas y 2 eventos de auditoría nuevos; otras 30 tablas
intactas. Respaldo final restaurado y conciliado en una segunda base nueva.
db/backend/web saludables; 22 comprobaciones HTTP de solo lectura aprobadas.
Sin commits, remoto, cambios de claves, bootstrap ni comercio ficticio en desarrollo.
Login con contraseña personal a cargo del propietario; impresora física no probada.
Nombres de destinos y huellas de respaldos en [corte](cutover.md).
