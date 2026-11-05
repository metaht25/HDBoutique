# F01: recuperación de operaciones tras pérdida de sesión

## Alcance y base

Corrección limitada a F01. Rama `fix/idempotencia-ventas`, creada desde
`origin/Desarollo`, verificada mediante `git ls-remote --heads origin` y fetch.
Base: `ff29c568d863f6a23876e620ed22c876dc5ad407`. `Desarollo` es el nombre
real de la referencia; `desarrollo` no existe en el inventario consultado.
Se conserva `Cronograma.docx` sin seguimiento. Sin commits ni push automáticos.

## Causa y mecanismos revisados

`useCashCommand` genera una UUID al crear una intención y guarda ruta, cuerpo y
clave en sessionStorage, bajo `hdb.cash.v1.<user_id>.<operation>`, antes de enviar.
Los reintentos reutilizan ese contenido; no toman los cambios posteriores del
formulario. Las sesiones no se guardan en esa intención.

El cliente HTTP convierte un 401 en cierre del estado autenticado. El hook usaba
`isDefinitiveRejection`, que clasificaba casi todos los 4xx como definitivos y
eliminaba la intención incluso si una petición anterior ya había podido terminar.
La cuenta original no encontraba su clave al entrar otra vez y podía crear otra
venta con una UUID distinta.

El servidor ya evita repetir una intención de la misma cuenta: ventas y compras
bloquean por cuenta/clave y comparan la huella del cuerpo antes de devolver el
resultado existente. Proveedores guarda una huella por cuenta/clave en auditoría;
anulaciones usan cuenta/operación/clave; recepción es idempotente por la compra y
su workflow. La venta, el pago y el inventario se confirman en una transacción.
No se cambiaron esos cálculos, bloqueos, restricciones ni tablas.

## Solución

- 401, 403, 408, 429, errores de red/servidor, respuestas genéricas del proxy,
  cambios de sesión y conflictos de clave conservan la intención.
- Solo se libera automáticamente una intención nueva ante un rechazo de
  aplicación definitivo sin incertidumbre anterior, o tras recibir éxito.
- Desde el primer resultado incierto, un rechazo posterior no demuestra qué
  ocurrió en el intento original. Se conserva hasta recuperar un éxito o conciliar.
- Toda intención recuperada al montar se considera incierta: la página pudo
  desaparecer después del commit y antes de ejecutar el manejador de error.
- Se mantiene el formato v1 y el cuerpo original para recuperar intenciones
  existentes sin invalidar su huella. No se renuevan las claves durante reintentos.
- La separación por cuenta se conserva; un hook reutilizado bajo otra cuenta u
  operación queda bloqueado, sin mover la intención al almacenamiento ajeno.
- Los comandos envían `X-Idempotency-Actor` con el ID de la cuenta que originó
  la intención. FastAPI lo compara con la identidad autenticada antes de llamar
  al servicio y devuelve 409 `session_changed` si no coinciden. Evita que una
  cookie cambiada en otra pestaña atribuya un reintento a una cuenta distinta.
- La cabecera es opcional para mantener compatibilidad con consumidores anteriores;
  nunca autentica ni concede permisos. Sesión, Origin, CSRF y roles siguen vigentes.

El hook compartido protege ventas, compras, proveedores, recepciones y anulaciones.
También se actualizó el consumidor anterior de transacciones para que use la misma
retención y envíe la cuenta esperada. No se limpiaron pantallas ni otros hallazgos.

## Archivos

| Archivo | Cambio |
| --- | --- |
| frontend/src/features/cash-register/useCashCommand.ts | Retención de incertidumbre y vínculo de la intención a su cuenta |
| frontend/src/features/transactions/pending.ts | Clasificación conservadora de rechazos |
| frontend/src/shared/api/client.ts | Envío de la identidad esperada como cabecera independiente |
| frontend/src/features/transactions/TransactionsPage.tsx | Mismo tratamiento en el consumidor anterior |
| frontend/src/features/transactions/api.ts | Propagación de la cuenta esperada al registrar/recibir |
| backend/app/modules/identity/dependencies.py | Rechazo del cambio de cuenta antes de escrituras comerciales |
| frontend/tests/components/cash-command.test.ts | Regresiones para cinco operaciones, errores y cambios de cuenta |
| frontend/tests/unit/transactions.test.ts | Clasificación de autenticación, proxy y conflictos |
| frontend/tests/unit/client.test.ts | Cabecera de cuenta sin alterar clave/cuerpo |
| frontend/tests/components/application.test.tsx | Espera de la consulta asíncrona ya exigida por el test |
| frontend/tests/integration/f01-session.spec.ts | Recorrido completo con commit real, respuesta perdida y recuperación |
| backend/tests/integration/test_sales.py | Expiración real, reautenticación, cuentas distintas y conteos de persistencia |
| docs/f01-idempotency-recovery.md | Causa, solución, pruebas y límites |

El ajuste del test de aplicación mantiene la misma aserción: espera a que la
pantalla lazy emita su consulta, en lugar de asumir que ya ocurrió cuando aparece
el encabezado. No se modificó la funcionalidad de contraseñas asignadas.

## Verificación

Antes de corregir el código, las nuevas pruebas focales produjeron 11 fallos
sobre la implementación anterior. Tras la corrección, las 42 pruebas focales
pasaron. Durante la verificación se corrigió una lectura de ref en render detectada
por ESLint utilizando estado inicial estable; no se deshabilitó ninguna regla.

Resultados completos de esta ejecución:

| Comprobación | Resultado |
| --- | --- |
| Backend con PostgreSQL aislado | 330 aprobadas, sin omisiones; 227,67 s |
| Cobertura backend | 92,26 %, umbral 90 % conservado |
| Ruff, formato y mypy | Aprobados; 173 archivos de formato y 108 fuentes tipadas |
| TypeScript y ESLint | Aprobados |
| Vitest | 116 aprobadas en 14 archivos |
| Compilación de producción | Aprobada |
| Playwright con API simulada | 22 aprobadas |
| Playwright conectado | 14 aprobadas, incluida F01; 1,2 min |

Las nuevas pruebas de PostgreSQL expiran `WebSession.expires_at`, verifican 401,
inician sesión con otra cuenta, comprueban el rechazo del reintento, recuperan la
cuenta original y obtienen exactamente el mismo resultado. SQL verifica una sola
venta, un pago y un workflow. Para las dos líneas de ese caso solo hay dos
movimientos de salida, con stock 12→10 y 12→9, sin otra deducción al reintentar.

La nueva prueba de navegador intercepta una venta después del commit y aborta
únicamente su respuesta. Simula expiración de la cookie, comprueba la conservación
del JSON original después del 401, entra con otra cuenta, prueba el rechazo de un
reenvío con propietario distinto y vuelve a la cuenta original. Debe recuperar
la misma clave, cuerpo, ID de venta y pago, con una sola salida de inventario.

Resultado conectado observado: venta original **7**, venta recuperada **7**,
pago original **7**, pago recuperado **7**, ventas nuevas **1**, descuento de
inventario **1**. El reenvío desde la cuenta distinta devolvió 409 session_changed
y la intención de la cuenta original permaneció intacta hasta su recuperación.

Comandos principales desde la raíz:

```powershell
docker compose -p hdboutique-test -f compose.test.yaml --profile integration build backend web
docker compose -f compose.frontend-test.yaml build frontend
docker compose -p hdboutique-test -f compose.test.yaml up --no-build --abort-on-container-exit --exit-code-from backend backend
docker compose -f compose.frontend-test.yaml run --rm --no-deps -T frontend
docker compose -p hdboutique-test -f compose.test.yaml --profile integration up -d --no-build --force-recreate --wait web
docker compose -p hdboutique-test -f compose.test.yaml --profile integration run --rm --no-deps -T browser
```

La suite backend y la semilla de navegador requieren por separado la base sintética
vacía. Solo se reinicializa el tmpfs de hdboutique-test tras verificar su etiqueta
y montaje. No superponer Compose de desarrollo, ni usar sus datos/credenciales.

## Límites y revisión

No hay migraciones, dependencias nuevas, cambios de reglas comerciales ni trabajo
en F02. Las pruebas con escrituras se limitan a hdboutique_test; no se recrean
servicios de desarrollo ni se ejecutan operaciones de negocio en su base.

Conservación segura no equivale a éxito: si la operación incierta no puede
confirmarse por permisos, datos o cambio de contrato, sigue pendiente y requiere
conciliación; no se ofrece descartarla y registrar otra a ciegas.

La protección sigue dependiendo del almacenamiento de la pestaña existente.
Cerrar la pestaña, borrar sessionStorage o volver desde otro navegador elimina
esa evidencia local. Esta corrección no recupera claves que versiones anteriores
ya borraron ni añade almacenamiento duradero o un módulo de conciliación.

Al integrar, desplegar la API compatible antes o junto con el frontend corregido
y recargar pestañas anteriores. Un cliente antiguo sin cabecera mantiene su
contrato y no obtiene la protección adicional frente al cambio silencioso de cookie.
Los cambios quedan sin commit para revisión; la rama de origen no se modifica.
La corrección está lista para revisión e integración, con las suites anteriores
completadas. No se recreó la web de desarrollo para desplegar este cambio.
