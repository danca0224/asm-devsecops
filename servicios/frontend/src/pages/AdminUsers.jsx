import { useState, useEffect } from 'react'
import { API } from '../api/auth'

export default function AdminUsers() {
  const [users, setUsers]     = useState([])
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' })
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')

  const loadUsers = () => API.get('/users/').then(r => setUsers(r.data))

  useEffect(() => { loadUsers() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setError(''); setSuccess('')
    try {
      await API.post('/users/', newUser)
      setSuccess('Usuario creado correctamente')
      setNewUser({ username: '', password: '', role: 'user' })
      loadUsers()
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al crear usuario')
    }
  }

  const handleDelete = async (id, username) => {
    if (!window.confirm(`¿Eliminar usuario "${username}"?`)) return
    try {
      await API.delete(`/users/${id}`)
      loadUsers()
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al eliminar')
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h1 className="text-2xl font-bold text-slate-900">⚙️ Gestión de Usuarios</h1>
      </div>

      {/* Crear usuario */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Crear nuevo usuario</h2>
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="text"
            placeholder="Usuario"
            value={newUser.username}
            onChange={e => setNewUser({ ...newUser, username: e.target.value })}
            required
            className="border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={newUser.password}
            onChange={e => setNewUser({ ...newUser, password: e.target.value })}
            required
            className="border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <select
            value={newUser.role}
            onChange={e => setNewUser({ ...newUser, role: e.target.value })}
            className="border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
          <button type="submit" className="bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 rounded-xl transition">
            Crear
          </button>
        </form>
        {error && <div className="mt-3 text-red-600 text-sm">{error}</div>}
        {success && <div className="mt-3 text-green-600 text-sm">{success}</div>}
      </div>

      {/* Lista de usuarios */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">Usuarios registrados</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-600 text-left">
              <th className="px-6 py-3">ID</th>
              <th className="px-4 py-3">Usuario</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Activo</th>
              <th className="px-4 py-3">Creado</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={u.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                <td className="px-6 py-3 text-slate-400">{u.id}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{u.username}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${u.role === 'admin' ? 'bg-brand-100 text-brand-800' : 'bg-slate-100 text-slate-700'}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3">{u.is_active ? '✅' : '❌'}</td>
                <td className="px-4 py-3 text-slate-400 text-xs">{new Date(u.created_at).toLocaleDateString('es-CO')}</td>
                <td className="px-4 py-3">
                  {u.username !== 'admin' && (
                    <button
                      onClick={() => handleDelete(u.id, u.username)}
                      className="text-xs text-red-600 hover:text-red-800 font-medium"
                    >
                      Eliminar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
