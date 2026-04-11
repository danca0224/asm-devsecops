import { Outlet, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../api/auth'

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <nav className="bg-slate-900 text-white px-6 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-6">
          <Link to="/" className="text-lg font-bold tracking-tight">
            🔎 ASM
          </Link>
          <Link to="/" className="text-sm text-slate-300 hover:text-white transition">
            Análisis
          </Link>
          <Link to="/consolidated" className="text-sm text-slate-300 hover:text-white transition">
            Consolidado
          </Link>
          {user?.role === 'admin' && (
            <Link to="/admin/users" className="text-sm text-slate-300 hover:text-white transition">
              Usuarios
            </Link>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400">
            {user?.username}
            <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-brand-700 text-white">
              {user?.role}
            </span>
          </span>
          <button
            onClick={handleLogout}
            className="text-sm bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg transition"
          >
            Salir
          </button>
        </div>
      </nav>

      {/* Contenido */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        <Outlet />
      </main>

      <footer className="text-center text-xs text-slate-400 py-4">
        ASM — Attack Surface Manager v1.0.0 — MIT License
      </footer>
    </div>
  )
}
