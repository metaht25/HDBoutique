import { lazy, Suspense } from 'react'
import { Link, Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import { MainLayout } from '../layouts/MainLayout'
import { LoadingState } from '../shared/ui/Feedback'
import { PageBoundary } from './PageBoundary'

const DashboardPage = lazy(() => import('../features/dashboard/DashboardPage'))
const ProductsPage = lazy(() => import('../features/products/ProductsPage'))
const CustomersPage = lazy(() => import('../features/customers/CustomersPage'))
const SalesPage = lazy(() => import('../features/sales/SalesPage'))
const PurchasesPage = lazy(() => import('../features/purchases/PurchasesPage'))
const SuppliersPage = lazy(() => import('../features/suppliers/SuppliersPage'))
const CashRegisterPage = lazy(() => import('../features/cash-register/CashRegisterPage.jsx'))
const ReportsPage = lazy(() => import('../features/reports/ReportsPage'))

export function App() {
  const location = useLocation()
  return <Routes>
    <Route element={<MainLayout />}>
      <Route index element={<Navigate to="/dashboard" replace />} />
      <Route element={<PageBoundary key={location.pathname}>
        <Suspense fallback={<LoadingState>Cargando pantalla…</LoadingState>}>
          <Outlet />
        </Suspense>
      </PageBoundary>}>
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="sales" element={<SalesPage />} />
        <Route path="purchases" element={<PurchasesPage />} />
        <Route path="suppliers" element={<SuppliersPage />} />
        <Route path="cash-register" element={<CashRegisterPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="*" element={<section><h2>Página no encontrada</h2>
          <p>La dirección solicitada no existe.</p><Link to="/dashboard">Ir al inicio</Link>
        </section>} />
      </Route>
    </Route>
  </Routes>
}
