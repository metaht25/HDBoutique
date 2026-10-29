# Migracion funcional del frontend: fase 12

Se ejecuta por incrementos: Productos primero y Clientes despues, por solicitud
expresa. Las otras pantallas conservan su contrato legacy y quedan pendientes.

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

## Verificacion de los incrementos

Resultados y limites de cada incremento en [characterization.md](characterization.md).
E2E usa respuestas sinteticas interceptadas; verifica navegador, formulario,
payload y recarga del estado simulado, no conexion real frontend/PostgreSQL.
Las pruebas HTTP de backend usan PostgreSQL aislado migrado desde vacio.
No se consultan ni migran bases reales. Head Alembic permanece en 0004.
