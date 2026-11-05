# F09: pantallas antiguas y contratos que se conservan

La entrada de rutas es `frontend/src/app/App.tsx`. Carga las pantallas de
`features/boutique`: Dashboard, Checkout, SalesLedger, Products, Directory y
Purchases. Las rutas antiguas `/reports`, `/cash-register` y `/settings` redirigen
a módulos vigentes. No existen registros de pantallas mediante `import.meta.glob`.

## Retiro acotado

Se buscaron referencias en código, pruebas y resto del repositorio antes del
retiro. Ninguna ruta, importación externa al propio archivo ni prueba consumía:

- `features/dashboard/DashboardPage.tsx`
- `features/products/ProductsPage.tsx`
- `features/reports/ReportsPage.tsx`
- `features/purchases/PurchasesPage.tsx`
- `features/sales/SalesPage.tsx`

Los dos últimos eran wrappers sin consumidores. `features/reports/Reporting.module.css`
solo estaba importado por las pantallas DashboardPage/ReportsPage retiradas.
Se retiran estos seis archivos; Git conserva sus versiones anteriores. No se
eliminan servicios, endpoints, estilos compartidos ni adaptadores por el solo
hecho de tener un nombre antiguo.

## Contratos y componentes aún necesarios

| Archivo o grupo | Consumidores verificados | Decisión |
| --- | --- | --- |
| `transactions/pending.ts` | `cash-register/useCashCommand.ts`, pruebas F01 | Conservar sin cambios: almacenamiento y recuperación de intención |
| `transactions/api.ts`, `VoidSaleForm.tsx` | `boutique/SalesLedger.tsx`, pruebas de transacciones/anulaciones | Conservar: todavía forman parte de la interfaz activa |
| `products/api.ts` | `transactions/api.ts`, pruebas de contrato | Conservar: dependencia transitiva activa |
| `reports/api.ts` | `cash-register/api.ts`, `settings/api.ts`, contratos de reportes | Conservar: dinero y parsing usados en operación |
| `transactions/TransactionsPage.tsx` | Implementación histórica incluida en la corrección F01 | Conservar sin cambios en este retiro: separar su eventual baja de F01 |
| UI compartida, catálogo de configuración y clientes API | Importaciones activas y pruebas | Conservar; fuera de esta limpieza acotada |

Hay nombres y modelos paralelos entre `boutique/contracts.ts` y los adaptadores
anteriores. Unificarlos exige revisar consumidores activos y snapshots históricos;
se pospone esa refactorización amplia. No se reactivan rutas ni se sustituyen
contratos públicos para reducir archivos.

Verificación del retiro: TypeScript analiza las importaciones restantes; ESLint,
pruebas completas de frontend, compilación y E2E comprueban acceso, rutas,
operaciones y navegación de escritorio/móvil. La integración final vuelve a
comprobar F01 y anulaciones contra la base aislada.
