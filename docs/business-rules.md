# Diccionario del negocio y decisiones pendientes

Incremento posterior autorizado: [Empleados](employees.md) implementa alta,
edicion, consulta y selector operativo; Administrator/Manager gestionan,
Cashier solo consulta ID/nombre. Sin borrado/desactivacion ni efecto de fechas
sobre operaciones. Configuracion inicial permanece pendiente. Este contrato
actualiza las referencias historicas a empleados pendientes que siguen abajo.

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
| B01 | Existencia disponible y campo legacy | Confirmado fase 9: stock disponible; cantidadstock legacy, sin actualizar | Productos nuevos con stock cero; ambos campos de solo lectura en CRUD; nulos existentes requieren conteo, no se convierten en cero | Implementado para compras y ventas/inventario |
| B02 | Entrada de compra al inventario | Confirmado fase 9: solo al recibir completamente | registered -> received, una sola vez, sin recepciones parciales | Implementado con movimientos, rollback e idempotencia |
| B03 | Precios, descuentos y redondeo | Compras confirmado fase 9; ventas confirmado fase 10: precio vigente del producto copiado por linea, total de servidor, NIO/Decimal/dos decimales | Sin descuentos ni precio editable; rechazar precio null/no positivo; envio de compra separado sin prorrateo | Implementado para compras y ventas; no redondeo implicito |
| B04 | Correccion de ventas confirmadas | Fase 10 conserva originales inmutables. Acuerdo posterior al corte: el usuario autoriza la correccion trazable recomendada | Implementar anulacion total autorizada, motivo obligatorio, original conservado, devolucion de importe y reposicion solo de mercancia efectivamente devuelta; sin editar/borrar la venta ni duplicar reintentos | Implementado en incremento de caja: anulacion total supervisada, atomica e idempotente |
| B05 | Fechas legacy y recepcion | Confirmado fase 9: revision/relleno se conservan sin efecto en inventario | received_at nuevo e independiente, sin inferir recepcion desde fechas antiguas | Implementado sin reconstruir historicos |
| B06 | Deuda, abono y saldo | Confirmado por el usuario tras fase 15: ventas solo y siempre al contado; ningun abono en ninguna version | Excluir credito, deuda, pagos parciales y abonos del producto. Cobro completo por venta. Conservar tabla/modelo historico de compatibilidad sin exponer escrituras ni inferir saldos | Regla definitiva: pago completo obligatorio y atomico con venta; historicos preservados sin inferencias |
| B07 | Efecto y persistencia de desactivacion | Clientes/Productos solo cambian estado local | Persistir estado conservando historia; decidir bloqueo de nuevas operaciones | Antes de completar activacion en API/frontend |
| B08 | Direccion y municipio | Formulario solicita un campo que el modelo no tiene | Acordar FK municipio y consistencia con departamento; no inferir historicos | Antes del esquema de ubicaciones y alta de clientes |
| B09 | Usuarios, empleados y permisos | Confirmado en fase 8: Administrator, Manager y Cashier; cuenta/empleado opcional y exclusivo | Matriz aprobada y contrato en [autenticacion](authentication.md) | Implementado y verificado en fase 8; frontend pendiente en sus fases |
| B10 | Alcance real de caja | Usuario confirma contado exclusivo en efectivo o transferencia; ningun abono ni tarjeta | Implementar cobro completo; transferencia con referencia/confirmacion manual separada del efectivo. Propuesta de turnos, apertura/cierre, movimientos y correcciones trazables en [caja](cash-register-proposal.md) | Implementado: caja principal, turnos, apertura/cierre, movimientos supervisados y conciliacion; [contrato](cash-register.md) |
| B11 | Funciones utilizadas desde admin Django | Confirmado fase 15: no se utiliza /admin/; empleados/abonos pueden seguir pendientes | Django retirado sin crear funciones ni datos comerciales nuevos | Resuelto para este corte local |
| B12 | Conservacion y corte de historicos | Confirmado fase 15: no hay origen/historicos SQL Server; destino hdboutique/volumen de desarrollo y ventana inmediata autorizados | Respaldos previo/final restaurados y conciliados; archivos/Git conservados sin borrado automatico; retorno en [corte](cutover.md) | Resuelto para este corte local; nuevos origenes requieren acuerdo propio |
| B13 | Telefono y datos obligatorios | Formulario y modelo tienen reglas distintas | Confirmar regla nicaraguense y tratamiento de historicos de otra longitud | Antes de endurecer validaciones |
| B14 | Definicion de bajo stock | Confirmado en fase 13: disponible 0 agotado, 1–10 bajo stock, >10 suficiente | Nulos y negativos separados, pendientes de conteo; sin usar cantidadstock como fallback | Implementado en dashboard/reportes FastAPI; pantallas legacy restantes conservan sus limites |

B01/B02/B03/B04/B05/B09/B14 estan confirmados para sus alcances actuales.
B11/B12 estan confirmados para el corte local de fase 15, sin origen SQL Server
ni tareas utilizadas en /admin/; no aprueban reglas de empleados/abonos pendientes.
Acuerdo posterior al corte: B06 excluye definitivamente abonos/credito y B04
autoriza correcciones trazables. El incremento de [caja](cash-register.md)
implementa cobro completo obligatorio, turnos y anulacion total supervisada.
Las demas decisiones definitivas siguen pendientes,
con los acuerdos de compatibilidad de fases 5/7 indicados abajo. La autorizacion para ejecutar una
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

Los acuerdos por fase siguientes son historicos. B04/B06/B10 actuales se concretan
en [caja](cash-register.md); el prototipo de caja ya fue sustituido.

Acuerdo de fase 13, confirmado expresamente por el usuario: politica B14 indicada
arriba; fecha comercial America/Managua, hoy de servidor, filtros inclusivos sobre
sale_date/purchase_date guardadas sin reinterpretar historicos ni usar auditoria
como fecha documental. B09: Administrator/Manager acceso completo a dashboard y
reportes; Cashier ventas, catalogo y clientes, sin compras/proveedores/costes en
las respuestas API. [Contrato](reporting.md). Caja queda pendiente por instruccion
expresa: [recomendacion B10 para revisar](cash-register-proposal.md), sin aprobar
pagos/deuda ni implementar sus movimientos.

Acuerdo de fase 10, confirmado expresamente por el usuario: precio vigente del
producto copiado por linea, total calculado por servidor, NIO/Decimal/dos decimales,
sin descuentos ni precio editable, precios null/no positivos rechazados. Ventas
inmutables sin edicion/borrado/anulacion; correcciones/devoluciones posteriores,
sin cobros/deuda. Administrator, Manager y Cashier registran y consultan ventas,
usando empleado vinculado o uno existente explicito si no hay vinculo, con cuenta
autenticada auditada. B01 rige las salidas atomicas. Ver [ventas](sales.md).

Acuerdo de fase 9, confirmado expresamente por el usuario: stock es disponible y
cantidadstock se conserva como legado sin actualizar; productos nuevos con stock
cero y nulos existentes sin conversion implicita. Registrar compra no aumenta
existencias; recepcion completa registered -> received una sola vez, sin parciales.
Coste vigente del proveedor copiado por linea, NIO/dos decimales/sin descuentos y
envio separado sin prorratear. Fechas de revision/relleno preservadas, recepcion en
campo nuevo. Administrator y Manager gestionan compras/recepciones; Cashier no
accede. Se usa empleado de la cuenta o se exige uno existente si no hay vinculo,
registrando ademas la cuenta autenticada. Ver [contrato](purchases-inventory.md).

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

Acuerdo de fase 12 (28 de octubre de 2026), confirmado expresamente:
Productos y Clientes se completan sin activacion/desactivacion; se retiran los
botones que simulaban cambios locales. B07 definitivo sigue pendiente. Para
Clientes se reutiliza una direccion existente: Administrator/Manager seleccionan
de ubicaciones; Cashier indica su ID sin recibir permiso de consulta de ubicaciones.
Se conserva telefono textual de hasta 10 caracteres, sin municipio ni deuda.
Este limite aplica al incremento frontend, sin crear un alta compuesta de direccion.

Colores, SKU, agrupacion de variantes, descuentos nuevos, devoluciones, graficos,
exportaciones y nuevas capacidades de caja requieren aprobacion independiente.
No descartar historicos ni completar datos con valores inventados para que una
migracion o una prueba resulte satisfactoria.
