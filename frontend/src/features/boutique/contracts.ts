import type { Payment } from '../cash-register/api'

export interface Context { business_date: string; timezone: string }
export interface Page<T> { context: Context; summary: Record<string, number | string | null>; items: T[]; offset: number; limit: number }
export interface Product { suppliers?: string[];
  product_id: number; name: string | null; category_id: number; category_name: string | null;
  size_id: number; size_name: string; unit_price: string | null; legacy_stock: number | null;
  status: string; is_active: boolean; description: string | null;
  cost?: string | null; supplier_id?: number | null; supplier_name?: string | null;
}
export interface Address { address_id: number | null; address_line: string | null; department_id: number | null; department_name: string | null; municipality_id: number | null; municipality_name: string | null }
export interface Customer extends Address { customer_id: number; first_names: string; last_names: string; phone_number: string | null; kind: string | null; is_active: boolean; created_at: string | null }
export interface Supplier extends Address { supplier_id: number; company_name: string; contact_first_names: string; contact_last_names: string; phone_number: string; work_email: string | null; is_active: boolean }
export interface Employee extends Address { employee_id: number; first_names: string; last_names: string; phone_number: string; job_title: string | null; start_date: string | null; end_date: string | null; is_active: boolean; username: string | null; user_id: number | null }
export interface SaleRow { sale_id: number; receipt_id: number | null; sale_date: string; created_at: string | null; customer_name: string; seller_name: string; units: number; products: string | null; method: string | null; total: string; status: string }
export interface Ledger extends Page<SaleRow> { methods: { method: string | null; total: string; count: number }[]; best_products: { product_id: number; name: string | null; quantity: number; total: string }[] }
export interface Overview { context: Context; summary: Page<never>['summary']; recent_sales: SaleRow[]; low_stock: Product[]; period: string }
export interface Sale {
  sale_id: number; customer_id: number; employee_id: number; sale_date: string; created_at: string | null;
  customer_kind: string | null; customer_name: string | null; customer_phone: string | null; customer_address: string | null; seller_name: string | null;
  delivery_cost: string | null; notes: string | null; total: string; status: string | null;
  items: { sale_item_id: number; product_id: number; product_name: string | null; size_name: string | null; quantity: number; unit_price: string; subtotal: string }[];
  payment: Payment | null;
  annulment: { reason: string; amount: string; cash_amount: string | null; transfer_amount: string | null; reference: string | null } | null;
}
export interface Profile { name: string | null; phone_number: string | null; address_line: string | null; logo_base64: string | null; ready: boolean }
export interface Receipt { receipt_number: string; sale_number: string; boutique: Profile; sale: Sale }
export interface PurchaseRow { purchase_id: number; purchase_date: string; supplier_id: number; supplier_name: string; products: string | null; units: number | null; shipping_cost: string | null; total: string | null; status: string }
export interface Choice { id: number; label: string; department_id?: number }
