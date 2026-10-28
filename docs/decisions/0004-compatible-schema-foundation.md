# ADR 0004 - Esquema inicial de compatibilidad y Alembic

Estado: implementado en fase 5, con pruebas PostgreSQL aisladas.

## Contexto y decision del usuario

Hay 17 recursos Django declarados, sin inventario fisico SQL Server y con B01-B14
pendientes. El usuario confirmo conservar la estructura inicial: dos existencias
separadas y direccion vinculada solo al departamento. No se considera una
aprobacion del significado comercial de esos campos.

## Decision

- Implementar 17 modelos tipados por funcionalidad y una DeclarativeBase comun.
  Registro explicito de metadata, sin conexiones ni DDL al importar modelos.
- Conservar FK, nulabilidad, longitudes y DATE declarados. Traducir nombres al
  ingles; retener ambas existencias con prefijo legacy para no atribuirles semantica.
- PK INTEGER Identity BY DEFAULT para preservar IDs. offering_id es identidad del
  destino, sin asumir la PK de Ofrece ni hacer unico el par proveedor/producto.
- FK con borrado RESTRICT e indices de referencia; sin cascadas destructivas,
  deduplicaciones ni nuevas restricciones comerciales sin perfilado/reglas.
- Dinero Decimal/NUMERIC. Precio de linea de venta NUMERIC(12,2) para centavos y
  rango completo del INTEGER original; demas importes NUMERIC(10,2).
- Session factory por engine, sin sesion global. El servicio abre/confirma su
  transaccion con Session.begin(); repositorios futuros no haran commits propios.
- Alembic es el mecanismo de esquema: revision explicita 0001_compatibility,
  metadata registrada, convencion de nombres y generacion offline sin credenciales.
  No create_all, stamp como sustituto de DDL ni migraciones al arrancar FastAPI.
- Mantener DDL historico independiente de modelos vivos. Futuras revisiones nuevas
  se generan/revisan y formatean con Ruff; no editar revisiones aplicadas.
- Probar en Compose independiente, PostgreSQL temporal sin puertos/volumen
  persistente, credenciales sinteticas y opt-in --run-postgres. Nunca reutilizar
  implicitamente HDB_DATABASE_* de la aplicacion para pruebas.

La [convencion de nombres SQLAlchemy](https://docs.sqlalchemy.org/en/21/core/constraints.html#configuring-constraint-naming-conventions)
y la [conexion compartida Alembic](https://alembic.sqlalchemy.org/en/latest/cookbook.html#connection-sharing)
permiten DDL consistente y ensayos dentro de transacciones controladas.

## Consecuencias y limites

La base local de fase 4 se migra explicitamente tras verificar que esta vacia y
respaldarla. Los ensayos de downgrade y datos solo se realizan en PostgreSQL de
pruebas. Los resultados ejecutados viven en [caracterizacion](../characterization.md).

El esquema no habilita CRUD nuevo ni garantiza invariantes de compras/ventas.
No se trasladan historicos, no se calcula saldo, no se reinterpreta refill_date y
no se corrige el precio entero del backend Django. Las siguientes fases agregaran
reglas, costes historicos comprobados, permisos e invariantes con sus revisiones.
Las secuencias deberan realinearse despues de cargar IDs explicitos en fase 6.
