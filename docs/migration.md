# Estrategia de migracion de datos

Estado: plan para fases posteriores. No hay scripts de transferencia ni migraciones
Alembic implementados. Esta documentacion no autoriza acceso o cambios en una base
real y no afirma haber validado sus datos.

## Dependencias

- Modelo y limites: [data-model.md](data-model.md).
- Diccionario de campos y traducciones: [legacy-api-contracts.md](legacy-api-contracts.md)
  y [contract-compatibility.md](contract-compatibility.md).
- Decisiones que condicionan transformaciones: [business-rules.md](business-rules.md).
- Fase 5: esquema nuevo y Alembic; fase 6: herramientas/ensayos de datos;
  fase 15: corte operativo. Ver [roadmap.md](roadmap.md).

## Procedimiento previsto

| Paso | Evidencia o resultado necesario |
| --- | --- |
| Identificar origen y destino autorizados | Motor/version, ubicacion, responsables, permisos y confirmacion de que la prueba usa copia |
| Respaldar y ensayar restauracion | Copia recuperable y resultado real de restauracion; no basta con que exista un archivo |
| Inventariar esquema fisico | Tablas de negocio y Django, PK/FK, tipos, nulos, defaults, indices, vistas, procedimientos y triggers |
| Perfilar informacion | Conteos, huérfanos, duplicados, negativos, faltantes y discrepancias de totales |
| Aprobar mapeos | Campo origen/destino, conversion, excepciones y decisiones B pendientes resueltas cuando afecten datos |
| Crear destino con Alembic | Base PostgreSQL nueva y version de esquema conocida |
| Extraer, transformar y cargar | Proceso repetible, IDs preservados y rechazos registrados sin exponer datos sensibles |
| Ajustar identidades | Secuencias preparadas para nuevas filas sin colisiones |
| Conciliar y probar aplicacion | Datos comparados y recorridos de negocio verificados |
| Ensayar corte y rollback | Ventana, responsables, escritura final y punto de retorno definidos |

Alembic versiona el esquema del destino; no convierte automaticamente SQL Server
ni sus procedimientos. SQLAlchemy puede ayudar a conectar ambos motores. Las
herramientas de extraccion no deben entrar como dependencia obligatoria de la
imagen final de aplicacion.

## Conciliacion requerida

- Contar todas las filas por tabla y documentar cada diferencia.
- Verificar PK, relaciones y correspondencia de IDs; detectar relaciones huérfanas.
- Comparar importes exactos, lineas/cabeceras, envio y abonos; no aceptar diferencias
  silenciosas de redondeo.
- Comparar ambas existencias legacy hasta que se resuelva su significado.
- Revisar fechas, nulos, textos, caracteres, longitudes y duplicados que colisiones
  de collation pudieran introducir.
- Comprobar preservacion de precios y costes historicos, y reconocer valores que
  el origen no permite reconstruir.
- Verificar usuarios/hashes y tareas de admin si forman parte del alcance B09/B11.
- Confirmar efectos de triggers antes de replicar movimientos desde la aplicacion.

No corregir historicos por suposicion ni omitir registros para cuadrar conteos.
Los datos sinteticos de pruebas son ejemplos de contratos, no validacion del origen.

## Corte y recuperacion

Usar una ventana de escritura controlada: detener escrituras del sistema anterior,
cargar cambios finales, conciliar y cambiar configuracion. Evitar escritura doble
sin una estrategia implementada y probada.

Antes de aceptar escrituras nuevas, el retorno puede usar el origen conservado.
Despues de aceptar operaciones en PostgreSQL, volver a SQL Server requiere
reconciliar esas operaciones; cambiar una cadena de conexion no basta. Definir
antes del corte el punto de no retorno, respaldo, estrategia y tiempo aceptable.

Un downgrade de Alembic no sustituye una restauracion ni garantiza recuperar datos
eliminados. Conservar el origen segun el periodo acordado en B12. Ejecutar el corte
solo al solicitar expresamente su fase y disponer de sus verificaciones.
