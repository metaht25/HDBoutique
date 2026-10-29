export const sale = { sale_id: 1, customer_id: 108, employee_id: 102, sale_date: '2026-10-28', total: '199.50', currency: 'NIO', status: 'confirmed',
  items: [{ sale_item_id: 1, product_id: 109, quantity: 1, unit_price: '199.50', subtotal: '199.50' }] }
export const purchase = { purchase_id: 1, supplier_id: 106, employee_id: 102, purchase_date: '2026-10-28', total: '170.50', currency: 'NIO', status: 'registered',
  shipping_cost: '50.00', merchandise_total: '120.50', items: [{ purchase_item_id: 1, supplier_product_id: 201, product_id: 109, quantity: 1, unit_cost: '120.50', subtotal: '120.50' }] }
export function supplierRows(count = 1) { return Array.from({ length: count }, (_, index) => ({
  supplier_id: index + 106, company_name: `Empresa sintética ${index + 1}`, address_id: 103, contact_first_names: 'Contacto', contact_last_names: 'Sintético', phone_number: '0000000000', work_email: null,
})) }
