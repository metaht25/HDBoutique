# Calidad y definicion de tarea terminada

## Verificacion proporcional

| Cambio | Verificaciones necesarias |
| --- | --- |
| Documentacion | Enlaces locales, ejemplos/comandos contra archivos reales, coherencia actual/objetivo, diff y ausencia de secretos |
| Contrato | Consumidores, ejemplos, compatibilidad y pruebas que ejerciten la frontera afectada |
| Regla de negocio | Pruebas unitarias de casos validos, limites y rechazos |
| Persistencia | Integracion con PostgreSQL, restricciones, transacciones y rollback |
| Compra/venta/inventario | Fallo intermedio, reintento, dinero exacto y concurrencia pertinente |
| Autenticacion/permisos | Acceso permitido y denegado; expiracion/cierre segun mecanismo elegido |
| Pantalla/formulario | Validacion, carga, vacio, error, teclado y responsive; pruebas de componentes/E2E segun riesgo |
| Migracion | Base vacia, actualizacion de esquema, datos representativos, conciliacion y restauracion |
| Contenedores | Construccion reproducible, salud, configuracion y persistencia |

No agregar pruebas triviales solo por aumentar conteos. Ejecutar las relevantes y
ampliar la verificacion si aparecen fallos, cambios nuevos o incertidumbre material.
Los cambios documentales no requieren volver a ejecutar toda la aplicacion.

## Cobertura existente y futura

La fuente de comandos, resultados registrados y limites de fase 1 es
[characterization.md](characterization.md). Distingue pruebas estaticas,
servicios con mocks, suite Django aislada y pruebas de datos/UI aun no realizadas.
No reinterpretar esos resultados como pruebas HTTP o de persistencia reales.

Pytest, Ruff, mypy y cobertura estan configurados con uv desde fase 3. Pytest
descubre app/pruebas estaticas y ejecuta la suite Django en un subproceso aislado,
sin instalar dependencias desde tests. Ruff cubre app y pruebas; excluye el arbol
Django legacy. mypy estricto cubre app y data_migration. Las advertencias de Pytest se tratan como
errores. La cobertura de app tiene umbral 90%; no mide el backend Django ni UI.

Los comandos verificados estan en [development.md](development.md). La suite
Django conserva un expectedFailure para D03; no implica que el defecto se haya
corregido ni que todas las operaciones de negocio esten probadas.

Las pruebas de persistencia/concurrencia deben usar PostgreSQL aislado,
sin sustituir sus bloqueos por SQLite. No importar configuracion productiva para
obtener una conexion de prueba.

Desde fase 4 hay un PostgreSQL local nuevo y una imagen development con los mismos
comandos uv. Se verificaron conectividad, permisos globales de la cuenta,
persistencia del volumen y restauracion de una sonda sintetica. Los escenarios
de negocio, sus restricciones y concurrencia siguen pendientes de sus fases.
Ver [Docker](docker.md) y los resultados de [caracterizacion](characterization.md).

El frontend incorporara pruebas de componentes y recorridos E2E en su fase.
Las herramientas se eligen por su funcion; no se agregan dependencias de testing
a la aplicacion final de produccion.

Fase 5 incorpora compose.test.yaml como entorno independiente: PostgreSQL tmpfs,
sin puertos, claves sinteticas, --run-postgres explicito y guardas de base vacia.
Se comprueban upgrade/downgrade/upgrade, metadata sin drift, las 17 tablas con
datos sinteticos, Decimal, nulabilidad/fechas, identidades, rechazo de huerfanos
y borrado referenciado, commit visible desde otra conexion y rollback.
El SQL offline se prueba sin conexion. La suite habitual sin la opcion omite
54 casos PostgreSQL desde fase 8 (11 originales de fase 6); no equivale a ejecutar
esas verificaciones.

La fuente de comandos de esquema e integracion es [migration.md](migration.md).
Fase 6 agrega pruebas ETL con datos sinteticos, rechazos, conciliacion por campo,
rollback de carga y secuencias, mas un ensayo pg_dump/pg_restore reproducible en
[data-transfer.md](data-transfer.md). mypy estricto cubre app y data_migration.
La cobertura configurada de app no incluye estas herramientas ni certifica datos
SQL Server. El usuario confirmo que no existe instancia/copia SQL Server ni datos
historicos para el cierre actual; si aparece un origen futuro, requerira su propio
inventario y ensayo.
La cobertura de app incluye declaraciones ORM: un 100% de esas lineas no demuestra
por si solo reglas de compra/venta, cobertura de cada DDL o concurrencia. Esos
casos permanecen en sus fases, con datos aislados y reglas aprobadas.

## Seguridad e integridad

- Validacion de servidor y esquemas explicitos, no solo restricciones del formulario.
- Autenticacion y permisos comprobados antes de exponer la nueva API fuera de su
  entorno de desarrollo/pruebas. El CRUD actual sin permisos no se preserva como requisito.
- Contraseñas con hash mantenido, secretos externos y logs sin credenciales ni
  informacion personal innecesaria.
- Consultas parametrizadas, restricciones referenciales y politicas de borrado
  coherentes con historicos.
- Operaciones financieras coordinadas en un solo limite transaccional, con dinero
  exacto y proteccion contra reintentos/concurrencia.
- Revisar dependencias en la fase de entorno; ninguna guia constituye por si sola
  un analisis de vulnerabilidades ejecutado.

## Revision y cierre de una tarea

1. El cambio corresponde a la fase autorizada y preserva trabajo ajeno.
2. Se revisaron contratos y reglas B que puedan afectar el resultado.
3. Codigo nuevo con nombres ingleses, tipado y responsabilidades segun convenciones.
4. Se ejecutaron las comprobaciones apropiadas; se registraron fallos, omitidas y
   pendientes sin presentar estas ultimas como aprobadas.
5. Datos y secretos estan protegidos; no hay transformaciones historicas supuestas.
6. Documentacion, muestras y migraciones necesarias corresponden al cambio real.
7. Se revisaron diff y contenido preparado; el commit contiene solo el trabajo propio.
8. Se informan commits locales, resultado y limites. Se detiene la fase sin push.

Si una verificacion requerida no pudo ejecutarse, registrar la razon y el requisito
para completarla. Cerrar una fase de preparacion no certifica las comprobaciones
de ejecucion que siguen pendientes.

## Automatizacion futura

CI utilizara la misma version fijada de Python/uv y `uv sync --locked`, seguido de
lint, formato, tipado, pruebas y migraciones de una base de pruebas. Frontend usara
npm ci, lint, tipos, pruebas y build cuando existan esas herramientas. Construir
imagenes reproducibles como verificacion de infraestructura.

La configuracion CI se puede versionar localmente cuando se implemente. Su
publicacion y ejecucion remota no forman parte del flujo actual de Codex.
Los comandos concretos estan en [development.md](development.md).
