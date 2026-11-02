# Autenticación y permisos vigentes

La reconstrucción autorizada sustituye la matriz de fases anteriores: solo Dueña
(Administrator) y Colaborador (Cashier) pueden iniciar sesión. Manager se conserva
únicamente como registro histórico retirado. 0006 desactiva esas cuentas, revoca
sesiones y registra role_retired en management_events sin conversión de privilegios.
No puede seleccionarse, crearse ni editarse desde los formularios actuales.

## Permisos aprobados e implementados

| Operación | Dueña | Colaborador |
| --- | --- | --- |
| Consultar catálogo, precios de venta y stock | Sí | Sí, sin costos/proveedor/valor al costo |
| Consultar departamentos y municipios | Sí | Sí, para domicilio de clientes |
| Gestionar catálogos y ubicaciones | Sí | No |
| Consultar clientes / alta atómica desde Nueva venta | Sí | Sí |
| Registrar ventas completas | Sí | Sí |
| Consultar ventas, recibos y PDF | Todas | Solo propios; ajenos 404 |
| Dashboard y consultas de actividad | Global | Solo propia y stock permitido |
| Proveedores, costos, ofertas, compras e inventario auditado | Sí | No |
| Empleados, cuentas y perfil boutique | Sí | No |
| Selector operativo de empleados activos | Sí | ID/nombre, sin datos privados |
| Desactivar/reactivar proveedores, alta desde Compras | Sí | No |
| Anulación total supervisada | Sí | No |
| Cambiar contraseña | Sí, propia y administradas | No |

Las cuentas se deshabilitan, no se borran. Un vínculo cuenta/empleado es opcional,
exclusivo y protegido por FK RESTRICT. El empleado debe estar activo para operar;
el cargo no concede permisos. Alta de empleado y cuenta Cashier en una transacción.
Desactivar empleado revoca sesiones y bloquea el login. La interfaz bloquea rutas
administrativas antes de montar sus consultas; la API vuelve a autorizar cada llamada.
[Personal](employees.md), [ventas](sales.md), [caja](cash-register.md).

## Contrato HTTP

HDB_BUSINESS_API_ENABLED sigue siendo false por defecto. Al habilitarlo se registran
identidad y los recursos de fase 7; todas las rutas de negocio requieren sesion.
Salud permanece publica. OpenAPI describe cookie de autenticacion y errores.

| Metodo y ruta | Entrada/resultado | Acceso |
| --- | --- | --- |
| GET /api/v1/auth/csrf | Cookie previa de 10 minutos y JSON csrf_token; en una sesion existente renueva solo el token CSRF | Publico; rechaza origen declarado ajeno y peticiones cross-site |
| POST /api/v1/auth/login | username y password; cuenta publica en JSON, cookie nueva y cabecera X-CSRF-Token nueva | Cookie previa, Origin y X-CSRF-Token validos |
| GET /api/v1/auth/me | Cuenta de la sesion | Autenticado |
| POST /api/v1/auth/logout | 204 y eliminacion de cookie y sesion servidor | Autenticado, Origin y CSRF |
| POST /api/v1/auth/password | current_password y new_password; 204, revoca sesiones | Solo Administrator, Origin y CSRF |
| GET /api/v1/users | Lista publica de cuentas; offset >= 0, limit 1..100, defecto 50 | Administrator |
| POST /api/v1/users | username, password, role y employee_id opcional; 201 | Administrator, Origin y CSRF |
| PATCH /api/v1/users/{user_id} | role, is_active, password y employee_id opcionales; 200 | Administrator, Origin y CSRF |

Cuenta pública: user_id, username, role, is_active, employee_id, display_name
y must_change_password. La lista administrativa puede incluir roles retirados
como historia; no son identidades de sesión válidas. Nunca devuelve
password ni password_hash. Los usernames se normalizan a minusculas y admiten
3..64 caracteres ASCII alfanumericos, punto, guion y guion bajo.
Las nuevas contraseñas tienen 6..128 caracteres; los espacios se conservan.
PATCH distingue omitido de null; solo employee_id admite null para desvincular.
No hay registro publico, cambio de rol propio sin permiso ni borrado de cuentas.

Flujo del cliente: obtener /auth/csrf guardando la cookie; enviar POST /auth/login
como JSON con Origin y X-CSRF-Token; reemplazar el token CSRF por la cabecera de
respuesta y enviar cookie y cabecera CSRF en todas las escrituras. Las lecturas
solo necesitan cookie. Despues de recargar la pagina, GET /auth/csrf recupera un
token nuevo ligado a esa sesion, invalidando el anterior; coordinar las pestañas.
El token de sesion es HttpOnly: no se copia a localStorage ni se manda en URLs.
Se requiere el mismo origen web; no se habilito CORS.

Errores seguros: 401 sin sesion/credenciales invalidas, 403 por permiso, origen
o CSRF, 409 por usuario/empleado duplicado o ultimo administrador, 422 por entrada
invalida/FK inexistente, 429 por limite de intentos, 503 por persistencia no disponible.
Se conserva el envoltorio error/code/message de fase 7, sin SQL ni valores recibidos.
Las respuestas /api/v1/ llevan Cache-Control: no-store y nosniff.

## Sesiones, contraseñas y revocacion

Argon2id mediante PasswordHasher de argon2-cffi 25.1.0, con salt aleatorio,
verificacion de hash ficticio para usuarios inexistentes y renovacion de parametros
en login. Los tokens de sesion y CSRF son secretos aleatorios de 256 bits; solo se
guardan sus SHA-256. Se comparan digests CSRF en tiempo constante.

Cookie hdb_session: host-only (sin Domain), Path=/, HttpOnly, SameSite=Strict,
Secure por defecto. El identificador se rota al iniciar sesion y se revoca al
salir. El servidor limita la sesion a 8 horas absolutas y 30 minutos de inactividad.
Cambiar rol, contraseña, estado o vinculo de una cuenta revoca todas sus sesiones.
El estado activo y rol se vuelven a consultar en cada solicitud.

Las escrituras exigen Origin exactamente igual a HDB_AUTH_ORIGIN y el token CSRF
ligado a la sesion, incluido el login. El limite de login se persiste en PostgreSQL:
5 fallos por username y 30 por direccion de conexion en ventanas de 15 minutos.
Devuelve errores genericos tanto para cuentas inexistentes como inactivas.
No confia en X-Forwarded-For para ese contador; un proxy comparte la IP vista por
la aplicacion. Revisar esa topologia antes de un despliegue final. Los fallos se
acumulan durante la ventana aunque haya un login correcto intermedio.

Bloqueos PostgreSQL coordinan contadores; un advisory lock transaccional serializa
login y administracion de cuentas para evitar crear sesiones con credenciales
revocadas. Tambien protege al ultimo Administrator activo frente a cambios
concurrentes. No se cancelan solicitudes de negocio ya autorizadas y en curso.
Eventos hdb.security registran exito/fallo, CSRF y cambios de cuenta sin
contraseñas, tokens, usernames, IP ni payloads; los eventos de cuenta usan user_id.
La configuracion del recolector de logs corresponde al despliegue.

## Contraseña asignada por Dueña

Dueña asigna y reemplaza contraseñas de 6–128 caracteres, preservando espacios.
Colaborador no puede cambiar la propia: POST /auth/password devuelve 403.
Dueña puede cambiar la propia comprobando su contraseña actual. Toda sustitución
revoca sesiones. No hay contraseña temporal ni cambio obligatorio. 0007 libera
must_change_password con auditoría password_policy_released y conserva el hash
anterior. La columna sigue por compatibilidad. Nunca se devuelve contraseña ni hash.

## Preparación operativa explícita

Head de código: 0009_shiftless_payments, 32 tablas más alembic_version.
El primer Administrator de desarrollo ya fue creado expresamente; no repetir
bootstrap. Las cuentas posteriores se gestionan desde Empleados/Cuentas y accesos.
La CLI bootstrap-admin queda reservada a una base nueva expresamente autorizada,
con --database coincidente y contraseña por getpass. No se ejecuta al arrancar.
[Estado del destino, respaldos y retorno](cutover.md).

Configuracion nueva:

| Variable | Defecto | Uso |
| --- | --- | --- |
| HDB_BUSINESS_API_ENABLED | false | Registrar identidad y negocio protegido |
| HDB_AUTH_ORIGIN | http://localhost:8001 | Origen HTTP(S) exacto, sin barra final, path, query ni credenciales |
| HDB_SESSION_COOKIE_SECURE | true | Enviar cookie solo por HTTPS |

Para un ensayo local HTTP puede configurarse Secure=false exclusivamente en
development/test. En production con negocio habilitado se exige origen HTTPS y
Secure=true; no se habilitan docs. TLS, proxy, origen y credenciales operativas se
configuran antes de publicar. Desarrollo local habilita negocio exclusivamente en
loopback mediante Compose; .env.docker privado conserva sus credenciales. Ninguna
migracion ni bootstrap ocurre al arrancar FastAPI.

Mantenimiento, en el destino explicitamente autorizado:

```powershell
uv run --locked python -m app.modules.identity.cli purge-expired --database NOMBRE_AUTORIZADO
```

Elimina sesiones vencidas/inactivas y contadores fuera de la ventana conservada.
Programar su ejecucion periodica en la operacion; esta entrega no crea tareas.
El downgrade de 0002 elimina datos de identidad: respaldar antes de considerarlo.
No se entregaron MFA ni recuperacion por correo. El login frontend moderno ya
esta integrado y Django se retiro en fase 15.

Fuentes tecnicas: [argon2-cffi](https://argon2-cffi.readthedocs.io/en/stable/api.html),
[sesiones OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
y [CSRF OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).
