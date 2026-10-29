# Base del frontend: fase 11

React/Vite conservados. TypeScript estricto para arranque, rutas, layout, sesion,
cliente HTTP, componentes compartidos, configuracion y pruebas. allowJs permite
la transicion: vistas legacy y adaptadores siguen en JSX/JS con checkJs false.
No se presentan como completamente tipadas ni migradas a FastAPI. No cambia
ninguna regla B ni el esquema del backend.

## Organizacion y rutas

| Ruta | Pantalla |
| --- | --- |
| /dashboard | Dashboard |
| /products | Productos |
| /customers | Clientes |
| /sales | Ventas |
| /purchases | Compras |
| /suppliers | Proveedores |
| /cash-register | Caja |
| /reports | Reportes |

/ redirige a /dashboard sin agregar historial. URL desconocida muestra una pagina
recuperable con enlace al inicio. BrowserRouter soporta enlaces, recarga y atras/
adelante. Vistas bajo demanda con carga y limite de errores; titulo y h1 siguen
la URL. src/app organiza rutas/navegacion; src/layouts la estructura comun;
src/features agrupa vistas, legacyApi.js y sesion. src/services mantiene las
reexportaciones de compatibilidad para consumidores anteriores.

CSS Modules aisla layout/componentes y cada pantalla mediante una clase scope
local. Los selectores legacy quedan dentro de ese scope, incluidos table/thead/td
de Productos. index.css conserva solo base, fuente y foco. Card se reutiliza en
Dashboard; LoadingState/Message en carga/errores; TableContainer ofrece region
nombrada y desplazamiento por teclado; TextField enlaza etiqueta/descripciones/
errores en Productos; Pagination pagina Proveedores, 20 registros ya cargados por
pagina. Buscar vuelve a pagina 1. No es paginacion de servidor ni resuelve listas
legacy que Django ya haya paginado antes de entregarlas.

Layout responsive con menu movil, salto al contenido, foco en el encabezado al
navegar, aria-current y tablas desplazables. Idioma es-NI, titulo por pantalla,
descripcion, tema y favicon propios. Los formularios completos siguen en fase 12.

## HTTP, errores y sesion

src/shared/api/client.ts concentra fetch. Acepta solo rutas locales /api/,
credentials same-origin, cache no-store y JSON. Soporta GET/POST/PUT/PATCH/DELETE,
AbortSignal, Idempotency-Key, 204 y rotacion X-CSRF-Token. No convierte dinero,
nulos ni envoltorios paginados. Respuestas externas unknown salvo tipo explicito;
Account se valida en ejecucion. DecimalMoney es texto; LegacyPage y errores/
fields tienen tipos propios. Cada modulo mantiene sus payloads publicos.

ApiError conserva status/code/message y locations/type validados de FastAPI;
la frontera Django admite detail y errores por campo. Las pantallas muestran
mensajes como texto React, sin insertar HTML. HTML de error usa un texto
alternativo; JSON invalido satisfactorio se considera fallo. Errores de red/
cancelacion conservan su identidad y muestran texto controlado. Se mantienen
avisos de alta parcial legacy y se retiran logs de errores/payloads afectados.
No hay reintentos automaticos de escrituras, incluso con CSRF, 401 o conflicto.
Idempotency-Key se envia solo si el caso de uso la aporta: esta base no convierte
el carrito legacy en venta atomica ni inventa claves para operaciones viejas.

SessionProvider consulta GET /api/v1/auth/me: distingue carga, autenticado,
anonimo (401) y error (incluido 404 si la API sigue deshabilitada). Una cuenta
autenticada obtiene CSRF con /auth/csrf. El encabezado muestra username/rol del
servidor; se elimina el administrador fijo. Reintentar recupera consultas fallidas.
Cerrar sesion envia POST con CSRF y limpia la cuenta tras confirmar 204; un fallo
conserva el estado y se muestra. Un 401 versionado limpia la sesion visible.
Respuestas anteriores no pisan un login posterior; restauraciones de StrictMode
se comparten. El contexto ofrece login(username,password) para la siguiente fase.

No se agrega aun pantalla de login, redireccion de acceso ni guardas por rol en
modulos legacy. La identidad FastAPI no protege por si sola las rutas Django ni
constituye un corte de seguridad del frontend. Login y pantallas se migran por
incremento en fase 12 con permisos reales del servidor. Caja sigue como prototipo.

Cookie HttpOnly administrada por backend; CSRF solo en memoria y solo en escrituras
/api/v1/. No se copia a localStorage/sessionStorage ni se envia a legacy u otros
origenes. Escrituras concurrentes comparten la preparacion CSRF; login conserva
la nueva cabecera. No se reenvian escrituras fallidas: si otra pestana cambio el
token, recargar sesion y revisar el error antes de otra accion explicita.
Cookies, origen y revocacion siguen el [contrato](authentication.md).

## Desarrollo, despliegue y comprobaciones

Node >=24 <25, verificado con 24.22.2; npm ci usa package-lock.json. build ejecuta
tsc y Vite, lint incluye TS/JSX, test combina Vitest/Testing Library y Node legacy;
test:e2e usa Playwright sobre dist con preview. [Comandos](../frontend/README.md).

Vite configura /api/v1 a 127.0.0.1:8001 y /api a 127.0.0.1:8000, en ese orden.
HDB_FASTAPI_TARGET/HDB_LEGACY_API_TARGET ajustan destinos de desarrollo, sin
incrustarlos en el bundle. No se habilita CORS ni se modifica configuracion
privada. Para sesiones reales, preparar cuentas, migraciones y habilitacion
segun [autenticacion](authentication.md), con Origin exacto del frontend. HTTP
de desarrollo exige Secure false explicito en su entorno autorizado; produccion
requiere HTTPS/Secure. No se hacen estos cambios operativos en fase 11.

El servidor de produccion debe servir dist, enviar /api/v1 a FastAPI y /api a
Django mientras existan consumidores, y resolver las demas rutas con fallback a
index.html, preservando estaticos. Preview verifica el artefacto; no se publica
ni configura un servidor de produccion en esta fase.

compose.frontend-test.yaml usa Node/Chromium sin red al ejecutar, puertos ni
backend. Contexto Docker limitado a frontend y fixture sintetico de contratos;
excluye .env, node_modules y resultados. npm ci y Chromium requieren red durante
build. Las pruebas corren como usuario node. E2E intercepta /api y verifica el
navegador real, sin certificar persistencia o autenticacion contra una base.
Capturas/trazas quedan ignoradas en test-results. No usa datos de desarrollo.

npm audit registra avisos en la fecha de verificacion; no sustituye revisiones
posteriores. Python, uv, migraciones y secretos se conservan. [Resultados](characterization.md).
Referencias: [Router](https://reactrouter.com/start/declarative/installation),
[allowJs](https://www.typescriptlang.org/tsconfig/allowJs.html),
[Vitest](https://vitest.dev/guide/) y [Playwright](https://playwright.dev/docs/test-webserver).
