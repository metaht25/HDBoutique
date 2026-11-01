# Empleados y cuentas

Solo Dueña consulta y gestiona el directorio completo y cuentas. El selector
operativo devuelve exclusivamente ID y nombre de empleados activos; no expone
correo, domicilio, credenciales ni acceso administrativo a Colaborador.

POST /api/v1/employees crea empleado y cuenta Cashier atómicamente. Campos:
nombres, apellidos, teléfono, correo (hasta 100), cargo, fecha de ingreso,
usuario, contraseña temporal y domicilio directo (departamento/municipio/texto).
Un usuario duplicado revierte también empleado/dirección. Contraseña con Argon2id,
nunca en respuesta ni logs; primer ingreso obliga reemplazarla y revoca sesiones.

PATCH permite editar datos, restablecer contraseña temporal y activar/desactivar.
Desactivar conserva toda la historia, bloquea nuevas operaciones/inicio de sesión
y revoca sesiones. Reactivar habilita de nuevo el acceso conservando la identidad.
No permite desactivar la última Dueña activa. No hay borrado de historia.

El usuario de acceso se conserva al editar empleado. «Cuentas y accesos» gestiona
vínculo exclusivo opcional cuenta/empleado, perfil, estado y restablecimiento.
Toda cuenta nueva no bootstrap exige cambiar contraseña. No hay bootstrap nuevo
en desarrollo. Empleados preexistentes sin cuenta permanecen visibles como tales.

Solo Administrator y Cashier son perfiles funcionales. Cuentas del perfil retirado
permanecen como historia sin acceso ni conversión automática. Cargo no concede
permisos. [Autenticación](authentication.md), [reglas](business-rules.md).
