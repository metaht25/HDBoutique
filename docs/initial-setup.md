# Preparación contextual de la boutique

## Primera instalación y recuperación de preparación incompleta (F06)

Después de aplicar Alembic explícitamente en el destino autorizado, el operador
prepara un JSON privado (fuera de Git) con `employee` y `boutique`. Debe contener
la identidad real de la Dueña, no un empleado elegido automáticamente. No incluir
usuario ni contraseña en ese archivo:

```json
{
  "employee": {
    "first_names": "Nombres reales",
    "last_names": "Apellidos reales",
    "phone_number": "80000000",
    "address": {
      "department_id": 1,
      "municipality_id": 1,
      "address_line": "Domicilio real confirmado"
    }
  },
  "boutique": {
    "name": "Nombre comercial confirmado",
    "address_line": "Dirección comercial confirmada",
    "phone_number": null
  }
}
```

El ejemplo es una plantilla: reemplazar teléfono/domicilio/nombres y verificar
los IDs de departamento/municipio; no cargarlo literalmente. El logo es opcional,
con las mismas validaciones de la API. Proteger la carpeta y no publicar el JSON.

Desde `backend/`, con el entorno del destino autorizado ya configurado:

```powershell
uv run --locked python -m app.modules.identity.cli bootstrap-admin --database NOMBRE_EXACTO --username USUARIO_REAL --setup-file RUTA_PRIVADA
uv run --locked python -m app.modules.identity.cli setup-status --database NOMBRE_EXACTO
```

La contraseña se solicita dos veces mediante entrada oculta, sin argumentos ni
logs. Se crea empleado activo, administrador vinculado y perfil comercial en una
sola transacción. Si falla algún paso, no queda una preparación parcial. No crea
una cuenta Cashier auxiliar ni ejecuta migraciones o semillas automáticamente.
Se niega si ya existen cuentas. `setup-status` no modifica datos y solo informa
si hay administrador que puede acceder/operar y perfil comercial completo.

Para una instalación antigua con administrador activo pero sin empleado:

```powershell
uv run --locked python -m app.modules.identity.cli complete-setup --database NOMBRE_EXACTO --username USUARIO_EXISTENTE --setup-file RUTA_PRIVADA
```

Se exige su contraseña actual, se conserva el hash y se revocan sus sesiones al
establecer el vínculo. Se niega a sustituir un vínculo existente. No ejecutar
estos comandos sobre la cuenta DEMO actual, ya vinculada.

Si la identidad real ya existe como empleado activo **sin cuenta asignada**,
`bootstrap-admin --employee-id ID_CONFIRMADO` permite seleccionarla explícitamente
en una instalación sin cuentas. Completar el perfil mediante `PUT
/api/v1/boutique-profile`, con sesión Administrator, Origin y CSRF válidos, y
consultar `setup-status`. Esa API conserva nombre, dirección, teléfono opcional,
logo opcional y las restricciones actuales; no se agrega una pantalla nueva.

## Preparación desde módulos operativos

La preparación se realiza desde los módulos operativos, sin Configuración en el
menú ni carga automática de datos comerciales:

1. El encabezado identifica a la Dueña, sin formulario de edición. El perfil existente
   permanece disponible para recibos; su API administrativa conserva permisos.
2. Productos administra categorías, costo principal y proveedores asociados; tallas
   S/M/L/XL/XXL son fijas. Alta inicial sin existencias y movimiento cero auditado.
3. Solo Empleados permite ampliar departamentos/municipios; los 3 departamentos y
   28 municipios iniciales son permanentes. Delivery sigue seleccionándolos.
4. Empleados crea personal/cuenta con cargo Vendedor fijo; Editar empleado conserva
   reemplazo de contraseña. No hay formulario separado de Cuentas y accesos.
   Compras/ventas requieren la cuenta real vinculada a un empleado activo.
5. Compras guarda proveedores; Proveedores consulta y activa/desactiva. Se elige el
   proveedor, productos asociados y cantidades, usando costos de Inventario.
   La recepción completa incorpora todas las existencias una sola vez.
6. Nueva venta registra clientes solo con nombre/apellido; Delivery completa
   teléfono/domicilio cuando corresponde, incluso para un cliente existente.
   Siempre pago completo y sin turno. Referencia opcional, confirmación obligatoria.

No se inventan referencias ni se afirma preparación completa por existir una fila.
Los estados vacíos indican qué falta. Cliente general se materializa únicamente
al confirmar una venta, con identidad técnica estable. No es una semilla comercial.

El logo se guarda como PNG saneado en PostgreSQL, incluido en pg_dump: entrada
raster PNG/JPEG/WebP de hasta 2 MB, máximo 3000 px por lado y 4 millones de píxeles,
reducida a 600 px. SVG, contenido inválido y rutas arbitrarias no se aceptan.
Un perfil con nombre y dirección está completo aunque no tenga teléfono ni logo.
Teléfono ausente se guarda como NULL y no reserva una línea en HTML, impresión ni PDF.
Sin perfil completo, el recibo indica preparación pendiente sin inventar datos.
Solo Dueña puede leer/editar el perfil; el recibo autorizado incluye los datos
necesarios para emitir el ticket.

[Interfaz](frontend-modules.md), [personal](employees.md),
[ventas y PDF](sales.md), [operación](cutover.md).
