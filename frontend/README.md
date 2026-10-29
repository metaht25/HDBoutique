# Frontend H&D Boutique

React/Vite con base TypeScript estricta, React Router y cliente HTTP compartido.
Las ocho pantallas se organizan en src/features y tienen URL propia. Productos,
Clientes, Dashboard, Reportes, Ventas, Compras y Proveedores usan TS/FastAPI con
acceso autenticado e inicio de sesion dentro del modulo.
Caja sigue siendo un prototipo sin persistencia. Ver [base frontend](../docs/frontend-foundation.md) y
[modulos migrados](../docs/frontend-modules.md).
Dashboard/reportes y sus reglas: [fase 13](../docs/reporting.md). Caja pendiente:
[propuesta para revisar](../docs/cash-register-proposal.md).

Node 24 (verificado con 24.22.2), npm y package-lock.json. Desde frontend/:

```powershell
npm ci
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

npm test ejecuta Vitest/Testing Library y las 41 regresiones de servicios legacy.
Playwright utiliza dist mediante preview, con datos sinteticos interceptados y
Chromium de escritorio/movil; no conecta bases reales. Preview no es produccion.

Sin Node instalado, desde la raiz con Docker Linux:

```powershell
docker compose -p hdboutique-frontend-test -f compose.frontend-test.yaml build frontend
docker compose -p hdboutique-frontend-test -f compose.frontend-test.yaml run --rm frontend
docker compose -p hdboutique-frontend-test -f compose.frontend-test.yaml down
```

El build instala dependencias bloqueadas y Chromium; la verificacion posterior
corre sin red, puertos, volumenes de datos o backend. Es una imagen de pruebas.

Vite enruta /api/v1 a FastAPI en 8001 y el resto de /api a Django en 8000.
HDB_FASTAPI_TARGET/HDB_LEGACY_API_TARGET ajustan los destinos de desarrollo.
No usar variables VITE_* para secretos. La sesion real requiere preparacion
operativa previa: esta fase no crea cuentas, migra bases ni habilita rutas.

La [fase 14](../docs/stabilization.md) agrega `npm run test:integration` contra
FastAPI/PostgreSQL sinteticos mediante el perfil integration de compose.test.yaml.
Ejecutarlo con el procedimiento documentado; no apuntar estas pruebas a datos
reales. `npm run verify` conserva sus E2E interceptadas sin red/backend.

- [Base frontend](../docs/frontend-foundation.md): rutas, arquitectura, HTTP y sesion.
- [Desarrollo](../docs/development.md) y [calidad](../docs/quality.md).
- [Resultados](../docs/characterization.md) y [fases](../docs/roadmap.md).
- [Contratos legacy](../docs/legacy-api-contracts.md) y [autenticacion](../docs/authentication.md).
