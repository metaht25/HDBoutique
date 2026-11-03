# Auditoría de las observaciones del propietario

Solicitud del 2 de noviembre de 2026, sobre Cris-develop después de Fase 16.
Es una corrección autorizada del sistema existente, sin nueva fase ni commits.
Se leyó mejoras.docx y se inspeccionó su única captura. El texto pegado por el
propietario define el alcance; el Word aporta observaciones y evidencia visual.

## A Diagnóstico inicial

- Login: ModuleAccess usaba un panel genérico de administración dentro del layout
  lateral anónimo, con poca jerarquía y sin control de visibilidad de contraseña.
- Cargo: PartyForm enviaba texto libre y StaffService lo persistía sin catálogo.
  No existe catálogo de cargos aprobado. Vendedor es la única opción nueva justificada;
  valores de fixtures históricos no constituyen autorización de nuevos cargos.
- Proveedor: Purchases entregaba onDraft a PartyForm. Confirmar el modal no emitía
  una solicitud HTTP: solo retenía el contacto en memoria para incluirlo al guardar
  una compra. Cerrar la compra perdía ese borrador. POST /suppliers está bloqueado
  deliberadamente por la política de alta contextual; habilitarlo globalmente no
  resuelve correctamente este flujo.
- Teléfonos: clientes/proveedores tenían límites de longitud pero no validación de
  dígitos. La captura muestra letras en Teléfono; Dirección exacta es texto legítimo.
  Los empleados ya tenían validación canónica, que se conserva.
- Cantidades/importes: inputMode no validaba entrada. El backend protege enteros,
  rangos y Decimal, pero aceptaba algunas cadenas con notación numérica ambigua.
- Perfil: phone_number era NOT NULL, obligatorio en ProfileWrite y parte de ready.
  Eso impedía guardar la ausencia de teléfono solicitada. El inventario autorizado
  encontró cero perfiles y una Dueña activa; no se extrajeron datos personales.

## B Cambios implementados

- Session/SignIn y MainLayout: presentación anónima centrada con estilos aislados.
- PartyForm: Cargo seleccionable; teléfonos válidos; alta de proveedor persistida.
- Purchases: selección automática tras éxito, actualización de consulta y confirmación
  visible; no se descartan líneas válidas al registrar otro proveedor contextual.
- POST /purchases/suppliers: PurchasingIdentity, servicio existente, transacción única
  para contacto/domicilio/auditoría. Misma cuenta/clave/cuerpo devuelve el mismo ID;
  cuerpo distinto devuelve 409. Bloqueo advisory serializa solicitudes de esa clave.
  Solo se guardan hashes en management_events, sin teléfonos ni cuerpos en auditoría.
- useCashCommand: conserva solicitudes inciertas por cuenta/operación en sessionStorage,
  permite recuperar proveedor después de recarga y bloquea envíos simultáneos.
- StaffService: nuevo cargo únicamente Vendedor o null; otro texto solo puede
  conservarse si ya era el cargo del empleado editado. No cambia perfiles de acceso.
- Contratos de entrada: teléfonos ASCII con ceros iniciales preservados; dinero sin
  exponentes/separadores ambiguos; lecturas históricas no se restringen retroactivamente.
- TextField: entrada controlada para cantidades/importes, admite borrar y pegar valores
  válidos. Referencias, direcciones y nombres mantienen su naturaleza textual.
- Perfil: migración 0010_optional_profile_phone hace nullable una columna existente;
  no agrega tablas ni modifica revisiones aplicadas. Downgrade falla si existen NULL,
  en lugar de fabricar un teléfono. Ticket HTML/impresión y PDF omiten líneas vacías.
- app.operations.set_boutique_profile: actualización explícita por destino y Dueña
  existente, auditada; jamás se ejecuta al arrancar. Destino local autorizado hdboutique.
- data_migration/target mantiene el teléfono obligatorio de su esquema archivado 0006.
  Este ajuste evita que la nueva metadata altere la validación de ensayos offline.

## C Diseño y evidencia visual

Identidad fucsia y fondo cálido; tarjeta de acceso con ancho limitado, marca y
jerarquía legibles, separación uniforme, foco visible, carga/deshabilitado/error y
mostrar/ocultar contraseña. Sin nuevas dependencias ni cambios de cookies, sesiones,
CSRF o contraseñas. Capturas y recibos sintéticos permanecen fuera de Git.

## D Verificación

Resultados nuevos: 308 pruebas backend/PostgreSQL aprobadas, cobertura 92.32%.
Ruff, formato (170 archivos), mypy (108 fuentes) y uv lock --check aprobados.
Frontend: 98 Vitest y 22 E2E interceptadas aprobadas; TypeScript, ESLint y build
aprobados. La comprobación final de tipos/lint se repitió con las fuentes y pruebas
actuales. Integración conectada: 11 aprobadas en 1.4 minutos, sobre Nginx/FastAPI/PostgreSQL reales.
El proveedor se verificó mediante GET antes de guardar la compra y en compras
posteriores. Crear/editar empleado, reemplazar contraseña, revocar sesiones y los
permisos de ambos perfiles se comprobaron con cuentas sintéticas.

La primera suite backend obtuvo 289 aprobadas y cuatro fallos del comparador de
metadata archivada 0006; se corrigió su representación del teléfono obligatorio y
la suite completa posterior pasó. Dos E2E de empleados usaban option.first y se
acotaron al listbox Departamento. Las pruebas conectadas antiguas que escribían
Ventas/Atención en Cargo se adaptaron a selectOption y a las opciones autorizadas.
Un intento de lanzar browser volvió a iniciar seed sobre la base ya preparada;
el guard de seed rechazó la repetición. Se ejecutó browser con --no-deps y las
repeticiones completas partieron de tmpfs vacío, sin tocar desarrollo.

Se inspeccionaron ocho capturas focales (login en tres tamaños, proveedor y empleado
en escritorio/móvil y cliente regular móvil) y tres renders PDF (mixto, anulado e
impresión Chromium). Sin logo roto ni línea de teléfono boutique vacía. Poppler
advirtió sobre fuentes auxiliares Symbol/ArialUnicode; los renders revisados
conservaron texto, acentos y símbolos legibles. Impresión de navegador usa papel
80×297 mm; PDF del servidor usa altura calculada según contenido.

Persistencia local: perfil único 1 creado con H&D Boutique, Milagro de Dios,
teléfono NULL y logo NULL, auditado por la Dueña existente. Migración 0009→0010
aplicada sin drift. Respaldo previo/final restaurados en bases nuevas separadas y
conciliados. Solo revisión, perfil y un evento nuevo; demás tablas y secuencias
intactas. Runtime 8080/8001/5433 saludable, diez SPA y salud 200, anónimos 401.
El respaldo y las evidencias se conservan en backups/owner-corrections-20261102-0d8baae8.

Comandos desde backend:

```powershell
uv run --locked ruff check .
uv run --locked ruff format --check .
uv run --locked python -m mypy
uv lock --check
```

Desde raíz: imagen backend y PostgreSQL exclusivamente hdboutique-test/compose.test.yaml;
Pytest --run-postgres --cov=app; imagen frontend:test con npm run verify;
perfil integration de Compose con npm run test:integration. Las pruebas usan datos
sintéticos exclusivamente en PostgreSQL tmpfs, nunca en desarrollo.

La suite final de backend se ejecutó con fuentes actuales montadas de solo lectura:

```powershell
docker compose -p hdboutique-test -f compose.test.yaml run --rm `
  -v "${PWD}/backend/app:/workspace/backend/app:ro" `
  -v "${PWD}/backend/tests:/workspace/backend/tests:ro" `
  -v "${PWD}/backend/migrations:/workspace/backend/migrations:ro" `
  -v "${PWD}/backend/data_migration:/workspace/backend/data_migration:ro" `
  backend uv run --locked python -m pytest --run-postgres --cov=app --cov-report=term --tb=short -q
docker run --rm hdboutique-frontend:test npm run verify
docker compose -p hdboutique-test -f compose.test.yaml --profile integration run --rm --no-deps browser
```

Requieren imágenes reconstruidas y base de prueba vacía antes de la suite/seed.
La última integración montó frontend/tests de solo lectura para verificar la
adaptación final de settings.spec.ts y guardó resultados en integration-verified.
No volver a ejecutar seed al lanzar browser contra la base ya preparada.

## E Riesgos y límites

Vendedor es la única opción laboral nueva aprobada; ampliar cargos requiere una
decisión comercial. Los textos históricos permanecen sin reinterpretarlos como roles.
Un proveedor confirmado desde Compras se conserva aunque luego se cancele la compra;
el formulario comunica esa persistencia. La compra conserva su propia atomicidad.
La idempotencia evita repetir una misma intención; registrar explícitamente otra
intención igual no implica que dos personas/empresas deban fusionarse por nombre.
No se modifica autenticación para probar con credenciales de desarrollo.
No se probó una impresora física ni se utilizó la contraseña personal del propietario.
Los recorridos autenticados se ejecutaron contra la base sintética aislada.

## F Recomendaciones

- Alta: mantener y comprobar respaldos periódicos antes de ampliar el uso comercial;
  la restauración puntual no sustituye una política de retención del propietario.
- Media: si crece la auditoría, medir consultas de idempotencia de proveedores y
  evaluar un índice específico antes de agregar otra abstracción de persistencia.
- Baja: acordar otros cargos laborales cuando exista necesidad real; mantener por
  ahora la opción explícitamente autorizada y la lectura de cargos históricos.

## G Git

Rama Cris-develop, HEAD inicial 89646ae. Árbol inicial limpio. Cambios de esta
auditoría conservados sin stage ni commit conforme a la solicitud. No hubo operaciones
remotas, merge, PR, cambios de secretos ni descarte de trabajo ajeno. El listado final
se obtiene con git status --short y el diff se revisa con git diff --check.

Inventario final de rutas (M modificada, ?? nueva):

```text
 M AGENTS.md
 M README.md
 M backend/app/api/schemas.py
 M backend/app/modules/boutique/models.py
 M backend/app/modules/boutique/pdf.py
 M backend/app/modules/boutique/schemas.py
 M backend/app/modules/boutique/service.py
 M backend/app/modules/customers/schemas.py
 M backend/app/modules/purchases/router.py
 M backend/app/modules/purchases/schemas.py
 M backend/app/modules/staff/service.py
 M backend/app/modules/suppliers/schemas.py
 M backend/app/modules/suppliers/service.py
 M backend/data_migration/target.py
 M backend/tests/integration/test_boutique_experience.py
 M backend/tests/integration/test_migrations.py
 M backend/tests/integration/test_staff.py
 M docs/architecture.md
 M docs/business-rules.md
 M docs/cutover.md
 M docs/data-model.md
 M docs/employees.md
 M docs/frontend-modules.md
 M docs/initial-setup.md
 M docs/purchases-inventory.md
 M docs/roadmap.md
 M frontend/src/features/boutique/PartyForm.tsx
 M frontend/src/features/boutique/ProfileModal.tsx
 M frontend/src/features/boutique/Purchases.tsx
 M frontend/src/features/boutique/ReceiptModal.tsx
 M frontend/src/features/cash-register/useCashCommand.ts
 M frontend/src/features/session/ModuleAccess.tsx
 M frontend/src/layouts/MainLayout.module.css
 M frontend/src/layouts/MainLayout.tsx
 M frontend/src/shared/ui/TextField.tsx
 M frontend/tests/components/cash-command.test.ts
 M frontend/tests/e2e/employees.spec.ts
 M frontend/tests/integration/application.spec.ts
 M frontend/tests/integration/settings.spec.ts
?? backend/app/operations/set_boutique_profile.py
?? backend/migrations/versions/0010_optional_profile_phone.py
?? backend/tests/integration/test_owner_corrections.py
?? backend/tests/unit/test_owner_numeric_validation.py
?? docs/owner-corrections-audit.md
?? frontend/src/features/session/SignIn.module.css
?? frontend/tests/components/owner-corrections.test.tsx
?? frontend/tests/integration/login-visual.spec.ts
?? frontend/tests/integration/owner-corrections.spec.ts
```
