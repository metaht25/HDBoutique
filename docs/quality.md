# Calidad y verificacion

## Comprobaciones por cambio

| Cambio | Verificacion |
| --- | --- |
| Documentacion | Enlaces locales, comandos/rutas reales, coherencia de estado y diff |
| Contrato/API | Validacion, consumidor, permisos y errores seguros |
| Persistencia/dinero | PostgreSQL aislado, Decimal, restricciones, rollback e idempotencia |
| Compra/venta/inventario | Operacion completa, ultima unidad, concurrencia y fallo intermedio |
| Sesion | Login/logout, CSRF/origen, revocacion, roles y respuestas obsoletas |
| UI | Tipos/lint, formularios/errores, teclado, responsive, URL/recarga y E2E |
| Operacion/datos | Destino autorizado, respaldo restaurado, huellas de campos/identidades y retorno |

No agregar pruebas que solo reflejen la implementacion ni repetir suites sin un
cambio, fallo o incertidumbre que lo justifique. Registrar resultados realmente
ejecutados; sin --run-postgres no se declara integracion PostgreSQL aprobada.

## Herramientas y aislamiento

Backend: uv bloqueado, Pytest con advertencias como errores, Ruff y mypy estricto
sobre app/data_migration. Cobertura de app con umbral 90%, incluyendo ORM: no
confundir lineas de modelos con evidencia de concurrencia o reglas comerciales.
Docker Linux evita restricciones nativas de este Windows.

PostgreSQL exclusivamente con -p hdboutique-test -f compose.test.yaml, tmpfs,
credenciales sinteticas, base vacia terminada en _test y --run-postgres expreso.
No fallback a HDB_DATABASE_* ni credenciales de desarrollo. La suite verifica
migraciones desde vacio, drift, FK, dinero, nulabilidad, transacciones, autoria,
idempotencia, recepcion/venta concurrentes, permisos y snapshots de lectura.

Frontend: TypeScript estricto, ESLint, Vitest/Testing Library y Chromium escritorio/
movil. compose.frontend-test.yaml no tiene red/backend y usa API interceptada.
El perfil integration prueba la imagen Nginx con FastAPI/PostgreSQL sinteticos,
sin interceptar API; un relay TCP mantiene origen loopback sin cambiar seguridad
del navegador. No es una prueba de carga ni una certificacion de produccion.

Las pruebas/adaptadores Django se retiraron juntos en fase 15: cuatro pruebas
Pytest de caracterizacion y 41 casos Node ya no corresponden a consumidores
activos. Se conservan contratos de referencia en docs/reference y resultados
historicos en [caracterizacion](characterization.md), sin presentar su retirada
como correccion de D03 en el backend anterior.

## Revision y entrega

Comprobar rama/estado, preservar trabajo ajeno, ejecutar verificaciones pertinentes
y revisar diff completo. Preparar rutas explicitas, git diff --cached y --check,
crear commits locales Conventional Commits y comprobar arbol limpio. Sin remoto.

Secretos fuera de codigo/logs/imagenes. Error HTTP sin SQL ni valores recibidos.
Revisar auditorias de dependencias y Gitleaks con redaccion cuando corresponda;
una auditoria temporal no garantiza ausencia de vulnerabilidades futuras.

Operaciones reales solo en destino/ventana expresamente autorizados. Las pruebas
con escrituras siguen aisladas aunque se haya autorizado un corte local. Humo
local limitado a login/logout y lecturas; no crear datos sinteticos en desarrollo.
[Corte y respaldo](cutover.md), [Docker](docker.md), [comandos](development.md).

## Reconstrucción de la boutique

La verificación conectada incluye pagos efectivo/transferencia/mixto, cambio,
cliente general estable, alta inline regular/delivery, producto costo × 1.15,
existencia inicial, compra/recepción única, anulación sin turno y sin mercancía
devuelta, endpoints de caja retirados, activación de productos/proveedores y
contraseña asignada por Dueña con revocación de sesiones. La suite backend agrega
costos de varios proveedores y conservación/protección de maestros e historia.
Frontend cubre teléfono (pegado/borrado/edición intermedia) y combobox (teclado,
acentos, vacíos y cambios sucesivos de departamento). Ninguna escritura de prueba
usa desarrollo.

Capturas: diez rutas Dueña y cinco Colaborador a 1440×1000 y 390×844, menú móvil,
modales y sus acciones, ticket/impresión. PDF renderizado con Poppler y ancho
verificado. La inspección de imágenes es necesaria; un test de overflow no prueba
fidelidad visual. [Inventario y resultado](visual-reconstruction.md).
