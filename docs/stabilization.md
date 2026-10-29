# Estabilizacion de fase 14

Registro historico de fase 14. La [fase 15](cutover.md) retira Django, cambia las
pruebas conectadas a la imagen Nginx y actualiza comandos en [desarrollo](development.md).
Los conteos, dependencias y comandos siguientes describen exclusivamente fase 14.

Verificada el 29 de octubre de 2026 en `Cris-develop`, con datos sinteticos y sin
acceso al remoto. Se retomo el trabajo interrumpido sin commits posteriores a
fase 13. El candidato FastAPI/React queda verificado para el alcance implementado;
no se inicia fase 15 ni se autoriza un despliegue o corte operativo.

## Resultado y alcance

Ventas, Compras y Proveedores completan su integracion frontend con TypeScript,
sesion y `/api/v1`. Las ventas se envian completas con precios y total de servidor;
registrar una compra no cambia stock y recibirla lo incrementa una sola vez.
Proveedores ofrece consulta, alta, edicion y busqueda global paginada. Contratos
en [modulos frontend](frontend-modules.md), [ventas](sales.md) y
[compras/inventario](purchases-inventory.md).

Se conserva una intencion de venta/compra por cuenta y operacion en sessionStorage:
payload y clave inmutables hasta confirmar el resultado. Una respuesta perdida
permite reintentar incluso tras recargar. No se guardan credenciales ni tokens.
Las respuestas de una sesion anterior se rechazan y los cambios de cuenta entre
pestanas retiran los datos protegidos antes de consultar la nueva identidad.

No se encontraron defectos criticos/altos abiertos en este alcance nuevo verificado.
Esto no declara seguro el backend Django legacy ni convierte funciones excluidas
en implementadas. Caja conserva su prototipo con aviso visible, sin persistencia.
Las decisiones B06/B07/B08/B10/B11/B12/B13 pendientes conservan sus limites.

## Evidencia ejecutada

| Verificacion | Resultado |
| --- | --- |
| Backend completo con `--run-postgres` | 222 aprobadas, cobertura app 98.38%; PostgreSQL 17.10 aislado, migrado desde vacio |
| Integridad y concurrencia | Ultima unidad, ventas/recepciones concurrentes, reintentos, rollback y dinero exacto en la suite PostgreSQL |
| Autenticacion/permisos | Sesiones, CSRF, origen, revocacion, roles y denegaciones HTTP; Cashier sin compras/proveedores/costes |
| Calidad backend | uv lock --check, Ruff y formato (131 archivos en imagen final), mypy estricto (84 archivos) aprobados |
| Frontend | Tipos, ESLint, 76 Vitest/componentes, 41 legacy y build aprobados |
| E2E con API interceptada | 80 aprobadas, Chromium escritorio y movil, sin red/backend |
| E2E conectado | 4 aprobadas contra FastAPI y PostgreSQL, sin interceptar `/api`; persistencia tras recarga y cambio de identidad entre pestanas |
| Revision visual final | 16 E2E de URL/recarga repetidas tras ampliar capturas; Ventas/Compras/Proveedores escritorio/movil inspeccionados |
| Restauracion de operaciones | pg_dump/pg_restore y comparacion de las 24 tablas por campos/hashes, conteos, identidades y head Alembic |
| Ensayo ETL independiente | Nueva base vacia a head; 17 tablas sinteticas cargadas/conciliadas y conciliadas otra vez tras restaurar |
| Dependencias | pip-audit sobre todos los grupos bloqueados y npm audit: sin vulnerabilidades conocidas reportadas |
| Secretos | Gitleaks local con redaccion: historial y cambios preparados revisados; excepciones limitadas a cinco claves de idempotencia sinteticas historicas |
| Runtime | Construido desde bloqueo; UID 10001, lectura sola, sin Django/pytest, documentacion oculta en production y negocio deshabilitado por defecto |

La suite Django conserva D03 como fallo esperado; no se modifico su modelo de
precio entero. Los D01-D12 describen el origen legacy. En el flujo migrado se
verifican D01/D02/D03/D07/D08/D09/D10/D11/D12; D04/D06 se evitan reutilizando
direcciones existentes. No hay simulacion de activacion D05 en Productos/Clientes.
Las correcciones no se atribuyen al servidor Django.

Se inspecciono la salida de pruebas: los errores SQL de FK/unicidad/check son
rechazos provocados con datos sinteticos. Las pruebas HTTP comprueban errores
sin SQL, credenciales ni valores de entrada. La API conectada usa `--no-access-log`;
su salida revisada mostro arranque normal, sin excepciones ni valores de peticiones.
No se consultaron logs operativos. Esta revision no sustituye configurar retencion,
acceso y redaccion de logs del futuro despliegue.

Django se actualizo 6.0.4 -> 6.0.9, DRF 3.17.1 -> 3.18.3 y sqlparse 0.5.5 -> 0.6.0,
con uv.lock y exportacion legacy coherentes. Referencias de los mantenedores:
[Django, seguridad del 6 de octubre](https://www.djangoproject.com/weblog/2026/oct/06/security-releases/)
y [notas DRF](https://www.django-rest-framework.org/community/release-notes/).
Las auditorias consultan avisos disponibles en su ejecucion; no garantizan ausencia
de vulnerabilidades futuras ni cubren paquetes del sistema operativo de las imagenes.

## Reproduccion de pruebas conectadas

Desde la raiz, Docker Linux, sin `.env.docker` ni superposiciones de desarrollo.
`compose.test.yaml` usa tmpfs, credenciales sinteticas y ningun puerto publicado.
La API del perfil integration solo es accesible desde su red de pruebas.

```powershell
docker compose -p hdboutique-test -f compose.test.yaml build backend
docker compose -f compose.frontend-test.yaml build frontend
docker compose -p hdboutique-test -f compose.test.yaml up --force-recreate --abort-on-container-exit --exit-code-from backend
docker compose -f compose.frontend-test.yaml run --rm -T frontend
docker compose -p hdboutique-test -f compose.test.yaml --profile integration up -d --force-recreate --wait api
docker compose -p hdboutique-test -f compose.test.yaml --profile integration run --rm --no-deps -T browser
```

La suite backend debe terminar antes de iniciar el perfil conectado. Al detenerse
PostgreSQL tmpfs, sus datos desaparecen. `seed` exige una base vacia y aplica Alembic
explicitamente, sin `create_all` ni `stamp`. No ejecutar seed de nuevo sobre la base
poblada ni repetir las pruebas conectadas sobre sus escrituras previas. Para un
nuevo ensayo, retirar solo el proyecto de pruebas y volver a iniciar el perfil.
Playwright exige `HDB_FASTAPI_TARGET=http://api:8000` antes de iniciar el navegador;
sin el destino canonico rechaza la ejecucion, sin usar el fallback local de Vite.

## Volumen y restauracion de operaciones

Despues de las pruebas conectadas, con `api` en marcha:

```powershell
docker compose -p hdboutique-test -f compose.test.yaml run --rm --no-deps -T backend uv run --locked python -m tests.rehearse_performance
docker compose -p hdboutique-test -f compose.test.yaml stop api
docker compose -p hdboutique-test -f compose.test.yaml exec -T db pg_dump -U hdboutique_test_owner -d hdboutique_test -Fc -f /tmp/stabilization.dump
docker compose -p hdboutique-test -f compose.test.yaml exec -T db createdb -U hdboutique_test_owner -O hdboutique_app hdboutique_restore_test
docker compose -p hdboutique-test -f compose.test.yaml exec -T db pg_restore -U hdboutique_test_owner --role=hdboutique_app --no-owner --exit-on-error -d hdboutique_restore_test /tmp/stabilization.dump
docker compose -p hdboutique-test -f compose.test.yaml run --rm --no-deps -T backend uv run --locked python -m tests.rehearse_stabilization
docker compose -p hdboutique-test -f compose.test.yaml --profile integration down
```

El ensayo de volumen agrega 2000 productos (incluidos null/negativo/0/5/20),
1000 clientes, 5000 ventas, 5000 compras y 15000 lineas a los datos del navegador.
Son historicos sinteticos de compatibilidad: no se inventan costes ni movimientos.
Verifica 997500.00 NIO de ventas y 6250.00 de envio, con 5000 compras de coste
desconocido, para el periodo sintetico; los resumenes son globales con 20 detalles.

Medicion HTTP real entre contenedores, una solicitud de calentamiento excluida y
10 muestras secuenciales por ruta, incluyendo autenticacion por sesion, SQL y JSON:

| Ruta | p50 ms | p95 ms |
| --- | ---: | ---: |
| dashboard | 20.8 | 26.3 |
| reports/sales | 21.2 | 26.7 |
| reports/purchases | 41.3 | 54.1 |
| reports/inventory | 15.9 | 20.2 |
| reports/customers | 14.8 | 15.9 |
| sales, limit=21/offset=4980 | 53.8 | 79.3 |
| purchases, limit=21/offset=4980 | 59.4 | 66.9 |
| products, q=Volume/limit=21 | 16.5 | 23.6 |

p95 usa rango mas cercano (con diez muestras coincide con el maximo). La prueba
es una referencia local de volumen, sin usuarios simultaneos ni garantia de SLA.
Las pruebas de concurrencia funcional viven en Pytest; no son una prueba de carga.
El volcado permanece en `/tmp` del contenedor sintetico y se retira con el proyecto.
El ensayo ETL de [traslado](data-transfer.md#pruebas-y-respaldorestauracion-sinteticos)
se ejecuta aparte sobre una base nueva, porque requiere las 24 tablas vacias.

## Riesgos residuales y condiciones operativas

| Limite | Condicion antes de operacion/corte |
| --- | --- |
| No hay instancia/copia SQL Server disponible | Si aparece un origen, reabrir inventario, perfilado, ensayo y conciliacion; no se afirma traslado real |
| Django y adaptadores conservados | Mantenerlos fuera del candidato runtime expuesto; inventariar consumidores/admin B11 y retirar solo en fase 15 autorizada |
| Caja, pagos/deuda, devoluciones y activacion pendientes | No ofrecerlos como persistentes; confirmar reglas y autorizar su implementacion por separado |
| Empleados sin CRUD moderno | Las operaciones usan empleado vinculado o ID existente validado; preparar los registros por procedimiento autorizado |
| Opciones de formularios se cargan completas por paginas | Medir catalogos/contactos reales antes de escalar; este ensayo mide endpoints, no miles de opciones en el DOM |
| Reintentos monetarios limitados a la pestana/cuenta | Conservar la pestana ante resultado incierto y usar la misma solicitud; si se pierde sessionStorage, revisar historial antes de registrar otra vez |
| Sesion entre pestanas | BroadcastChannel probado en Chromium; servidor valida permisos siempre; otros navegadores y despliegue TLS requieren validacion propia |
| Infraestructura productiva no preparada | HTTPS, origen exacto, cookies Secure, secretos externos, respaldo cifrado/retencion, monitoreo y restauracion del entorno real requieren ensayo operativo |

No se aplicaron migraciones al entorno de desarrollo, no se crearon cuentas
operativas, no se modificaron secretos ni se habilito negocio por defecto. Head
permanece `0004_atomic_sales`. La fase 14 cierra la estabilizacion de este alcance;
la fase 15 y los limites anteriores requieren su propia autorizacion y evidencia.
