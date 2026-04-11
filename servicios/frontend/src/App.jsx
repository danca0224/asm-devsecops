import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './api/auth'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ScanDetail from './pages/ScanDetail'
import Consolidated from './pages/Consolidated'
import AdminUsers from './pages/AdminUsers'
import Layout from './components/Layout'

function PrivateRoute({ children }) {
  const { token } = useAuth()
  return token ? children : <Navigate to="/login" replace />
}

function AdminRoute({ children }) {
  const { user } = useAuth()
  return user?.role === 'admin' ? children : <Navigate to="/" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="scans/:id" element={<ScanDetail />} />
        <Route path="consolidated" element={<Consolidated />} />
        <Route path="admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
