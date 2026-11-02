# Pagos completos e historia de caja

La Fase 16 retira caja y turnos del comportamiento operativo. No hay apertura,
cierre, saldo inicial, ingresos/retiros, conciliación ni diferencias. Dashboard y
Nueva venta no montan componentes ni consultan turnos. /api/v1/cash/* devuelve 404.
Venta y anulación no requieren shift_id ni crean cash_movements.

| Pago | Regla |
| --- | --- |
| Efectivo | recibido >= total; aplicado = total; cambio = recibido − total |
| Transferencia | importe exacto = total; referencia y confirmación manual |
| Mixto | 0 < transferencia < total; efectivo aplicado = total − transferencia; recibido >= aplicado; cambio = recibido − aplicado |

Componentes cash_amount y transfer_amount separados. Venta/pago/salida de stock
son atómicos e idempotentes. Importes exactos: texto decimal o entero; se rechazan
float, booleanos, valores no finitos, precisión excesiva y desbordamientos.
Nunca se infieren pagos históricos sin cobro. Sin tarjetas, crédito ni abonos.

Anulación total solo Dueña: motivo, reintegro completo por medios originales,
referencia para transferencia y cantidades realmente devueltas, incluido cero.
Conserva original/recibo/auditoría; solo lo devuelto repone stock mediante sale_return.
No necesita turno ni disponibilidad de caja para registrar el reintegro confirmado.

0005 introdujo caja; 0006 agregó mixto. Se conservan ambas revisiones y todas sus
tablas/filas históricas. 0009 hace nullable shift_id en sale_payments/sale_voids;
las operaciones nuevas guardan null. Campos shift_id entrantes antiguos se admiten
para preservar huellas de reintentos; no enlazan las operaciones nuevas a caja.
Las intenciones antiguas de turnos quedan bloqueadas conservando evidencia.
Downgrade con actividad sin turno falla; el retorno seguro restaura en una base
separada y concilia operaciones posteriores. [Corte](cutover.md), [ventas](sales.md).
