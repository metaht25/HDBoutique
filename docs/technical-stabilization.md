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

## F06 — Preparación inicial completa

`bootstrap-admin --setup-file` recibe identidad real y perfil comercial explícitos,
sin contraseñas en el JSON. Guarda empleado, administrador vinculado y perfil en
una transacción, reutilizando validadores, cuentas y perfil existentes. El modo
`--employee-id` exige una identidad activa existente; se rechaza el bootstrap sin
vínculo y se reserva a una instalación sin cuentas. No crea Cashier auxiliar.
`complete-setup` exige la contraseña actual y una cuenta administradora todavía
sin empleado; conserva su contraseña y rechaza sustituir un vínculo existente.
`setup-status` es de lectura y distingue acceso, operación y perfil completo.
README y guía inicial incluyen preparación, uso y verificación por operador.

Verificación: 62 pruebas PostgreSQL aprobadas, incluidas seis de inicialización,
compra/recepción/venta/recibo posterior, rollback completo por logo inválido,
repetición, contraseña actual y prohibición del bootstrap desvinculado. Ruff,
formato y mypy aprobados. No se ejecutó la preparación sobre la instalación DEMO.

## F03 — Logos y Pillow

El bloqueo permitía Pillow 12.3.0 y excluía la versión corregida. Se actualiza
únicamente Pillow a 13.0.0, compatible con Python 3.13 y los usos actuales.
Los avisos de [APNG](https://github.com/python-pillow/Pillow/security/advisories/GHSA-5xm2-6676-qcp9)
y [XBM](https://github.com/python-pillow/Pillow/security/advisories/GHSA-xgh8-jp6q-p5x8)
afectaban la apertura anterior al control de dimensiones. Las
[notas oficiales](https://pillow.readthedocs.io/en/stable/releasenotes/13.0.0.html)
también describen correcciones de JPEG, formato admitido. Los avisos de formatos
no utilizados no equivalen a rutas explotables demostradas en HDBoutique.

La conversión pasa a un proceso Python aislado sin credenciales del entorno.
Solo abre PNG/JPEG/WebP mediante `formats=`, verifica estructura y carga píxeles.
Conserva límites: 2 MiB, 3000 píxeles por lado, 4 millones de píxeles y salida PNG
de 600×600 como máximo; mantiene transparencia y primer fotograma. En el runtime
Linux se limita el proceso a 256 MiB de espacio virtual y 3 s de CPU; el padre
impone 5 s de tiempo real en todas las plataformas. Windows nativo conserva
timeout y límites de entrada/dimensiones, sin RLIMIT de memoria/CPU: usar Docker
para el entorno con todos los límites. Los logos guardados no se reescriben.

Verificación: 72 pruebas aprobadas, incluidas 17 de imágenes (formatos válidos,
inválidos, truncados, límites de bytes/dimensiones, alpha, PNG previamente saneado,
timeout y fallo nativo simulados), inicialización y ventas/F01. No se ejecutaron
cargas de agotamiento. Ruff, formato y mypy aprobados. `pip-audit` del inventario
instalado actualizado: cero vulnerabilidades conocidas al consultar los avisos.
