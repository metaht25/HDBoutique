# Interfaz vigente

Correcciones posteriores a Fase 16: login centrado responsive; Cargo seleccionable;
proveedor guardado inmediatamente desde Compras, con selección y reintento seguro;
teléfonos y entradas numéricas controlados; perfil admite teléfono ausente.
Ver [diagnóstico y verificación](owner-corrections-audit.md).

React/Vite/TypeScript conserva cliente HTTP compartido, sesión, CSRF y recuperación
de comandos idempotentes. La reconstrucción usa las 26 capturas inventariadas en
[referencias visuales](visual-reconstruction.md). Variables y componentes
reutilizables centralizan rosa/fucsia de Dueña y morado/lavanda de Colaborador,
tarjetas, filtros, tablas, formularios, modales y responsive.

| Dueña, en orden | Ruta |
| --- | --- |
| Dashboard | /dashboard |
| Nueva venta | /new-sale |
| Ventas | /sales |
| Historial de ventas | /sales-history |
| Recibos | /receipts |
| Productos / Inventario | /products |
| Compras | /purchases |
| Proveedores | /suppliers |
| Clientes | /customers |
| Empleados | /employees |

Colaborador: Inicio (/dashboard), Nueva venta, Productos, Clientes y Mis recibos.
Muestra nombre del colaborador en encabezado. Cerrar sesión al final del menú.
Las rutas administrativas se rechazan antes de cargar consultas restringidas.

Caja/turnos se retiran de Dashboard/Nueva venta y de la API viva. Reportes están
en Ventas e Historial; categorías en Productos; departamentos
y municipios en directorios; cuentas en Empleados. Datos de la boutique en
«Dueña · Mi perfil» del encabezado. No hay entradas Caja, Reportes, Configuración
ni Pérdidas. Las URLs antiguas redirigen a su módulo de destino.

Clientes solo consulta/busca, con alta desde Nueva venta. Proveedores consulta y
activa/desactiva, con alta desde Compras. Los datos existentes se rellenan sin editar.
Empleados usa teléfono 8000-0000, sin correo laboral, y contraseña asignada por Dueña
con mostrar/ocultar. Ubicaciones usa combobox buscables sin distinguir acentos,
municipio dependiente y limpieza al cambiar departamento. Tallas fijas sin pestaña
administrable. Recibos decimales sin prefijo/relleno.

Altas y ediciones autorizadas en modales con foco, Escape y retorno al control de origen.
En móvil se pliegan menú y columnas; el desplazamiento horizontal se limita a
tablas. Vacío, carga, error, confirmación y reintento tienen estados visibles.
Operaciones inciertas conservan cuerpo/clave por cuenta y pestaña al recargar.

Nueva venta usa fecha de servidor, cliente general/regular/delivery, catálogo,
carrito limitado por stock, cambio y pago completo. Modal de éxito abre recibo,
impresión y descarga PDF. El servidor sigue siendo autoridad del dinero/stock.

Los contratos antiguos se conservan solo donde hay consumidores de compatibilidad.
[Reglas](business-rules.md), [preparación contextual](initial-setup.md),
[reportes](reporting.md), [ventas](sales.md).
