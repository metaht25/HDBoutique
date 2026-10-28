# ADR 0006: compras atomicas y recepcion unica

Estado: aceptada para fase 9, 28 de octubre de 2026, tras confirmacion expresa
de B01/B02/B05 y politica de costes de compra. Contrato en
[compras e inventario](../purchases-inventory.md).

## Decision

Mantener las tablas legacy de compra y lineas, y agregar workflow, snapshots
de coste/producto y movimientos mediante 0003_purchase_receipts. Esta separacion
permite conservar historicos sin inventar estados ni costes con precios actuales.
Las nuevas compras son registered hasta una recepcion completa received.

stock disponible cambia solo en la transaccion de recepcion; cantidadstock queda
legacy e independiente. El CRUD de productos deja de aceptar ambos campos y crea
stock cero solo para productos nuevos, conservando nulos y valores historicos.
Esto es una restriccion intencionada del contrato nuevo aprobado en fase 7.

El registro tiene idempotencia persistente por cuenta/clave y una solicitud con
cabecera/lineas. El servidor captura precio vigente y producto original, calcula
con Decimal y guarda envio separado. La recepcion bloquea workflow y productos
en orden estable y escribe una entrada por linea con unicidad y delta comprobado.

## Consecuencias

No hay ventas, ediciones destructivas, recepciones parciales o conciliacion
automatica de stock nulo. Historicos sin snapshots son consultables con costes
desconocidos; recibirlos requiere conciliacion autorizada.
Los bloqueos requieren PostgreSQL y se verifican con conexiones independientes,
no con SQLite ni mocks de bloqueo. Revertir el esquema no deshace stock operativo.
Roles de compras/inventario: Administrator y Manager; Cashier no tiene acceso.
