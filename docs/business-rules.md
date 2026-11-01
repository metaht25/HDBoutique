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
| B07 | Activación persistente de productos, clientes, proveedores y empleados. Inactivos conservan historia y quedan excluidos de nuevas operaciones hasta reactivación. Empleado inactivo bloquea acceso y revoca sesiones. |
| B08 | Domicilio directo: departamento, municipio y dirección exacta. Municipio debe pertenecer al departamento. La FK nueva es nullable para conservar domicilios antiguos sin inventar municipio. |
| B09 | Dos perfiles: Dueña (Administrator) y Colaborador (Cashier). Perfil intermedio retirado; cuentas antiguas se desactivan, revocan y auditan sin convertirlas. Alta de empleado crea cuenta de colaborador en la misma transacción, con contraseña temporal hasheada y cambio obligatorio. |
| B10 | Caja principal y turnos; apertura/cierre, ingresos/retiros supervisados y conciliación. Efectivo, transferencia o mixto, con componentes separados. Integrada en Dashboard/Nueva venta; sin entrada independiente en menú. |
| B11 | No se utiliza /admin/ ni existe backend Django. Empleados y cuentas se gestionan desde la interfaz vigente. |
| B12 | Sin origen SQL Server. Destino local autorizado hdboutique-dev/hdboutique; respaldos previo/final restaurados en bases separadas y conciliados. No se borran historias ni evidencias. Nuevos orígenes requieren alcance propio. |
| B13 | Teléfono textual hasta 10 caracteres para personas/proveedores. Cliente regular: nombre y apellido, teléfono opcional. Delivery: teléfono y domicilio completos obligatorios. Cliente general: identidad técnica única, sin datos personales. |
| B14 | Stock 0 agotado; 1–5 bajo; >5 suficiente. Nulo y negativo separados. Sin fallback al campo legado. |

Cliente general no genera una persona por venta. Cliente regular y delivery se
registran desde Clientes o Nueva venta. El delivery se introduce manualmente,
no negativo, y forma parte del total confirmado por servidor.

En mixto: efectivo aplicado = total − transferencia; ambas partes positivas;
efectivo recibido >= efectivo aplicado; cambio = recibido − aplicado. Referencia
y confirmación manual obligatorias para toda transferencia. Venta, cobro, salida
de stock y caja forman una transacción. Reintentos usan la misma clave/cuerpo.

[Permisos](authentication.md), [ventas/recibos](sales.md),
[caja](cash-register.md), [compras/inventario](purchases-inventory.md),
[personal](employees.md), [navegación](frontend-modules.md).
No se agregan tarjetas, pérdidas de inventario, descuentos, recepción parcial,
despliegue público ni datos ficticios al desarrollo.
