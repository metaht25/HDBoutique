# Preparación contextual de la boutique

La preparación se realiza desde los módulos operativos, sin Configuración en el
menú ni carga automática de datos comerciales:

1. El encabezado identifica a la Dueña, sin formulario de edición. El perfil existente
   permanece disponible para recibos; su API administrativa conserva permisos.
2. Productos administra categorías, costo principal y proveedores asociados; tallas
   S/M/L/XL/XXL son fijas. Alta inicial sin existencias y movimiento cero auditado.
3. Solo Empleados permite ampliar departamentos/municipios; los 3 departamentos y
   28 municipios iniciales son permanentes. Delivery sigue seleccionándolos.
4. Empleados crea personal/cuenta con cargo Vendedor fijo; Editar empleado conserva
   reemplazo de contraseña. No hay formulario separado de Cuentas y accesos.
   Compras/ventas requieren la cuenta real vinculada a un empleado activo.
5. Compras guarda proveedores; Proveedores consulta y activa/desactiva. Se elige el
   proveedor, productos asociados y cantidades, usando costos de Inventario.
   La recepción completa incorpora todas las existencias una sola vez.
6. Nueva venta registra clientes solo con nombre/apellido; Delivery completa
   teléfono/domicilio cuando corresponde, incluso para un cliente existente.
   Siempre pago completo y sin turno. Referencia opcional, confirmación obligatoria.

No se inventan referencias ni se afirma preparación completa por existir una fila.
Los estados vacíos indican qué falta. Cliente general se materializa únicamente
al confirmar una venta, con identidad técnica estable. No es una semilla comercial.

El logo se guarda como PNG saneado en PostgreSQL, incluido en pg_dump: entrada
raster PNG/JPEG/WebP de hasta 2 MB, máximo 3000 px por lado y 4 millones de píxeles,
reducida a 600 px. SVG, contenido inválido y rutas arbitrarias no se aceptan.
Un perfil con nombre y dirección está completo aunque no tenga teléfono ni logo.
Teléfono ausente se guarda como NULL y no reserva una línea en HTML, impresión ni PDF.
Sin perfil completo, el recibo indica preparación pendiente sin inventar datos.
Solo Dueña puede leer/editar el perfil; el recibo autorizado incluye los datos
necesarios para emitir el ticket.

[Interfaz](frontend-modules.md), [personal](employees.md),
[ventas y PDF](sales.md), [operación](cutover.md).
