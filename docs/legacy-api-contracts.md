# Contratos actuales de HDBoutique

Referencia: commit `9bc044c`, inicio de la fase 1. Este documento describe el
backend Django/DRF existente; no define todavia una API FastAPI.

## Evidencia y limites

- Rutas: `backend/hdboutique/hdboutique/urls.py:25` y los seis `api/urls.py`.
- Controladores: los `api/views.py` utilizan `ModelViewSet` sin personalizaciones.
- Entrada/salida: los `api/serializers.py` utilizan `ModelSerializer` con
  `fields = '__all__'`; los campos proceden de los seis `models.py`.
- Consumidores: `frontend/src/services/` y `frontend/src/pages/`.
- Ejemplos completos de los 17 recursos:
  [legacy_contracts.json](../backend/tests/characterization/fixtures/legacy_contracts.json).
  Son datos sinteticos, no respuestas capturadas de una base real.

Las rutas y declaraciones se verifican estaticamente. En fase 3 las pruebas
aisladas Django tambien verifican lecturas 200, formatos, campos requeridos y
errores 400 sobre datos sinteticos. Las escrituras satisfactorias, borrados y
errores de persistencia de las tablas siguientes siguen describiendo comportamiento
esperado de DRF; no fueron ejecutados contra una base. No se han confirmado esquema
fisico, registros, restricciones SQL ni triggers.

## Convenciones compartidas

| Aspecto | Contrato existente |
| --- | --- |
| Prefijo | `/api/`; sin version explicita |
| Barra final | Presente en las rutas y consumidores; no depender de redirecciones de POST |
| Coleccion | GET devuelve una lista JSON; no hay paginacion configurada |
| Detalle | GET devuelve un objeto; sufijo `/{pk}/` |
| Relaciones | IDs planos, no objetos anidados; el JSON usa `id_cliente`, no `id_cliente_id` |
| PK | Entero generado, de solo lectura en serializers |
| Fecha | Texto ISO `YYYY-MM-DD`, sin hora |
| Decimal | Texto con dos decimales en respuestas; hasta 10 digitos totales y 2 decimales |
| Entero | Numero JSON; no implica por si solo positividad |
| Campos opcionales | Pueden omitirse al crear; los indicados como nulos aceptan `null` |
| PATCH | Solo valida campos enviados; PUT requiere campos obligatorios |
| Errores | Estructura DRF por campo o `detail`; no existe envoltorio propio |
| Orden | Sin orden estable explicito: no depender del orden de las listas |

Las cadenas opcionales con `blank=True` tambien admiten vacio. Los campos de FK
obligatorios necesitan un registro relacionado existente para validar una escritura
real. La API no tiene filtros ni busqueda de negocio declarados; las pantallas
filtran en memoria. Parametros `page`, `search` o `ordering` no son un contrato
implementado actualmente.

| Operacion | Ruta | Resultado habitual esperado |
| --- | --- | --- |
| Listar | GET coleccion | 200 y lista, incluida `[]` |
| Crear | POST coleccion | 201 y objeto creado |
| Consultar | GET detalle | 200 y objeto, o 404 |
| Reemplazar | PUT detalle | 200 y objeto, o 400/404 |
| Actualizar | PATCH detalle | 200 y objeto, o 400/404 |
| Eliminar | DELETE detalle | 204 sin cuerpo, o 404; una FK fisica puede impedir el borrado |
| Datos invalidos | POST/PUT/PATCH | 400 con errores por campo |
| Metodo no soportado | Por ejemplo DELETE coleccion | 405 |

HEAD y OPTIONS son proporcionados por DRF. Los routers tambien publican sus raices
de navegacion y sufijos de formato; el frontend consume las rutas de recursos.

Ejemplos de errores esperados, no capturados del servidor:

```json
{"id_cliente": ["This field is required."]}
```

```json
{"fechaventa": ["Date has wrong format. Use one of these formats instead: YYYY-MM-DD."]}
```

No fijar el texto traducible de esos errores como contrato futuro; conservar su
significado y documentar cualquier cambio de estructura.

## Recursos y campos

En las tablas: **R** = requerido en POST/PUT; **N** = omitible y acepta `null`;
**PK** = solo lectura. Todo campo no PK es escribible en el serializer actual.

### Ubicaciones

Fuente: `backend/hdboutique/ubicaciones/models.py:4`, `api/urls.py:12` y
`api/serializers.py:6`.

| Coleccion | Campo | Tipo y regla |
| --- | --- | --- |
| `/api/departamentos/` | `id_departamento` | entero PK |
| | `departamento` | texto(40), R |
| `/api/municipios/` | `id_municipio` | entero PK |
| | `id_departamento` | FK departamento, R |
| | `municipio` | texto(40), N |
| `/api/direcciones/` | `id_direccion` | entero PK |
| | `id_departamento` | FK departamento, R |
| | `direccion` | texto(100), N |

Direccion no declara `id_municipio` ni `direccionexacta`. Esa incompatibilidad con
Clientes es D04 en [characterization.md](characterization.md).

### Personas

Fuente: `backend/hdboutique/personas/models.py:4`, `api/urls.py:11` y
`api/serializers.py:5`.

| Coleccion | Campo | Tipo y regla |
| --- | --- | --- |
| `/api/personas/tipos-clientes/` | `id_tipo_cliente` | entero PK |
| | `tipo` | texto(20), N |
| `/api/personas/clientes/` | `id_cliente` | entero PK |
| | `id_direccion` | FK direccion, R |
| | `id_tipo_cliente` | FK tipo de cliente, R |
| | `nombres`, `apellidos` | texto(40) cada uno, R |
| | `numerotelefono` | texto(10), R; sin regla de 8 digitos en modelo |
| `/api/personas/empleados/` | `id_empleado` | entero PK |
| | `id_direccion` | FK direccion, R |
| | `nombres`, `apellidos` | texto(40) cada uno, R |
| | `numerotelefonico` | texto(10), R |
| | `correoprofesional`, `cargo` | texto(20) cada uno, N |
| | `fechainicio`, `fechafin` | fecha, N |
| `/api/personas/deudas-clientes/` | `id_deuda` | entero PK |
| | `id_cliente`, `id_venta` | FK cliente/venta, R |
| | `fecha_abono` | fecha, R |
| | `abono` | decimal(10,2), R |

`correoprofesional` es CharField, no EmailField. `DeudaCliente` representa registros
de abono segun sus campos; no hay principal, saldo ni estado de deuda declarados.

### Productos

Fuente: `backend/hdboutique/productos/models.py:5`, `api/urls.py:10` y
`api/serializers.py:5`.

| Coleccion | Campo | Tipo y regla |
| --- | --- | --- |
| `/api/productos/categorias/` | `id_categoria` | entero PK |
| | `categoria` | texto(20), N |
| `/api/productos/tallas/` | `id_talla` | entero PK |
| | `talla` | texto(20), R |
| `/api/productos/productos/` | `id_producto` | entero PK |
| | `id_categoria`, `id_talla` | FK categoria/talla, R |
| | `nombre` | texto(40), N |
| | `cantidadstock`, `stock` | entero, N |
| | `preciounitario` | decimal(10,2), N |

No hay estado activo, SKU, color ni identificador de producto padre. El modelo
permite nombre y precio nulos; el formulario los exige. No se han aprobado nuevas
restricciones para limpiar historicos automaticamente.

### Proveedores

Fuente: `backend/hdboutique/proveedores/models.py:7`, `api/urls.py:10` y
`api/serializers.py:5`.

| Coleccion | Campo | Tipo y regla |
| --- | --- | --- |
| `/api/proveedores/proveedores/` | `id_proveedor` | entero PK |
| | `id_direccion` | FK direccion, R |
| | `nombreempresa`, `nombrecontacto`, `apellidocontacto` | texto(50) cada uno, R |
| | `numerotelefono` | texto(10), R |
| | `correoprofesional` | texto(40), N |
| `/api/proveedores/productos-proveedores/` | `id_productoproveedor` | entero PK |
| | `id_producto` | FK producto, R |
| | `preciodecompra` | decimal(10,2), R |
| `/api/proveedores/ofrece/` | `id` | PK implicita esperada por Django; pendiente de verificar en SQL Server |
| | `id_proveedor`, `id_productoproveedor` | FK proveedor/producto de proveedor, R |

La muestra de `Ofrece` describe el objeto esperado por el ORM, no demuestra que
exista una columna fisica `id`. No usarla como evidencia de integridad de la tabla.

### Compras

Fuente: `backend/hdboutique/compras/models.py:6`, `api/urls.py:9` y
`api/serializers.py:5`.

| Coleccion | Campo | Tipo y regla |
| --- | --- | --- |
| `/api/compras/compras/` | `id_compra` | entero PK |
| | `id_proveedor`, `id_empleado` | FK proveedor/empleado, R |
| | `fechacompra` | fecha, R |
| | `fecharevision`, `fecharelleno` | fecha, N |
| | `costodeenvio` | decimal(10,2), N |
| `/api/compras/detalles-compras/` | `id_detallecompra` | entero PK |
| | `id_productoproveedor`, `id_compra` | FK producto de proveedor/compra, R |
| | `cantidad` | entero, R |

Cabecera y lineas son recursos independientes. No existe total de compra en el
modelo ni coste historico en el detalle. No hay transaccion de recepcion declarada.

### Ventas

Fuente: `backend/hdboutique/ventas/models.py:6`, `api/urls.py:9` y
`api/serializers.py:5`.

| Coleccion | Campo | Tipo y regla |
| --- | --- | --- |
| `/api/ventas/ventas/` | `id_venta` | entero PK |
| | `fechaventa` | fecha, R |
| | `id_cliente`, `id_empleado` | FK cliente/empleado, R |
| | `total` | decimal(10,2), R |
| `/api/ventas/detalles-ventas/` | `id_detalleventa` | entero PK |
| | `id_venta`, `id_producto` | FK venta/producto, R |
| | `cantidad`, `preciounitario` | entero, R |

El precio entero del detalle es un defecto conocido D03. El total es escribible
y no se recalcula en el codigo backend inspeccionado (D07). No preservar estos
defectos como requisitos del futuro sistema.

## Escrituras que realiza el frontend

| Flujo | Consumidor y solicitud |
| --- | --- |
| Producto nuevo | `Productos.jsx:278`; POST producto con nombre, ambas existencias, precio, categoria y talla |
| Editar producto | Mismos campos mediante PATCH `/{id}/` |
| Cliente nuevo | `Clientes.jsx:379`; POST direccion; despues POST cliente con el ID recibido |
| Editar cliente | PATCH cliente con nombres, apellidos, telefono, tipo y direccion existente |
| Venta nueva | `Ventas.jsx:384`; POST cabecera con fecha, total, cliente y empleado; despues un POST por detalle |
| Compra/proveedor | Pantallas de consulta; no hay escrituras en sus servicios actuales |
| Activar/desactivar | Cambia estado React; no envia peticion |
| Caja | Formularios locales; no envia peticion |

Payload sintetico compatible de producto:

```json
{"nombre":"Camisa de prueba","cantidadstock":12,"stock":12,"preciounitario":200,"id_categoria":107,"id_talla":108}
```

Venta sintetica valida en el formato legacy, suponiendo que existen sus FK:

```json
{"fechaventa":"2026-10-20","total":400,"id_cliente":105,"id_empleado":106}
```

Detalle enviado en otra solicitud, tras obtener `id_venta=115`:

```json
{"cantidad":2,"preciounitario":200,"id_venta":115,"id_producto":109}
```

Direccion enviada actualmente por el formulario de clientes, incompatible:

```json
{"direccionexacta":"Direccion sintetica","id_departamento":101,"id_municipio":102}
```

Formato que declara el serializer de direcciones:

```json
{"direccion":"Direccion sintetica","id_departamento":101}
```

El comportamiento esperado de ModelSerializer es ignorar entradas ajenas a sus
campos: el fallo puede ser perdida silenciosa del texto/municipio, no necesariamente
un 400. Esta fase no afirma haberlo observado contra SQL Server.

## Lecturas, errores y seguridad

Los siete servicios usan `fetch` con rutas relativas. Las lecturas devuelven el
JSON sin transformarlo. Las escrituras devuelven el objeto recibido y lanzan un
Error generico cuando `response.ok` es falso; no leen los errores por campo del
servidor. Los fallos de red se propagan. Son hechos probados con respuestas simuladas.

Las pantallas admiten lista o `results`, pero no recorren `next`; conservar ese
envoltorio en el servicio no prueba una paginacion completa. Dashboard/Reportes
calculan sobre todos los registros descargados. El proxy de Vite envia `/api` al
backend local (`frontend/vite.config.js:8`).

La configuracion instala autenticacion Django, pero no exige permisos en ViewSets
ni define `REST_FRAMEWORK`. No hay endpoint propio de login ni roles de negocio.
`/admin/` es la administracion Django, no la identidad del texto fijo de la interfaz.
Las pruebas de lectura usan identidad simulada para no convertir el acceso anonimo
actual en un requisito de compatibilidad. No hay pruebas ejecutadas de autenticacion,
CSRF, CORS, borrados o permisos efectivos contra un servidor.
