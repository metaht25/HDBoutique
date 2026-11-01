export const navigation = [
  { path: '/dashboard', label: 'Dashboard', collaborator: 'Inicio' },
  { path: '/new-sale', label: 'Nueva venta', collaborator: 'Nueva venta' },
  { path: '/sales', label: 'Ventas' },
  { path: '/sales-history', label: 'Historial de ventas' },
  { path: '/receipts', label: 'Recibos', collaborator: 'Mis recibos' },
  { path: '/products', label: 'Productos / Inventario', collaborator: 'Productos' },
  { path: '/purchases', label: 'Compras' },
  { path: '/suppliers', label: 'Proveedores' },
  { path: '/customers', label: 'Clientes', collaborator: 'Clientes' },
  { path: '/employees', label: 'Empleados' },
] as const
export const collaboratorOrder = ['/dashboard', '/new-sale', '/products', '/customers', '/receipts']
