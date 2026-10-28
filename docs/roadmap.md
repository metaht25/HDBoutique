# Plan de refactorizacion por fases

Se trabaja con una sola persona, en Cris-develop y con commits locales. Cada fase
se inicia por instruccion del usuario, entrega un resultado verificable y se
detiene al cerrar su alcance. El push es manual a cargo del propietario.

## Estado de avance

| Fase | Objetivo y entregable principal | Estado |
| --- | --- | --- |
| 0 | Rama y saneamiento de README | Completada: 9bc044c; punto de partida f67910b |
| 1 | Contratos, ejemplos y caracterizacion | Preparacion completada: e247dd8 y 4d4443d; suite Django ejecutada en fase 3 |
| 2 | AGENTS, guias y convenciones | Completada en documentacion: enlaces y diff revisados; B01-B14 siguen pendientes |
| 3 | uv, FastAPI minimo y calidad | Completada: entorno, calidad, pruebas y arranque verificados; D03 sigue esperado |
| 4 | Docker, Compose y PostgreSQL local | Completada: 7cb3f92 y 9def699; construccion, conexion, persistencia y restauracion sintetica verificadas; ver [Docker](docker.md) y [resultados](characterization.md#verificacion-de-fase-4) |
| 5 | Modelos SQLAlchemy y migraciones Alembic | Completada como esquema inicial de compatibilidad acordado: 17 modelos, revision 0001_compatibility y 38 pruebas aprobadas; ver [modelo](data-model.md) y [resultados](characterization.md#verificacion-de-fase-5) |
| 6 | Herramientas y ensayos de migracion SQL Server | Pendiente; requiere origen autorizado |
| 7 | Modulos fundamentales FastAPI | Pendiente |
| 8 | Autenticacion y autorizacion | Pendiente |
| 9 | Compras e inventario | Pendiente |
| 10 | Ventas transaccionales | Pendiente |
| 11 | Base frontend con TypeScript, Router y HTTP compartido | Pendiente |
| 12 | Migracion funcional de pantallas | Pendiente |
| 13 | Dashboard y reportes; caja segun alcance | Pendiente |
| 14 | Integracion, seguridad y estabilizacion | Pendiente |
| 15 | Corte de datos y retirada de Django | Pendiente; requiere instruccion expresa y verificaciones operativas |

Este documento registra el estado, sin sustituir los resultados detallados de
[characterization.md](characterization.md). Actualizar cada fila al cerrar su fase.
No presentar una propuesta documental como una herramienta ya implementada.

## Entregas y condiciones para avanzar

| Fase | Trabajo y condicion de cierre |
| --- | --- |
| 0 | Verificar Git y rama, resolver conflicto documental, registrar origen y commit local |
| 1 | Inventariar 17 contratos, muestras sinteticas, matriz de compatibilidad y regresiones; distinguir pruebas ejecutadas de pendientes |
| 2 | README real, AGENTS, arquitectura, desarrollo, datos, migracion, calidad y convenciones; enlaces/diff revisados |
| 3 | Fijar Python/uv y dependencias; crear pyproject.toml, uv.lock, .python-version y FastAPI minimo; health checks, lint, tipado y pruebas ejecutables; conservar Django temporalmente |
| 4 | Construccion con uv bloqueado, PostgreSQL saludable y persistente, Compose, configuracion y secretos separados; verificar arranque y reproduccion |
| 5 | Esquema SQLAlchemy en ingles, restricciones e indices revisados, Alembic reproducible desde base vacia; resolver reglas que condicionen el esquema definitivo |
| 6 | Inventario fisico, perfilado, mapeo, transferencia y conciliacion repetibles en copia; no alterar el origen |
| 7 | Ubicaciones/catalogo, clientes/proveedores y empleados por incrementos; schemas explicitos, validacion y pruebas de cada modulo |
| 8 | Usuario/empleado, mecanismo de sesion y permisos definidos; accesos permitidos/denegados probados antes de exposicion operativa |
| 9 | Compra y lineas atomicas, coste historico, recepcion y movimientos segun B01/B02/B03/B05; rollback y duplicados probados |
| 10 | Venta completa en una solicitud, precio/total de servidor, inventario seguro e idempotencia; ultima unidad y fallo parcial probados |
| 11 | Organizacion por funcionalidades, Router, TypeScript, cliente HTTP, sesion, componentes y estilos encapsulados; verificacion frontend |
| 12 | Migrar pantallas por modulo, contratos y formularios; reemplazar servicios antiguos solo cuando no tengan consumidores |
| 13 | Agregaciones/filtros de servidor y fecha comercial coherente; caja solo tras resolver B10 |
| 14 | Regresion, E2E, concurrencia, permisos, dependencias, restauracion y ensayos de migracion; sin defectos criticos/altos abiertos |
| 15 | Ventana y respaldo, escrituras controladas, carga final y conciliacion; retirar Django/adaptadores al verificar consumidores y preservar origen segun acuerdo |

## Dependencias y limites

- Las decisiones B01-B14 viven en [business-rules.md](business-rules.md). Resolver
  solo las que condicionen el incremento; las demas no impiden documentar o crear
  el entorno base. No dar por aprobados roles, reglas de deuda o nuevas funciones.
- En fase 5 el usuario eligio una base inicial de compatibilidad: ambas existencias
  y direccion ligada a departamento, sin fijar semantica de B01/B08. El cierre de
  esa fase verifica estructura y Alembic; las reglas comerciales pendientes se
  incorporaran mediante nuevas revisiones antes de habilitar los casos de uso.
- Si la fase 6 espera un origen autorizado, pueden prepararse otras piezas
  independientes cuando el usuario lo solicite; no certificar migracion real.
- Durante fase 7 la nueva API permanece en entorno de desarrollo/pruebas hasta
  completar permisos de fase 8. No publicar endpoints abiertos por respetar orden.
- Las pruebas y documentacion se mantienen en cada fase; la 14 consolida la
  estabilizacion y no es el primer momento para probar.
- Las fases 7 y 12 pueden solicitarse por modulo. No es necesario completar todas
  sus funcionalidades en una sola interaccion.
- Colores, SKU, nuevas devoluciones, exportaciones o caja ampliada no se agregan
  como trabajo obligatorio. Requieren ampliar el alcance expresamente.

## Forma de entrega

Informar archivos principales, comportamiento/documentacion resultante,
verificaciones realmente ejecutadas, limitaciones, decisiones pendientes y hashes
de commits locales. Preservar cambios ajenos, cerrar el alcance solicitado y dejar
la siguiente fase a la indicacion del usuario. Ver
[collaboration.md](collaboration.md) y [quality.md](quality.md).
