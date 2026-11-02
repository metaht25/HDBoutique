# Dashboard y consultas

Agregaciones, filtros inclusivos y paginación se calculan en PostgreSQL, con
transacciones de lectura REPEATABLE READ para que indicadores y filas concuerden.
Fecha comercial y contexto provienen del servidor en America/Managua.

Dashboard: vendido hoy/mes, productos vendidos, bajo stock, resumen semana/mes/año,
total y cantidad del periodo y últimas ventas; sin turno ni consultas de caja. Colaborador recibe
solo su actividad; el catálogo permitido muestra stock, sin costo ni proveedor.

API /api/v1:
- /dashboard/overview: periodo week/month/year.
- /reports/product-catalog: nombre/categoría/estado y métricas; columnas y valor
  al costo únicamente para Dueña.
- /reports/customer-directory: búsqueda/departamento/estado, totales y domicilios.
- /reports/supplier-directory y /employee-directory: solo Dueña.
- /reports/sales-ledger: fechas inclusivas, número/cliente/método/estado,
  indicadores, filas, medios de pago y más vendidos. Colaborador queda limitado
  a su cuenta incluso enviando filtros manuales.
- /reports/purchase-ledger: solo Dueña, proveedor/búsqueda/fechas/estado.
- Endpoints históricos globales /dashboard, /reports/sales y /reports/customers
  son administrativos; no abren un acceso alternativo a Colaborador.

Anuladas visibles con estado, excluidas de importes/unidades vendidos. Histórico
sin pago no se cuenta como recibo emitido. No se infieren horas o identidades no
guardadas. Dinero Decimal serializado como texto, sin sumar importes con float.

Stock: 0 agotado; 1–5 bajo; >5 disponible; null pendiente de conteo y negativo
inválido separados. Nunca usar legacy_stock_quantity como fallback.

Ventas integra indicadores, métodos y productos más vendidos; Historial agrega
búsqueda amplia, acciones Buscar/Limpiar, detalle/recibo e impresión del resultado;
Recibos muestra hoy/mes/monto y permite vista, impresión/PDF.
[Interfaz](frontend-modules.md), [ventas](sales.md).
