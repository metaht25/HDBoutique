# Compras e inventario: fase 9

Reglas B01/B02/B05 y alcance de B03 para compras confirmados expresamente por el
usuario el 28 de octubre de 2026. Administrator y Manager registran y reciben
compras y consultan movimientos; Cashier no accede a estas rutas ni a los costes.
Se mantienen las sesiones, CSRF, origen exacto y habilitacion explicita de fase 8.

## Flujo y existencias

Una solicitud registra cabecera, lineas, costes historicos y autoria en una sola
transaccion. Estado inicial registered: no modifica existencias. La recepcion es
completa y atomica: registered -> received, con una entrada de inventario por
linea y aumento de stock. Repetirla devuelve la compra recibida sin otro aumento,
sin cambiar su fecha ni su responsable original.

stock, expuesto como legacy_stock, es la existencia disponible. cantidadstock,
expuesto como legacy_stock_quantity, queda conservado como dato legacy y no cambia
al recibir. Los productos creados por la nueva API comienzan con stock cero;
cantidadstock queda null. Ambos campos son ahora de solo lectura en POST/PUT/PATCH
de productos: los campos enviados se rechazan con 422. PUT de metadatos conserva
ambas existencias. Esto sustituye expresamente las escrituras de compatibilidad
de fase 7; el frontend Django conserva su contrato hasta su migracion.

Un stock existente null o negativo bloquea la recepcion: no se interpreta como
cero ni se corrige automaticamente. Requiere conteo y procedimiento autorizado
antes de operar; esta entrega no agrega ajustes manuales ni movimientos ficticios
de apertura. Se rechaza tambien cualquier suma que exceda INTEGER de 32 bits.
No se eliminan restricciones FK ni historicos para permitir una operacion.

## Costes, fechas y responsabilidad

El servidor obtiene el precio vigente de supplier_products al registrar, valida
que el producto este ofrecido por ese proveedor y guarda una copia inmutable del
coste y del product_id de cada linea. Un cambio posterior de precio, oferta o
relacion del producto del proveedor no reescribe esos datos de la compra.
No se acepta unit_cost ni un total impuesto por el cliente.

NIO, Decimal y dos decimales; cantidades enteras positivas, costes y envio no
negativos. El envio se guarda separado, sin distribuirlo en unidades. La suma
de quantity * unit_cost da merchandise_total; total agrega el envio. No hay
descuentos ni calculo de valoracion ponderada de inventario.
shipping_cost admite texto decimal exacto o entero; rechaza float, booleanos,
NaN, infinitos y fracciones que necesiten redondeo. Se normaliza la salida a
dos decimales. Los costes unitarios conservan NUMERIC(10,2); los totales calculados
no se fuerzan a ese rango de almacenamiento.

purchase_date es una fecha del documento. review_date y refill_date siguen
siendo datos legacy opcionales y no activan inventario ni definen estados nuevos.
La recepcion registra received_at nuevo, con reloj del servidor y zona UTC,
independiente de esas fechas.

Si la cuenta tiene empleado vinculado se usa ese empleado; intentar indicar otro
devuelve 422. Si no lo tiene, la solicitud exige employee_id existente. Se registran
por separado cuenta y empleado de registro y de recepcion. La recepcion no cambia
el empleado original de la cabecera. No se amplio el CRUD de empleados.

## API

Prefijo /api/v1. Todas las operaciones requieren Administrator o Manager; las
escrituras tambien necesitan Origin y X-CSRF-Token validos.

| Metodo y ruta | Resultado |
| --- | --- |
| GET /purchases | Lista de compras nuevas y legacy, ordenada por ID |
| POST /purchases | Registro atomico, 201; exige Idempotency-Key |
| GET /purchases/{purchase_id} | Cabecera, lineas, costes conocidos y estado |
| POST /purchases/{purchase_id}/receive | Recepcion completa o reintento sin efectos adicionales, 200 |
| GET /inventory/movements | Historial ordenado por ID; filtros product_id y purchase_id |

Las listas reciben offset >= 0 y limit entre 1 y 100, por defecto 50; devuelven
una lista, incluida []. Los filtros de movimientos son IDs positivos. No existen
escrituras independientes de lineas/movimientos, ediciones, borrados, anulaciones
ni recepciones parciales en esta fase.

Ejemplo sintetico de registro, con IDs existentes:

```json
{
  "supplier_id": 101,
  "employee_id": 102,
  "purchase_date": "2026-10-28",
  "shipping_cost": "50.00",
  "items": [{"supplier_product_id": 103, "quantity": 2}]
}
```

Se admiten de 1 a 100 lineas; no se repite supplier_product_id en una solicitud.
Asociaciones distintas que correspondan al mismo producto se conservan: se
acumulan sus entradas sin fusionar sus costes. Las dos fechas legacy pueden
incluirse opcionalmente. El cuerpo de recepcion solo admite employee_id opcional:
`{"employee_id":102}` o `{}` si la cuenta ya tiene vinculo.

Idempotency-Key admite 8..128 caracteres ASCII alfanumericos, guion o guion bajo.
Su alcance es la cuenta creadora; solo se guarda el SHA-256 de la clave y de la
solicitud normalizada. Reintentar el mismo cuerpo devuelve la misma compra en su
estado actual, tambien con 201, aunque haya cambiado el precio del proveedor.
Reutilizar la clave con otro cuerpo u orden de lineas devuelve 409. El envio
entero 1 y el texto "1.00" se consideran iguales. Una operacion que revierte no
reserva la clave. La recepcion es idempotente por purchase_id, sin otra clave.

Errores con el envoltorio seguro de fase 7: 401 sin sesion, 403 por permisos/origen/
CSRF, 404 si no existe, 422 para cantidades, dinero, asociaciones o empleado
invalidos, 409 para conflicto de clave, compra legacy no conciliada, estado
incompleto, stock sin conteo o desbordamiento. Las FK e indices unicos son una
segunda defensa frente a carreras y se traducen a 409. Un fallo revierte la unidad.

## Persistencia, concurrencia y conservacion

Head 0003_purchase_receipts agrega purchase_workflows, purchase_item_costs e
inventory_movements: 23 tablas/modelos en total, sin editar revisiones aplicadas
ni alterar las 17 tablas legacy. Las filas antiguas no reciben estados,
costes, fechas de recepcion o movimientos inferidos.

GET de una compra sin workflow devuelve status y autoria nuevos como null.
Las lineas sin snapshot muestran unit_cost/product_id/subtotal null; no se
consulta el precio actual para fabricar costes antiguos. Sin costes conocidos,
merchandise_total/total son null. Esas compras no pueden recibirse mediante la
nueva operacion hasta un ensayo y conciliacion autorizados.

Un advisory lock transaccional serializa el registro por cuenta/clave. Se bloquean
precios/ofertas en orden de ID para capturar costes coherentes. La recepcion
bloquea su workflow y despues los productos ordenados por ID; las actualizaciones
de stock y movimientos se confirman juntas. Hay unicidad por linea recibida y
CHECK de cantidades/delta/estado. Los repositorios no hacen commits.
Referencia: [bloqueos PostgreSQL 17](https://www.postgresql.org/docs/17/explicit-locking.html).

ETL mantiene las 17 tablas mapeadas y exige head actual con las 23 tablas vacias;
no importa ni exporta identidad, workflows, costes reconstruidos o movimientos.
Los manifiestos de revisiones previas requieren nuevo ensayo y evidencia,
conservando los originales. La nueva revision se verifico solo en PostgreSQL
aislado; no se aplico contra desarrollo ni bases operativas.

Operacion con respaldo y destino autorizado: ejecutar
`uv run --locked python -m alembic upgrade head` desde backend antes de habilitar
las rutas. No hay migraciones, compras o recepciones automaticas al arrancar.
El downgrade elimina auditoria/costes/movimientos nuevos y no revierte el stock:
no equivale a deshacer recepciones y requiere respaldo y plan operativo.

Frontend, ventas, ajustes, devoluciones, anulaciones y otras reglas B03/B04/B06/B07
permanecen en sus fases o pendientes de acuerdo. Ver [reglas](business-rules.md),
[migraciones](migration.md) y [resultados](characterization.md).
