# Propuesta de reglas de caja: B10 pendiente

Solicitada en fase 13. **Recomendacion para revisar; no aprobada ni implementada.**
La pantalla actual sigue siendo un prototipo local. No se crean tablas, endpoints,
pagos ni saldos de caja en esta entrega. Las ventas documentadas del dashboard
no significan efectivo recibido. B06 (deuda/abonos) sigue pendiente.

## Reglas recomendadas para una primera version

| Tema | Propuesta para HDBoutique |
| --- | --- |
| Unidad de control | Caja fisica identificada y turno con responsable. Un solo turno abierto por caja, protegido por restriccion/bloqueo; no una caja global por navegador |
| Responsabilidad | Cuenta autenticada y empleado existente, siguiendo ventas/compras. Cashier opera su turno; Manager/Administrator supervisan y consultan todos. Traspaso exige cierre y nueva apertura |
| Apertura | Conteo inicial explicito en NIO, importe no negativo, usuario y fecha UTC del servidor; fecha comercial America/Managua. No copiar automaticamente el cierre anterior como efectivo contado |
| Duracion | Apertura y cierre explicitos, varios turnos por dia permitidos. Cruzar medianoche no mueve transacciones a otro turno ni cierra automaticamente |
| Moneda | Solo NIO, Decimal y dos decimales; sin conversion ni redondeos ocultos |
| Venta y cobro | Entidades distintas: una venta documenta mercancia; un pago confirma recepcion de dinero. Solo el pago confirmado afecta caja. No deducir pagos desde ventas ni desde la tabla legacy de abonos |
| Alcance inicial de pagos | Contado completo. Proponer efectivo, tarjeta y transferencia, cada uno identificado; tarjetas/transferencias se reportan separados y nunca aumentan efectivo del cajon. Credito, pagos parciales y abonos esperan B06 |
| Efectivo y cambio | Servidor exige recibido >= importe a pagar y calcula cambio. Entrada neta = recibido - cambio. Ejemplo sintetico: venta 399.00, recibido 500.00, cambio 101.00, entrada neta 399.00 |
| Ingresos y retiros | Registro separado de venta, importe positivo, motivo obligatorio, responsable y referencia cuando exista. Retiros/aportes requieren autorizacion Manager/Administrator. Registrar el retiro bancario explicitamente |
| Compras | Registrar o recibir una compra no demuestra su pago. Solo una salida de efectivo autorizada y referenciada afectaria caja, una vez definido ese flujo |
| Cierre | Conteo fisico obligatorio; esperado calculado por servidor, contado, diferencia y responsable persistidos. Recomiendo conteo previo a mostrar diferencia. Toda diferencia requiere motivo y revision de Manager/Administrator, sin un umbral inventado |
| Historia | Turno cerrado inmutable: no editar, borrar ni reabrir. Correcciones mediante movimientos compensatorios referenciados y autorizados; devoluciones/anulaciones requieren su propio acuerdo B04 |

Estados propuestos: `open -> closing -> closed`. Durante closing se bloquean
nuevos pagos/movimientos; si el conteo se cancela antes de confirmar, el turno
puede volver a open dejando auditoria. closed es definitivo. El cierre debe
serializarse con pagos y movimientos mediante bloqueo del turno para que una
venta concurrente no quede fuera del conteo esperado.

`Esperado = apertura + cobros netos en efectivo + ingresos - retiros - reembolsos`.
Los ingresos/retiros/reembolsos requieren autorizacion. Los reembolsos no se habilitan
por esta formula: dependen del futuro acuerdo de devoluciones. Diferencia =
contado - esperado. Se conserva la diferencia; no crear un ajuste automatico
para forzar que sea cero. No mezclar importe vendido, pagos electronicos,
deudas pendientes ni costes de mercancia con efectivo disponible.

Pagos y movimientos futuros deben ser atomicos e idempotentes por cuenta/operacion,
con permisos en servidor y trazabilidad de cuenta, empleado, turno, fecha,
motivo y documento origen. Un doble clic o reintento no duplica el cobro;
dos aperturas simultaneas no crean dos turnos; cerrar mientras se cobra produce
un orden definido. Las ventas existentes conservan su historia y se concilian
explicitamente antes de asociarles pagos; no marcar historicos como pagados.

## Decisiones antes de implementar

Confirmar numero de cajas y responsables por turno, medios de pago realmente
usados, si contado completo cubre la operacion inicial, proceso de autorizacion
de retiros/diferencias y necesidad de credito/devoluciones. Aprobar estas reglas
no sustituye la definicion de B06/B04 ni autoriza migrar datos reales.

La propuesta de turnos, apertura/cierre y comparacion esperado/contado toma como
referencia [gestion de caja de Shopify](https://help.shopify.com/en/manual/sell-in-person/shopify-pos/cash-register-management)
y [flujo de punto de venta de Odoo](https://www.odoo.com/documentation/19.0/applications/sales/point_of_sale/use.html).
Los permisos, limites y decisiones anteriores son una propuesta especifica para
este proyecto, no reglas impuestas por esas plataformas.
