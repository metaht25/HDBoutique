# Preparación contextual de la boutique

La preparación se realiza desde los módulos operativos, sin Configuración en el
menú ni carga automática de datos comerciales:

1. Dueña abre su perfil en encabezado para nombre y dirección; teléfono y logo son opcionales.
2. Productos administra categorías/costo principal; tallas S/M/L/XL/XXL son fijas.
3. Los directorios permiten ampliar departamentos y municipios; los 3 departamentos
   y 28 municipios iniciales son permanentes. Las direcciones se
   escriben directamente en los formularios.
4. Empleados crea personal y acceso de colaborador; «Cuentas y accesos» administra
   cuentas existentes. Una operación requiere empleado activo.
5. Compras registra proveedores contextualmente y costos por producto; Proveedores
   consulta y activa/desactiva. Productos registra cantidad inicial auditada;
   recepción de compras incorpora inventario adicional.
6. Nueva venta registra clientes contextualmente y cobra el pago completo, sin turno.

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
