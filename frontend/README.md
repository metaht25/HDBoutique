# Frontend H&D Boutique

React/Vite con TypeScript estricto, Router, sesion y cliente HTTP /api/v1.
Ocho pantallas FastAPI, incluida [Caja](../docs/cash-register.md) persistente con
turnos, cobros completos efectivo/transferencia y anulacion total supervisada.
No quedan servicios/adaptadores/proxy Django. [Contratos](../docs/frontend-modules.md).

Node >=24 <25 (24.22.2 verificado), npm y package-lock.json. Desde frontend/:

```powershell
npm ci
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

npm test usa Vitest/Testing Library; las pruebas de adaptadores Django se retiraron
junto con sus consumidores. E2E normal usa API sintetica interceptada en Chromium
escritorio/movil. npm run verify agrega tipos/lint/build. compose.frontend-test.yaml
permite ejecutarlo sin Node nativo, sin red/backend.

La imagen Dockerfile runtime construye dist con npm ci y lo sirve mediante Nginx
sin privilegios. La web local activa esta en http://127.0.0.1:8080, con /api/v1
hacia FastAPI por el mismo origen y recarga de rutas SPA. Preview es de pruebas.
Vite dev solo usa HDB_FASTAPI_TARGET; no hay destino legacy. No exponer secretos
mediante VITE_*. [Operacion](../docs/docker.md).

npm run test:integration exige el destino interno de compose.test.yaml y prueba
la imagen Nginx con FastAPI/PostgreSQL sinteticos, sin interceptar API. Usar el
perfil integration en un proyecto de pruebas nuevo segun [desarrollo](../docs/development.md).
Nunca ejecutarlo contra datos locales reales. [Cierre y limites](../docs/cutover.md).
