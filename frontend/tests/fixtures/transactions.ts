export const sale = { sale_id: 1, customer_id: 108, employee_id: 102, sale_date: '2026-10-28', total: '199.50', currency: 'NIO', status: 'confirmed',
  payment: { payment_id: 1, shift_id: 1, method: 'cash', amount: '199.50', received_amount: '200.00', change_amount: '0.50', reference: null }, annulment: null,
  items: [{ sale_item_id: 1, product_id: 109, quantity: 1, unit_price: '199.50', subtotal: '199.50' }] }
export const purchase = { purchase_id: 1, supplier_id: 106, employee_id: 102, purchase_date: '2026-10-28', total: '170.50', currency: 'NIO', status: 'registered',
  shipping_cost: '50.00', merchandise_total: '120.50', items: [{ purchase_item_id: 1, supplier_product_id: 201, product_id: 109, quantity: 1, unit_cost: '120.50', subtotal: '120.50' }] }
export function supplierRows(count = 1) { return Array.from({ length: count }, (_, index) => ({
  supplier_id: index + 106, company_name: `Empresa sintética ${index + 1}`, address_id: 103, contact_first_names: 'Contacto', contact_last_names: 'Sintético', phone_number: '0000000000', work_email: null,
})) }
export const shift = { shift_id: 1, register_code: 'main', employee_id: 102, opened_by_user_id: 1, opened_at: '2026-10-29T15:00:00Z', status: 'open', opening_amount: '1000.00',
  cash_collected: '0.00', transfers_collected: '0.00', cash_refunded: '0.00', transfers_refunded: '0.00', deposits: '0.00', withdrawals: '0.00', expected_amount: '1000.00',
  counted_amount: null, difference: null, closed_at: null, closed_by_user_id: null, closing_reason: null, movements: [] }
