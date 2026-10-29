# Ventas atomicas: fase 10

Acuerdo posterior a fase 15: ventas solo y siempre al contado, cobro completo en
efectivo o transferencia; sin credito/abonos/pagos parciales en ninguna version.
El usuario autoriza correcciones trazables de ventas equivocadas, conservando el
original. El incremento de [caja](cash-register.md) implementa payment obligatorio
en POST /api/v1/sales y anulacion total supervisada. No inferir que una venta
historica existente ya tiene cobro. [Reglas vigentes](business-rules.md).
El resto conserva el contrato de fase 10 anterior al cobro; agregar payment a
sus ejemplos de registro segun el contrato de caja.

B03/B04 y permisos de venta B09 confirmados expresamente por el usuario el
28 de octubre de 2026. Administrator, Manager y Cashier registran y consultan
ventas. Se exige sesion y, en escrituras, Origin exacto y X-CSRF-Token valido.
HDB_BUSINESS_API_ENABLED sigue deshabilitado por defecto.

## Registro, precios e inventario

POST /api/v1/sales recibe cabecera y de 1 a 100 lineas en una sola solicitud.
El servidor valida cliente y empleado existentes, bloquea los productos en orden
de ID, obtiene sus precios vigentes y calcula subtotales y total con Decimal.
El precio se copia en sale_items.unit_price; cambios posteriores del catalogo
no modifican esa copia ni el total almacenado. No se aceptan precio, subtotal,
total, moneda o descuentos en la entrada. Tampoco escrituras de lineas separadas.

NIO y dos decimales, sin descuentos ni redondeo implicito. El precio de producto
debe ser finito y positivo; null, cero o negativo devuelve 422. Cantidades enteras
estrictas entre 1 y 2147483647, sin repetir product_id. Se conserva el rango
NUMERIC(10,2) de sales.total: un total mayor que 99999999.99 se rechaza con 422
antes de escribir. El dinero de salida es texto decimal, nunca float.

stock (legacy_stock) es disponible y se descuenta por la cantidad vendida.
cantidadstock (legacy_stock_quantity) se conserva sin actualizar. Un stock null
o negativo exige conteo y devuelve 409; no se interpreta como cero. Stock menor
que la cantidad solicitada devuelve 409 insufficient_stock. Cabecera, lineas,
descuento de existencias, movimientos sale_issue y auditoria se confirman juntos
o revierten completamente. Los repositorios comparten la sesion y no hacen
commits propios.

Cada salida conserva producto, linea de venta, cantidad positiva, stock_before,
stock_after, instante UTC, cuenta y empleado. Los CHECK validan origen exclusivo
compra/venta, cantidades y delta de entrada/salida; un indice unico impide dos
movimientos por linea. Compras y ventas usan el mismo bloqueo de productos, por
orden estable: dos ventas no pueden consumir la misma ultima unidad ni perder
actualizaciones con recepciones concurrentes.

Si la cuenta tiene empleado vinculado, se usa ese empleado; solicitar otro
devuelve 422. Sin vinculo se exige employee_id existente. Se audita por separado
la cuenta autenticada. sale_date es la fecha documental recibida; created_at usa
el reloj UTC del servidor. No se modifica el CRUD de empleados.

## Contrato HTTP e idempotencia

| Metodo y ruta | Resultado |
| --- | --- |
| GET /api/v1/sales | Lista ordenada por sale_id, incluidas ventas legacy |
| POST /api/v1/sales | Venta completa e idempotente, 201; exige Idempotency-Key |
| GET /api/v1/sales/{sale_id} | Cabecera y lineas con sus precios historicos |
| GET /api/v1/inventory/movements?sale_id={sale_id} | Salidas de esa venta; conserva permisos Administrator/Manager de inventario |

Las listas usan offset >= 0 y limit 1..100, por defecto 50; devuelven una lista,
incluida []. Los filtros de movimientos product_id, purchase_id y sale_id se
combinan; deben ser positivos. Cashier consulta ventas mediante /sales,
sin acceso a compras, costes o al historial general de inventario.
Los tres roles pueden consultar todas las ventas; no hay filtro por propietario.

Ejemplo sintetico con IDs existentes y empleado sin vinculo en la cuenta:

```json
{
  "customer_id": 101,
  "employee_id": 102,
  "sale_date": "2026-10-28",
  "items": [{"product_id": 109, "quantity": 2}]
}
```

Con precio vigente 199.50, la linea guarda unit_price "199.50", subtotal "399.00"
y la venta total "399.00". Respuesta: sale_id, customer_id, employee_id, sale_date,
total, currency "NIO", status "confirmed", created_by_user_id, created_at e items
con sale_item_id, product_id, quantity, unit_price y subtotal.

Idempotency-Key admite 8..128 caracteres ASCII alfanumericos, guion o guion bajo.
La clave se limita a cuenta y operacion venta; puede coincidir con una clave de
compra o de otra cuenta. Solo se almacenan SHA-256 de clave y cuerpo normalizado.
Un advisory lock transaccional por cuenta/clave serializa reintentos concurrentes.
La misma clave y cuerpo devuelve la misma venta con 201, sin consultar precios
actuales ni descontar otra vez; otro cuerpo u orden de lineas devuelve 409.
Omitir employee_id y enviarlo null son equivalentes; enviar un ID explicito cambia
el cuerpo. Un fallo no reserva la clave. Las FK y unicidades son segunda defensa.

Errores seguros: 401 sin sesion, 403 por origen/CSRF/permisos, 404 para venta
inexistente, 422 por cuerpo/referencias/empleado/precio/total invalidos y 409 por
stock o conflicto de idempotencia/integridad. El envoltorio error/code/message
no expone SQL ni datos de la solicitud. Respuestas con no-store y nosniff.

## Inmutabilidad, historicos y operacion

Las ventas confirmadas no se editan, borran, anulan ni devuelven en esta fase,
para ninguno de los tres roles. PUT/PATCH/DELETE no existen. Correcciones y
devoluciones requieren un flujo trazable posterior y reglas expresas. No se
implementan cobros, deuda, abonos, saldos ni caja; B06/B10 siguen pendientes.

Las ventas legacy se consultan con sus precios y total almacenados, aunque
presenten diferencias: no se recalculan ni se fabrican centavos con el catalogo
actual. Sin sale_workflows, status y autoria/instante nuevos son null. No se
reconstruyen salidas antiguas ni se alteran existencias al migrar o consultar.

Head 0004_atomic_sales agrega sale_workflows y extiende inventory_movements con
sale_item_id opcional y purchase_item_id opcional, con origen exclusivo. Hay
24 modelos/tablas; se conservan las 17 tablas comerciales y las revisiones previas.
Las entradas de compras existentes conservan todos sus valores y sale_item_id null.
ETL exige el head actual y las 24 tablas vacias; carga solo las 17 mapeadas, sin
inventar auditoria, movimientos o identidad. Manifiestos anteriores requieren
nuevo ensayo, conservando los originales.

La revision se verifica exclusivamente en PostgreSQL aislado. No se aplican
migraciones a desarrollo o datos operativos por implementar esta fase. Para una
habilitacion posterior, el operador debe respaldar y ejecutar explicitamente
`uv run --locked python -m alembic upgrade head` contra el destino autorizado.
El arranque de FastAPI no aplica migraciones. Downgrade no restaura stock y se
rechaza si existen salidas de venta, para evitar descartarlas; una reversa real
necesita respaldo y plan de conciliacion. Incluso sin salidas, bajar la revision
elimina la auditoria nueva y requiere evaluar su conservacion.

Django y React mantienen sus contratos y limitaciones. El nuevo backend corrige
D02/D03 y la parte de ventas de D11; su adopcion por pantallas queda en fases
posteriores. Ver [compatibilidad](contract-compatibility.md),
[reglas](business-rules.md) y [resultados](characterization.md).
