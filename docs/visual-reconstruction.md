# Reconstruccion de H&D Boutique

Incremento expresamente autorizado el 31 de octubre de 2026. Sustituye las
restricciones anteriores incompatibles: dos perfiles, bajo stock 1–5, domicilio
directo, activacion persistente, precio costo × 1.15, existencia inicial auditada,
delivery, pago mixto completo y recibo PDF de 80 mm. Sin credito, abonos, tarjetas,
descuentos, recepcion parcial ni perdidas de inventario.

## Referencias inspeccionadas

Las 26 imagenes del ZIP se extrajeron con validacion de rutas a una carpeta
temporal fuera de Git y se inspeccionaron individualmente. Prefijo comun:
`WhatsApp Image 2026-10-31 at 21.20.`; sufijo `.jpeg`.

| Archivo | Pantalla y elementos de referencia |
| --- | --- |
| 23 | Dashboard: cuatro indicadores, resumen por periodo y ultimas ventas |
| 23 (1) | Nueva venta: cliente/fecha/pago, catalogo y carrito en dos columnas |
| 24 | Carrito: cantidades, vaciado, resumen y acciones de confirmacion |
| 24 (1) | Modal de venta completada, recibo e impresion |
| 24 (2) | Ventas: indicadores, filtros, listado y medios de pago |
| 24 (3) | Ventas: productos mas vendidos |
| 24 (4) | Historial: indicadores, filtros amplios y acciones ver/recibo |
| 24 (5) | Recibos: indicadores, filtros y listado |
| 24 (6) | Recibos: vista previa y exportacion PDF |
| 25 | Productos: indicadores, filtros y tabla administrativa |
| 25 (1) | Modal de producto con costo, precio calculado y existencia inicial |
| 25 (2) | Perdidas: referencia inspeccionada, funcionalidad excluida |
| 25 (3) | Historial de perdidas: referencia inspeccionada, excluida |
| 25 (4) | Compras: indicadores, filtros, pendientes y recibidas |
| 25 (5) | Modal de compra con multiples lineas y envio |
| 25 (6) | Proveedores: tres indicadores y tabla completa |
| 26 | Modal de proveedor con domicilio directo |
| 26 (1) | Clientes: indicadores, filtros, listado y recientes |
| 26 (2) | Modal de cliente con municipio y domicilio |
| 26 (3) | Empleados: indicadores, filtros y tabla |
| 27 | Modal de empleado y cuenta de acceso |
| 27 (1) | Inicio colaborador lavanda, actividad propia y bajo stock |
| 27 (2) | Nueva venta colaborador |
| 27 (3) | Productos colaborador; corregir exposicion de proveedor/valor al costo |
| 28 | Clientes colaborador; ampliar con alta y edicion autorizadas |
| 28 (1) | Mis recibos y acciones propias |

Identidad: sidebar claro, rosa/fucsia para Dueña, morado/lavanda para Colaborador,
fondo calido claro, tarjetas blancas redondeadas y bordes discretos. Se corrigen
titulos/campos recortados, desbordamiento y multiples barras verticales. No se
copian datos comerciales de las capturas.

## Registro de trabajo

- Inicio: rama Cris-develop, arbol limpio; runtime local saludable 8080/8001/5433.
- Inspeccion previa de solo lectura: head 0005_cash_checkout; cero cuentas Manager.
- Implementacion, pruebas, comparacion final y migracion: en curso. Este documento
  no certifica verificaciones pendientes.
