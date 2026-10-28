# Pruebas de caracterizacion y regresion

## Proposito y alcance

Preparar una base verificable antes de reemplazar Django o los servicios frontend.
Se protege el comportamiento valido de los [contratos actuales](legacy-api-contracts.md)
y se identifican defectos que deben corregirse. No se inicia FastAPI ni se modifica
codigo de aplicacion en esta fase.

Las muestras se encuentran en
`backend/tests/characterization/fixtures/legacy_contracts.json`: 17 recursos con
IDs y datos sinteticos relacionados. `baseline_commit` identifica el codigo de
aplicacion de referencia, no una exportacion de SQL Server.

## Ejecucion desde la raiz del repositorio

### Declaraciones backend, sin dependencias externas

```powershell
python -B -m unittest discover -s backend/tests/characterization -p test_source_contracts.py -v
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
node --test --test-reporter=spec frontend/tests/characterization/services.test.js
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

### Adaptadores HTTP y serializers Django, preparados

```powershell
python -B backend/tests/characterization/run_django_tests.py
```

El ejecutor comprueba primero si Django y DRF ya estan disponibles. Si faltan,
informa que no se ejecutaron las pruebas y termina con codigo 2; no instala nada,
no omite silenciosamente toda la suite y no reporta exito.

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
deberia admitir precio 199.50. Todavia no fue ejecutada. Al corregir D03, se debe
retirar expectedFailure y actualizar el contrato intencionadamente; un exito
inesperado fuerza esa revision.

Las lecturas usan una identidad simulada. No se exige preservar acceso anonimo
ni se certifica autenticacion. No ejecutar estos casos mediante el `manage.py test`
productivo; utilizar su ejecutor aislado.

### Relacion con uv

En esta fase no se inicializa un proyecto Python ni se instalan dependencias. El
uso directo de Python ejecuta biblioteca estandar o dependencias ya disponibles;
no introduce un gestor alternativo a uv. En fase 3, al existir pyproject.toml y
uv.lock, los mismos comandos Python se ejecutaran mediante `uv run --locked` y
estas pruebas se integraran con Pytest. No usar pip para preparar esta fase.

## Matriz de caracterizacion

| ID | Comportamiento valido | Proteccion preparada | Limite |
| --- | --- | --- | --- |
| C01 | Rutas actuales y 17 recursos | Prueba estatica + resolucion Django | Django pendiente de dependencias |
| C02 | Nombres, campos y relaciones por ID | Fixture, estatico y serializers | No prueba FK fisica |
| C03 | Decimal como texto con 2 decimales; fecha ISO | Fixture + serializer Django | Lectura runtime pendiente |
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
| D03 | `ventas/models.py:22` | Regresion Django preparada: precio 199.50 debe conservar centavos | Precio de linea exacto y total 399.00 para 2 unidades |
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

## Resultados de esta fase

| Verificacion | Resultado registrado |
| --- | --- |
| Estaticas Python | 3 pruebas aprobadas, con subcasos para 17 recursos |
| Servicios Node | 41 pruebas aprobadas; 0 fallos y 0 omitidas |
| Suite Django | No ejecutada: faltan Django y DRF; preflight informa impedimento |
| SQL Server/PostgreSQL, UI y E2E | No ejecutados |

No presentar las 44 pruebas aprobadas como 44 pruebas de endpoints reales. Los
resultados corresponden exclusivamente a declaraciones y servicios con mocks.

## Criterio de mantenimiento

Al corregir un defecto, agregar su prueba real en la capa adecuada, actualizar
fixture/documentacion si cambia el contrato y registrar la incompatibilidad
intencionada. No volver todas las pruebas expectedFailure ni convertir todos los
defectos en snapshots inmutables. Migrar la cobertura util junto con cada modulo.
