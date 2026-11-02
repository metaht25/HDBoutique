# Compras e inventario

Solo Dueña consulta/registra compras, proveedores, ofertas y costos. Colaborador
no obtiene esos datos mediante API ni navegación. Compras requiere proveedor,
productos y empleado activos; usa el vínculo de cuenta cuando existe.

Registro con Idempotency-Key: varias líneas, cantidades positivas, costo de compra
por proveedor/producto copiado por línea, envío y descripción opcional. Proveedor
se selecciona en consulta o se registra dentro de la compra; fallo revierte también
su domicilio y relaciones. Inactivo requiere reactivación en Proveedores. Total de servidor en
NIO/Decimal/dos decimales; envío separado, sin prorrateo. Siempre Pendiente
(registered). Registrar no aumenta existencias. Fechas antiguas de revisión/relleno
se conservan sin inferir recepción.

Los costos de proveedor también exigen texto decimal o entero exacto; rechazan
float, booleanos, valores no finitos, precisión excesiva y desbordamientos.

Recepción completa: confirmación explícita y empleado activo; registered → received
una sola vez. Bloqueo transaccional de compra/productos; movimiento purchase_receipt
con stock antes/después y autor. Un reintento no duplica inventario. No recepción
parcial. Inactivos no se usan en registro ni recepción hasta reactivar.

Productos nuevos: nombre, fecha actual, categoría, talla fija S/M/L/XL/XXL, costo
principal, cantidad inicial y descripción opcional. Puede crearse sin proveedor. Costo positivo;
precio calculado = costo × 1.15, ROUND_HALF_UP a dos decimales. No se acepta precio
manual ni cambios directos de stock. Cantidad inicial genera movimiento
initial_stock auditable incluso si es cero. Cuenta autora obligatoria, sin
inventar empleado cuando el alta no requiere uno.

Ventas generan sale_issue; anulaciones reponen solo lo devuelto mediante sale_return.
Movimientos preservan cantidad, stock anterior/posterior y relaciones históricas.
Stock nulo/negativo no se transforma silenciosamente en cero. legacy_stock_quantity
no se actualiza. Producto inactivo conserva todas sus relaciones y se reactiva
explícitamente antes de nuevas operaciones. No borrar productos históricos.

Un producto admite varios proveedores con costos propios. Compras crea/reutiliza
supplier_products/supplier_offerings por proveedor/producto/costo; otro costo crea
otra relación conservando las anteriores. Compras previas y costo principal/precio
de venta permanecen intactos. products.supplier_id histórico se conserva como
respaldo visual si no hay relaciones; no se inventan costos faltantes. Productos
muestra proveedores/costos legibles solo a Dueña, sin un flujo separado de «ofertas».

[Reglas](business-rules.md), [ventas](sales.md), [reportes](reporting.md).
