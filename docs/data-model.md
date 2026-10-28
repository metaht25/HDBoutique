# Modelo de datos: referencia y limites

## Fuente de verdad disponible

El codigo declara 17 modelos de negocio en los seis archivos models.py activos.
Todos usan managed=False; por tanto, sus migraciones no administran las tablas.
Los nombres, campos, tipos declarados y ejemplos se encuentran en
[legacy-api-contracts.md](legacy-api-contracts.md), sin duplicar ese diccionario aqui.

La base fisica SQL Server no se ha inspeccionado. No tomar los modelos como
inventario completo de tablas, PK, FK, restricciones, indices, triggers o usuarios.
El archivo autogenerado `backend/hdboutique/modelos_bd.py` no es el modelo activo
ni una fuente de esquema actualizada.

## Relaciones declaradas en codigo

Cada flecha representa una FK desde la entidad de la izquierda hacia la derecha.
No afirma haber verificado su existencia fisica.

| Entidad | Entidades referenciadas |
| --- | --- |
| Municipio | Departamento |
| Direccion | Departamento; no tiene FK a Municipio |
| Clientes | Direccion, TipoCliente |
| Empleados | Direccion |
| Productos | Categoria, Tallas |
| Proveedores | Direccion |
| Productoproveedor | Productos |
| Ofrece | Proveedores, Productoproveedor |
| Compras | Proveedores, Empleados |
| Detallecompra | Compras, Productoproveedor |
| Venta | Clientes, Empleados |
| Detalleventa | Venta, Productos |
| DeudaCliente | Clientes, Venta |

Departamento, TipoCliente, Categoria y Tallas no declaran otras FK. Los 16 modelos
distintos de Ofrece declaran una PK AutoField explicita. Ofrece no declara PK y
Django espera una identidad implicita; falta verificar como se identifica la fila
real. Todas las FK del codigo usan DO_NOTHING: eso describe al ORM, no certifica
que la base carezca de restricciones o de proteccion contra borrados.

## Puntos de integridad que condicionan el nuevo esquema

| Asunto | Tratamiento antes de definir PostgreSQL |
| --- | --- |
| Dos existencias anulables | Resolver B01 y perfilar valores; no eliminar una columna por similitud de nombre |
| Precio producto decimal, detalle venta entero | Corregir D03 sin inventar centavos historicos |
| Coste en ProductoProveedor y no en DetalleCompra | Confirmar de donde recuperar costes historicos; no usar automaticamente precio actual |
| Cabeceras y lineas independientes | Definir casos de uso atomicos y politica de operaciones confirmadas |
| DeudaCliente contiene abonos | Confirmar B06; no inferir principal, saldo o sobrepagos |
| Direccion sin municipio | Resolver B08 antes de agregar relaciones o rellenar historicos |
| Campos texto opcionales y sin unicidad declarada | Buscar nulos/duplicados antes de endurecer restricciones |
| Fecha sin hora | Preservar DATE; no reconstruir instantes inexistentes |
| Collation SQL Server | Revisar comparacion por mayusculas, acentos y unicidad en el destino |

## Modelo objetivo y evolucion

SQLAlchemy 2.x describira el modelo activo nuevo y Alembic su evolucion versionada.
No usar create_all como mecanismo de despliegue que compita con las migraciones.
La fase 5 implementa y comprueba el esquema PostgreSQL; la fase 6 ensaya el traslado
de datos desde un origen autorizado.

Las traducciones candidatas de tablas/columnas estan en
[contract-compatibility.md](contract-compatibility.md). Mantener IDs y mapeos cuando
se cambien nombres. Las entidades nuevas de inventario/identidad se definiran con
sus reglas y no se presentaran como tablas existentes del origen.

Los importes nuevos usaran NUMERIC y Decimal. Restricciones de cantidades,
unicidad, indices y borrado se revisaran contra reglas aprobadas y datos reales.
Los documentos B01-B14 siguen pendientes: una propuesta arquitectonica no aprueba
su politica comercial. Para conservacion y conciliacion, ver
[migration.md](migration.md).
