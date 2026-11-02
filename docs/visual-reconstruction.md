# Reconstruccion de H&D Boutique

Incremento expresamente autorizado el 31 de octubre de 2026. Sustituye las
restricciones anteriores incompatibles: dos perfiles, bajo stock 1–5, domicilio
directo, activacion persistente, precio costo × 1.15, existencia inicial auditada,
delivery, pago mixto completo y recibo PDF de 80 mm. Sin credito, abonos, tarjetas,
descuentos, recepcion parcial ni perdidas de inventario.

La reconstrucción y comparación de 0006 que sigue es un hito histórico.
La verificación posterior de Fase 16 se registra al final de este documento.

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
- Cierre verificado el 2 de noviembre de 2026: implementación, pruebas conectadas,
  comparación visual y migración local completadas para el alcance autorizado.

## Comparación final ejecutada

Se volvieron a inspeccionar las 26 referencias y se compararon con 63 capturas
finales conectadas y tres renders PDF (66 PNG en total), fuera de Git en
`%TEMP%/hdb-boutique-connected-final-20261102`. La revisión se hizo con imágenes,
incluidas hojas de contacto, no solo mediante nombres o assertions de overflow.

| Referencias | Correspondencia y resultado |
| --- | --- |
| 23, 27 (1) | Dashboard/Inicio: indicadores, periodo, últimas ventas y bajo stock; dos paletas y turno contextual |
| 23 (1), 24, 27 (2) | Nueva venta: catálogo/carrito, total/cambio, clientes y pago; columnas apiladas en móvil |
| 24 (1) | Venta completada: número/total, cierre y acceso al recibo |
| 24 (2), 24 (3) | Ventas: indicadores, filtros, tabla, medios y más vendidos; barras de medios en lugar del gráfico circular antiguo |
| 24 (4) | Historial: filtros amplios, tabla, detalle/anulación e impresión |
| 24 (5), 24 (6), 28 (1) | Recibos propios/globales: filtros, vista de ticket, impresión/PDF y estado anulado |
| 25, 25 (1), 27 (3) | Productos/modal: indicadores, filtros y tabla; precio calculado y cantidad inicial; colaborador sin costos ni proveedor |
| 25 (2), 25 (3) | Pérdidas se excluye expresamente; no se reproduce |
| 25 (4), 25 (5) | Compras/modal: pendiente, líneas/envío, recepción única y estado recibido |
| 25 (6), 26 | Proveedores/modal: métricas, filtros, domicilio, activación e historia |
| 26 (1), 26 (2), 28 | Clientes/modal: métricas, recientes, regular/delivery y alta/edición autorizadas para colaborador |
| 26 (3), 27 | Empleados/modal: directorio y cuenta temporal, domicilio y acceso contextual a cuentas |

Las quince rutas (diez Dueña y cinco Colaborador) se inspeccionaron a 1440×1000
y 390×844, además de ambos menús móviles desplegados. Los cinco formularios
principales se revisaron en escritorio y móvil, incluidos sus botones inferiores
después de desplazar el modal. Se revisaron tres ventas completadas, tres recibos,
clientes inline, caja contextual y detalle anulado. Sin superposición material ni
scroll horizontal global; las tablas anchas conservan desplazamiento local.
Los contornos de foco visibles en títulos corresponden a navegación accesible.

Se conserva identidad y organización, con adaptación al contrato vigente: catálogo
en tarjetas, filtros de servidor, gráfico de medios en barras, caja contextual y
ticket de 80 mm en modal. No es una réplica píxel a píxel ni copia datos comerciales
de las imágenes. No se detectaron diferencias materiales que requirieran otro
cambio de código en esta revisión.

PDF: tres documentos renderizados con Poppler e inspeccionados. Mixto y anulado:
226.772 puntos de ancho, una página cada uno, texto largo/acentos/escapado legibles,
logo y desglose de reintegro. Impresión Chromium: 227.04 puntos (~80.1 mm), una
página. Poppler emitió avisos sobre fuentes de sustitución Symbol/ArialUnicode;
los renders no mostraron glifos perdidos. No se probó una impresora física.

Pruebas y respaldo: [resultados finales](characterization.md), [corte](cutover.md).

## Fase 16: simplificación verificada (2 de noviembre de 2026)

Se inspeccionaron las 61 capturas conectadas finales y tres renders PDF (64 PNG),
fuera de Git en `%TEMP%/hdb-phase16-resumed-captures`. Se usaron imágenes completas
y 17 hojas de contacto, con revisión focal de formularios y PDF.

Las diez rutas Dueña y cinco Colaborador se revisaron a 1440×1000 y 390×844,
además de ambos menús móviles, modales de producto/compra/empleado/proveedor y
clientes regular/delivery, tres pagos, venta completada, recibos y detalle anulado.
Se verificaron los pies de formularios móviles desplazados. Rosa/fucsia y
morado/lavanda se conservan, con tablas de desplazamiento local y sin overflow
global/superposición material. Los contornos de títulos son foco accesible.

Clientes queda sin acciones de mutación; Proveedores sin alta/edición; los registros
se preparan dentro de venta/compra. Producto elimina proveedor redundante y
administración de tallas; muestra costos por proveedor. Empleado muestra teléfono
8000-0000, contraseña ocultable y ningún correo laboral. Dashboard/Checkout sin
turno. Colaborador continúa sin costos/proveedores/datos administrativos.

Recibo decimal coherente en listado, HTML, impresión y PDF. Poppler: mixto y
anulado de una página a 226.772 pt (80 mm); impresión Chromium a 227.04 pt
(~80.1 mm). Texto largo, acentos, símbolos, logo y reintegro mixto legibles.
Poppler avisó de fuentes de sustitución Symbol/ArialUnicode; no se observaron
glifos perdidos en los tres documentos finales. No se probó impresora física.
Las capturas usan exclusivamente datos sintéticos del tmpfs de pruebas.
