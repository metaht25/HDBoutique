# Compras e inventario

Contrato RF-05 a RF-09: [implementación y verificaciones](integral-improvements.md).
Solo Dueña administra proveedores, asociaciones, productos y compras. Colaborador
no recibe costos, proveedores ni informes administrativos.

Nuevo producto exige nombre, categoría, talla fija, costo positivo y al menos un
proveedor activo. El selector permite buscar y añadir varios proveedores. No se
admiten IDs repetidos o inactivos. Se usan supplier_products/supplier_offerings;
añadir un proveedor reutiliza asociaciones existentes y conserva todas las antiguas.
Los productos históricos sin asociación requieren asignarla explícitamente. No se
infieren proveedores ni costos. products.supplier_id histórico se conserva.

El alta siempre comienza con stock cero y movimiento initial_stock cero auditado.
No existe Cantidad inicial en UI; la API rechaza valores positivos, negativos o
booleanos. legacy_stock_quantity permanece intacto. Precio de venta = costo × 1.15,
Decimal/ROUND_HALF_UP a dos decimales, calculado por el servidor.

Nuevo proveedor se guarda desde Compras con POST /api/v1/purchases/suppliers,
Dueña/CSRF/Idempotency-Key. Ocho dígitos, prefijo 7/8 y teléfono canónico. Dirección
textual opcional; no exige departamento/municipio. Los domicilios históricos y sus
FK se conservan. Un proveedor guardado sobrevive al cierre o fallo de una compra.

Nueva compra usa un único combobox Proveedor. Solo ofrece productos asociados;
el servidor también rechaza productos incompatibles. Responsable desde la cuenta
autenticada vinculada a un empleado activo; nunca acepta otro empleado ni un
fallback para cuentas sin vínculo. Fecha, envío y descripción se conservan.

Costo de compra visible y de solo lectura: el servidor bloquea los productos,
consulta su costo principal vigente y guarda PurchaseItemCost en la transacción.
unit_cost omitido usa ese costo; si se envía uno distinto, devuelve 422. Las ofertas
antiguas conservan sus costos. Subtotal y total del servidor, NIO/Decimal, envío
separado. Cambios posteriores del costo no afectan compras registradas ni recepción.

Registro Pendiente con Idempotency-Key; no incrementa stock. Ver compra es lectura.
Marcar como recibida es una acción explícita, sin segundo selector de empleado ni
confirmación redundante. Recibe todas las líneas bajo bloqueo transaccional,
aumenta existencias, crea purchase_receipt y audita cuenta/empleado de sesión.
Un reintento devuelve la misma recepción sin duplicar mercancía. Sin parcial.
Stock desconocido/negativo o producto inactivo requiere resolver el estado antes.

Ventas generan sale_issue; anulaciones reponen solo lo devuelto con sale_return.
En Nueva venta el servidor pagina solo productos activos con precio y stock
positivos: cero, nulo y negativo se excluyen. Una unidad sí puede venderse.

[Reglas](business-rules.md), [ventas](sales.md), [reportes](reporting.md).
