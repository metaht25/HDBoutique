# Empleados

Incremento autorizado el 29 de octubre de 2026. Completa el modulo staff de
fase 7 y su pantalla TypeScript `/employees`. [Configuracion inicial](initial-setup.md)
se completo posteriormente e incluye la administracion de cuentas.

## Reglas confirmadas

Administrator y Manager consultan, crean y editan empleados. Cashier no accede
al expediente: los tres roles consultan un selector con ID, nombres y apellidos.
No hay borrado, activacion/desactivacion ni creacion automatica de cuentas.
El cargo es descriptivo: no asigna roles. Fechas de ingreso/salida son datos
anulables y no bloquean compras, ventas, caja ni acceso.

Se conserva el esquema existente: nombres/apellidos obligatorios hasta 40,
telefono textual obligatorio hasta 10 (con ceros iniciales), direccion existente
ligada a departamento; correo laboral y cargo opcionales hasta 20, fechas ISO
opcionales. No se infiere municipio ni se endurece el formato de telefono/correo.
No se exige una cronologia nueva sobre las fechas historicas.

## API y persistencia

- GET /api/v1/employees: expediente, offset >= 0, limit 1..100 (50 por defecto).
  q opcional hasta 100; nombre completo o telefono, busqueda literal sin distinguir
  mayusculas antes de paginar. Orden por employee_id.
- GET /api/v1/employees/{record_id}: expediente o 404.
- POST /api/v1/employees: alta 201; requiere sesion supervisora, Origin y CSRF.
- PATCH /api/v1/employees/{record_id}: edicion 200; mismos controles.
  Omision conserva el dato; null solo limpia correo, cargo y fechas.
- GET /api/v1/employee-options: mismos limites de paginacion, q solo por nombre;
  requiere sesion y solo consulta/devuelve employee_id, first_names, last_names.
  No permite buscar personas por telefono con permisos Cashier.

Referencias inexistentes/entrada invalida: 422; conflicto de integridad: 409.
Campos adicionales rechazados. Las transacciones pertenecen al servicio;
repositorio sin commits. No cambia esquema ni revisiones: head 0005_cash_checkout,
30 tablas. No hay cargas ni datos comerciales sinteticos en desarrollo.

## Interfaz e integraciones

Busqueda y pagina en URL; 20 expedientes por pagina, lectura de 21 para siguiente.
Formulario con errores por campo, bloqueo de envio duplicado, recarga explicita,
vacios/errores y validacion de respuestas. Acceso Cashier denegado antes de cargar
expedientes o ubicaciones. Desmontar por cambio de identidad descarta el formulario.

Compras (registro/recepcion), ventas y apertura de caja usan el selector minimo.
Cuenta vinculada mantiene su empleado bloqueado; cuentas sin vinculo seleccionan
uno existente. Venta respeta al empleado del turno; servidor sigue validando
coincidencia con cuenta y caja. Se conserva la intencion idempotente de operaciones.

Las API existentes POST/PATCH /api/v1/users conservan el vinculo opcional y
exclusivo, gestionado solo por Administrator. Cambiar un expediente no modifica
IDs en ventas/compras/turnos ni el vinculo de la cuenta. La pantalla de cuentas
pertenece a configuracion inicial; este incremento no crea usuarios reales.

## Verificacion

Resultados de cierre en [caracterizacion](characterization.md). Pruebas sinteticas
PostgreSQL y navegador en los proyectos aislados documentados en [desarrollo](development.md).
