# Compras e inventario

Solo Dueña consulta/registra compras, proveedores, ofertas y costos. Colaborador
no obtiene esos datos mediante API ni navegación. Compras requiere proveedor,
productos y empleado activos; usa el vínculo de cuenta cuando existe.

Registro con Idempotency-Key: varias líneas, cantidades positivas, costo vigente de
la oferta copiado por línea, envío y descripción opcional. Total de servidor en
NIO/Decimal/dos decimales; envío separado, sin prorrateo. Siempre Pendiente
(registered). Registrar no aumenta existencias. Fechas antiguas de revisión/relleno
se conservan sin inferir recepción.

Recepción completa: confirmación explícita y empleado activo; registered → received
una sola vez. Bloqueo transaccional de compra/productos; movimiento purchase_receipt
con stock antes/después y autor. Un reintento no duplica inventario. No recepción
parcial. Inactivos no se usan en registro ni recepción hasta reactivar.

Productos nuevos: nombre, fecha actual, categoría, talla, costo, proveedor/oferta
cuando corresponda, cantidad inicial y descripción opcional. Costo positivo;
precio calculado = costo × 1.15, ROUND_HALF_UP a dos decimales. No se acepta precio
manual ni cambios directos de stock. Cantidad inicial genera movimiento
initial_stock auditable incluso si es cero. Cuenta autora obligatoria, sin
inventar empleado cuando el alta no requiere uno.

Ventas generan sale_issue; anulaciones reponen solo lo devuelto mediante sale_return.
Movimientos preservan cantidad, stock anterior/posterior y relaciones históricas.
Stock nulo/negativo no se transforma silenciosamente en cero. legacy_stock_quantity
no se actualiza. Producto inactivo conserva todas sus relaciones y se reactiva
explícitamente antes de nuevas operaciones. No borrar productos históricos.

[Reglas](business-rules.md), [ventas](sales.md), [reportes](reporting.md).
