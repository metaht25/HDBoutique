# Configuracion inicial de la primera version

Incremento autorizado el 29 de octubre de 2026. Pantalla `/settings`, accesible
desde Configuracion en el menu. Completa las pantallas operativas de la v1 local.
La preparacion de los datos reales corresponde al propietario desde la interfaz;
no hay semillas comerciales, nuevos administradores automaticos ni asistente
que cambie reglas o marque el negocio preparado sin verificar sus referencias.

## Permisos y alcance

Administrator y Manager consultan, crean y editan departamentos, direcciones,
categorias, tallas, tipos de cliente, costes de compra y ofertas de proveedores.
Cashier no monta Configuracion ni solicita sus expedientes, ubicaciones o costes.
Solo Administrator consulta/crea/edita cuentas. Manager recibe una denegacion
al entrar directamente en la seccion de cuentas, sin solicitar `/api/v1/users`.
Los permisos se comprueban tambien en las API existentes con sesion, Origin y CSRF.

Se conservan los contratos existentes; no hay endpoints nuevos, migraciones,
dependencias, borrados en esta pantalla ni cambios de semantica comercial.
Direccion sigue ligada a departamento. No se incorpora municipio, activacion
de productos/clientes, descuentos, credito, abonos, tarjetas ni nuevas reglas de stock.

## Orden para preparar el negocio

1. Registrar departamentos y direcciones en Configuracion.
2. Registrar categorias, tallas y tipos de cliente en Configuracion.
3. Registrar empleados en Empleados. Administrator puede crear cuentas y vincular
   cada empleado de forma opcional y exclusiva.
4. Registrar productos, clientes y proveedores en sus pantallas existentes.
5. Registrar un costo de compra por producto en Configuracion / Costes de compra.
6. Relacionar proveedor y producto/costo en Configuracion / Ofertas de proveedores.
7. Registrar una compra y confirmar la recepcion de la mercancia completa para
   incorporar existencias. El producto nuevo comienza con stock cero.
8. Abrir caja con su responsable y el efectivo inicial contado.
9. Registrar una venta con cliente, stock disponible y pago completo en efectivo
   o transferencia. La venta utiliza el empleado responsable del turno.

Preparacion del negocio consulta presencia con `offset=0&limit=1` en once recursos.
Muestra Con registros o Pendiente de registrar y enlaces al formulario adecuado.
Si una lectura falla, muestra el error y permite revisar de nuevo; no convierte
un fallo en ausencia de datos. No certifica precios, stock ni turno abierto por
encontrar una fila. Los casos de uso operativos siguen validando sus requisitos.

## Catalogos y formularios

`section` y `page` de catalogos se conservan en la URL. Siete secciones, paginas
de 20 con lectura de 21 para detectar siguiente. Opciones relacionadas completas
por paginas de 100, con validacion de respuestas y errores recuperables.
Guardar no reintenta escrituras automaticamente y bloquea envios simultaneos.

Los limites son los de cada API: departamentos 40 caracteres, direcciones 100,
categorias/tallas/tipos 20. Campos anulables pueden vaciarse; talla/departamento
requieren nombre. El costo se envia como texto monetario positivo con hasta dos
decimales; el servidor conserva Decimal/NIO y valida precision/referencias.
Al editar un costo, el formulario conserva su producto. Las compras confirmadas
mantienen sus snapshots historicos al cambiar el costo vigente.

## Cuentas y sesiones

Usuario de 3..64 caracteres, normalizado a minusculas, sin renombrado en edicion.
Alta con rol explicito (Caja por defecto) y contrasena de 12..128 caracteres,
confirmada por repeticion. Empleado opcional; el selector excluye empleados
asignados a otra cuenta, incluso inactiva. El servidor protege el vinculo exclusivo.
El cargo del empleado no decide el rol de la cuenta.

Edicion de rol, estado, vinculo y contrasena. Contrasena vacia conserva la actual;
sin cambios no se envia PATCH. Los campos se envian solo si cambian. Se pueden
reactivar cuentas o desvincular empleados; no se borran cuentas. El servidor
rechaza retirar al ultimo Administrator activo y revoca las sesiones de la
cuenta modificada. Si es la cuenta actual, la pantalla revalida sesion y retira
los formularios; las otras pestanas reciben la notificacion de cambio.
Modificar otra cuenta conserva la sesion y la confirmacion del administrador.

La lista de cuentas se carga completa por paginas de API y se filtra por usuario
en memoria, con paginas de 20. Solo devuelve campos publicos. Las contrasenas
permanecen en campos password del formulario y se vacian tras cada solicitud;
no se guardan en localStorage/sessionStorage ni se exponen en tablas o URLs.

## Entrega y limites

Resultados realmente ejecutados en [caracterizacion](characterization.md).
Backend, Alembic head 0005_cash_checkout y 30 tablas sin cambios. El primer
Administrator del corte se conserva; no se repite bootstrap ni se leen sus claves.
Entorno de pruebas separado en `hdboutique-test/compose.test.yaml` con tmpfs y
datos sinteticos. Desarrollo conserva `.env.docker` y su volumen existente.

Esta entrega cierra el alcance funcional solicitado de la primera version local.
Los acuerdos excluidos y un despliegue publico requieren un alcance posterior;
no son tareas que se inicien automaticamente al cerrar esta entrega.
