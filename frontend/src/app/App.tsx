import { lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import { Link, Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import { MainLayout } from '../layouts/MainLayout'
import { LoadingState, Message } from '../shared/ui/Feedback'
import { useSession } from '../features/session/sessionContext'
import { PageBoundary } from './PageBoundary'

const Dashboard = lazy(() => import('../features/boutique/Dashboard'))
const Products = lazy(() => import('../features/boutique/Products'))
const Directory = lazy(() => import('../features/boutique/Directory'))
const Checkout = lazy(() => import('../features/boutique/Checkout'))
const SalesLedger = lazy(() => import('../features/boutique/SalesLedger'))
const Purchases = lazy(() => import('../features/boutique/Purchases'))

function OwnerOnly({ children }: { children: ReactNode }) {
  return useSession().state.account?.role === 'Administrator' ? children : <Message>Esta pantalla está disponible únicamente para la dueña.</Message>
}
export function App() {
  const location = useLocation()
  return <Routes><Route element={<MainLayout />}>
    <Route index element={<Navigate to="/dashboard" replace />} />
    <Route element={<PageBoundary key={location.pathname}><Suspense fallback={<LoadingState>Cargando pantalla…</LoadingState>}><Outlet /></Suspense></PageBoundary>}>
      <Route path="dashboard" element={<Dashboard />} />
      <Route path="new-sale" element={<Checkout />} />
      <Route path="sales" element={<OwnerOnly><SalesLedger mode="sales" /></OwnerOnly>} />
      <Route path="sales-history" element={<OwnerOnly><SalesLedger mode="history" /></OwnerOnly>} />
      <Route path="receipts" element={<SalesLedger mode="receipts" />} />
      <Route path="products" element={<Products />} />
      <Route path="customers" element={<Directory key="customers" kind="customers" />} />
      <Route path="suppliers" element={<OwnerOnly><Directory key="suppliers" kind="suppliers" /></OwnerOnly>} />
      <Route path="employees" element={<OwnerOnly><Directory key="employees" kind="employees" /></OwnerOnly>} />
      <Route path="purchases" element={<OwnerOnly><Purchases /></OwnerOnly>} />
      <Route path="reports" element={<Navigate to="/sales" replace />} />
      <Route path="cash-register" element={<Navigate to="/dashboard" replace />} />
      <Route path="settings" element={<Navigate to="/employees" replace />} />
      <Route path="*" element={<section><h2>Página no encontrada</h2><p>La dirección solicitada no existe.</p><Link to="/dashboard">Ir al inicio</Link></section>} />
    </Route>
  </Route></Routes>
}
