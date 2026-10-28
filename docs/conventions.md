# Convenciones del proyecto

Aplican al codigo nuevo y a las partes que se refactoricen. No ordenan un
renombrado masivo de codigo, datos o contratos existentes.

## Lenguaje y nombres

Todo identificador nuevo debe estar en ingles. Comentarios, README, documentacion,
mensajes de validacion y textos visibles pueden estar en espanol.

| Elemento | Convencion | Ejemplo |
| --- | --- | --- |
| Modulo/archivo Python | snake_case | `sale_service.py` |
| Variable/funcion Python | snake_case | `available_stock`, `create_sale` |
| Clase Python | PascalCase, singular | `Sale`, `SaleItem`, `SaleCreate` |
| Constante | UPPER_SNAKE_CASE | `DEFAULT_PAGE_SIZE` |
| Prueba Python | test_ con comportamiento | `test_rejects_insufficient_stock` |
| Variable/funcion TypeScript | camelCase | `availableStock`, `createSale` |
| Componente y archivo React | PascalCase | `ProductForm.tsx` |
| Hook y archivo | use + PascalCase | `useProducts.ts` |
| Utilidad/servicio TypeScript | camelCase | `formatMoney.ts`, `productService.ts` |
| Estilo de componente | CSS Modules | `ProductForm.module.css` |
| Tabla | plural snake_case | `sales`, `sale_items` |
| Columna/PK/FK | snake_case explicito | `sale_id`, `product_id`, `unit_price` |
| Recurso HTTP nuevo | ingles, plural; kebab-case si es compuesto | `/api/v1/products`, `/api/v1/customer-types` |

Los campos JSON legacy y las referencias a modelos espanoles son una excepcion
temporal de compatibilidad. Su mapeo esta en
[contract-compatibility.md](contract-compatibility.md); no introducir nuevos
identificadores espanoles fuera de esa frontera.

## Python y tipado

- Seguir PEP 8 con longitud de proyecto de 88 caracteres para codigo nuevo; Ruff
  sera el formateador/linter cuando se configure en fase 3.
- Agregar type hints a funciones nuevas de aplicacion, argumentos, retornos y
  contratos importantes. Preferir tipos concretos y modelos tipados a diccionarios
  ambiguos; no convertir cada prueba en una jerarquia de tipos.
- Imports ordenados por biblioteca estandar, terceros y modulos del proyecto.
- Evitar imports con efectos de conexion, cambios de datos o arranque de servicios.
- Usar nombres de negocio claros; funciones pequenas y cohesionadas. Aplicar DRY
  despues de reconocer una repeticion real, sin abstraer CRUD por anticipado.
- Capturar errores que se puedan traducir o recuperar. No ocultar fallos con
  `except Exception: pass` ni devolver exito tras una operacion parcial.
- No incluir credenciales, datos personales o SQL interno en errores al usuario.

## Responsabilidades y transacciones

- API: entrada/salida HTTP, autenticacion y permisos, traduccion de errores.
- Servicio: caso de uso, coordinacion y limite transaccional.
- Dominio: invariantes centrales independientes de HTTP y del ORM cuando aporte
  claridad; no crear entidades duplicadas para operaciones simples.
- Repositorio: consultas y persistencia concreta; no confirmar transacciones por
  cuenta propia dentro de una operacion coordinada por un servicio.
- Infraestructura: configuracion, sesiones de base, seguridad y recursos tecnicos.
- Dependencias entre funcionalidades por servicios/contratos claros. Evitar imports
  circulares, acceso a estado de otra pantalla y reglas escondidas en serializers.

La [arquitectura](architecture.md) describe su organizacion. No introducir
repositorios genericos universales, microservicios o eventos sin necesidad real.

## Dinero, cantidades y fechas

- Backend: Decimal para dinero y NUMERIC en el esquema futuro; no float para
  importes. Definir redondeo con B03 antes de implementar calculos financieros.
- Mantener decimales como texto en respuestas compatibles. Los calculos de UI
  son orientativos; el servidor valida y calcula los valores persistidos.
- Cantidades de prendas: validar enteros y limites segun reglas aprobadas; reforzar
  con restricciones de base despues de revisar historicos.
- Diferenciar fecha comercial de instante. Mantener fechas legacy como DATE;
  nuevos instantes con zona horaria y presentacion de negocio en America/Managua.
- No sustituir nulos por ceros ni inferir valores historicos automaticamente.

## API y errores

- Schemas de entrada/salida explicitos; no exponer automaticamente todos los
  campos del ORM ni aceptar valores financieros sin validacion de servidor.
- Mantener semantica HTTP: validacion, ausencia y conflicto deben distinguirse.
  El formato definitivo de errores nuevos se acordara con sus consumidores al
  implementar la API; el contrato DRF actual esta documentado aparte.
- Introducir paginacion/filtros junto con sus consumidores y totales de servidor.
- No cambiar nombres publicos, rutas, tipos monetarios, nulabilidad o metodos sin
  revisar compatibilidad, pruebas y mapeo de datos.
- Usar operaciones atomicas para compras/ventas. Idempotencia y concurrencia se
  implementan y prueban con persistencia; un boton deshabilitado no es garantia.

## Frontend

- Conservar React/Vite; migrar a TypeScript por funcionalidad en su fase.
- Componentes de presentacion separados de carga, validacion y acceso HTTP.
- Estado de formulario local; sesion y estado compartido solo donde haga falta.
  No agregar un gestor global por defecto.
- Tipar fronteras; usar unknown y validacion para datos externos antes que any
  generalizado. Mantener el cliente HTTP y formato de moneda/fechas compartidos.
- Rutas navegables con Router cuando se implemente. Etiquetas de formulario,
  teclado, foco, carga, vacios y errores forman parte de cada pantalla.
- Encapsular CSS; evitar selectores globales de tablas o clases comunes repetidas.
- Mantener un estilo coherente con el codigo existente hasta activar un formateador;
  no mezclar formato masivo con cambios funcionales.

## Pruebas, documentos y decisiones

Pruebas por comportamiento y riesgo, con nombres ingleses y datos sinteticos.
No crear pruebas que solo repitan lineas de implementacion. No llamar aprobada a
una prueba pendiente u omitida. Seguir [quality.md](quality.md).

Mantener una sola fuente por tema: campos actuales en contratos, pendientes B01-B14
en reglas de negocio, comandos en desarrollo/caracterizacion y fases en roadmap.
Documentar decisiones arquitectonicas relevantes mediante ADR numeradas con
contexto, estado, decision y consecuencias. No registrar preferencias pendientes
como aprobaciones del usuario.
