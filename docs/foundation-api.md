# API fundamental: incrementos de fase 7

Implementados ubicaciones/catalogo y clientes/proveedores con schemas explicitos,
repositorios concretos y transacciones en servicios. Empleados no forma parte del
incremento solicitado. Django y sus consumidores conservan sus rutas.

## Habilitacion y limites

Las rutas estan deshabilitadas por defecto. HDB_BUSINESS_API_ENABLED=true las
registra exclusivamente con HDB_ENVIRONMENT=development o test. La configuracion
rechaza habilitarlas en production hasta implementar permisos de fase 8. Este
interruptor no es autenticacion: limitar el acceso al entorno local de desarrollo.
No se cambio Compose ni la configuracion privada para habilitarlas.

La implementacion preserva el esquema inicial acordado en fase 5. El usuario
confirmo para las altas y ediciones de este incremento la compatibilidad B08/B13:
direccion solo con departamento y telefono textual de hasta 10 caracteres,
ademas de ambas existencias independientes. Las pruebas habilitan las rutas
solo con datos sinteticos; la configuracion local existente no se modifico.
B01/B03/B07 siguen pendientes: no se definen disponible/reservado, movimientos,
descuentos, redondeo, desactivaciones ni calculos de deuda.

## Recursos

Prefijo /api/v1, sin barra final. Cada recurso ofrece GET/POST de coleccion y
GET/PUT/PATCH/DELETE de detalle /{record_id}. IDs de solo lectura, generados por
PostgreSQL. Las relaciones son IDs planos.

| Recurso | ID | Campos de escritura |
| --- | --- | --- |
| departments | department_id | name |
| municipalities | municipality_id | department_id, name |
| addresses | address_id | department_id, address_line |
| categories | category_id | name |
| sizes | size_id | name |
| products | product_id | category_id, size_id, name, legacy_stock_quantity, legacy_stock, unit_price |
| customer-types | customer_type_id | name |
| customers | customer_id | address_id, customer_type_id, first_names, last_names, phone_number |
| suppliers | supplier_id | address_id, company_name, contact_first_names, contact_last_names, phone_number, work_email |
| supplier-products | supplier_product_id | product_id, purchase_price |
| supplier-offerings | offering_id | supplier_id, supplier_product_id |

La nulabilidad y longitudes siguen el [modelo inicial](data-model.md).
Los schemas Create, Patch y Read de cada modulo son la fuente ejecutable del
contrato; OpenAPI describe campos, limites, metodos y errores cuando se habilita.
No hay nuevas tablas, migraciones, dependencias, estados ni unicidades de pares.

## Validacion y respuestas

- GET devuelve 200, POST 201, PUT/PATCH 200 y DELETE 204 sin cuerpo.
- Listas ordenadas por ID, con offset >= 0 y limit entre 1 y 100 (defecto 50).
  Devuelven una lista, incluida []; avanzar offset hasta recibir una lista vacia.
  El frontend actual no consume estas listas ni cambia su paginacion.
- PUT reemplaza los campos: los opcionales omitidos pasan a null. PATCH conserva
  los omitidos; null solo se permite en columnas anulables. PATCH vacio no cambia
  valores. No se permiten campos ajenos ni escribir IDs generados.
- Cadenas requeridas no vacias, limites de longitud del esquema y espacios
  exteriores eliminados en entrada. Telefonos siguen como texto, sin imponer
  ocho digitos ni convertirlos a numero. work_email conserva CharField legacy.
- IDs de relacion enteros positivos y existentes. Enteros de stock estrictos de
  32 bits; ambos campos independientes y anulables, sin restricciones comerciales
  inventadas. Dinero Decimal/NUMERIC(10,2), sin redondear exceso de decimales;
  la salida serializa dinero como texto con los centavos guardados.
- 404 para ausencia, 422 para validacion/referencia inexistente, 409 para conflicto
  referencial y 503 para base no configurada/no disponible. Las escrituras fallidas
  revierten su transaccion; las FK RESTRICT protegen relaciones historicas.

Formato de error:

```json
{"error":{"code":"invalid_reference","message":"Related record not found"}}
```

Los errores de validacion agregan fields con location y type. No incluyen el
valor recibido, SQL, credenciales ni detalles internos de excepciones.

Ejemplo de direccion sintetica:

```json
{"department_id":101,"address_line":"Direccion sintetica"}
```

No se acepta municipality_id ni direccionexacta: se rechazan explicitamente
para evitar la perdida silenciosa de D04. Una direccion se registra como recurso
independiente; customers/suppliers reciben address_id existente. No se afirma
atomicidad conjunta de direccion y persona ni se migra el formulario legacy.
Una alta atomica anidada y la relacion municipio requieren concretar B08.

Las pruebas HTTP de PostgreSQL usan compose.test.yaml, Alembic y datos sinteticos,
incluyendo roundtrip de los once recursos, PATCH/PUT, FK invalidas, rollback,
borrados protegidos y visibilidad del commit desde otra conexion.
Ver [resultados](characterization.md#verificacion-de-fase-7-incrementos-solicitados).
