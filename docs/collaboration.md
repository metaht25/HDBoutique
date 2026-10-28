# Git y trabajo individual

## Acuerdo vigente

Participa un solo desarrollador. Se trabaja en la rama exacta `Cris-develop` con
commits locales. main se conserva como referencia estable; estas fases no la
actualizan, fusionan ni publican cambios.

Codex no ejecuta push, fetch o pull, no crea PR ni modifica remotos. El propietario
realiza el push manualmente. No crear ramas por funcionalidad, worktrees ni otros
chats como parte del flujo habitual salvo que el usuario cambie el acuerdo.

## Flujo por tarea o fase

1. Revisar rama, estado y ultimo commit local.
2. Leer AGENTS y los documentos pertinentes; mantener el alcance solicitado.
3. Si hay cambios ajenos, identificarlos y preservarlos. Si no se puede evitar un
   solapamiento, pedir la decision necesaria; no borrarlos ni guardarlos en stash
   automaticamente.
4. Implementar un cambio cohesivo y ejecutar su verificacion pertinente.
5. Revisar el diff completo, incluidos nuevos archivos.
6. Preparar rutas explicitas y revisar contenido preparado.
7. Crear commit local con Conventional Commits.
8. Comprobar el estado final e informar hashes y limitaciones.

Comprobaciones de lectura desde la raiz:

```powershell
git branch --show-current
git status --short
git log -1 --oneline
git diff --check
git diff
```

Antes del commit, revisar `git diff --cached` y `git diff --cached --check` tras
agregar unicamente las rutas propias con git add. No usar git add . para incorporar
por accidente datos locales, secretos o cambios ajenos.

## Conventional Commits

Formato: `type(scope): short description`; scope es opcional. Mensajes en ingles,
en imperativo y centrados en el resultado. Documentacion y explicaciones al usuario
pueden permanecer en espanol.

| Tipo | Uso | Ejemplo |
| --- | --- | --- |
| feat | Comportamiento nuevo aprobado | `feat(catalog): add product search` |
| fix | Correccion de un defecto | `fix(sales): preserve fractional prices` |
| refactor | Cambio interno sin nueva funcionalidad | `refactor(customers): extract validation` |
| test | Cobertura y caracterizacion | `test: characterize legacy contracts` |
| docs | Documentacion e instrucciones | `docs: define project conventions` |
| build | Dependencias, empaquetado o contenedores | `build: configure backend with uv` |
| ci | Automatizacion de comprobaciones | `ci: add backend quality checks` |
| chore | Mantenimiento restante | `chore: update ignore patterns` |

No mezclar renombrado masivo, cambio funcional y formato en un commit. Los cambios
de contratos deben explicar compatibilidad; si se usa `!` o BREAKING CHANGE,
describir el consumidor afectado y su adaptacion.

## Revision y conflictos

La revision es individual: comparar con los criterios de [quality.md](quality.md),
inspeccionar cambios sensibles y dejar evidencia de pruebas. No afirmar revision
por un segundo integrante o aprobacion de PR que no existen.

Ante un conflicto local, entender ambas intenciones y resolver los archivos
afectados sin aceptar automaticamente un lado. Verificar que no queden marcadores
y ejecutar la regresion pertinente. No reescribir migraciones ya aplicadas o
compartidas ni regenerar un bloqueo para ocultar el conflicto: revisar dependencias
y resolver con el gestor oficial cuando corresponda.

Si la identidad Git no permite un commit, informarlo sin inventar autor ni cambiar
configuracion global. Conservar los cambios para que el usuario complete el paso.
