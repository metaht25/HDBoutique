# Listados: medición y corrección de N+1

Se midieron `SaleService.list_sales` y `PurchaseService.list_purchases`, usados
por `GET /api/v1/sales` y `GET /api/v1/purchases`. La interfaz activa de Ventas y
Compras usa los reportes agregados; no se atribuye a este cambio una aceleración
del dashboard ni se modifican esas consultas de reportes. Los endpoints de
detalle/listado siguen siendo contratos disponibles y participan en integración.

Antes, cada fila consultaba su flujo y líneas; ventas además consultaba pago,
anulación y devoluciones. El número de consultas crecía con el tamaño de página.
Se agrupan lecturas de las entidades de una página ya filtrada y paginada. El
formateador de cada respuesta se comparte con el detalle individual. No cambia
el contrato, orden, precisión monetaria, datos históricos ni filtro de Cashier.
No se modifican comandos de registro, cobro, recepción o anulación, ni sus locks
o claves de idempotencia. No requiere relaciones ORM nuevas ni migraciones.

## Evidencia reproducible

Prueba `tests/integration/test_list_queries.py`, exclusivamente PostgreSQL de
pruebas. Cada caso construye 20 registros por tipo: vigentes, un histórico sin
flujo/costos, compra recibida y venta anulada con devolución. Contador SQLAlchemy
de SELECT, sesiones nuevas y cinco repeticiones por tamaño. Los tiempos incluyen
lectura/formateo del servicio; son medianas locales con datos sintéticos y caché
de PostgreSQL caliente, no una garantía de latencia en producción.

| Listado | Filas | SELECT antes | SELECT después | Mediana antes | Mediana después |
| --- | ---: | ---: | ---: | ---: | ---: |
| Ventas | 1 | 5 | 5 | 3,60 ms | 3,91 ms |
| Ventas | 20 | 82 | 6 | 45,89 ms | 7,95 ms |
| Compras | 1 | 3 | 3 | 4,02 ms | 4,36 ms |
| Compras | 20 | 41 | 3 | 29,37 ms | 7,46 ms |

La regresión impone máximo seis SELECT para ventas (cinco si no hay anulación)
y tres para compras; al crecer de una a veinte filas admite solo una consulta
adicional para devoluciones. Compara todos los campos serializados de cada fila
contra el detalle, incluye NULL históricos, estados y cantidades devueltas,
comprueba paginación vacía y restringe a las nueve ventas del colaborador.

Ejecutar con el procedimiento aislado de `compose.test.yaml`, sobre una base
vacía terminada en `_test`, como las demás pruebas de integración:

```text
uv run --locked python -m pytest --run-postgres --no-cov -s tests/integration/test_list_queries.py
```

La mejora limita las consultas por página. El tamaño máximo de la página y de
las líneas continúa siendo el del contrato existente; no descarga todos los
registros ni introduce cachés de datos comerciales entre cuentas o peticiones.
