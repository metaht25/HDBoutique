# Arquitectura del sistema

## Implementacion existente

El backend Django/DRF se organiza en ubicaciones, personas, productos,
proveedores, compras y ventas. Cada aplicacion contiene modelos unmanaged,
ModelSerializers y ModelViewSets. La ruta habitual es router -> ViewSet ->
serializer -> Django ORM -> SQL Server. No hay una capa propia de casos de uso.

El frontend React/Vite contiene un layout, ocho paginas y siete servicios fetch.
El estado de navegacion y formularios reside en componentes; gran parte de la
validacion y los calculos estan dentro de las paginas. Los contratos, consumidores
y limitaciones se detallan en [legacy-api-contracts.md](legacy-api-contracts.md).

Desde fase 3 existe ademas `backend/app/`: main.py crea FastAPI, core/config.py
valida variables HDB_ y api/health.py publica salud. Desde fase 4, infrastructure/
database/connection.py crea un engine perezoso; readiness consulta PostgreSQL
si esta configurado y live sigue comprobando solo proceso. No importa settings
Django. La nueva aplicacion se ejecuta en
8001 para mantener el frontend y Django en su contrato actual de 8000.

Desde fase 5, Base comparte metadata y nombres de restricciones; models.py registra
17 modelos tipados de siete funcionalidades. session.py configura sessionmaker,
guardada en el estado de FastAPI sin abrir sesiones/conexiones al importar.
Alembic versiona la estructura; 0001_compatibility conserva el modelo inicial
acordado, sin decidir las reglas ambiguas. El detalle esta en
[data-model.md](data-model.md) y [ADR 0004](decisions/0004-compatible-schema-foundation.md).

pyproject.toml y uv.lock gestionan ambos backends. Las dependencias legacy quedan
en su grupo temporal y requirements.txt es una exportacion generada. Las decisiones
tecnicas de esta base estan en [ADR 0002](decisions/0002-backend-foundation.md).

## Diseno objetivo

Monolito modular por funcionalidades, con arquitectura por capas dentro de cada
modulo. Se conserva React/Vite y se incorpora TypeScript gradualmente. El backend
utilizara FastAPI, Pydantic, SQLAlchemy 2.x, Alembic y PostgreSQL, gestionado con uv.
La base de versiones y los comandos verificados estan en
[development.md](development.md); el bloqueo contiene la resolucion exacta.

| Capa | Responsabilidad | Limite |
| --- | --- | --- |
| API/presentacion | Rutas, schemas, permisos y respuestas HTTP | No hacer calculos financieros o commits |
| Aplicacion/servicio | Casos de uso, coordinacion y transacciones | No depender de componentes frontend |
| Dominio | Invariantes y calculos centrales que ameriten extraccion | Sin dependencias HTTP o SQLAlchemy |
| Persistencia/repositorio | Consultas y escritura mediante ORM | No confirmar por separado una operacion del servicio |
| Infraestructura | Configuracion, sesiones, seguridad y logs | Sin reglas comerciales ocultas |

Flujo previsto de una escritura coordinada:

```text
HTTP -> router + schemas -> servicio -> reglas de dominio
                              |
                              +-> repositorios -> sesion SQLAlchemy -> PostgreSQL
```

Empezar con SQLAlchemy sincrono, una sesion por solicitud/caso de uso y repositorios
concretos. Extraer interfaces o entidades de dominio separadas solo cuando faciliten
reglas, pruebas o sustituciones reales. No duplicar entidades simples por cumplir
una plantilla de capas.

Una compra/venta futura se confirmara en una sola transaccion que incluya cabecera,
lineas y efectos de inventario acordados. El servicio establece ese limite y los
repositorios comparten la sesion. Ver B01-B06 antes de fijar su comportamiento.

## Modulos previstos

| Modulo | Responsabilidad y origen |
| --- | --- |
| catalog | Productos, categorias y tallas de productos |
| inventory | Existencias y movimientos bajo reglas B01/B02 |
| customers | Clientes, tipos y abonos existentes; B06 pendiente |
| suppliers | Proveedores y correspondencias de productos |
| locations | Departamentos, municipios y direcciones; B08 pendiente |
| staff | Empleados, separados de la identidad de acceso |
| identity | Usuarios, sesion y permisos segun B09 |
| purchases | Casos de uso de compra y recepcion acordada |
| sales | Casos de uso de venta y sus efectos coordinados |
| reporting | Consultas agregadas; sin escribir sobre otras funcionalidades |

Caja conserva su pantalla existente. Un modulo backend de caja solo se agrega
cuando se confirme B10. Colores, SKU o variantes agrupadas no son requisitos nuevos
implicitos. El inventario funcional esta en los documentos de fase 1.

## Estructura objetivo, implementada parcialmente

```text
HDBoutique/
├── AGENTS.md
├── README.md
├── backend/
│   ├── pyproject.toml, uv.lock, .python-version
│   ├── Dockerfile, .dockerignore, alembic.ini
│   ├── app/
│   │   ├── main.py
│   │   ├── api/                    # router, dependencias, errores HTTP
│   │   ├── core/                   # configuracion, errores y logs
│   │   ├── infrastructure/         # base de datos y seguridad
│   │   ├── modules/
│   │   │   ├── catalog/
│   │   │   ├── inventory/
│   │   │   └── ...                 # modulos de la tabla
│   │   └── compatibility/          # adaptacion legacy temporal
│   ├── migrations/versions/
│   ├── scripts/data_migration/
│   └── tests/                      # caracterizacion, unidad, API e integracion
├── frontend/
│   ├── Dockerfile, .dockerignore
│   ├── src/
│   │   ├── app/                    # router y proveedores de contexto
│   │   ├── features/               # funcionalidades existentes
│   │   ├── layouts/
│   │   └── shared/                 # HTTP, UI, tipos y formato
│   └── tests/
├── docs/
├── infra/                          # proxy y operacion cuando sean necesarios
└── compose.yaml                    # con ajustes de desarrollo/produccion
```

Dentro de cada modulo, router.py, schemas.py, service.py, models.py y repository.py
se crean segun necesidad. domain.py se reserva para reglas centrales; no generar
archivos vacios ni capas de paso. El backend legacy permanece durante la sustitucion.
La fase 3 creo la base uv/FastAPI y pruebas; fase 4 incorpora conexion tecnica,
Dockerfile/.dockerignore, compose.yaml, compose.dev.yaml e infra/postgres y
scripts. Fase 5 agrega Base, registro ORM, session factory, los modelos de catalog,
locations, customers, staff, suppliers, purchases y sales y migrations/ con Alembic.
compose.test.yaml verifica esquema/persistencia en PostgreSQL desechable. Fase 7
agrega routers, schemas explicitos, servicios transaccionales y repositorios
concretos en locations, catalog, customers y suppliers. Las rutas requieren
habilitacion expresa en desarrollo/pruebas; ver [contrato](foundation-api.md).
Staff, los flujos transaccionales y la reorganizacion frontend siguen pendientes.

## Fronteras y compatibilidad

Un modulo coordina a otro por un servicio/contrato explicito; no importa sus
routers ni crea sesiones propias a mitad de una transaccion. Las FK entre modelos
expresan relaciones, pero no sustituyen autorizacion ni reglas de aplicacion.

Los schemas nuevos usan ingles y campos explicitos. La traduccion del contrato
legacy se limita a su adaptador y sus pruebas. Revisar
[contract-compatibility.md](contract-compatibility.md) antes de modificar rutas,
paginacion, formatos de errores o representacion monetaria.

Los reportes agregan datos en servidor; no requieren otra base, un bus de eventos
o un servicio independiente. Identidad y configuracion son compartidas por el
monolito, sin introducir un framework interno de abstracciones genericas.

## Seguridad y operacion previstas

Autenticacion y permisos en la API; hashing mantenido y vinculo usuario/empleado
definido. El mecanismo concreto de sesion se elegira en fase 8. No asumir que el
texto de administrador actual representa una sesion real.

Docker utiliza uv durante la construccion, usuario sin privilegios y claves
locales externas a la imagen. Compose desarrollo publica puertos solo en loopback.
La [guia Docker](docker.md) cubre salud, persistencia y respaldo local.
Las migraciones se ejecutan explicitamente segun [migration.md](migration.md);
CI sigue pendiente. Ver
[development.md](development.md), [quality.md](quality.md) y
[migration.md](migration.md).
