import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../api/auth'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
      navigate('/')
    } catch {
      setError('Credenciales incorrectas. Verifica usuario y contraseña.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🔎</div>
          <h1 className="text-2xl font-bold text-slate-900">ASM</h1>
          <p className="text-slate-500 text-sm mt-1">Attack Surface Manager</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Usuario</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoComplete="username"
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="admin"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="••••••••"
            />
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3 rounded-xl transition disabled:opacity-60"
          >
            {loading ? 'Autenticando...' : 'Iniciar sesión'}
          </button>
        </form>
      </div>
    </div>
  )
}
