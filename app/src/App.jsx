import { useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { MicroSidebar } from './components/MicroSidebar'
import { Dashboard } from './pages/Dashboard'
import { Bills } from './pages/Bills'
import { BillDetail } from './pages/BillDetail'
import { Vendors } from './pages/Vendors'
import { VendorDetail } from './pages/VendorDetail'
import { VendorLedger } from './pages/VendorLedger'
import { Contracts } from './pages/Contracts'
import { Payments } from './pages/Payments'
import { Login } from './pages/Login'
import { Users } from './pages/Users'
import { Approvals } from './pages/Approvals'

function ProtectedRoute({ children }) {
  const { session, loading, profile } = useAuth()
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)', color: 'var(--text3)', fontSize: 13 }}>
      Loading…
    </div>
  )
  if (!session) return <Navigate to="/login" replace />
  if (profile && profile.is_active === false) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)', gap: 12 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--red)' }}>Account Deactivated</div>
      <div style={{ fontSize: 13, color: 'var(--text3)' }}>Contact your administrator.</div>
    </div>
  )
  return children
}

function LoginRoute() {
  const { session, loading } = useAuth()
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)', color: 'var(--text3)', fontSize: 13 }}>
      Loading…
    </div>
  )
  if (session) return <Navigate to="/" replace />
  return <Login />
}

function AnimatedRoutes() {
  const location = useLocation()
  const ref = useRef(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.classList.remove('page-enter')
      void ref.current.offsetWidth
      ref.current.classList.add('page-enter')
    }
  }, [location.pathname])

  return (
    <div ref={ref} className="page-enter" style={{ flex: 1 }}>
      <Routes location={location}>
        <Route path="/"             element={<Dashboard />} />
        <Route path="/bills"        element={<Bills />} />
        <Route path="/bills/:id"    element={<BillDetail />} />
        <Route path="/approvals"    element={<Approvals />} />
        <Route path="/vendors"      element={<Vendors />} />
        <Route path="/vendors/:id"  element={<VendorDetail />} />
        <Route path="/vendors/:id/ledger" element={<VendorLedger />} />
        <Route path="/contracts"    element={<Contracts />} />
        <Route path="/payments"     element={<Payments />} />
        <Route path="/users"        element={<Users />} />
      </Routes>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginRoute />} />
          <Route path="/*" element={
            <ProtectedRoute>
              <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
                <MicroSidebar />
                <main style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
                  <AnimatedRoutes />
                </main>
              </div>
            </ProtectedRoute>
          } />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
