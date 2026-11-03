# Empleados y cuentas

Solo Dueña consulta y gestiona empleados/cuentas. El selector operativo devuelve
ID y nombre de empleados activos, sin datos privados para Colaborador.

POST /api/v1/employees crea empleado, domicilio y cuenta Cashier atómicamente:
nombres, apellidos, teléfono, cargo, fecha de ingreso, usuario, contraseña asignada
y domicilio coherente departamento/municipio/dirección exacta. Un usuario duplicado
revierte también empleado/domicilio.

Teléfono canónico: ocho dígitos ASCII, prefijo 7 u 8; presentación 8000-0000.
Frontend admite pegado, borrado y edición intermedia. API y servicio validan el valor
canónico con mensaje específico. Correo laboral ya no se acepta ni devuelve;
se conservan la columna y los valores históricos.

Contraseña de 6–128 caracteres, con espacios preservados, inicialmente oculta y
control accesible mostrar/ocultar. Se limpia al terminar/cancelar el formulario.
Argon2id vigente; nunca se devuelve ni registra el secreto. No hay contraseña temporal
ni cambio obligatorio. Solo Dueña puede reemplazarla; toda sustitución revoca sesiones.
Colaborador no puede cambiar su propia contraseña.

PATCH edita datos, contraseña y estado; conserva usuario. Desactivar bloquea login/
nuevas operaciones y revoca sesiones; reactivar conserva identidad e historia.
La última Dueña activa está protegida. No hay borrado. «Cuentas y accesos» administra
cuentas/vínculos exclusivos existentes. Un empleado sin cuenta requiere vincular una
antes de asignar contraseña. No repetir bootstrap.

0007 libera must_change_password con auditoría sin cambiar hashes. Manager sigue
retirado, sin conversión automática. Cargo no concede permisos. El selector admite Vendedor y ausencia de cargo;
solo conserva otro valor si ya pertenece al empleado histórico que se edita.
El servicio rechaza nuevos valores arbitrarios sin renombrar cargos antiguos.
[Autenticación](authentication.md), [reglas](business-rules.md), [corte](cutover.md).
