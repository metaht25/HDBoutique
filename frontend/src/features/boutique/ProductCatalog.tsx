import { Icon } from '../../shared/ui/Icon'
import { money, statusLabels } from './api'
import type { Product } from './contracts'
import ui from './Products.module.css'

export function ProductCatalog({ rows, owner, onEdit, onToggle }: { rows: Product[]; owner: boolean; onEdit: (row: Product) => void; onToggle: (row: Product) => void }) {
  return <div className={ui.catalog} role="region" aria-label="Listado de productos" tabIndex={0}>
    <table><caption className={ui.srOnly}>Productos, precios y disponibilidad{owner ? ', costos y proveedores' : ''}</caption>
      <thead><tr><th scope="col">Producto</th><th scope="col">Categoría</th><th scope="col">Talla</th>{owner && <th scope="col">Proveedor</th>}<th scope="col">Precio de venta</th>{owner && <th scope="col">Costo</th>}<th scope="col">Stock</th><th scope="col">Estado</th>{owner && <th scope="col">Acciones</th>}</tr></thead>
      <tbody>{rows.map(row => <tr key={row.product_id}>
        <td className={ui.identity}><div className={ui.productName}><span className={ui.productIcon}><Icon name="products" size={18} /></span><div><strong>{row.name ?? 'Sin nombre'}</strong><small>#{String(row.product_id).padStart(3, '0')}{!row.is_active && <span className={ui.inactive}>Inactivo</span>}</small></div></div></td>
        <td data-label="Categoría">{row.category_name ?? 'Sin categoría'}</td><td data-label="Talla"><span className={ui.size}>{row.size_name}</span></td>
        {owner && <td className={ui.suppliers} data-label="Proveedor">{row.suppliers?.length ? <ul>{row.suppliers.map((name, index) => <li key={`${index}-${name}`}>{name}</li>)}</ul> : row.supplier_name ?? <span className={ui.muted}>Sin proveedores registrados</span>}</td>}
        <td data-label="Precio de venta" className={ui.price}>{money(row.unit_price)}</td>{owner && <td data-label="Costo" className={ui.cost}>{money(row.cost)}</td>}
        <td data-label="Stock"><span className={ui.quantity} data-unknown={row.legacy_stock === null}>{row.legacy_stock ?? 'Pendiente'}</span>{row.legacy_stock !== null && <small className={ui.units}>unidades</small>}</td>
        <td data-label="Estado"><span className={ui.stockBadge} data-status={row.status}><span aria-hidden="true" />{row.status === 'available' ? 'Suficiente' : statusLabels[row.status] ?? row.status}</span></td>
        {owner && <td className={ui.rowActions} data-label="Acciones"><button type="button" className="secondary" onClick={() => onEdit(row)}>Editar</button><button type="button" className="secondary" onClick={() => onToggle(row)}>{row.is_active ? 'Desactivar' : 'Activar'}</button></td>}
      </tr>)}</tbody>
    </table>
  </div>
}
