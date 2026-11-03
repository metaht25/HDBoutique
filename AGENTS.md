# Instrucciones de trabajo para HDBoutique

Estas instrucciones se aplican al repositorio completo. Las instrucciones nuevas
del usuario prevalecen sobre estas convenciones del proyecto.

## Alcance y autonomia

- Al iniciar una sesion, si existe `README.codex-local.md` en la raiz, leerlo
  antes de planificar o editar. Es la guia local de continuidad por fases para
  Codex CLI y esta excluida de Git; no forzar su inclusion en commits. Si falta,
  usar docs/roadmap.md y solicitar al usuario el contexto local solo si hace falta.
- Trabajar sobre el repositorio local existente; conservar funcionalidades validas
  e historicos. No clonar nuevamente ni acceder al repositorio remoto.
- Ejecutar solo la fase solicitada en [docs/roadmap.md](docs/roadmap.md).
  Completar sus tareas normales y verificaciones sin pedir confirmaciones repetidas.
- Terminar al cerrar la fase e informar resultado, limites y commits; no comenzar
  automaticamente la siguiente.
- Si una decision B01-B21 afecta el trabajo, consultar
  [docs/business-rules.md](docs/business-rules.md). No inventar su respuesta;
  avanzar en lo independiente y pedir solo la decision necesaria.
- El proyecto lo desarrolla una sola persona. No delegar ni crear otros chats o
  subagentes salvo instruccion explicita del usuario.

## Git

- Trabajar unicamente en `Cris-develop`. Comprobar rama y estado antes de editar.
- Si la rama no es la esperada o hay cambios ajenos que se solapan, preservar el
  trabajo y resolver el alcance antes de modificarlo. No forzar cambios de rama.
- Crear commits locales pequenos con Conventional Commits y mensajes en ingles.
- Preparar rutas explicitas; revisar `git diff --cached` y `git diff --cached --check`.
- No ejecutar push, fetch, pull, crear PR ni modificar remotos. El propietario
  realiza el push manualmente. No escribir sobre main ni reescribir historial.
- No descartar cambios ajenos, hacer stash automatico ni ejecutar reset/clean
  destructivos para obtener un estado limpio.
- Seguir [docs/collaboration.md](docs/collaboration.md).

## Estado y documentos de referencia

- Acuerdo vigente de reconstrucción: ventas solo y siempre al contado, efectivo,
  transferencia o mixto completo; sin abonos, crédito ni pagos parciales.
  El usuario autoriza correcciones trazables: anulacion total
  supervisada, motivo, original conservado, devolucion del importe y reposicion
  solo de mercancia efectivamente devuelta. Implementados pago completo atomico obligatorio
  con venta y anulación auditada; caja/turnos retirados de la operación, historia
  conservada. Head de código 0010_optional_profile_phone, 32 tablas;
  estado concreto de migración local y respaldos en docs/cutover.md.
  Historicos sin pago no se marcan como cobrados. Ver B04/B06/B10 y
  docs/cash-register.md. Empleados: docs/employees.md. Configuracion inicial
  completada: docs/initial-setup.md. V1 funcional local, sin datos ficticios ni
  carga comercial automatica; el propietario prepara referencias desde la interfaz.
  No ampliar a tarjeta, credito ni abonos.

- Fase 15 cerrada para el corte local autorizado en hdboutique-dev/base hdboutique,
  volumen hdboutique-dev_postgres_data. Web http://127.0.0.1:8080 (Nginx),
  FastAPI 127.0.0.1:8001 y PostgreSQL 127.0.0.1:5433. Solo loopback, no despliegue
  publico. Compose base mantiene production/negocio false y HTTPS/Secure al habilitar.
- Django/DRF, grupo legacy, requirements.txt, drivers SQL Server y adaptadores/
  servicios frontend retirados. Codigo anterior preservado en Git/archivo privado.
  Diez pantallas Dueña y cinco Colaborador TS/FastAPI; navegación exacta en
  docs/frontend-modules.md. Sin caja/turnos operativos; reportes
  en Ventas/Historial, catálogos en Productos/directorios, cuentas en Empleados
  y perfil boutique en encabezado. Sin Caja/Reportes/Configuración en menú.
- El usuario confirmo que no existe origen/historicos SQL Server y no utiliza
  /admin/ (B11). Empleados implementado; abonos excluidos; no crear datos ficticios para
  completar referencias. Una venta/compra requiere un empleado existente.
- Corte local 0001 -> 0004_atomic_sales: respaldo previo/final restaurados en bases
  separadas, filas/identidades conciliadas. 24 tablas mas alembic_version. Ninguna
  revision editada ni migracion automatica. Sin carga de registros comerciales.
  Primer Administrator creado expresamente; credenciales privadas en carpeta de
  respaldo ignorada. No repetir bootstrap ni imprimir credenciales/evidencias.
- Operacion, limites y retorno: [docs/cutover.md](docs/cutover.md). Conservar
  .env.docker, respaldos y volumen. No usar down -v ni restaurar --clean sobre
  desarrollo. Autorizar nuevos destinos/trabajos de datos antes de ejecutarlos.
- B01/B02/B03/B04/B05/B09/B14 confirmados para sus alcances: stock disponible,
  cantidadstock legado inmutable; cantidad inicial explícita auditada incluso cero,
  nulos requieren conteo; precio de producto costo × 1.15/ROUND_HALF_UP;
  recepcion completa unica y ventas inmutables; dinero NIO/Decimal/dos decimales,
  precio/total de servidor y cuenta/empleado auditados. B14: 0 agotado, 1-5 bajo,
  >5 suficiente; null/negativo aparte. Fecha comercial America/Managua del servidor.
- Solo Dueña/Administrator y Colaborador/Cashier. Manager retirado, sin creación
  ni login; cuentas históricas desactivadas/auditadas sin convertir privilegios.
  Cashier consulta catálogo/clientes y actividad/recibos propios, crea clientes
  solo dentro de Nueva venta sin editar existentes
  y registra ventas; sin compras/proveedores/costos/personal/reportes globales.
- Domicilio directo con departamento/municipio coherentes; teléfono textual hasta
  10. Cliente general técnico único, regular y delivery con costo manual incluido.
  Activación persistente de productos/proveedores/empleados; clientes de consulta
  conservan sus estados históricos sin mutaciones nuevas. Alta de
  empleado + cuenta atómica, contraseña asignada por Dueña (6–128), teléfono
  canónico de ocho dígitos prefijo 7/8 y revocación al desactivar. Sin correo laboral
  nuevo ni cambio obligatorio de contraseña. Ubicaciones iniciales permanentes
  (3 departamentos/28 municipios), combobox dependientes y tallas S/M/L/XL/XXL.
  Perfil/logo durable y recibo PDF/impresión de 80 mm. Sin municipio inferido,
  deuda, descuentos, pérdidas ni recepción parcial.
- [Reglas](docs/business-rules.md), [autenticacion](docs/authentication.md),
  [frontend](docs/frontend-modules.md), [compras](docs/purchases-inventory.md),
  [ventas](docs/sales.md), [reportes](docs/reporting.md).
- [Arquitectura](docs/architecture.md), [convenciones](docs/conventions.md),
  [calidad](docs/quality.md), [desarrollo](docs/development.md),
  [resultados](docs/characterization.md), [Docker](docs/docker.md),
  [datos](docs/data-model.md), [migracion](docs/migration.md).
- data_migration mantiene herramientas y ensayos offline historicos sin drivers
  SQL Server distribuidos. Un origen futuro requiere inventario/ensayo autorizado;
  no presentar los ensayos sinteticos como traslado de datos reales.
- Fase 16: [contrato y cierre](docs/phase-16-usability.md). B15-B21 sustituyen
  contraseña temporal/correo de empleado, edición de directorios, tallas
  administrables, recibos con prefijo y caja/turnos. Clientes se crean en Nueva
  venta; proveedores en Compras, con costos por producto sin alterar precios
  principales ni compras anteriores. Recibo decimal usa identidad del pago.
  Ver resultados reales y migración en docs/characterization.md y docs/cutover.md.

## Implementacion

- Identificadores nuevos en ingles: variables, funciones, clases, archivos de
  codigo, modulos, tablas, columnas, esquemas y endpoints. Comentarios,
  documentacion y textos al usuario pueden estar en espanol.
- Mantener nombres legacy solo donde el contrato existente o su adaptador lo
  requiera. No renombrar contratos publicos o datos sin revisar consumidores.
- Python: PEP 8, snake_case, PascalCase y constantes UPPER_SNAKE_CASE. Incorporar
  type hints en codigo nuevo y preservar la precision monetaria con Decimal.
- Aplicar arquitectura por funcionalidades y capas, servicios para casos de uso
  y transacciones, repositorios concretos. Evitar abstracciones sin necesidad.
- Conservar React/Vite y migrar gradualmente a TypeScript cuando corresponda.
- No agregar funcionalidades ni dependencias que no necesite la fase autorizada.
- No asumir semantica de stock, recepcion, saldos, roles o caja pendiente de confirmar.

## Python y herramientas

- uv es el gestor oficial del backend. No introducir Poetry, Pipenv ni pip como
  gestores principales; no generar archivos de dependencias redundantes.
- pyproject.toml, uv.lock y .python-version estan en backend/. Usar Python
  3.13.15 y uv 0.12.10. Versionar el bloqueo y excluir .venv/caches.
- Desde backend/, usar `uv sync --locked` y `uv run --locked ...` para aplicaciones,
  pruebas y calidad. Para Pytest/Uvicorn preferir `python -m pytest` y
  `python -m uvicorn` dentro de uv, compatibles con los lanzadores de este Windows.
  Cambios de dependencias mediante uv.
- Solo el grupo dev se instala por defecto. Para runtime usar
  `uv sync --locked --no-default-groups`. No reintroducir grupo legacy,
  requirements.txt, Django ni drivers SQL Server retirados en fase 15.
- Mientras no exista ese entorno, las pruebas sin dependencias pueden ejecutarse
  con Python/Node existentes segun la guia de caracterizacion.
- No instalar dependencias, iniciar servicios ni crear entornos durante una fase
  exclusivamente documental. En fases de entorno o implementacion, ejecutar las
  acciones normales que requiera el alcance autorizado.
- Alembic gestiona el esquema; usar `uv run --locked python -m alembic ...`.
  No usar create_all, stamp para simular una migracion ni editar revisiones ya
  aplicadas. Nuevos modelos deben importarse en infrastructure/database/models.py.
  Los servicios futuros abren/confirman transacciones; los repositorios no hacen
  commits propios ni comparten una Session global.

## Datos y secretos

- No imprimir secretos, leer/exportar datos personales sin necesidad ni incorporar
  .env, respaldos, archivos de base o credenciales a codigo, logs, pruebas o imagenes.
- Usar datos sinteticos en pruebas. La caracterizacion Django fue retirada con
  su backend; los contratos de referencia conservados son historicos.
- No consultar ni modificar una base real por el mero hecho de encontrar una
  configuracion local. Para la fase de datos, confirmar origen/destino autorizados.
- Compose de desarrollo usa .env.docker ignorado y volumen hdboutique-dev_postgres_data.
  No imprimir config expandida, borrar volumenes ni cambiar claves como sustituto
  de una rotacion. No iniciar migraciones automaticamente al arrancar FastAPI.
- La integracion PostgreSQL usa exclusivamente `docker compose -p hdboutique-test
  -f compose.test.yaml ...`, archivo independiente con tmpfs y claves sinteticas.
  `--run-postgres` requiere HDB_TEST_DATABASE_* y una base vacia terminada en _test;
  nunca usar las credenciales de desarrollo como fallback. Sin esa opcion se
  omiten los casos PostgreSQL y no se declara integracion aprobada.
- No ejecutar migraciones, escrituras, restauraciones o corte contra datos reales
  fuera de su alcance especifico. Mantener respaldos y conciliacion segun la guia.
- No descartar historicos ni inferir valores faltantes para hacer pasar una prueba.

## Verificacion y entrega

- Ejecutar verificaciones proporcionales al cambio. Para documentacion, revisar
  enlaces, ejemplos, referencias, estado Git y diff; no agregar pruebas de relleno.
- Para cambios de codigo, ejecutar las pruebas relevantes y registrar el resultado
  real. No afirmar que una suite paso si no se ejecuto o quedo omitida.
- Mantener separados comportamiento valido y defectos D01-D12. Al corregir un
  defecto, agregar la regresion pertinente y actualizar contrato/muestras si procede.
- Mantener el arbol limpio al terminar cuando los cambios sean propios y esten
  verificados; informar cualquier cambio ajeno preservado.
