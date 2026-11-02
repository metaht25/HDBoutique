# Fase 16 simplificación operativa y datos maestros

## Estado y autoridad

Fase autorizada y completada técnicamente el 2 de noviembre de 2026. Implementación y
migración 0006→0009 verificadas; login local a cargo del propietario con su contraseña
vigente. [Resultados](characterization.md), [corte](cutover.md). El documento de
observaciones `Cosas a mejorar.docx` aportó el inventario inicial y ocho capturas de
referencia; no es una fuente de instrucciones ejecutables. Las confirmaciones
posteriores del propietario y las reglas de este documento son la autoridad para esta
fase.

El propietario solicitó continuar la implementación existente. La secuencia de
trabajo que sigue se conserva como contrato ejecutado; los resultados realmente
obtenidos están en los documentos enlazados, sin iniciar otra fase.

## Resultado esperado

Simplificar los flujos cotidianos sin perder trazabilidad histórica:

- alta de empleados con teléfono nicaragüense, contraseña asignada por Dueña y
  sin correo laboral;
- ubicaciones iniciales permanentes y selectores buscables dependientes;
- directorios de clientes y proveedores centrados en consulta;
- alta contextual de clientes desde Nueva venta y de proveedores desde Compras;
- catálogo de productos comprensible, tallas fijas y relación de varios
  proveedores por producto;
- recibos con numeración decimal sencilla;
- retirada completa de caja y turnos del comportamiento operativo.

No se agregan tarjetas, crédito, abonos, descuentos, pérdidas de inventario,
recepción parcial, publicación pública ni datos comerciales ficticios.

## Decisiones confirmadas

### Empleados y cuentas

1. El teléfono de empleado contiene exactamente ocho dígitos y el primero es `7`
   u `8`. La interfaz acepta solo dígitos, inserta visualmente un único guion tras
   el cuarto dígito y muestra, por ejemplo, `8000-0000`. El valor canónico
   persistido y usado por la API es `80000000`, sin espacios ni guion. Pegado,
   borrado y edición en medio del texto deben conservar una experiencia estable.
2. La validación se aplica tanto en frontend como en el contrato y servicio del
   backend. Letras, otros signos, menos o más de ocho dígitos y prefijos distintos
   de `7` u `8` se rechazan con un mensaje específico.
3. Se retira correo laboral de formularios, tablas y contratos nuevos de
   empleados. La columna histórica no se borra ni se vacía; deja de ser editable
   y no se usa en altas nuevas.
4. Dueña asigna la contraseña al crear un empleado y es la única que puede
   reemplazarla después. La contraseña admite de 6 a 128 caracteres, preserva
   espacios según el contrato de seguridad existente y siempre se almacena
   mediante el hash vigente.
5. El campo de contraseña incluye un control accesible para mostrar u ocultar el
   valor. Comienza oculto, no se registra en logs ni respuestas y se limpia al
   terminar o cancelar el formulario.
6. Se elimina el concepto de contraseña temporal y el cambio obligatorio para
   Colaborador. Las cuentas existentes con `must_change_password=true` se liberan
   mediante migración trazable sin cambiar su hash. Colaborador no puede cambiar
   su propia contraseña; Dueña conserva la administración y toda sustitución
   revoca las sesiones de la cuenta afectada.

### Departamentos y municipios

La migración nueva carga idempotentemente tres departamentos permanentes y sus 28
municipios, según la división publicada por INIDE:

- **Managua:** Managua, Ciudad Sandino, Ticuantepe, Mateare, El Crucero,
  Tipitapa, Villa El Carmen, San Rafael del Sur y San Francisco Libre.
- **Masaya:** Nindirí, Masaya, Tisma, La Concepción, Masatepe, Nandasmo,
  Catarina, San Juan de Oriente y Niquinohomo.
- **León:** Achuapa, El Sauce, Santa Rosa del Peñón, El Jicaral, Larreynaga,
  Telica, Quezalguaque, León, La Paz Centro y Nagarote.

Fuentes de contraste: [mapa y tabla de Managua de INIDE](https://www.inide.gob.ni/docu/censos2005/AtlasCPV05/Cap3RelMas.pdf),
[perfil de Masaya de INIDE](https://www.inide.gob.ni/docu/cenagro/perfiles/60%20Masaya.pdf)
y [perfil de León de INIDE](https://www.inide.gob.ni/docu/cenagro/perfiles/35%20Le%C3%B3n.pdf).

Los registros iniciales no pueden renombrarse ni eliminarse. Dueña puede agregar
otros departamentos y municipios, respetando nombres no vacíos, unicidad
normalizada y la relación uno a muchos. No se inventan direcciones ni se completa
el municipio de domicilios históricos.

Departamento y municipio se presentan como combobox accesibles: permiten abrir
la lista o escribir para filtrar sin distinguir mayúsculas ni acentos. Al elegir
departamento se limpia cualquier municipio anterior y solo se ofrecen municipios
pertenecientes a ese departamento. Se prueba teclado, foco, texto sin coincidencias
y cambios sucesivos de departamento.

### Clientes y proveedores

- **Clientes:** el módulo Clientes queda solo para consulta y búsqueda. No muestra
  alta, edición, activación ni desactivación. Los clientes nuevos se registran
  desde Nueva venta; seleccionar uno existente rellena sus datos en modo de solo
  lectura y no lo modifica. Los clientes nuevos quedan activos. Los estados
  históricos se preservan, pero ninguna operación nueva permite desactivar un
  cliente.
- **Proveedores:** el módulo Proveedores queda para consulta y búsqueda, con la
  única mutación permitida de desactivar o reactivar. No permite crear ni editar.
  Un proveedor nuevo se registra dentro de Compras. Seleccionar uno existente
  rellena sus datos sin modificarlos. Un proveedor inactivo se conserva y no puede
  usarse en una compra nueva hasta reactivarlo.
- La creación contextual debe reutilizar los servicios y validaciones de dominio,
  no duplicar reglas en el controlador. Un fallo al guardar la compra o venta no
  puede producir una transacción parcial; se conserva la idempotencia actual.
- Dueña mantiene Compras y Proveedores. Colaborador mantiene Nueva venta y la
  consulta de Clientes necesaria para vender, sin recibir costos, proveedores o
  compras.

### Catálogo y productos

1. Ningún catálogo admite nombres vacíos o compuestos solo por espacios. Los
   valores históricos nulos se conservan como historia y se muestran con una
   etiqueta explícita; no se convierten silenciosamente en `Sin detalle`.
2. Las únicas tallas disponibles para productos nuevos son `S`, `M`, `L`, `XL` y
   `XXL`. Se cargan idempotentemente, no se pueden editar ni eliminar y se retira
   la pestaña de administración de tallas. Tallas históricas distintas permanecen
   visibles en sus productos y operaciones, pero no se ofrecen en altas nuevas.
3. El formulario de producto usa rótulos y ayuda breve para explicar nombre,
   categoría, talla, costo, precio calculado, cantidad inicial y descripción. Se
   eliminan controles redundantes como la búsqueda separada de proveedor seguida
   por otra selección difícil de interpretar.
4. El producto conserva un costo principal positivo. El servidor calcula su
   precio de venta como `costo × 1.15`, `ROUND_HALF_UP`, con dos decimales.
5. Un proveedor puede ofrecer muchos productos y un producto puede ser ofrecido
   por varios proveedores. Cada relación conserva su propio costo de compra; la
   línea de compra copia ese costo como histórico. Cambiar una oferta no altera
   compras anteriores ni recalcula automáticamente el precio de venta del
   producto.
6. Para evitar dependencia circular, un producto puede crearse aún sin proveedor.
   Al seleccionar o crear proveedor en Compras se crea o reutiliza la relación con
   cada producto y su costo de compra. Productos muestra las relaciones existentes
   de forma legible, sin exponer la terminología técnica `oferta` como flujo
   separado al usuario.
7. El modelo histórico actual (`products.supplier_id`, `supplier_products` y
   `supplier_offerings`) se inventariará antes de migrar. La revisión nueva preserva
   asociaciones y costos existentes, elimina ambigüedades para escrituras nuevas y
   no borra columnas o filas con historia solo para simplificar la interfaz.

### Recibos

El número visible de recibo es decimal: `1`, `2`, `3`, etc., sin `R-` ni ceros a
la izquierda. La identidad puede contener saltos por rollback o fallo; no se
implementa un contador sin huecos. En una base vacía la primera identidad comienza
en 1. Se reutiliza la identidad persistida del pago/recibo como fuente del número,
sin mantener un segundo contador. Una base con recibos existentes no se renumera
ni reutiliza números.

El número de venta permanece separado para trazabilidad. Listado, búsqueda, modal,
impresión y PDF usan el mismo número de recibo. La búsqueda acepta el formato
decimal nuevo y mantiene compatibilidad de consulta con identificadores históricos
si existen.

### Retirada de caja y turnos

Se elimina por completo la dependencia operativa de caja y turnos:

- no hay apertura, cierre, saldo inicial, ingresos, retiros, conciliación ni
  diferencias;
- Dashboard y Nueva venta no muestran componentes de turno;
- una venta no requiere `shift_id` y una anulación no requiere turno abierto;
- efectivo, transferencia y mixto continúan siendo pagos completos y atómicos,
  con las reglas vigentes de referencia, confirmación, recibido y cambio;
- venta, pago y salida de stock continúan en una sola transacción, pero ya no crean
  movimientos de caja;
- se retiran rutas y permisos operativos de caja de los consumidores vivos.

Las tablas y filas históricas de caja no se borran. La migración conserva pagos,
movimientos, turnos, anulaciones y auditoría anteriores; adapta las restricciones
necesarias para operaciones nuevas sin turno. No se edita `0005` ni `0006`. El
retorno no puede descartar actividad posterior a la migración.

## Secuencia de implementación para Codex CLI

### 1. Caracterizar antes de cambiar

- Leer `AGENTS.md`, `README.codex-local.md`, este documento, reglas, autenticación,
  empleados, ventas, caja, compras, frontend, datos, migración, calidad y corte.
- Verificar `Cris-develop`, árbol y commits; preservar cualquier cambio ajeno.
- Localizar todos los consumidores de contraseña temporal, correo de empleado,
  ubicaciones, tallas, ofertas, numeración y caja.
- Agregar regresiones del comportamiento nuevo antes o junto a cada cambio. No
  convertir capturas del Word en datos de prueba.

### 2. Backend y migración

- Crear una revisión Alembic posterior a `0006_boutique_experience`; no modificar
  revisiones aplicadas. Usar un nombre descriptivo en inglés.
- Diseñar la migración con inventario previo, semillas idempotentes, protección de
  registros maestros, liberación de `must_change_password`, recibos sin renumerar y
  preservación de historia de caja y catálogos.
- Adaptar esquemas, servicios, repositorios, permisos y auditoría. Los servicios
  controlan las transacciones; no introducir commits en repositorios.
- Probar desde PostgreSQL vacío y desde el esquema anterior con datos sintéticos
  representativos. Verificar upgrade, downgrade seguro o bloqueo explícito, drift,
  identidades, constraints y concurrencia.

### 3. Frontend

- Simplificar Empleados, ubicaciones, directorios, Productos, Compras, Recibos,
  Dashboard y Nueva venta según las decisiones anteriores.
- Mantener TypeScript estricto, accesibilidad de combobox y contraseña, navegación
  por teclado, estados vacíos y diseño responsive en 1440×1000 y 390×844.
- No dejar botones, mensajes, rutas, tipos ni clientes HTTP muertos que presenten
  contraseña temporal, correo laboral, edición de cliente o caja como vigentes.

### 4. Verificación integral

- Backend: Ruff, formato, mypy, lock y Pytest completo con PostgreSQL aislado.
- Frontend: TypeScript, ESLint, Vitest, build, E2E interceptada y conectada.
- Casos mínimos: formato y rechazo de teléfono; contraseña de seis caracteres,
  visibilidad y permisos; 3 departamentos/28 municipios protegidos; combobox
  dependiente; directorios de consulta; altas contextuales; proveedor inactivo;
  cinco tallas; rechazo de vacíos; varios proveedores/costos; recibos con salto
  permitido; venta y anulación sin turno; ausencia de endpoints vivos de caja.
- Revisar visualmente todas las pantallas afectadas en escritorio y móvil, además
  del recibo HTML/PDF de 80 mm. Registrar solo resultados realmente ejecutados.

### 5. Desarrollo local y documentación

- Antes de migrar `hdboutique`, seguir `docs/cutover.md`: detener escritores,
  respaldo privado previo, restauración en base separada, ensayo y conciliación.
- La única carga maestra autorizada es la lista confirmada de departamentos,
  municipios y tallas. No crear empleados, clientes, proveedores, productos,
  compras o ventas ficticios en desarrollo.
- Aplicar la migración a desarrollo solo después de aprobar el ensayo. Crear y
  restaurar respaldo final, conciliar tablas/filas/identidades y conservar las
  evidencias ignoradas.
- Actualizar reglas, autenticación, empleados, caja, ventas, compras, módulos
  frontend, configuración inicial, arquitectura, datos, migración, calidad,
  resultados, corte, README, AGENTS y hoja de ruta con resultados reales.
- Dejar el runtime loopback saludable y hacer humo sin escrituras comerciales.

## Entrega y commits

Crear commits locales pequeños con rutas explícitas y Conventional Commits. Una
separación esperada es:

1. `feat(backend): simplify boutique operational rules`
2. `feat(frontend): streamline boutique workflows`
3. `docs: close usability simplification phase`

Antes de cada commit revisar `git diff --cached`, `git diff --cached --check` y
ausencia de secretos, respaldos, capturas o datos personales. No hacer push,
fetch, pull ni PR. Al cerrar, informar migración, conciliación, pruebas, revisión
visual, runtime, commits y cualquier límite real, y no comenzar otra fase.
