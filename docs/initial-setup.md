# Preparación contextual de la boutique

La preparación se realiza desde los módulos operativos, sin Configuración en el
menú ni carga automática de datos comerciales:

1. Dueña abre su perfil en encabezado para nombre, teléfono, dirección y logo.
2. Productos contiene categorías, tallas, costos y ofertas.
3. Los directorios contienen departamentos y municipios; las direcciones se
   escriben directamente en los formularios.
4. Empleados crea personal y acceso de colaborador; «Cuentas y accesos» administra
   cuentas existentes. Una operación requiere empleado activo.
5. Proveedores registra contactos activos; Productos registra costo y existencia
   inicial auditada. Compras puede recibir inventario adicional.
6. Dashboard/Nueva venta permite abrir el turno antes de cobrar.

No se inventan referencias ni se afirma preparación completa por existir una fila.
Los estados vacíos indican qué falta. Cliente general se materializa únicamente
al confirmar una venta, con identidad técnica estable. No es una semilla comercial.

El logo se guarda como PNG saneado en PostgreSQL, incluido en pg_dump: entrada
raster PNG/JPEG/WebP de hasta 2 MB, máximo 3000 px por lado y 4 millones de píxeles,
reducida a 600 px. SVG, contenido inválido y rutas arbitrarias no se aceptan.
Sin perfil completo, el recibo indica preparación pendiente sin inventar datos.
Solo Dueña puede leer/editar el perfil; el recibo autorizado incluye los datos
necesarios para emitir el ticket.

[Interfaz](frontend-modules.md), [personal](employees.md),
[ventas y PDF](sales.md), [operación](cutover.md).
