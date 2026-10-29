# Migracion funcional del frontend: fase 12

Actualizacion posterior al corte: [Caja](cash-register.md) ya usa TS/FastAPI;
Ventas exige pago completo efectivo/transferencia y permite anulacion total
supervisada. Sustituye las menciones historicas al prototipo en esta guia.

Se ejecuta por incrementos: Productos primero y Clientes despues, por solicitud
expresa. Dashboard/Reportes se migran en [fase 13](reporting.md).
Ventas/Compras/Proveedores se integraron durante la [fase 14](stabilization.md);
Caja mantiene el prototipo hasta resolver B10. Las siete pantallas operativas
usan FastAPI; los adaptadores y sus pruebas legacy se retiraron en [fase 15](cutover.md).

## Productos

`/products` usa TypeScript y `/api/v1/products` mediante el cliente compartido.
Los tres roles consultan; Administrator/Manager crean y editan, Cashier consulta.
El servidor conserva la autoridad sobre permisos, referencias y validaciones.
El acceso anonimo ofrece inicio de sesion reutilizable dentro del modulo; un
fallo de sesion permite reintentar. No se habilitan rutas ni cuentas operativas.

Nombre nullable de hasta 40 caracteres, categoria y talla existentes, precio
nullable Numeric(10,2) como texto decimal exacto. El formulario no redondea ni
convierte dinero a Number. El catalogo admite precios cero/negativos; la venta
aplica su propia regla B03 de precio positivo. Disponible y cifra historica son
de solo lectura y se muestran separados. Null significa sin conteo/registro,
no cero. Un producto nuevo inicia con disponible cero segun fase 9.

GET acepta `q` opcional (maximo 100), coincidencia literal sin distinguir
mayusculas en nombre, espacios externos retirados, antes de offset/limit.
Sin q se mantiene el contrato anterior. La URL conserva q/page; 20 filas y una
fila adicional permiten avanzar sin inventar un total. Categorias/tallas se
cargan por paginas de 100 hasta completar las opciones, detectando duplicados.
No se agrega CRUD de esos catalogos en esta pantalla.

Carga, error, lista vacia, errores por campo, envio en curso y exito tienen
estados explicitos. Los borradores sobreviven a errores; las escrituras no se
reintentan automaticamente. Las consultas anteriores se abortan/ignoran al
cambiar pagina, busqueda o salir del modulo. El envio doble simultaneo se bloquea;
esto no agrega idempotencia a las altas CRUD del servidor.

El usuario confirmo B07 para este incremento: sin activacion por ahora. Se
retiran botones que cambiaban estado solo en memoria. No se agrega borrado,
umbral de bajo stock (B14) ni reglas comerciales nuevas. Los adaptadores legacy
se conservan mientras existan consumidores y pruebas de compatibilidad.

## Clientes

`/customers` usa TypeScript y `/api/v1/customers`: los tres roles consultan,
crean y editan. Nombres/apellidos obligatorios de hasta 40 caracteres y telefono
textual obligatorio de hasta 10, sin conversion numerica, regla de ocho digitos
ni eliminacion de ceros iniciales. Los tipos provienen de customer-types; sus
IDs/nombres reales no implican frecuencia, deuda ni otra clasificacion inferida.

Se exige un `address_id` existente, segun acuerdo expreso. Administrator/Manager
seleccionan direcciones con detalle y departamento; se cargan todas las paginas
de direcciones/departamentos/tipos. Cashier introduce un ID y no solicita rutas
de ubicaciones. El servidor valida la referencia al guardar, sin ampliar permisos.
El listado muestra solo el ID de direccion a Cashier; si falla una consulta
auxiliar, los IDs siguen identificando referencias sin inventar datos.

Una sola escritura POST/PATCH guarda el cliente. No hay alta inline de direccion,
municipio, deuda, activacion/desactivacion ni borrado. Si faltan direcciones o
tipos, se explica el requisito de registro por personal autorizado. No se generan
direcciones huerfanas al rechazar el cliente (D06 del formulario anterior).

GET customers admite `q` opcional de hasta 100 caracteres para nombre completo
o telefono, literal e insensible a mayusculas, antes de offset/limit. Se conservan
pagina/busqueda en URL y los mismos estados, cancelacion de lecturas, errores por
campo, bloqueo de doble envio y confirmacion de guardado que en Productos.

## Ventas y compras: integracion de fase 14

`/sales` y `/purchases` usan el espacio compartido transactions en TypeScript.
Consulta de 20 operaciones por pagina con una fila adicional para avanzar, pagina
en URL y detalle con precios historicos, cantidades y total del servidor. Las
compras historicas muestran los costes ausentes como desconocidos y no ofrecen
recepcion inferida. Importes como texto, sin sumar en navegador ni usar Number.

Los tres roles consultan/registran ventas. Solo Administrator/Manager consultan,
registran y reciben compras. Cashier no monta el modulo de compras ni solicita
proveedores/costes. Inicio de sesion dentro del modulo y permisos del servidor.
Las opciones se cargan completas por paginas; la fecha inicial procede de
context.business_date del dashboard (America/Managua). El empleado vinculado se
usa automaticamente; si falta, se exige un ID existente validado por servidor.
No hay CRUD de empleados ni nuevas reglas de autoria.

Una solicitud POST guarda la operacion completa, sin precios/total del cliente.
Venta: cliente, fecha e items producto/cantidad. Compra: proveedor, fecha, envio
textual no negativo y productos ofrecidos por ese proveedor con sus cantidades.
Hasta 100 lineas distintas, enteros positivos. El servidor sigue validando
precios, referencias, cantidades y disponible. No se editan/borran ventas.
La recepcion completa usa el endpoint idempotente de la compra registrada;
no se cambia inventario al registrar ni se permite recepcion parcial.

Antes del POST se conserva payload/Idempotency-Key en sessionStorage por cuenta
y tipo de operacion. Ante error de red/5xx o cambio de sesion se mantiene y
bloquea su edicion; el usuario reintenta exactamente la misma solicitud, incluso
tras recargar. Un rechazo definitivo permite corregir el borrador; solo se retira
la intencion tras respuesta valida o rechazo definitivo. Si el almacenamiento
esta bloqueado/corrupto se exige revisar el historial y no se crea otra intencion
silenciosamente. No hay reintentos automaticos ni tokens en almacenamiento.

## Proveedores: integracion de fase 14

`/suppliers` permite consulta/alta/edicion a Administrator/Manager y deniega a
Cashier antes de pedir datos. Empresa y nombres del contacto hasta 50 caracteres,
telefono textual hasta 10, correo opcional hasta 40 y direccion existente.
No se crean direcciones en este formulario ni se agrega municipio, activacion,
borrado o administracion de productos/ofertas del proveedor.

Una escritura POST/PATCH guarda los datos, con errores por campo y bloqueo del
doble envio. GET suppliers admite `q` opcional hasta 100 caracteres: coincidencia
literal insensible a mayusculas en empresa, nombre completo del contacto o
telefono, antes de offset/limit. `q`/page se conservan en URL; 20 filas por pagina.

## Verificacion de los incrementos

Resultados y limites de cada incremento en [characterization.md](characterization.md).
E2E usa respuestas sinteticas interceptadas; verifica navegador, formulario,
payload y recarga del estado simulado, no conexion real frontend/PostgreSQL.
Las pruebas HTTP de backend usan PostgreSQL aislado migrado desde vacio.
Fase 14 agrega cuatro E2E sin interceptar API. Fase 15 las ejecuta contra la imagen
Nginx real y agrega verificacion de recarga/404/sesion anonima, con datos sinteticos.
El corte local autorizado migro hdboutique a head 0004 tras respaldo/conciliacion;
no se cargaron datos comerciales. [Evidencia y limites](cutover.md).
