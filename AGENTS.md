# Instrucciones de trabajo para HDBoutique

Estas instrucciones se aplican al repositorio completo. Las instrucciones nuevas
del usuario prevalecen sobre estas convenciones del proyecto.

## Alcance y autonomia

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

- Aplicacion existente: Django/DRF y SQL Server en `backend/hdboutique/`, React/Vite
  JavaScript en `frontend/`. No asumir que el stack objetivo ya esta implementado.
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
- En fase 3 se preparan pyproject.toml, uv.lock y .python-version. Versionar el
  bloqueo; excluir .venv y fijar versiones de herramientas cuando se implementen.
- Una vez preparado el entorno, usar `uv sync --locked` y `uv run --locked ...`
  para aplicaciones, pruebas y calidad. Cambios de dependencias mediante uv.
- Mientras no exista ese entorno, las pruebas sin dependencias pueden ejecutarse
  con Python/Node existentes segun la guia de caracterizacion.
- No instalar dependencias, iniciar servicios ni crear entornos durante una fase
  exclusivamente documental. En fases de entorno o implementacion, ejecutar las
  acciones normales que requiera el alcance autorizado.

## Datos y secretos

- No imprimir secretos, leer/exportar datos personales sin necesidad ni incorporar
  .env, respaldos, archivos de base o credenciales a codigo, logs, pruebas o imagenes.
- Usar datos sinteticos en pruebas. La caracterizacion Django utiliza su ejecutor
  aislado con motor dummy; no sustituirlo por settings productivos.
- No consultar ni modificar una base real por el mero hecho de encontrar una
  configuracion local. Para la fase de datos, confirmar origen/destino autorizados.
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
