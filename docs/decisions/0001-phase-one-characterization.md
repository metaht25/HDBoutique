# ADR 0001 - Caracterizacion antes de sustituir implementaciones

Estado: aplicado al alcance tecnico de la fase 1.

## Contexto

El proyecto actual usa Django/DRF y React/Vite. Los datos de negocio dependen de
una base SQL Server que no se ha inspeccionado. Las seis plantillas tests.py no
contienen pruebas. Hay contratos que deben conservarse y defectos que deben
corregirse, descritos en [characterization.md](../characterization.md).

El usuario autorizo documentar contratos y preparar caracterizacion, sin iniciar
FastAPI. Se trabaja con una sola persona, en Cris-develop y con commits locales;
el push lo realiza manualmente el propietario.

## Decision tecnica

1. Registrar los 17 recursos y ejemplos sinteticos en un fixture compartido.
2. Comprobar las declaraciones con unittest/AST, sin dependencias nuevas.
3. Ejecutar servicios JavaScript reales con node:test y fetch simulado.
4. Preparar pruebas Django/DRF con configuracion independiente y motor dummy;
   prohibir consultas SQL desde SimpleTestCase.
5. Informar ausencia de dependencias mediante preflight fallido, no mediante un
   resultado satisfactorio de una suite completamente omitida.
6. Registrar los defectos separadamente y preparar una regresion esperada de
   precio fraccionario. No aceptar esos defectos como requisitos nuevos.
7. Posponer configuracion e instalacion de uv/Pytest a la fase 3, donde estas
   comprobaciones se integraran con el mecanismo oficial del backend.

## Consecuencias

La fase produce comprobaciones ejecutables sin iniciar servicios ni acceder a
datos reales. La parte estatica no prueba comportamiento HTTP; los mocks no
prueban persistencia ni concurrencia. La suite Django permanece pendiente de
ejecucion mientras no existan sus dependencias en el entorno autorizado.

Los identificadores de codigo nuevos son ingleses. Los nombres espanoles en las
muestras y referencias son contratos legacy que se caracterizan, no nombres
elegidos para nuevas entidades de aplicacion.

## Decisiones de negocio no aprobadas

B01-B14 en [business-rules.md](../business-rules.md) siguen pendientes. Esta ADR
no elige semantica de stock, recepcion de compras, descuentos, anulaciones, saldos,
roles, caja ni nuevas funcionalidades. La matriz de nombres ingleses es propuesta
de compatibilidad, no una migracion autorizada o ejecutada.
