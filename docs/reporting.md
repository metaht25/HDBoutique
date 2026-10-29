# Dashboard y reportes: fase 13

Dashboard y Reportes migrados a TypeScript/FastAPI, con acceso de sesion, estados
de carga/vacio/error, recuperacion explicita, tablas accesibles y responsive.
La peticion del usuario excluye implementar caja; su [propuesta](cash-register-proposal.md)
queda para revisar. Las otras pantallas pendientes de fase 12 conservan su alcance.

## Reglas confirmadas expresamente

- B14: disponible 0 es agotado, 1–10 bajo stock y >10 suficiente. Null es sin
  conteo y negativo es conteo invalido, separados y pendientes de conteo; nunca
  se sustituyen por cero o por legacy_stock_quantity.
- Fecha comercial America/Managua. Hoy proviene del reloj del servidor convertido
  a esa zona, no del navegador ni de UTC cortado a fecha. Las fechas documentales
  sale_date/purchase_date ya guardadas se filtran inclusivamente, sin reinterpretar
  historicos ni usar created_at, revision o relleno como fecha de negocio.
- B09: Administrator/Manager acceden a todo este modulo; Cashier a ventas,
  inventario del catalogo y clientes. Compras/proveedores/costes no se envian a
  Cashier ni se consultan para construir su dashboard. Compras devuelve 403.

## Contrato HTTP

Todas las rutas exigen sesion y la habilitacion explicita de la API de negocio,
que sigue deshabilitada por defecto. Solo GET; no escriben datos comerciales.
Cache-Control no-store y limpieza de datos visibles al expirar la sesion.

| Ruta bajo /api/v1 | Resultado y filtros |
| --- | --- |
| /dashboard | Fecha de hoy en Managua, cantidad/importe de ventas del dia, hasta cinco ventas del dia, productos/clientes actuales, cinco estados de stock; solo personal autorizado recibe staff con proveedores y compras del dia |
| /reports/sales | summary global y items; start_date/end_date opcionales inclusivos sobre sale_date |
| /reports/purchases | summary global e items con costes historicos; fechas opcionales sobre purchase_date; Administrator/Manager |
| /reports/inventory | summary global de cinco estados; status opcional filtra detalle y total_count; inventario actual |
| /reports/customers | Clientes agrupados por customer_type_id/nombre; incluye tipos sin clientes y distingue nombres repetidos; datos actuales |

Reportes usan offset >= 0 y limit 1..100, defecto 20. Ventas/compras ordenan por
fecha descendente y luego ID descendente; inventario/tipos por ID ascendente.
Todos los resumenes se calculan antes de paginar. Una pagina vacia o fuera de
rango conserva el total global. Clientes informa total_count de clientes y
group_count de tipos, siendo este ultimo el que pagina. Inventario devuelve
total_count del detalle filtrado y conteos globales por estado claramente rotulados.

Cada respuesta tiene context con start_date/end_date cuando aplican,
business_date, timezone, generated_at UTC y currency NIO. Dashboard acota su
periodo a hoy; reportes sin fechas consultan todo el historial documental.
Inventario/clientes no aplican fechas porque el esquema no permite reconstruir
sus estados pasados. Rango invertido, fecha invalida, estado desconocido o
offset/limit fuera de limites producen 422. Sin sesion 401 y sin base 503.

Cada reporte y el dashboard ejecutan una sola sentencia SQL con resumen y pagina,
compartiendo snapshot MVCC de PostgreSQL. Se evita multiplicar cabeceras al unir
lineas; el resumen sigue representando todo el resultado aunque haya concurrencia.
Paginas solicitadas por separado pueden reflejar cambios confirmados entre ellas;
no se promete una exportacion historica congelada. No se agregan exportaciones
ni graficos a este incremento.

## Importes e historia

SQL/Decimal preserva centavos; salida textual con dos decimales, tambien en cero.
Las sumas globales pueden superar el limite monetario de una venta individual;
el frontend no las convierte a Number ni las recalcula desde filas de la pagina.

Ventas suma sales.total guardado, con source confirmed cuando existe workflow y
legacy en otro caso; informa legacy_count. No usa el precio actual del producto,
ni supone auditoria inexistente. Importe vendido no equivale a efectivo, pagos,
utilidad o deuda.
Nombres de clientes/proveedores son los actuales con sus IDs, no snapshots
historicos de identidad que el esquema no guarda.

Compras usa PurchaseItemCost por linea. Mercancia es desconocida si falta algun
snapshot, no hay lineas o una cantidad es invalida. Envio null sigue desconocido;
el total de una compra es null cuando falta mercancia/envio. Se muestran sumas
conocidas separadas y cantidades de compras incompletas. known_total incluye solo
compras con ambos importes determinados; no necesariamente equivale a la suma de
las otras dos sumas parciales. Precios actuales del proveedor nunca completan
historicos. Se distingue registered/received/legacy sin inferir recepciones.

## Frontend y operacion

/reports conserva type/page/start/end/status en URL, filtra en servidor y pagina
20 filas. Cambiar tipo o aplicar filtros vuelve a pagina 1; limpiar recupera todo
el historial. Cashier no tiene opcion de compras y el enlace directo se rechaza
sin solicitar esos datos. /dashboard ofrece el acceso al reporte completo de ventas.
Ambas pantallas reutilizan cliente HTTP, ModuleAccess, useResource y componentes;
las consultas anteriores se abortan/ignoran al navegar. Adaptadores legacy se
conservan para compatibilidad hasta verificar su retirada junto con consumidores.

tzdata 2026.2 pasa de dependencia exclusiva legacy a runtime para ZoneInfo tambien
en Windows/instalacion sin Django. No se cambia version; uv.lock actualizado con uv
y requirements.txt regenerado con el comando oficial de exportacion legacy.
No nuevas tablas, migraciones (head 0004), cuentas, habilitacion operativa ni
lecturas/escrituras de datos reales. [Resultados](characterization.md).
