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
- Si una decision B01-B14 afecta el trabajo, consultar
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

- Aplicacion legacy: Django/DRF y SQL Server en `backend/hdboutique/`, React/Vite
  JavaScript en `frontend/`. FastAPI en `backend/app/` ofrece salud.
  Los modulos de fase 7 locations/catalog/customers/suppliers estan implementados,
  deshabilitados por defecto; fase 8 incorpora autenticacion y permisos obligatorios.
  Production exige origen HTTPS y cookies Secure. Contratos y
  compatibilidad confirmada: docs/foundation-api.md. Empleados sigue pendiente.
  Hay 24 modelos SQLAlchemy; 0003_purchase_receipts agrega workflows, costes
  historicos y movimientos de recepcion. Compras e inventario de fase 9 implementados
  segun docs/purchases-inventory.md, sin aplicar migraciones contra desarrollo.
  La revision inicial 0001_compatibility se conserva, sin historicos
  trasladados. B09 confirmado y fase 8 verificada en PostgreSQL aislado;
  contratos/operacion en docs/authentication.md. B01/B02/B05 y B03 para compras
  confirmados en fase 9: stock disponible, cantidadstock legacy inmutable, recepcion
  completa unica, precios de proveedor historicos y envio separado. Stock nuevo
  cero, campos de stock solo lectura en CRUD; no convertir nulos existentes a cero.
  Fase 10 implementa ventas segun docs/sales.md; head 0004_atomic_sales agrega
  auditoria/idempotencia y salidas de inventario, sin migrar desarrollo. B03 de
  ventas/B04 y permisos B09 confirmados: precio de producto copiado, total de
  servidor, NIO/Decimal/dos decimales, sin descuentos/precio editable; ventas
  inmutables sin edicion/borrado/anulacion. Los tres roles registran y consultan
  ventas, con empleado vinculado o existente explicito y cuenta auditada.
  Las demas reglas definitivas siguen pendientes; el usuario confirmo conservar ambos
  campos de existencias y direccion ligada solo a departamento en esta base inicial.
  Docker/Compose y PostgreSQL local estan disponibles; readiness comprueba conexion
  cuando esta configurada. Operacion y secretos: [docs/docker.md](docs/docker.md).
- Fase 6 completada para el alcance disponible: no existe instancia/copia SQL
  Server ni historicos a trasladar. Herramientas en backend/data_migration/ y
  ensayos sinteticos verificados contra `db:5432/hdboutique_test`. Si aparece un
  origen futuro, debe inventariarse y conciliarse antes de usarlo. Procedimiento y
  limites: [docs/data-transfer.md](docs/data-transfer.md).
- Arquitectura: [docs/architecture.md](docs/architecture.md).
- Convenciones: [docs/conventions.md](docs/conventions.md).
- API existente: [docs/legacy-api-contracts.md](docs/legacy-api-contracts.md).
- Cambios de contrato: [docs/contract-compatibility.md](docs/contract-compatibility.md).
- Esquema y traslado: [docs/data-model.md](docs/data-model.md) y
  [docs/migration.md](docs/migration.md).
- Calidad y comandos: [docs/quality.md](docs/quality.md),
  [docs/development.md](docs/development.md) y
  [docs/characterization.md](docs/characterization.md).

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
- Los grupos dev/legacy se instalan por defecto durante la transicion. Para
  instalacion solo runtime usar `uv sync --locked --no-default-groups`; --no-dev
  por si solo no excluye Django. requirements.txt es una exportacion de legacy,
  no se edita manualmente; su comando esta en la guia de desarrollo.
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
- Usar datos sinteticos en pruebas. La caracterizacion Django utiliza su ejecutor
  aislado con motor dummy; no sustituirlo por settings productivos.
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
