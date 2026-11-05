# Dependencias: revisión de estabilización del 5 de noviembre de 2026

## F08 — Actualización compatible no disponible

El bloqueo instala `minimatch` 10.2.5 como dependencia de desarrollo de ESLint
y TypeScript ESLint. `npm audit --json` devuelve diez nodos moderados asociados
al mismo aviso [GHSA-g3hv-75wg-m249](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249),
no diez vulnerabilidades independientes. El aviso de npm incluye versiones
`>=7.0.0 <11.0.1`; el mantenedor identifica 11.0.1 como versión corregida.

Se consultaron las versiones y restricciones publicadas en el registro npm:

| Paquete consultado | Última versión | Restricción de minimatch |
| --- | --- | --- |
| eslint | 10.14.0 | ^10.2.6 |
| @eslint/config-array | 0.23.5 | ^10.2.4 |
| typescript-eslint / @typescript-eslint/typescript-estree | 8.72.1 | ^10.2.2 |
| minimatch, línea 10 | 10.2.6 | Sigue dentro del rango del aviso |

Actualizar ESLint dentro de su major, o minimatch a 10.2.6, no elimina este
hallazgo. Las recomendaciones automáticas del audit implican volver a ESLint 9
y TypeScript ESLint 8.36.0; su parser declara TypeScript `>=4.8.4 <5.9.0`,
incompatible con el TypeScript 6 del proyecto.
No se aplican ese retroceso, `audit fix --force` ni overrides que sustituyan un
major fuera de los rangos declarados por los consumidores. Se conservan
`package.json` y `package-lock.json`: no se declara F08 corregido.

`npm audit --omit=dev --json` devuelve cero vulnerabilidades conocidas. El bundle
web no incorpora ESLint/minimatch. El riesgo pendiente está en las herramientas
de desarrollo al procesar patrones glob controlados por terceros; no se demostró
una ruta desde formularios o peticiones comerciales hacia esa herramienta.

Para desbloquear: esperar una versión corregida compatible con la línea 10 o que
los consumidores soporten 11.0.1+, actualizar solo esa cadena y repetir audit,
TypeScript, ESLint, pruebas y compilación. Volver a consultar los avisos al integrar:
los resultados describen la consulta de esta fecha, no una garantía futura.

Consultas reproducibles, desde `frontend/` con Node 24:

```text
npm audit --json
npm audit --omit=dev --json
npm view eslint version dependencies.minimatch
npm view typescript-eslint version
npm view @typescript-eslint/typescript-estree@latest dependencies.minimatch
npm view @eslint/config-array@latest version dependencies.minimatch
npm view minimatch@10 version
```

## Backend

Tras F03, Pillow queda bloqueado en 13.0.0. Se ejecutó `pip-audit` sobre el
inventario instalado del entorno de pruebas actualizado: cero vulnerabilidades
conocidas. La herramienta de auditoría se ejecutó de forma temporal, sin agregar
una dependencia del proyecto. Los detalles del procesamiento de logos y sus
límites están en [la evidencia de estabilización](technical-stabilization.md).
