# Corte local y retirada de Django: fase 15

Fecha: 29 de octubre de 2026, America/Managua. Repositorio local en Cris-develop,
sin acceso al remoto ni push. Alcance: entorno local autorizado, no despliegue
publico ni traslado de una base SQL Server inexistente.

## Autorizaciones y estado previo

El usuario confirmo expresamente en esta sesion:

- Ventana inmediata y destino PostgreSQL de desarrollo: proyecto hdboutique-dev,
  base hdboutique, volumen existente hdboutique-dev_postgres_data. Respaldo,
  restauracion de verificacion, migraciones y habilitacion local autorizados.
- Sigue sin existir origen/historicos SQL Server. No hay carga final que ejecutar
  ni una instancia SQL Server que conservar o detener.
- B11: no se utiliza /admin/; empleados y abonos pueden seguir pendientes.

La API estaba detenida y el negocio deshabilitado. La base tenia
0001_compatibility, 17 tablas comerciales y cero filas comerciales. No se
confundio esa base con hdboutique_test ni se introdujeron semillas sinteticas.

## Respaldo, restauracion y continuidad

Antes de modificar el esquema se guardo un archivo Git del estado d8736ac y un
pg_dump completo en `backups/cutover-20261029-phase15/`, ignorado y con ACL de
acceso restringida al propietario actual de Windows. Se conservaron las claves
existentes de .env.docker y el volumen original.

El volcado previo se restauro sin --clean en una base nueva del mismo servidor,
`hdboutique_cutover_verify`, propiedad de hdboutique_app. Se compararon tablas,
columnas, conteos, SHA-256 de filas ordenadas por PK y estado de identidades. Original y
restauracion coincidieron antes de continuar. La evidencia JSON no exporta valores
de registros; los respaldos binarios si contienen informacion privada.

Se ejecuto Alembic upgrade head de forma expresa: 0002_identity,
0003_purchase_receipts y 0004_atomic_sales. Nuevas huellas verificaron que las
17 tablas e identidades anteriores se conservaron. Las revisiones no se editaron,
no se uso create_all/stamp y no se ejecutaron migraciones al arrancar FastAPI.
El destino quedo con 24 tablas comerciales/de identidad, ademas de alembic_version.

Tras bootstrap y humo se repitio pg_dump/pg_restore del estado final en otra base
nueva, `hdboutique_cutover_final_verify`. Las 24 tablas, identidad de cuenta y
secuencias coincidieron con el destino final. Volcados previo/final, sus JSON de
huellas y checksums permanecen en la carpeta privada del corte. Las dos bases de
verificacion se conservan separadas de la aplicacion, sin escrituras operativas.

Se creo exclusivamente la primera cuenta Administrator local, sin empleado
inventado. Usuario `administrador`; credenciales aleatorias en el archivo privado
`backups/cutover-20261029-phase15/administrator.json`. No se imprimieron ni se
pasaron como argumentos. La administracion posterior de cuentas usa /api/v1/users
con sesion/CSRF. No repetir bootstrap sobre esta base.

## Aplicacion activa y codigo retirado

Web: http://127.0.0.1:8080. Nginx sirve dist, permite recarga de las siete rutas
operativas y dirige /api/v1 a FastAPI sin cambiar el origen ni reintentar escrituras.
La imagen web no lleva Node ni herramientas de pruebas; ejecuta nginx sin root,
con raiz de solo lectura y /tmp tmpfs. Acceso local limitado a loopback.

FastAPI directo en 127.0.0.1:8001 y PostgreSQL en 127.0.0.1:5433. compose.dev.yaml
habilita negocio con origen exacto 127.0.0.1/puerto web y cookies HTTP locales.
Compose base conserva production/negocio deshabilitado y HTTPS/Secure obligatorios
si se habilita. El corte no configura un despliegue publico, TLS o secretos externos.

Se verificaron consumidores en src/ y pruebas antes de retirar:

- Backend Django, rutas, serializers, modelos unmanaged, admin y ejecutor de
  caracterizacion Django. Codigo anterior preservado en Git/archivo privado.
- Grupo legacy y paquetes Django, DRF, mssql-django, pyodbc y auxiliares; eliminada
  la exportacion requirements.txt. uv.lock regenerado con uv 0.12.10.
- Siete adaptadores legacyApi y siete reexportaciones services sin consumidores
  operativos, junto con sus 41 pruebas especificas y el proxy Vite a Django.
- Adaptacion de errores DRF y tipo LegacyPage sin consumidores; el cliente HTTP
  ahora rechaza rutas ajenas a /api/v1 antes de enviar credenciales.

La muestra historica se conserva en [reference/legacy-contracts.json](reference/legacy-contracts.json).
Los valores legacy_stock/legacy_stock_quantity, relaciones, tablas y migraciones
se conservan: retirar el backend no elimina historicos del modelo nuevo.
data_migration mantiene mapeos/ensayos offline y referencias al antiguo origen;
no se distribuyen drivers SQL Server en runtime ni development. Un origen futuro
requerira un alcance propio, dependencias de operador y un nuevo ensayo autorizado.

## Verificacion

Humo contra la base local autorizada: login/logout de Administrator, siete URLs
SPA y consultas autenticadas de productos, clientes, proveedores, compras, ventas,
dashboard e inventario; sin escrituras comerciales. Readiness confirma PostgreSQL.
Los permisos de negocio se mantienen en servidor y no se crean registros ficticios
para hacer que un formulario opere sobre una base vacia.

Las pruebas de negocio y navegador con escrituras se ejecutan exclusivamente en
compose.test.yaml, proyecto hdboutique-test, tmpfs y credenciales sinteticas.
El perfil integration ahora usa la imagen Nginx real; comprueba tambien recarga
de rutas, login/cookies/CSRF, dinero/stock, permisos y 404 de endpoints retirados.
Un relay TCP interno mantiene el origen loopback del navegador de pruebas, como
en el entorno local, sin desactivar seguridad del navegador ni usar Vite preview.
Las pruebas frontend habituales siguen usando API interceptada sin red/backend.
Resultados finales en [caracterizacion](characterization.md).

Resultado final: 221 pruebas backend/PostgreSQL (97.62% cobertura), 77 Vitest,
80 E2E interceptadas y cinco conectadas aprobadas; tipos, lint, Ruff/formato,
mypy y uv lock --check aprobados. Runtime/development comprobados sin imports de
Django/DRF/ODBC; las cuatro revisiones Alembic se conservan sin cambios.

## Operacion y retorno

Arranque/reconstruccion:

```powershell
docker compose --env-file .env.docker -f compose.yaml -f compose.dev.yaml up --build -d --wait --wait-timeout 180
docker compose --env-file .env.docker -f compose.yaml -f compose.dev.yaml ps
```

No borrar el volumen ni usar down -v. Respaldar antes de nuevas migraciones o
trabajos de datos. `app.operations.snapshot --database NOMBRE --output RUTA_NUEVA`
es de lectura y rechaza destino no coincidente/evidencia existente. Comparar con
servicios escritores detenidos; una huella no sustituye un respaldo restaurable.

El respaldo previo y el archivo de codigo se conservan sin fecha automatica de
borrado; no hay historicos SQL Server que necesiten una politica B12 adicional.
Para volver al estado previo, detener web/backend y restaurar el volcado en una
base nueva autorizada, conservando el destino actual. Revisar configuracion y
codigo desde el archivo Git en una carpeta separada, sin resetear este historial.
No usar downgrade para simular rollback de datos ni restaurar --clean sobre el
volumen actual. Antes de aceptar nuevas escrituras se puede volver al respaldo
previo; despues deben conciliarse todas las operaciones nuevas antes de cambiar
destino. No hay retorno automatico ni traslado inverso a SQL Server.

## Limites conservados

Al cerrar fase 15, empleados/abonos y caja quedaron fuera del corte. Un acuerdo
posterior excluye definitivamente abonos/credito e incorpora [caja](cash-register.md)
y correccion de ventas supervisada mediante revision nueva 0005. No se aprobo
ninguna regla pendiente por el mero retiro de Django. En una base comercial vacia, una venta/compra
requiere primero sus referencias validas, incluido un empleado existente: este
corte no crea empleados ni datos comerciales. Catalogos/ubicaciones/ofertas y
cuentas tienen las APIs autenticadas existentes, sin prometer un panel admin nuevo.
La publicacion productiva externa sigue requiriendo TLS, secretos, observabilidad
y un procedimiento de respaldo/retencion del entorno correspondiente.

## Incremento posterior: caja

0005_cash_checkout aplicado en el mismo destino local autorizado, despues de
respaldo/restauracion y ensayo en copia. Se preservaron las 24 tablas/identidades
anteriores; seis tablas nuevas vacias. Respaldo final restaurado y conciliado en
hdboutique_cash_final_verify: 30 tablas. Evidencia privada en la subcarpeta
cash-checkout del respaldo original; sin eliminar las evidencias previas.
[Reglas, operacion, verificaciones y limites](cash-register.md).

## Reconstrucción boutique: recuperación y cierre local (2 de noviembre de 2026)

La recuperación de acceso solicitada detectó código 0006 con base aún en 0005:
el login devolvía 503 por la columna must_change_password ausente. Se detuvieron
web/backend, se respaldó y ensayó 0006 en una restauración separada antes de
aplicarla expresamente a hdboutique. Alembic current confirmó
0006_boutique_experience y check no detectó drift. Los servicios se reconstruyeron
y quedaron saludables en 8080/8001/5433; login real HTTP 200. No se repitió bootstrap.
El propietario solicitó restablecer su credencial; se revocaron sesiones. La copia
inicial de credenciales del corte histórico ya no representa la contraseña vigente.

Evidencia privada, ignorada y con ACL del propietario:
backups/login-recovery-20261102-075813/. Se conservan ambos dumps custom:

| Archivo | SHA-256 |
| --- | --- |
| before-0006.dump | CCD18B80EEC2B475554366807176144C7896F9694BC110C92B6C621C5E7E0AF2 |
| final-0006.dump | E946C51A46C2B5673ED5E5B7998070AEB04CE8D5B24EDB2DB88F15CE92272EA5 |

Bases separadas conservadas: hdboutique_login_verify_20261102075838 (ensayo de
migración), hdboutique_before_verify_20261102 (restauración de 0005) y
hdboutique_final_verify_20261102 (restauración final de 0006). La primera tentativa
de ensayo detectó propiedad incorrecta de objetos restaurados; se corrigió en
esa base de ensayo antes de migrar desarrollo. No se restauró --clean en desarrollo.

La conciliación posterior, con escritores detenidos, verificó las columnas
anteriores de 28 tablas por hashes exactos, incluida la cuenta existente. Se
excluyeron explícitamente alembic_version (revisión cambiada), web_sessions y
login_throttles (actividad de autenticación de la recuperación). No se presenta
esa exclusión como igualdad de sesiones. Cero cuentas Manager en desarrollo.
La restauración final coincidió exactamente en las 32 tablas más alembic_version,
columnas, conteos, hashes y estado de todas las secuencias con el origen final.
Snapshots y resultado agregado permanecen privados junto a los dumps.

La comprobación de continuidad se completó después de la recuperación urgente;
no se afirma que hubiera sido ejecutada antes de aplicar 0006. Ningún dato
comercial sintético fue insertado por estas operaciones. El volumen y .env.docker
se conservaron. El retorno sigue siendo una restauración separada y conciliada;
el downgrade de 0006 protege contra pérdida de nuevos datos operativos.
