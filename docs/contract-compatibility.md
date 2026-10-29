# Matriz de compatibilidad propuesta

Actualizacion posterior al corte: Django ya fue retirado. [Caja](cash-register.md)
agrega payment obligatorio a la venta y POST /api/v1/sales/{id}/void; no hay
customer-payments ni abonos/credito, excluidos definitivamente por el usuario.
Las propuestas y menciones Django siguientes son referencias de la transicion.

Estado: nombres y estrategia, implementados parcialmente en fase 7 para
ubicaciones/catalogo y clientes/proveedores; ver [contrato vigente](foundation-api.md).
Las demas rutas siguen propuestas. Origen: [contratos actuales](legacy-api-contracts.md).

Fase 9 implementa [compras e inventario](purchases-inventory.md): cabecera/lineas
atomicas, costes historicos, recepcion unica y stocks de solo lectura en CRUD.
El frontend aun conserva los contratos Django.
Fase 10 implementa [ventas](sales.md): una solicitud atomica e idempotente,
precio/total de servidor, salidas y ventas inmutables. No se publican escrituras
de cabecera/lineas separadas ni ediciones/borrados financieros.
Fase 11 centraliza HTTP/errores y organiza las vistas por funcionalidad, conservando
los payloads/metodos/rutas Django y los servicios como reexportaciones. La sesion
consulta /api/v1/auth/* mediante proxy separado; no constituye migracion de los
formularios a FastAPI. Alcance en [base frontend](frontend-foundation.md).
Las fases 12/13 y la integracion de fase 14 ya sustituyen las siete pantallas
operativas por TS/FastAPI. Caja sigue como prototipo; Django/adaptadores conservan
sus contratos hasta la retirada autorizada en fase 15. Ver [contratos frontend](frontend-modules.md)
y [estabilizacion](stabilization.md).

Actualizacion de fase 5: las tablas/modelos nuevos ya usan estos nombres en
persistencia, con las precisiones siguientes. Las rutas HTTP y los contratos
JSON nuevos se concretan por incremento; Django conserva todos sus contratos.

## Rutas

| Recurso actual | Ruta candidata en ingles | Tratamiento |
| --- | --- | --- |
| `/api/departamentos/` | `/api/v1/departments` | Mantener IDs y nombres |
| `/api/municipios/` | `/api/v1/municipalities` | Mantener relacion con departamento |
| `/api/direcciones/` | `/api/v1/addresses` | Corregir contrato D04; municipio pendiente |
| `/api/personas/tipos-clientes/` | `/api/v1/customer-types` | Mantener catalogo |
| `/api/personas/clientes/` | `/api/v1/customers` | Mantener identidad y relaciones; direccion atomica propuesta |
| `/api/personas/empleados/` | `/api/v1/employees` | Separar empleado de cuenta de acceso |
| `/api/personas/deudas-clientes/` | `/api/v1/customer-payments` | Nombre provisional: son abonos; confirmar reglas |
| `/api/productos/categorias/` | `/api/v1/categories` | Mantener catalogo |
| `/api/productos/tallas/` | `/api/v1/sizes` | Mantener tallas actuales |
| `/api/productos/productos/` | `/api/v1/products` | Fase 9: stock disponible inicial cero, ambos stocks solo lectura; estado B07 pendiente |
| `/api/proveedores/proveedores/` | `/api/v1/suppliers` | Mantener contactos y direccion |
| `/api/proveedores/productos-proveedores/` | `/api/v1/supplier-products` | Conservar correspondencia historica |
| `/api/proveedores/ofrece/` | `/api/v1/supplier-offerings` | Verificar PK fisica; no fusionar automaticamente |
| `/api/compras/compras/` | `/api/v1/purchases` | Implementado fase 9: registro atomico e idempotente de cabecera y lineas |
| `/api/compras/detalles-compras/` | `/api/v1/purchases/{purchase_id}` | Lineas anidadas en items de la compra; sin escritura independiente |
| Sin endpoint legacy | `/api/v1/inventory/movements` | Entradas/salidas, solo lectura; filtros product_id, purchase_id y sale_id |
| `/api/ventas/ventas/` | `/api/v1/sales` | Implementado fase 10: cabecera, lineas y stock atomicos e idempotentes |
| `/api/ventas/detalles-ventas/` | `/api/v1/sales/{sale_id}` | Lineas en items de la venta; sin escritura independiente |

## Campos

Estos nombres describen el mapeo de almacenamiento inicial de fase 5; no publican
contratos HTTP nuevos. No autorizan conversiones o descartes de historicos, que
requieren el origen y los ensayos de fase 6. El usuario confirmo preservar la
estructura ambigua inicial, sin resolver B01/B08.

| Contexto | Campos actuales -> almacenamiento inicial |
| --- | --- |
| PK de cada recurso | `id_departamento -> department_id`, `id_municipio -> municipality_id`, `id_direccion -> address_id`, `id_tipo_cliente -> customer_type_id`, `id_cliente -> customer_id`, `id_empleado -> employee_id`, `id_deuda -> payment_id`, `id_categoria -> category_id`, `id_talla -> size_id`, `id_producto -> product_id`, `id_proveedor -> supplier_id`, `id_productoproveedor -> supplier_product_id`, `id_compra -> purchase_id`, `id_detallecompra -> purchase_item_id`, `id_venta -> sale_id`, `id_detalleventa -> sale_item_id` |
| FK | Aplicar los mismos nombres segun entidad referenciada; mantener valores de IDs |
| Ubicaciones | `departamento -> name`, `municipio -> name`, `direccion -> address_line` |
| Tipo de cliente | `tipo -> name` |
| Cliente/empleado | `nombres -> first_names`, `apellidos -> last_names`, `numerotelefono` o `numerotelefonico -> phone_number` |
| Empleado | `correoprofesional -> work_email`, `cargo -> job_title`, `fechainicio -> start_date`, `fechafin -> end_date` |
| Abono | `fecha_abono -> payment_date`, `abono -> amount`; registro tecnico inicial, sin inferir deuda o saldo B06 |
| Categoria/talla | `categoria -> name`, `talla -> name` |
| Producto | `nombre -> name`, `preciounitario -> unit_price` |
| Existencias | `cantidadstock -> legacy_stock_quantity`, `stock -> legacy_stock`; ambos INTEGER anulables, sin equivalencia semantica aprobada |
| Proveedor | `nombreempresa -> company_name`, `nombrecontacto -> contact_first_names`, `apellidocontacto -> contact_last_names`, `numerotelefono -> phone_number`, `correoprofesional -> work_email` |
| Producto de proveedor | `preciodecompra -> purchase_price`; conservar relacion con producto |
| Ofrece | `offering_id` es la identidad nueva del destino. Copiar `id` de origen solo si se confirma fisicamente; no deduplicar pares ni inventar ese ID origen |
| Compra | `fechacompra -> purchase_date`, `fecharevision -> review_date`, `fecharelleno -> refill_date`, `costodeenvio -> shipping_cost` |
| Detalle de compra | `cantidad -> quantity`; coste historico nuevo requiere decision, no se reconstruye con precio actual |
| Venta | `fechaventa -> sale_date`, `total -> total` |
| Detalle de venta | `cantidad -> quantity`, `preciounitario -> unit_price`; corregir incompatibilidad de decimales |

unit_price en sale_items usa NUMERIC(12,2) para admitir centavos sin reducir el
rango INTEGER del origen. Los demas campos monetarios conservan NUMERIC(10,2).
Un historico INTEGER se preserva como su valor entero con .00; no recuperar
centavos perdidos sustituyendolo por el precio actual del producto.
Las precisiones de tipo, nulabilidad y FK implementadas estan en
[modelo de datos](data-model.md#tipos-restricciones-e-indices). El defecto D03
sigue presente en Django; su nueva persistencia decimal se probo con PostgreSQL.

`refill_date` es un nombre provisional: no equivale todavia a recepcion.
`direccionexacta` e `id_municipio` solo existen en el payload del formulario; no
son columnas confirmadas de Direccion.

## Cambios que requieren adaptacion coordinada

1. Introducir nombres ingleses con version de API explicita.
2. Mantener rutas/campos antiguos en un adaptador temporal cuando tengan consumidores.
3. Mantener salida decimal como texto durante la compatibilidad; nuevos contratos
   deben fijar precision y redondeo. No convertir dinero a float en el servidor.
4. Introducir paginacion junto con cambios de pantallas y reportes; no devolver
   solo una pagina a consumidores que calculan totales globales.
5. Cambiar venta y compra a solicitudes completas atomicas. Un simple alias de
   POST cabecera seguido de POST detalles no proporciona atomicidad.
6. Introducir autenticacion con su flujo frontend antes de exigirla a consumidores.
7. Documentar el nuevo formato de errores y adaptar el cliente HTTP.
8. Mantener los adaptadores hasta que no haya consumidores y existan pruebas del
   recorrido sustituto; retirar su codigo y sus pruebas especificas juntos.

No se promete mantener indefinidamente CRUD destructivo de operaciones financieras,
acceso anonimo, stock contradictorio o perdida de datos. Sus correcciones deben
incluir pruebas nuevas y una explicacion de incompatibilidad intencionada.
