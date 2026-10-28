# Frontend H&D Boutique

Aplicacion React/Vite en JavaScript y JSX. Tiene pantallas de Dashboard, Productos,
Clientes, Proveedores, Compras, Ventas, Reportes y Caja. La navegacion actual usa
estado local; Caja es un prototipo sin persistencia.

Se conserva React/Vite durante la modernizacion. TypeScript, React Router,
componentes compartidos y pruebas de interfaz corresponden a fases posteriores.

Los scripts existentes son `dev`, `build`, `lint` y `preview`. Las versiones se
resuelven mediante package-lock.json. Los servicios usan fetch y rutas `/api`;
Vite tiene proxy al backend local en el puerto 8000.

- [Guia de desarrollo](../docs/development.md): requisitos y comandos reales.
- [Caracterizacion](../docs/characterization.md): pruebas Node sin instalar paquetes.
- [Contratos actuales](../docs/legacy-api-contracts.md) y
  [compatibilidad propuesta](../docs/contract-compatibility.md).
- [Convenciones](../docs/conventions.md) y [calidad](../docs/quality.md).
- [Plan por fases](../docs/roadmap.md).

Las pruebas de servicios no montan React ni verifican persistencia. npm no tiene
todavia un script test del proyecto; usar los comandos documentados para Node.
