# Caja y ventas al contado

Incremento solicitado despues del corte de fase 15. Acuerdos B04/B06/B10:
ventas siempre con pago completo, solamente efectivo o transferencia. No se
implementan credito, deuda, pagos parciales, tarjeta ni abonos en ninguna version.
La tabla historica customer_payments permanece sin rutas de escritura ni saldos
inferidos. Ningun historico se marca como pagado automaticamente.

## Operacion

Una caja principal (`main`) y un solo turno abierto. Cada turno guarda cuenta,
empleado existente, apertura contada y fecha UTC del servidor. Cashier opera y
consulta sus turnos; Administrator/Manager supervisan todos. La venta usa el
empleado del turno, respetando el vinculo de la cuenta. Cambiar de responsable
exige cerrar y abrir otro turno. No hay traspaso ni reapertura.

En `/cash-register`, abrir con efectivo inicial contado, incluso cero. En
`/sales`, seleccionar turno abierto y registrar toda la venta con su pago:

- Efectivo: indicar recibido. El servidor exige recibido >= total y calcula
  cambio. Solo el importe neto de la venta aumenta el efectivo esperado.
- Transferencia: comprobar manualmente la recepcion e indicar importe y referencia
  textual. El importe debe coincidir exactamente con el total del servidor;
  no existe integracion bancaria ni aumento del cajon.

Venta, lineas, inventario, auditoria y pago se guardan en una transaccion.
No hay venta pendiente de cobro ni endpoint de pagos posteriores. Precios y
total siguen calculados por el servidor, NIO/Decimal/dos decimales.

Administrator/Manager registran ingresos/retiros de efectivo con motivo obligatorio.
Un retiro o reintegro no puede superar el efectivo esperado. Registrar/recibir
compras no registra un pago ni descuenta caja automaticamente.

Para cerrar, indicar conteo fisico final. El servidor guarda:

`esperado = inicial + cobros efectivo + ingresos - retiros - reintegros efectivo`.

`diferencia = contado - esperado`. Una diferencia exige motivo y cierre por
Administrator/Manager; Cashier puede cerrar su turno si no hay diferencia.
Transferencias y sus reintegros se muestran separados. El cierre es definitivo:
no editar, borrar ni reabrir. El siguiente turno exige un conteo nuevo; no copia
el cierre anterior. Historia con cuenta, empleado, fechas y movimientos.
La confirmacion del cierre es atomica, sin estado intermedio editable.

## Corregir una venta equivocada

Administrator/Manager abren el detalle en Ventas y usan **Anular venta completa**.
Indicar motivo, turno abierto para reintegrar, cantidad realmente devuelta para
cada linea (incluido cero) y confirmar el reintegro completo. La transferencia
exige referencia del reintegro; se conserva el medio original. El flujo registra
manualmente el reintegro efectuado, sin ejecutar operaciones bancarias.
No admite reintegros monetarios parciales.

Se conserva la venta original y sus precios/lineas. Se agrega anulacion auditada,
reintegro completo y entrada de inventario solo por unidades fisicamente devueltas.
legacy_stock_quantity no cambia. Cantidades superiores a las vendidas, productos
ajenos, lineas faltantes/repetidas o stock desconocido para reponer se rechazan
sin efectos parciales. Una venta se anula una vez. Despues se registra la venta
correcta como otra operacion.

El reintegro puede pertenecer a un turno posterior; no altera un turno cerrado.
Dashboard/reportes conservan la fila anulada y su importe original, pero la suma
vendida excluye anulaciones. El filtro usa la fecha documental de la venta;
la salida real de dinero pertenece al turno/fecha del reintegro en caja.
Una venta historica sin pago exige conciliacion antes de corregirse por este flujo.

## Contrato y reintentos

Sesion obligatoria; escrituras ademas con Origin, CSRF e Idempotency-Key.

| Ruta | Operacion |
| --- | --- |
| GET /api/v1/cash/shifts?offset=0&limit=20 | Turnos visibles al rol; paginacion hasta 100 |
| POST /api/v1/cash/shifts | employee_id opcional si cuenta vinculada, opening_amount |
| POST /api/v1/cash/shifts/{id}/close | counted_amount, reason si hay diferencia |
| POST /api/v1/cash/shifts/{id}/movements | kind deposit/withdrawal, amount positivo, reason |
| POST /api/v1/sales | Contrato de venta + payment obligatorio |
| POST /api/v1/sales/{id}/void | shift_id, reason, refund_confirmed=true, items y referencia para transferencia |

Ejemplos de payment con datos sinteticos:

```json
{"shift_id": 1, "method": "cash", "received_amount": "500.00"}
```

```json
{"shift_id": 1, "method": "transfer", "received_amount": "399.00", "reference": "0000123", "transfer_confirmed": true}
```

La respuesta de venta agrega payment y annulment; status puede ser confirmed,
voided o null para historicos. Importes como texto con dos decimales.
El frontend conserva intencion/clave por cuenta y pestana en sessionStorage.
Ante resultado incierto, reintentar la misma operacion, sin otra clave.
Para recuperar una anulacion tras recargar, abrir el detalle de esa venta y
reintentar la misma anulacion pendiente. Intenciones anteriores sin payment quedan
bloqueadas con aviso: revisar historial, sin inventar pagos ni descartar evidencia.

Las claves se protegen con bloqueos transaccionales y unicidad. Las operaciones
de caja se serializan antes de bloquear turno/venta/productos. El cierre incluye
un cobro anterior confirmado o impide uno posterior. Recepciones, ventas y
devoluciones bloquean productos por ID ascendente.

## Esquema y limites

Revision nueva 0005_cash_checkout; sin modificar revisiones previas ni rellenar
historicos. Agrega cash_shifts, cash_movements, cash_requests, sale_payments,
sale_voids y sale_return_items: 30 tablas de aplicacion. InventoryMovement agrega
return_item_id/tipo sale_return, origen exclusivo y delta comprobado.
El downgrade rechaza descartar una caja utilizada; retornar requiere respaldo
verificado y conciliacion de operaciones posteriores.

Empleados y las pantallas de configuracion inicial de catalogos, ubicaciones y
ofertas siguen fuera de este incremento. No se crean empleados ni datos ficticios
para habilitar caja. Una base comercial vacia necesita referencias reales antes
de operar. No se declara terminado todo el proyecto ni un despliegue productivo externo.

## Verificacion de esta entrega

253 pruebas backend con PostgreSQL aislado aprobadas; cobertura app 97,53 %.
Incluyen rollback de venta/pago/devolucion, dinero exacto, permisos, historicos,
reintentos, doble anulacion concurrente y cierre concurrente con cobro.
Ruff/formato (139 archivos), mypy (92 fuentes) y bloqueo uv aprobados.
Frontend: tipos, lint, 82 pruebas Vitest, build y 80 E2E interceptadas aprobados.
Seis E2E conectadas a Nginx/FastAPI/PostgreSQL aprobadas, incluida apertura,
transferencia, anulacion, reposicion y cierre con conciliacion. Captura de caja revisada.
Escaneo Gitleaks de cambios preparados sin hallazgos; sin dependencias nuevas.

Destino local previamente autorizado hdboutique-dev/base hdboutique, mismo volumen.
Se detuvieron web/API durante la actualizacion, se respaldo y restauro en
hdboutique_cash_verify, comparando tablas/campos/huellas/identidades exactas.
La migracion ensayada preservo las 24 tablas y secuencias anteriores, con seis
tablas nuevas vacias. El upgrade local produjo la misma huella que el ensayo.
El respaldo final se restauro en hdboutique_cash_final_verify y coincidio exactamente
en las 30 tablas/identidades. Evidencia privada en
`backups/cutover-20261029-phase15/cash-checkout/`: quiescent.dump, after.dump,
huellas JSON y checksums. No se borran los respaldos ni las bases de verificacion.

Web/API/DB locales saludables; humo de login/logout, ocho rutas SPA y consultas
autenticadas, incluida caja, aprobado sin escrituras comerciales. No se cargaron
empleados ni datos comerciales sinteticos en desarrollo. Pruebas siempre aisladas.
No se realizo push ni acceso al repositorio remoto.
