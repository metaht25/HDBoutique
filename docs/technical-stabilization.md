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

## F05 — Límite de transporte de logos

Nginx ahora admite 3 MiB de JSON únicamente en `/api/v1/boutique-profile`:
2 MiB de archivo requieren 2.796.204 caracteres base64 más los campos del perfil.
Los demás endpoints conservan su límite anterior. El exceso de cuerpo del perfil
devuelve 413 JSON, mensaje en español, campo `logo_base64` y `Cache-Control: no-store`.
El backend conserva el límite real de 2 MiB y la validación de imagen.

Verificación: TypeScript, ESLint, compilación y 21 pruebas del cliente aprobados.
Dos pruebas conectadas contra Nginx/FastAPI/PostgreSQL aislados aprobadas:
PNG válido de exactamente 2 MiB con metadata CRC válida llega y se sanea;
archivo 2 MiB+1 e imagen inválida reciben 422 de backend; JSON superior a 3 MiB
recibe 413 estructurado sin modificar el perfil guardado; otro endpoint sigue
limitado. F01 conectado conserva venta/pago originales y descuento único.

## F04 — Selectores de compras completos

Productos y proveedores usan búsqueda del servidor y páginas de 20 resultados,
sin descargar el catálogo entero. Productos exige proveedor activo seleccionado
y conserva `supplier_id` en cada consulta. La selección guarda su registro aunque
cambie la página; cambiar proveedor limpia producto y líneas anteriores. Historial
también permite buscar proveedores inactivos para consultar compras antiguas.
El selector paginado conserva el foco en el buscador al cambiar página, incluso
durante la carga; no cambia el comportamiento de los selectores sin paginación.

Verificación: TypeScript, ESLint, compilación, 40 pruebas de componentes y 22 E2E
de escritorio/móvil aprobados. Nueve escenarios conectados operativos aprobados;
regresión específica crea 125 productos y 125 proveedores sintéticos, llega a la
séptima página, busca fuera de los primeros 100, comprueba separación de proveedor
y registra la compra correcta. Cinco pruebas de selectores y las dos regresiones
conectadas F04/F01 se repitieron tras ajustar el foco y aprobaron. Sin cambios API,
cálculos ni lógica de idempotencia.

## F07 — Contraseña del administrador inicial

El servicio exige mínimo 12 caracteres únicamente cuando `bootstrap=True`;
la validación general conserva 6–128. Abarca los dos modos oficiales del CLI y
las llamadas directas, incluidos el flujo transaccional de F06 y su rollback.
La confirmación interactiva indica el rango real. `complete-setup` sigue
verificando y conservando contraseñas existentes, sin aplicarles la política nueva.

Verificación: Ruff, formato y mypy aprobados; 67 pruebas PostgreSQL de preparación,
identidad y ventas aprobadas, incluida F01. Regresiones prueban 6/11 rechazados,
12/128 aceptados, CLI con contraseña corta sin valores en salida, rollback de
empleado/cuenta/domicilio/perfil y conservación de seis caracteres en cuentas
ordinarias y preparación de una cuenta antigua. No se rotaron credenciales DEMO.

## F08 — Revisión de dependencias de desarrollo

Bloqueado por ausencia de corrección dentro de los rangos publicados: ESLint
10.14.0 y TypeScript ESLint 8.72.1 siguen exigiendo minimatch 10; el aviso exige
11.0.1. La solución automática implica retrocesos incompatibles. Se conserva
el bloqueo y se documentan versiones, riesgo y criterio para reabrir en
[dependencias](dependency-security.md). No se afirma que el aviso esté resuelto.

Verificación: audit completo devuelve diez nodos moderados de un solo aviso;
audit sin dependencias de desarrollo devuelve cero. TypeScript, ESLint, las 120
pruebas frontend completas y compilación aprobados con el bloqueo conservado.
La limitación no impide revisar las mejoras independientes sin forzar upgrades.

## A — Errores comprensibles

La presentación traduce mensajes conocidos de acceso, permisos, disponibilidad y
referencias; las validaciones incluyen nombre de campo y número de línea cuando
corresponde. No cambia `ApiError.message`, código, estado ni ubicaciones originales.
Los mensajes de negocio desconocidos se conservan. Empleados muestra errores del
servidor junto a campos de texto/contraseña con los vínculos accesibles existentes,
mantiene el formulario y retira el error de un campo al corregirlo. La contraseña
se borra tras enviar sin ocultar su error de validación. No cambia el reintento F01.

Verificación: TypeScript, ESLint, compilación y 53 pruebas relevantes aprobados,
incluidas traducción sin pérdida de diagnóstico, validación anidada, rechazo de
login en español, asociación accesible de errores, conservación del formulario
y las 17 pruebas de recuperación de comandos/idempotencia.

## B — N+1 medido y corregido

Se confirmó crecimiento por fila en los endpoints de listado detallado: 20 ventas
requerían 82 SELECT y 20 compras, 41. Se cargan flujos, líneas, pagos y anulaciones
en grupos limitados a la página ya autorizada; quedan seis y tres respectivamente.
La interfaz principal utiliza otros reportes agregados: no se atribuye a este
cambio una aceleración de esas pantallas. Formato, orden, NULL históricos, alcance
de Cashier y transacciones de escritura no cambian. Medianas locales y método en
[rendimiento de listados](list-performance.md).

Verificación: Ruff, formato y mypy aprobados; 80 pruebas PostgreSQL de listados,
ventas/F01, pagos/anulaciones y compras/recepción aprobadas. La regresión impone
presupuesto fijo de consultas y equivalencia de cada campo con el detalle,
incluidos datos históricos, devoluciones, recibidos y filtro por identidad.

## C / F09 — Retiro de pantallas sin consumidores

Se retiran cinco pantallas/wrappers sin rutas, importaciones ni pruebas consumidoras
y su CSS exclusivo. La revisión de dependencias encontró usos activos de los
adaptadores anteriores desde SalesLedger, anulaciones y catálogos; se conservan
contratos y todos los archivos de la implementación F01. El inventario y criterio
de conservación están en [código frontend histórico](frontend-legacy.md).

Verificación: TypeScript, ESLint, 128 pruebas frontend completas, compilación y
22 E2E en escritorio/móvil aprobados. Una ejecución inicial concurrente con la
construcción del backend agotó los cinco segundos de una prueba paginada; se
repitió la suite completa con dos workers de Vitest y uno de Playwright, sin
cambiar pruebas, límites ni código para omitir el caso. No se unifican contratos
activos ni se realiza una limpieza más amplia.

## Verificación integral y entrega

Rama de entrega: `fix/estabilizacion-tecnica`, desde `Desarollo` local `1682e3b`.
La referencia `Desarollo` sigue en ese commit y `feat/ui-modernizacion` sigue en
`d0a41a9`. No se hicieron push, merge, cambios de rama durante las correcciones,
reescrituras de historial ni migraciones nuevas.

| Verificación final | Resultado |
| --- | --- |
| Bloqueo uv, Ruff, formato y mypy | Aprobados; 110 archivos fuente analizados por mypy |
| Backend completo con PostgreSQL aislado | 367 aprobadas; cobertura de líneas/ramas combinada 91,81 %; umbral 90 % |
| TypeScript, ESLint y compilación | Aprobados |
| Frontend completo | 128 aprobadas; concurrencia limitada a dos workers |
| E2E escritorio/móvil con servicios simulados | 22 aprobadas; un worker |
| Navegador con Nginx/FastAPI/PostgreSQL reales de pruebas | 16 aprobadas; sin reintentos automáticos de las pruebas |
| Auditoría backend instalado | Cero avisos conocidos tras actualizar Pillow |
| Auditoría frontend sin dependencias de desarrollo | Cero avisos conocidos |
| Auditoría frontend completa | Diez nodos moderados derivados de un aviso; F08 pendiente |

F01 final: `originalSale=7`, `recoveredSale=7`, `newSales=1`,
`stockDiscount=1`, `originalPayment=7`, `recoveredPayment=7`; otra identidad no
puede recuperar la intención. F05 acepta PNG válido de exactamente 2 MiB a través
de Nginx y rechaza excesos sin cambiar el perfil. F04 crea 125 productos y 125
proveedores sintéticos y compra correctamente fuera de los primeros 100.
Se revisaron también capturas de Compras de 1440 px y 390 px y el modal móvil;
la integración comprueba límites de pantalla y acceso al botón de envío.

### Commits independientes

| Commit | Mensaje |
| --- | --- |
| `75dfef2` | fix(identity): proteger ultimo administrador utilizable |
| `ad6f6c3` | fix(setup): completar configuracion inicial del sistema |
| `bcbc248` | fix(security): reforzar validacion y procesamiento de imagenes |
| `6c6233b` | fix(nginx): alinear limites de carga de imagenes |
| `40be25f` | fix(purchases): permitir busqueda completa de productos y proveedores |
| `62439ec` | fix(auth): validar longitud minima del bootstrap |
| `0c1afb0` | docs(security): documentar bloqueo compatible de minimatch |
| `94c3614` | fix(ui): presentar errores y validaciones en espanol |
| `c23ea6e` | perf(transactions): agrupar consultas de listados sin alterar contratos |
| `560e287` | refactor(frontend): retirar pantallas sin consumidores verificados |

F08 tiene un commit de documentación del bloqueo, no un commit que simule una
actualización corregida. Esta entrega agrega un commit documental de cierre.

### Archivos principales

- Identidad/personal: `backend/app/modules/identity/{repository,service,cli,setup}.py`
  y `backend/app/modules/staff/service.py`; preparación en README y guía inicial.
- Logos: `backend/app/modules/boutique/{service,logo_worker}.py`,
  `backend/pyproject.toml`, `backend/uv.lock` y `frontend/nginx.conf`.
- Compras: `frontend/src/features/boutique/{Purchases,PurchaseSelectors,SearchSelect}.tsx`.
- Errores: `frontend/src/shared/api/errors.ts`, `shared/forms/fields.ts` y
  `features/boutique/PartyForm.tsx`.
- Lecturas agrupadas: repositorios/servicios de ventas y compras y formateo de
  anulaciones en `backend/app/modules/cash/service.py`.
- Regresiones: pruebas backend de identidad/preparación/imágenes/listados y
  pruebas frontend de selectores/errores/transporte de logos, además de las suites
  F01 existentes. Los seis retiros y sus consumidores se detallan en `frontend-legacy.md`.

### Preservación del entorno

Respaldos privados previo/final conservados bajo `backups/`, sin restaurarlos ni
publicarlos. Comparación de 31 tablas públicas mediante conteo y SHA-256 de sus
filas ordenadas: cero diferencias, incluidas cuentas/hashes de contraseña,
productos/stock, clientes, empleados, compras, ventas, pagos, movimientos y
auditoría. Solo se excluyen sesiones e intentos de login, que son estado efímero.
La instantánea previa real ya tenía 11 ventas, 11 pagos y 72 movimientos; esos
conteos se conservaron, junto con 30 productos, 4 proveedores, 10 clientes,
3 empleados y 5 compras. No se ajustaron registros para hacer coincidir las
cifras del contexto anterior.

`Cronograma.docx` continúa sin seguimiento y con la huella original. `.env.docker`,
credenciales privadas y respaldos no están versionados. No se borraron volúmenes;
la base de ensayos usa tmpfs separado. Los archivos de implementación F01 se
compararon contra `1682e3b` y permanecen sin cambios.

Las imágenes verificadas se conservaron con las etiquetas locales
`hdboutique-backend:stabilization-tested` y `hdboutique-frontend:stabilization-tested`.
Compose comparte nombres de imagen entre pruebas y desarrollo: para preservar
la línea visual del próximo arranque, `hdboutique-frontend:runtime` se reconstruyó
desde un archivo Git privado de `d0a41a9`, sin cambiar de rama. La etiqueta
`hdboutique-backend:development` conserva la imagen nueva ensayada. Los tres
contenedores de desarrollo existentes no se recrearon y siguen saludables.
Antes de recrearlos tras integrar, construir ambas imágenes desde el código
combinado; no asumir que una etiqueta compartida identifica una revisión Git.

### Riesgos y revisión antes de integrar

1. F08 sigue abierto: consultar `dependency-security.md` y decidir su tratamiento
   antes de integrar. No ocultar el aviso ni forzar un major incompatible.
2. Los límites completos de memoria/CPU del decodificador requieren Docker/Linux;
   Windows nativo solo aplica timeout, bytes y dimensiones. La cobertura no es
   una demostración de ausencia de cualquier vulnerabilidad futura.
3. Se retiraron pantallas sin consumidores; los adaptadores paralelos con usos
   activos se conservan. Una futura unificación requiere trabajo separado.
4. Revisar los commits e integrar explícitamente en `Desarollo`; después combinar
   con `feat/ui-modernizacion` y repetir pruebas, especialmente Compras,
   validaciones, navegación móvil y F01. La rama visual no se sobrescribió.
5. Al aplicar la integración, reconstruir backend/web para instalar Pillow 13 y
   cargar Nginx actualizado, con respaldo previo. No repetir bootstrap ni
   completar configuración sobre las cuentas DEMO ya vinculadas. No se sustituyen
   los contenedores de desarrollo durante estos ensayos; su frontend conserva
   la imagen visual existente. El backend de desarrollo monta el código local.

Las correcciones verificadas están preparadas para revisión. La integración
global requiere tratar conscientemente F08 y verificar la combinación visual.
