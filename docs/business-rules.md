# Diccionario del negocio y decisiones pendientes

Estado de la fase 1: comportamiento observado en codigo, recomendaciones y
preguntas pendientes. Una recomendacion no constituye una regla aprobada.
Referencia tecnica: commit `9bc044c` y [contratos actuales](legacy-api-contracts.md).

## Diccionario comprobado

| Concepto | Implementacion actual | Comportamiento que debe preservarse |
| --- | --- | --- |
| Producto | Nombre, categoria, talla, dos campos de existencias y precio de venta | Identidad y relaciones historicas con compras/ventas |
| Categoria | Catalogo de nombres | Clasificacion existente; no sustituir valores sin mapeo |
| Talla | Catalogo relacionado con producto | Tallas existentes; no inventar equivalencias |
| Variante | Cada producto tiene una talla; no hay entidad de producto padre, color o SKU | No agrupar ni fusionar productos automaticamente |
| Existencias | `cantidadstock` y `stock` son enteros anulables | Conservar ambos datos hasta aclarar su significado |
| Cliente | Nombres, apellidos, telefono, tipo y direccion | Identidad, contactos y vinculos con ventas/abonos |
| Tipo de cliente | Catalogo `Tipo_Cliente` | Catalogo y relaciones; las etiquetas no prueban descuentos |
| Empleado | Datos de persona, cargo y fechas; relacionado con compras/ventas | Autoria historica; no asumir que empleado equivale a usuario autenticado |
| Proveedor | Empresa, contacto, telefono, correo y direccion | Contactos y relaciones con compras |
| Producto de proveedor | Producto y precio de compra; se relaciona con proveedor mediante `Ofrece` | Correspondencia de cada detalle de compra con el registro original |
| Compra | Proveedor, empleado, fechas y envio; detalles separados | Fechas originales, cantidades y relaciones |
| Venta | Cliente, empleado, fecha, total; detalles con cantidad y precio | Historia de cada linea y precio aplicado; consultar sin usar el precio actual del producto |
| Abono | `DeudaCliente`: cliente, venta, fecha e importe | Historial de abonos; no calcular principal o saldo sin confirmar reglas |
| Direccion | Texto y departamento; municipio existe en catalogo aparte | Texto y relacion existentes; no inventar municipios para historicos |
| Caja | Formulario React de apertura/cierre, con ventas ingresadas manualmente | Conservar el prototipo como tal hasta acordar persistencia e integracion |
| Reporte | Agregaciones y filtros en navegador | Intencion de consulta: ventas, compras, bajo stock y tipos de cliente |

## Validaciones observadas en la interfaz

Estas reglas describen el formulario actual, no garantias de la API:

- `Productos.jsx:90`: nombre, categoria, talla y precio obligatorios; precio > 0;
  ambas existencias >= 0; `stock <= cantidadstock`. No hay comprobacion explicita
  de enteros en esa funcion y el modelo permite varios nulos.
- `Clientes.jsx:156`: nombres, apellidos y tipo obligatorios; telefono de exactamente
  ocho digitos. En alta exige departamento, municipio y texto de direccion. La
  edicion conserva la direccion existente. El modelo admite telefono de hasta 10.
- `Ventas.jsx:287`: producto valido, cantidad > 0, no superar el stock consultado y
  no repetir producto en el carrito. El chequeo sucede al agregar, no es un bloqueo
  contra otra venta concurrente.
- `Ventas.jsx:344`: fecha, cliente, empleado y al menos una linea para enviar venta.
- `Compras.jsx:128`: compra "pendiente de revision" significa que falta fecha de
  revision; esto no demuestra que esa fecha controle recepcion de inventario.
- `Productos.jsx:321` considera bajo stock entre 1 y 10; Dashboard y Reportes
  incluyen cero. El umbral 10 esta repetido en el frontend, sin politica central.
- `Clientes.jsx:150` clasifica tipos por coincidencia textual con "frecuente" o
  "casual". No se aplica una regla de descuento por tipo de cliente.
- Los importes se presentan como NIO; no hay columna de moneda ni conversion.

Las validaciones utiles se caracterizan antes de trasladarlas al servidor. No se
endurecen restricciones sobre historicos sin perfilarlos primero.

## Decisiones que requieren confirmacion

| ID | Decision | Evidencia y riesgo | Propuesta para evaluar | Momento limite |
| --- | --- | --- | --- | --- |
| B01 | Que significan `stock` y `cantidadstock` | Productos prioriza el segundo y Ventas el primero | Una existencia disponible autorizada; conservar otro dato solo si tiene funcion distinta | Antes del esquema definitivo de inventario y fases 9/10 |
| B02 | Cuando una compra entra al inventario | Fechas compra/revision/relleno sin servicio de recepcion | Distinguir registro y recepcion; no sumar stock dos veces | Antes de compras e inventario |
| B03 | Politica de precios, descuentos y redondeo | Precio producto decimal; detalle venta entero; total del cliente | Servidor calcula con Decimal; definir quien puede cambiar precio y cuando redondear | Antes de contratos de compra/venta definitivos |
| B04 | Correccion de ventas confirmadas | CRUD permite modificar/borrar cabecera y lineas por separado | Correcciones trazables y atomicas; decidir anulacion y efectos en stock/abonos | Antes de ventas |
| B05 | Significado de fechas de revision/relleno | Solo DateField sin reglas temporales | Mantener valores y significado original; no renombrar relleno a recepcion sin confirmar | Antes de migracion de datos y compras |
| B06 | Deuda, abono y saldo | Modelo guarda abonos, no principal ni estado | Confirmar origen de deuda, pagos parciales, sobrepagos y relacion cliente/venta | Antes de implementar cobros |
| B07 | Efecto y persistencia de desactivacion | Clientes/Productos solo cambian estado local | Persistir estado conservando historia; decidir bloqueo de nuevas operaciones | Antes de completar activacion en API/frontend |
| B08 | Direccion y municipio | Formulario solicita un campo que el modelo no tiene | Acordar FK municipio y consistencia con departamento; no inferir historicos | Antes del esquema de ubicaciones y alta de clientes |
| B09 | Usuarios, empleados y permisos | Confirmado en fase 8: Administrator, Manager y Cashier; cuenta/empleado opcional y exclusivo | Matriz aprobada y contrato en [autenticacion](authentication.md) | Implementado y verificado en fase 8; frontend pendiente en sus fases |
| B10 | Alcance real de caja | Apertura/cierre no persisten y ventas son manuales | Acordar turno, entradas/salidas, medios de pago y conciliacion antes de completar | Antes de backend de caja |
| B11 | Funciones utilizadas desde admin Django | Los 17 modelos estan registrados en admin | Enumerar tareas operativas que necesiten reemplazo antes de retirar Django | Antes de retirada del backend anterior |
| B12 | Conservacion y corte de historicos | No se inspecciono la base real | Preservar IDs, fechas, abonos y operaciones; acordar ventana y rollback | Antes de migracion operativa |
| B13 | Telefono y datos obligatorios | Formulario y modelo tienen reglas distintas | Confirmar regla nicaraguense y tratamiento de historicos de otra longitud | Antes de endurecer validaciones |
| B14 | Definicion de bajo stock | Cero incluido en unas pantallas y excluido en otras | Separar agotado y bajo stock, con umbral acordado | Antes de dashboard/reportes definitivos |

Salvo B09, las reglas definitivas B01-B14 permanecen pendientes, con los acuerdos
de compatibilidad de fases 5/7 indicados abajo. La autorizacion para ejecutar una
fase no aprueba por si sola sus alternativas. Las fases documentales y la preparacion del
entorno pueden continuar; el trabajo dependiente debe respetar estos limites.

Acuerdo de fase 5: el usuario eligio conservar la estructura actual como esquema
inicial de compatibilidad y dejar las reglas pendientes explicitas. Se mantienen
ambas existencias independientes y la direccion ligada solo al departamento.
Esto no resuelve el significado de B01 ni adopta una nueva relacion B08. No se
infieren recepciones, saldos, estados, roles o costes historicos. El esquema base
se describe en [data-model.md](data-model.md) y evolucionara por Alembic cuando
se acuerde cada regla pertinente.

## Ejemplos sinteticos y preguntas de aceptacion

Acuerdo B09 de fase 8 (28 de octubre de 2026), confirmado expresamente por el usuario:
Administrator administra cuentas y tiene acceso completo; Manager consulta, crea
y edita ubicaciones, catalogo, clientes y proveedores, sin administrar cuentas ni
eliminar; Cashier consulta catalogo/clientes y crea/edita clientes, sin proveedores
ni costes de compra. Cuenta con empleado opcional y exclusivo. Se adoptan sesiones
web mediante cookies protegidas y CSRF. La [matriz detallada](authentication.md)
limita estos permisos a recursos implementados, sin aprobar reglas de fases futuras.

Acuerdo de fase 7 (28 de octubre de 2026): el usuario confirmo conservar la
compatibilidad en las altas y ediciones de ubicaciones, catalogo, clientes y
proveedores: direccion ligada solo al departamento, telefono textual de hasta
10 caracteres y ambos campos de existencias independientes. Este acuerdo habilita
el contrato inicial de estos incrementos en desarrollo/pruebas; no adopta una
relacion con municipio, una regla de telefono de ocho digitos, activacion ni
semantica de inventario. Las reglas definitivas B01/B07/B08/B13 siguen pendientes.

1. **Venta integral sin ambiguedad monetaria:** producto 109, precio 200.00,
   existencias 12/12, dos unidades; total esperado 400.00. Conservar IDs de cliente
   y empleado. El fixture no afirma haber persistido esa venta ni descontado stock.
2. **Precio fraccionario:** producto a 199.50, dos unidades; resultado monetario
   esperado 399.00. El detalle legacy entero es incompatible (D03).
3. **Compra:** producto de proveedor a 120.50, doce unidades, envio 50.00;
   mercancia 1446.00 y suma ilustrativa con envio 1496.00. Falta decidir si el envio
   se distribuye por unidad y cuando se incorporan las doce unidades.
4. **Stock contradictorio:** `cantidadstock=12`, `stock=3`; Productos muestra 12
   y Ventas consulta 3. No decidir automaticamente que uno representa vendidos.
5. **Abono:** venta 400.00 y abono 100.50. La resta 299.50 solo seria saldo si se
   confirma que la venta genera deuda por ese principal y no existen otros pagos.
6. **Cliente/direccion:** texto "Direccion sintetica", departamento 101 y municipio
   102. El municipio debe pertenecer al departamento si se adopta esa relacion;
   actualmente no se guarda desde Direccion.

## Fuera del alcance obligatorio

Colores, SKU, agrupacion de variantes, descuentos nuevos, devoluciones, graficos,
exportaciones y nuevas capacidades de caja requieren aprobacion independiente.
No descartar historicos ni completar datos con valores inventados para que una
migracion o una prueba resulte satisfactoria.
