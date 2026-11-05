# Estabilización técnica

Rama `fix/estabilizacion-tecnica`, desde `Desarollo` local con F01 (`1682e3b`).
La modernización permanece en `feat/ui-modernizacion` (`d0a41a9`); no se integra
ni se despliega desde esta rama. Los ensayos usan exclusivamente PostgreSQL
`hdboutique_test`, proyecto `hdboutique-test`, con almacenamiento tmpfs.
No se aplican migraciones ni comandos de preparación a los datos DEMO.

## F02 — Último administrador utilizable

El conteo anterior consideraba rol/estado de cuenta, mientras el login también
comprueba al empleado. Se agrega una consulta que considera ambos estados y
admite cuentas sin empleado porque aún pueden autenticar. Creación, vinculación,
promoción y reactivación de una cuenta activa rechazan empleados inactivos.
La protección de la última cuenta utilizable se verifica dentro de la misma
transacción y bloqueo administrativo, incluso desde Empleados; los rechazos
revierten los cambios y la revocación de sesiones.

Verificación: 58 pruebas PostgreSQL de identidad, personal y ventas aprobadas,
incluidas siete regresiones F02, concurrencia y recuperación F01. Ruff, formato
y mypy aprobados. No requiere migración ni altera cuentas existentes.
