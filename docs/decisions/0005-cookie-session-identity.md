# ADR 0005: identidad propia y sesiones revocables

Estado: aceptada para fase 8, 28 de octubre de 2026. B09 confirmado por el usuario;
matriz operativa en [autenticacion](../authentication.md).

## Contexto

FastAPI tiene once recursos fundamentales y el frontend sigue en Django.
Los empleados representan autoria historica, no cuentas de acceso. Se requieren
tres roles aprobados, cierre de sesion efectivo y permisos verificables.

## Decision

Crear cuentas propias con vinculo opcional y exclusivo a empleado; conservar
identidad Django sin importar hashes. Contraseñas Argon2id, sesiones opacas con
digests en PostgreSQL, cookie HttpOnly/Secure/SameSite y CSRF sincronizado con
origen exacto, incluido login. Aplicar autorizacion central a todos los routers
fundamentales y permisos de Administrator a gestion de cuentas.

La revision 0002_identity agrega tres tablas sin cambiar la revision inicial.
Las migraciones y el alta del primer administrador se ejecutan explicitamente;
no existen claves predeterminadas, registro publico o credenciales en argv.

## Consecuencias

Las sesiones se revocan sin esperar vencimiento de tokens autocontenidos. Hay
consulta de estado/rol en cada solicitud y dependencia de PostgreSQL disponible.
La CLI permite mantenimiento de sesiones expiradas. Los bloqueos de identidad
favorecen consistencia, serializando login y cambios administrativos; revisar
capacidad y topologia de proxy si cambia el volumen de uso.
React se integra en sus fases; no se exige nueva identidad a los endpoints
legacy. El interruptor de negocio sigue false por defecto y production exige
HTTPS y cookies Secure antes de habilitarlo.
