# Caja y pagos completos

Caja principal única en NIO. Turnos persistentes con cuenta/empleado activo,
apertura contada, cierre contado/esperado/diferencia y movimientos auditados.
Se opera desde Dashboard o Nueva venta, sin módulo independiente en el menú.

Dueña supervisa turnos, ingresos/retiros y correcciones. Colaborador abre/cierra
su turno y consulta únicamente sus turnos. Cierre con diferencia requiere Dueña
y motivo. Turnos cerrados inmutables; no se reabren para corregir ventas.

| Pago | Regla |
| --- | --- |
| Efectivo | recibido >= total; aplicado = total; cambio = recibido − total |
| Transferencia | importe exacto = total; referencia y confirmación manual |
| Mixto | 0 < transferencia < total; efectivo aplicado = total − transferencia; recibido >= aplicado; cambio = recibido − aplicado |

Componentes cash_amount y transfer_amount se conservan por separado. Caja suma
efectivo aplicado, nunca todo el recibido; transferencias se concilian separadamente.
Históricos previos sin componentes explícitos conservan nulos y el método original
permite agregarlos sin modificar sus filas. Sin crédito, abonos, tarjeta ni banco.

Venta/pago/inventario/caja se confirman atómicamente. Bloqueo de caja y fila de turno
serializan cobro/cierre/correcciones; Idempotency-Key identifica comando por cuenta.
El navegador persiste operaciones inciertas y reintenta el mismo cuerpo/clave.
Los importes de apertura, cierre, movimientos y pagos rechazan float, booleanos,
valores no finitos, precisión excesiva y desbordamientos antes de persistir;
se envían como texto decimal o entero exacto.

Anulación total: solo Dueña, motivo y devolución completa por medios originales,
referencia cuando hay transferencia. Efectivo reintegrado disminuye caja, transferencia
queda registrada aparte. Reposición solo por unidades realmente devueltas (cero
permitido). Original/recibo/stock anterior/auditoría se conservan. No hay pagos
inferidos en históricos sin cobro. [Ventas](sales.md), [reglas](business-rules.md).

0005 introdujo caja; 0006 agrega mixto/componentes sin editar la revisión anterior.
[Respaldo, migración y retorno](cutover.md).
