# Mejoras integrales RF-01 a RF-18

## A. Resumen ejecutivo

Incremento solicitado el 3 de noviembre de 2026 mediante la solicitud pegada y
Puntos a mejorar.docx. Se leyeron todos los requisitos y se inspeccionaron sus
16 capturas. La solicitud prevalece sobre las reglas anteriores incompatibles.
Se trabaja sobre Cris-develop, base 25cea7f, inicialmente limpia, sin remoto,
subagentes ni commits automáticos. Los cambios quedan disponibles para revisión.

Se simplificaron empleados, productos, compras y ventas manteniendo React/FastAPI,
las transacciones, los dos roles, el inventario auditable y los recibos de 80 mm.
No se añadieron dependencias. Dinero del servidor con Decimal; cálculos de entrada
en React con centavos BigInt, sin float. Se conserva el diseño rosa/lavanda.

**Estado de ejecución:** RF-01 a RF-18 implementados, verificados en entorno
aislado y aplicados a hdboutique-dev/hdboutique por autorización expresa del
propietario. Migraciones 0010→0012 ensayadas y aplicadas sin alterar datos históricos;
respaldos previo/final restaurados y conciliados en dos bases nuevas conservadas.
La cuenta administrador quedó vinculada al empleado #2 (Alejandra), expresamente
identificado por el propietario. Runtime local saludable en http://127.0.0.1:8080.
Evidencia y límites del procedimiento en [corte](cutover.md).

## B. Matriz de cumplimiento

Las rutas siguientes son relativas al repositorio. Cada requisito se verificó
funcionalmente con escrituras sintéticas en test aislado. La versión verificada
está aplicada a desarrollo, cuyo humo final fue de solo lectura.

| RF | Estado | Archivos principales | Resultado y evidencia | Problemas o decisiones |
| --- | --- | --- | --- | --- |
| 01 | Completado | backend/app/modules/staff/{schemas,service}.py; frontend/src/features/boutique/PartyForm.tsx | Servidor asigna Vendedor; campo de solo lectura; regresión de cargo omitido/manipulado e historia | Cargo antiguo conservado, no convertido; cargo separado de Cashier |
| 02 | Completado | Directory.tsx; ReferenceModal.tsx; eliminación de AccountsPanel.tsx/SettingsPage.tsx | Sin Cuentas y accesos ni acceso por /settings; altas atómicas, revocación y reactivación conservadas | Recuperación de contraseña sigue en Editar empleado; cuentas sin empleado carecen de formulario propio |
| 03 | Completado | Directory.tsx; PartyForm.tsx; suppliers/models.py; 0011 | Administración de ubicaciones solo Empleados; proveedor con dirección textual opcional; Delivery conserva selección coherente | FK/domicilios históricos conservados; no se infiere ubicación |
| 04 | Completado | backend/app/api/schemas.py; core/errors.py; PhoneField.tsx; phone.ts | Validador compartido 7/8 + ocho dígitos; guion automático y API canónica; pruebas válidas/inválidas y mensajes | Prefijos 7/8 son la interpretación explícita del encargo; regular no requiere teléfono |
| 05 | Completado | catalog/{schemas,service}.py; suppliers/service.py; Products.tsx | Proveedores activos buscables/múltiples; validación/evitación de duplicados; alta cero con movimiento auditado | Sin conversión de cardinalidad ni asociaciones arbitrarias de históricos |
| 06 | Completado | Purchases.tsx; SearchSelect.tsx; purchases/service.py; reporting/boutique_* | Un solo Proveedor; teclado y búsqueda; productos asociados en SQL; compras incompatibles rechazadas | Búsqueda acotada del servidor; selección identificada por contacto/teléfono/ID |
| 07 | Completado | purchases/service.py; Purchases.tsx | Sin empleado manual; servidor usa cuenta/empleado activo real; regresión de identidad manipulada | Cuenta sin vínculo falla explícitamente, sin ID fijo ni empleado inventado |
| 08 | Completado | purchases/{schemas,service}.py; Purchases.tsx | Costo principal bloqueado y copiado a PurchaseItemCost; costo distinto rechazado; recepción no recalcula | Ofertas y compras antiguas conservan sus costos; sin precio de venta como costo |
| 09 | Completado | Purchases.tsx; purchases/service.py; reporting/boutique_repository.py | Acción explícita Marcar como recibida, completa/atómica/idempotente; stock cero excluido; una unidad vendible | Ver compra sigue siendo lectura; no recepción parcial |
| 10 | Completado | sales/service.py; Checkout.tsx | Identidad técnica general estable; venta y recibo sin datos personales | No se crea una persona por venta |
| 11 | Completado | PartyForm.tsx; Checkout.tsx | Regular solo nombre/apellido; modelo conserva campos opcionales; prueba de formulario/venta | Campos de entrega se solicitan solo para operación Delivery |
| 12 | Completado | sales/{schemas,service}.py; PartyForm.tsx; Checkout.tsx | delivery_details actualiza cliente seleccionado con la venta, rollback integral, mismo ID e instantáneas inmutables | Solo teléfono/domicilio; nombres existentes de solo lectura; directorio sigue protegido |
| 13 | Completado | sales/service.py; Checkout.tsx | Sin selector de vendedor; cuenta real de Dueña o Colaborador; recibo/historial guardan vendedor | Identidad ajena rechazada; no fallback de cuenta sin empleado |
| 14 | Completado | SearchSelect.tsx; Checkout.tsx; reports/customer-directory | Un combobox con lupa, búsqueda parcial del servidor, 20 coincidencias, teclado/vacío/carga/error | Identidad seleccionada estable; datos borrados al elegir otro cliente |
| 15 | Completado | Checkout.tsx; api.ts; cash/{schemas,models}.py; 0012 | Cálculo mixto bidireccional, campo editado preservado, recibido/cambio separados; referencia opcional, confirmación obligatoria | Se detectó y corrigió CHECK antiguo que rechazaba NULL; no pagos incompletos |
| 16 | Completado | ReceiptModal.tsx conservado; boutique/pdf.py conservado; pruebas conectadas | Se conserva ticket, vista previa, impresión y PDF de 80 mm, usando snapshots/autor correcto | Sin rediseño; no se reescriben recibos anteriores; impresora física fuera de prueba |
| 17 | Completado | Dashboard.tsx; SalesChart.tsx; reporting/boutique_{service,schemas}.py | Dos gráficos SVG responsive/accesibles con tabla; serie SQL diaria real, Managua, solo confirmadas y solo Dueña | UI semanal/mensual; year sigue compatible en backend; vacíos sin comercio inventado |
| 18 | Completado | MainLayout.tsx; eliminación de ProfileModal.tsx | Encabezado de solo lectura; formulario eliminado; perfil/API/datos internos de recibo conservados | No se crea formulario sustituto |

## C. Cambios técnicos

El backend mantiene routers, schemas, servicios y repositorios existentes.
PurchaseItemCost y snapshots de ventas siguen siendo la autoridad histórica.
Inventario mantiene bloqueo ordenado, movimientos y actualización atómica; recepción
no ejecuta consultas para recalcular precios. Se valida cuenta/empleado también en
la recepción repetida. No se retiran autenticación, sesiones, CSRF, roles o auditorías.

Contratos nuevos o ajustados:

- ProductCreate requiere supplier_ids no vacío, único y activo. initial_stock solo
  admite entero cero. ProductPatch añade asociaciones sin borrar las existentes.
- PurchaseLineCreate acepta product_id sin unit_cost. Si se envía costo, debe
  coincidir con el costo principal del servidor; la relación debe existir.
- employee_id sigue admitido por compatibilidad/idempotencia únicamente si coincide
  con el empleado de sesión. Sin vínculo no se acepta un empleado arbitrario.
- SaleCreate.delivery_details contiene teléfono y domicilio completo para actualizar
  exclusivamente al cliente seleccionado en una operación Delivery. Es transaccional.
- PhoneNumber acepta ocho dígitos o su presentación con un guion y devuelve ocho
  dígitos. No se migran teléfonos históricos ni se vuelve obligatorio el opcional.
- PaymentCreate.reference ausente/blanca se guarda NULL; transfer_confirmed sigue
  requerido para transferencias. Huellas de solicitudes anteriores conservadas.
- /reports/product-catalog acepta supplier_id solo Dueña y status=sellable.
- /dashboard/overview añade series diaria; para Cashier es vacía y el resto queda
  limitado a su cuenta. Agregación en snapshot REPEATABLE READ.

Migraciones nuevas:

| Revisión | Cambio | Conservación y retorno |
| --- | --- | --- |
| 0011_supplier_addresses | suppliers.address_id nullable; address_line textual opcional | Sin actualizar filas; FK conservada. Downgrade bloqueado si perdería dirección nueva o proveedor sin ubicación |
| 0012_optional_transfer_reference | CHECK full_payment permite referencia NULL en transferencia/mixto | Conserva cobertura completa, componentes y cambio; downgrade bloqueado si hay pagos sin referencia |

No se editaron 0001–0010 ni se inicia Alembic automáticamente. Se mantienen 32
tablas más alembic_version. La herramienta offline histórica sigue apuntando a su
esquema archivado: ajustada su comparación para excluir las columnas nuevas, sin
presentarla como carga real o autorización para importar datos.

## D. Resultados de pruebas

Resultados finales reales:

| Grupo | Resultado |
| --- | --- |
| Backend PostgreSQL, incluido Alembic vacío→head, downgrade protegido, FK, concurrencia y rollback | 324 aprobadas, cobertura 92.26 %; 184.31 s; sin omisiones |
| Ruff / formato | Aprobados; 174 archivos con formato verificado |
| mypy estricto / uv lock | Aprobados; 108 archivos tipados; bloqueo coherente |
| TypeScript / ESLint / build producción | Aprobados sobre imagen final |
| Vitest / Testing Library | 102 aprobadas en 14 archivos |
| Playwright interceptado | 22 aprobadas: escritorio y móvil |
| Playwright conectado real | 12 flujos aprobados en 1.2 min; proveedor→producto→compra→recepción, ventas/recibos, cliente reutilizado, permisos y revocación |
| Comprobación conectada focal de gráficos | 1 aprobada: semanal/mensual en 1440 y 390 px, tras ajustar etiquetas legibles |
| Compose test y desarrollo | config --quiet aprobados; sin imprimir variables |
| Imágenes / proxy / PostgreSQL / autenticación | Construcción aprobada; db/api/web de test saludables; pruebas por Nginx /api/v1 con sesión/CSRF y permisos |
| Alembic conectado final | 0012_optional_transfer_reference; check sin operaciones pendientes/drift |
| Revisión visual | 16 capturas fuente; 69 capturas finales inspeccionadas, 15 rutas, escritorio/móvil, formularios, recibos y gráficos |
| PDF | Tres documentos renderizados e inspeccionados: mixto, anulado y navegador; exportación API 226.772 pt ≈ 80 mm; impresión Chromium 227.04 pt ≈ 80.1 mm |
| Git y documentación | Rama Cris-develop, HEAD 25cea7f; diff --check y enlaces locales aprobados; sin staging/commits/remoto |
| Migración/restauración real | Autorizada y completada: 0010→0012 sin drift; respaldos previo/final restaurados, 33 tablas/PK y 27 secuencias conciliadas |
| Vínculo autorizado de Dueña | Empleado #2 trasladado atómicamente a administrador; ambas cuentas/roles/contraseñas conservados, 7 sesiones revocadas, 2 eventos nuevos; otras 30 tablas intactas |
| Runtime real local | db/backend/web saludables; 22 comprobaciones HTTP aprobadas, incluidas diez SPA, assets, salud/readiness, anónimo 401 y rutas retiradas 404 |

Evidencia temporal de prueba: `%TEMP%/hdb-improvements-backend-final.log`,
`hdb-improvements-frontend-verified.log`, `hdb-improvements-connected.log`,
`hdb-improvements-chart-check.log`; capturas en `hdb-integral-connected-20261103`
y `hdb-integral-chart-final-20261103`. Son datos exclusivamente sintéticos, fuera
de Git. Se revisaron también los tres PNG de los PDF (72 imágenes finales).

Los siguientes comandos fueron usados realmente; las ejecuciones intermedias con fallos se corrigieron sin bajar el umbral
90 %, eliminar pruebas críticas ni declarar éxito cuando fallaron.

```powershell
# Desde backend/
uv run --locked ruff check .
uv run --locked ruff format --check .
uv run --locked python -m mypy
uv lock --check
uv run --locked python -m alembic heads

# Desde la raíz; DB tmpfs vacía del proyecto test
docker compose -p hdboutique-test -f compose.test.yaml run --rm -v "${PWD}/backend:/workspace/backend" backend uv run --locked python -m pytest --run-postgres --cov=app --cov-report=term-missing
docker compose -p hdboutique-test -f compose.test.yaml build backend web
docker build -f frontend/Dockerfile.test -t hdboutique-frontend:test .
docker run --rm hdboutique-frontend:test npm run verify
# Con api/web saludables y sembrado ya completado; evita repetir la semilla protegida
# Las capturas se montaron en un destino temporal, como se describe arriba.
docker compose -p hdboutique-test -f compose.test.yaml --profile integration run --rm --no-deps -v "${PWD}/frontend/tests:/workspace/frontend/tests" browser
# Tras el ajuste exclusivamente visual de etiquetas:
docker compose -p hdboutique-test -f compose.test.yaml --profile integration run --rm --no-deps -v "${PWD}/frontend/tests:/workspace/frontend/tests" browser npm run test:integration -- dashboard-visual.spec.ts
docker compose -p hdboutique-test -f compose.test.yaml --profile integration exec -T api uv run --locked python -m alembic check
```

En Windows, el lanzador nativo mypy fue bloqueado por Control de aplicaciones;
python -m mypy del mismo entorno uv ejecutó correctamente la comprobación.
Las suites Docker usan Python/uv y dependencias bloqueadas del proyecto.

Corte local autorizado: se ejecutaron además los siguientes comandos (todos con
el prefijo `docker compose -p hdboutique-dev --env-file .env.docker -f compose.yaml -f compose.dev.yaml`):

```powershell
up -d --wait db
exec -T db sh -c 'umask 077; pg_dump -U hdboutique_owner -d hdboutique -Fc -f /tmp/hdb-integral-6f0fa328-before.dump'
exec -T db psql -X -v ON_ERROR_STOP=1 -U hdboutique_owner -d postgres -c "CREATE DATABASE hdboutique_integral_before_verify_6f0fa328 OWNER hdboutique_app TEMPLATE template0"
exec -T db pg_restore --exit-on-error --no-owner --role=hdboutique_app -U hdboutique_owner -d hdboutique_integral_before_verify_6f0fa328 /tmp/hdb-integral-6f0fa328-before.dump
run --rm --no-deps -e HDB_DATABASE_NAME=hdboutique_integral_before_verify_6f0fa328 backend uv run --locked python -m alembic upgrade head
run --rm --no-deps -e HDB_DATABASE_NAME=hdboutique_integral_before_verify_6f0fa328 backend uv run --locked python -m alembic check
run --rm --no-deps backend uv run --locked python -m alembic upgrade head
run --rm --no-deps backend uv run --locked python -m alembic check
exec -T db sh -c 'umask 077; pg_dump -U hdboutique_owner -d hdboutique -Fc -f /tmp/hdb-integral-6f0fa328-final.dump'
exec -T db psql -X -v ON_ERROR_STOP=1 -U hdboutique_owner -d postgres -c "CREATE DATABASE hdboutique_integral_final_verify_6f0fa328 OWNER hdboutique_app TEMPLATE template0"
exec -T db pg_restore --exit-on-error --no-owner --role=hdboutique_app -U hdboutique_owner -d hdboutique_integral_final_verify_6f0fa328 /tmp/hdb-integral-6f0fa328-final.dump
up -d --wait --wait-timeout 180 backend web
ps
```

Resultado: ambas restauraciones completas coinciden, ensayo y upgrade real en
0012 sin drift, proyección histórica conservada, servicios saludables. Se copiaron
ambos dumps al directorio privado y se verificaron sus SHA-256 con Get-FileHash.
Los comandos de captura/conciliación, traslado transaccional autorizado y humo
HTTP están en los helpers privados cutover_check.py, transfer_owner_link.py y
http_smoke.py, junto a sus JSON de evidencia, en el directorio de [corte](cutover.md).

## E. Riesgos y limitaciones

La verificación funcional con comercio sintético se limita a hdboutique_test/tmpfs.
En desarrollo solo se aplicaron las dos revisiones y el traslado de vínculo
expresamente autorizado. No hubo bootstrap, cambios de contraseñas, comercio
sintético ni migraciones automáticas. .env.docker, volumen y respaldos anteriores
se conservaron. Se generaron nuevos respaldos privados con ACL exclusiva.

Una cuenta sin empleado vinculado conserva login y sus permisos, pero no puede
registrar ventas/compras/recepciones. Resolver ese vínculo requiere identificar al
empleado real, sin asignarlo arbitrariamente. La recuperación de contraseña de
empleados vinculados continúa en Editar empleado. Sin formulario de cuentas, las
cuentas no vinculadas requieren la API administrativa existente; no hay módulo nuevo.
La Dueña ya tiene el vínculo autorizado #2. La cuenta anterior de ese empleado se
conservó sin vínculo, con sus roles e historial; no se reasignaron operaciones
anteriores ni se crearon empleados ficticios. No se utilizó la contraseña del
propietario ni se inició su sesión para el humo real.

Los históricos sin proveedor o costo principal no se completan automáticamente.
Se pueden asociar proveedores y registrar costo desde Productos antes de comprar.
Los teléfonos históricos inválidos no se reescriben: Delivery requiere completarlos
con un móvil válido antes de confirmar la venta. Recibos anteriores conservan sus
instantáneas. No se probó impresora física ni se desplegó públicamente.

## F. Recomendaciones

Conservar los respaldos y las dos bases de verificación documentadas en cutover.md.
El propietario puede entrar con su contraseña vigente y comprobar una impresión
física de 80 mm. El login personal y la impresora física no forman parte de la
comprobación automatizada; no quedan migraciones pendientes de este incremento.

Mantener los cambios sin commit hasta la revisión del propietario. No se propone
otro módulo, rol, medio de pago ni ampliación de negocio.
