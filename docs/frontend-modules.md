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

## Verificacion

Resultados y limites de cada incremento en [characterization.md](characterization.md).
E2E usa respuestas sinteticas interceptadas; verifica navegador, formulario,
payload y recarga del estado simulado, no conexion real frontend/PostgreSQL.
Las pruebas HTTP de backend usan PostgreSQL aislado migrado desde vacio.
No se consultan ni migran bases reales. Head Alembic permanece en 0004.
