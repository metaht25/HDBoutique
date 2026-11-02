# Ventas, clientes y recibos

POST /api/v1/sales registra una venta completa con Idempotency-Key y sesión/CSRF.
No permite editar ni borrar originales. Fecha comercial: hoy del servidor en
America/Managua; una fecha enviada por navegador no modifica esta decisión.
Cuenta y empleado activo quedan auditados; se respeta el vínculo de cuenta.

Cliente general usa identidad técnica única sin datos personales. Regular exige
nombre/apellido y admite teléfono opcional. El alta se envía dentro de la venta,
reutiliza el servicio de clientes y se revierte si falla cualquier paso. Un cliente
existente se selecciona en consulta; no se modifica. Delivery requiere teléfono y domicilio
coherente, más costo manual no negativo. Los datos de cliente, vendedor, producto,
talla y precios se guardan como instantáneas de la venta nueva; no se reconstruyen
ni inventan instantáneas de históricos.

Precios/copias de líneas, subtotal y total se calculan en servidor con Decimal.
Total incluye delivery. Productos y cliente deben estar activos. Stock disponible
se bloquea por filas en orden estable; cantidad positiva, sin líneas duplicadas,
sin sobreventa ni conversión de nulos/negativos a cero. Venta, inventario, pago
e idempotencia se confirman o revierten juntos. No se requiere turno ni se crean
movimientos de caja. Límites monetarios vigentes
y dos decimales; no precios manuales, crédito, abonos, tarjetas ni descuentos.

Efectivo admite recibido >= total y cambio; transferencia exige importe exacto,
referencia y confirmación manual; mixto conserva efectivo aplicado y transferencia
separados, con cambio solo sobre efectivo recibido. [Caja](cash-register.md).

GET /api/v1/sales y /sales/{id}, /receipts/{id} y /receipts/{id}/pdf:
Dueña consulta todas; Colaborador solo las ventas que creó. Acceso ajeno devuelve
404. Históricos sin pago no se presentan como cobrados ni se emiten como recibos.

Número visible de recibo: identidad del pago en decimal, sin R- ni relleno.
Venta mantiene su identificador separado. Listado/modal/impresión/PDF son coherentes.
Se permiten saltos; no se renumera ni se reutiliza historia. Búsqueda decimal y
compatibilidad con R- histórico.

Ticket real PDF vectorial/texto de 80 mm con altura calculada, logo durable,
datos boutique, números, fecha/hora Managua, cliente, vendedor, líneas, delivery,
total, método/componentes, recibido/cambio, referencias y estado. CSS de impresión
también de 80 mm, aislado del resto de la página. La descarga valida application/pdf.
Datos no registrados se identifican como tales. Las notas y textos se escapan.

POST /sales/{id}/void: exclusivamente Dueña, anulación total supervisada con motivo,
reintegro confirmado por medios originales, cantidades efectivamente devueltas
(incluso cero), referencia de transferencia cuando corresponde y misma garantía
atómica/idempotente. Conserva original y registra movimientos sale_return.
Anuladas siguen visibles, fuera de sumas vendidas. [Consultas](reporting.md).
