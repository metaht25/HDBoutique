# Reglas vigentes de H&D Boutique

El incremento visual y funcional solicitado el 31 de octubre de 2026 sustituye
los acuerdos anteriores incompatibles. Su alcance, referencias y verificación se
registran en [reconstrucción](visual-reconstruction.md). Las fases anteriores
permanecen en el historial Git; no son reglas operativas alternativas.

| ID | Decisión vigente |
| --- | --- |
| B01 | `legacy_stock` es disponible. `legacy_stock_quantity` conserva el legado, inmutable. Alta con cantidad inicial explícita (por defecto cero), movimiento `initial_stock` y cuenta auditada. Nulos/negativos históricos requieren conteo; no se convierten a cero. |
| B02 | Compra nueva Pendiente; recepción completa única, atómica e idempotente. Sin recepción parcial. |
| B03 | NIO, Decimal, dos decimales. Producto nuevo: costo × 1.15 con ROUND_HALF_UP; precio de venta no editable. Venta copia precio vigente por línea y calcula subtotales/total en servidor. Compra conserva costo histórico de oferta y envío separado, sin prorrateo. Sin descuentos. |
| B04 | Venta confirmada inmutable. Dueña puede anular totalmente con motivo, reintegro completo por los medios originales y reposición únicamente de unidades devueltas (incluido cero). Original y auditoría conservados. |
| B05 | Fechas antiguas de revisión/relleno no implican recepción. La recepción usa su auditoría propia. La fecha de venta nueva es siempre hoy del servidor en America/Managua. |
| B06 | Exclusivamente contado y pago completo. Sin crédito, deuda, abonos ni pagos parciales en ninguna versión. Compatibilidad histórica conservada sin inferir saldos. |
| B07 | Activación persistente de productos, proveedores y empleados. Clientes conserva estados históricos sin nuevas ediciones ni cambios de estado (B17). Inactivos conservan historia y quedan excluidos de nuevas operaciones hasta reactivación. Empleado inactivo bloquea acceso y revoca sesiones. |
| B08 | Domicilio directo: departamento, municipio y dirección exacta. Municipio debe pertenecer al departamento. La FK nueva es nullable para conservar domicilios antiguos sin inventar municipio. |
| B09 | Dos perfiles: Dueña (Administrator) y Colaborador (Cashier). Perfil intermedio retirado; cuentas antiguas se desactivan, revocan y auditan sin convertirlas. Alta de empleado crea cuenta de colaborador en la misma transacción, con contraseña asignada por Dueña y hasheada, sin cambio obligatorio (B15). |
| B10 | Pago completo en efectivo, transferencia o mixto, con componentes separados. Caja y turnos retirados de la operación (B21), conservando su historia. |
| B11 | No se utiliza /admin/ ni existe backend Django. Empleados y cuentas se gestionan desde la interfaz vigente. |
| B12 | Sin origen SQL Server. Destino local autorizado hdboutique-dev/hdboutique; respaldos previo/final restaurados en bases separadas y conciliados. No se borran historias ni evidencias. Nuevos orígenes requieren alcance propio. |
| B13 | Teléfono textual de 1–10 dígitos ASCII para altas de clientes/proveedores; empleado canónico de ocho dígitos con prefijo 7 u 8 (B15). Cliente regular: nombre y apellido, teléfono opcional. Delivery: teléfono y domicilio completos obligatorios. Cliente general: identidad técnica única, sin datos personales. |
| B14 | Stock 0 agotado; 1–5 bajo; >5 suficiente. Nulo y negativo separados. Sin fallback al campo legado. |

Cliente general no genera una persona por venta. Cliente regular y delivery se registran
solo dentro de Nueva venta, atómicamente con la venta. El delivery se introduce
manualmente, no negativo, y forma parte del total confirmado por servidor.

En mixto: efectivo aplicado = total − transferencia; ambas partes positivas; efectivo
recibido >= efectivo aplicado; cambio = recibido − aplicado. Referencia y confirmación
manual obligatorias para toda transferencia. Venta, cobro, salida de stock forman una
transacción, sin turno ni movimiento de caja. Reintentos usan la misma clave/cuerpo.

[Permisos](authentication.md), [ventas/recibos](sales.md),
[caja](cash-register.md), [compras/inventario](purchases-inventory.md),
[personal](employees.md), [navegación](frontend-modules.md).
No se agregan tarjetas, pérdidas de inventario, descuentos, recepción parcial,
despliegue público ni datos ficticios al desarrollo.

## Decisiones aprobadas para la Fase 16

El propietario confirmó el 2 de noviembre de 2026 las decisiones B15-B21 para
la [Fase 16](phase-16-usability.md). Sustituyen los fragmentos incompatibles de B07, B09, B10 y B13.
Verificación y destino migrado en [resultados](characterization.md) y [corte](cutover.md).

| ID | Decisión vigente |
| --- | --- |
| B15 | Empleado: teléfono canónico de ocho dígitos con prefijo 7 u 8 y presentación `####-####`; sin correo laboral nuevo. Dueña asigna y modifica contraseñas de 6..128 caracteres con control mostrar/ocultar; sin contraseña temporal ni cambio obligatorio para Colaborador. |
| B16 | Managua, Masaya y León y sus 28 municipios oficiales se cargan como registros permanentes. Dueña puede ampliar ubicaciones. Selectores buscables y municipio dependiente del departamento. |
| B17 | Clientes queda en consulta, sin edición ni desactivación; alta solo desde Nueva venta. Proveedores queda en consulta, puede desactivarse/reactivarse y se crea solo desde Compras. El alta contextual guarda inmediatamente con idempotencia antes de seleccionar el proveedor; las compras posteriores usan su ID. Elegir registros existentes rellena sin modificarlos. |
| B18 | Catálogos nuevos no admiten vacíos. Tallas fijas para altas: S, M, L, XL y XXL; no editables. Valores históricos se conservan sin ofrecerse como nuevas opciones. |
| B19 | Producto conserva costo principal y precio servidor costo × 1.15. Relación muchos a muchos con proveedores; cada relación guarda su costo de compra histórico sin recalcular automáticamente el precio de venta. |
| B20 | Recibo visible decimal desde 1, sin prefijo ni relleno; se permiten saltos por fallos o rollbacks y nunca se renumera historia. Venta mantiene identificador separado. |
| B21 | Se retiran caja y turnos del comportamiento operativo. Venta/anulación no requieren turno ni generan movimientos de caja. Pagos completos e historia de caja se conservan; tablas y filas anteriores no se borran. |
