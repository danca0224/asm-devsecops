import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { API } from '../api/auth'

const STATUS_COLORS = {
  pending:   'bg-yellow-100 text-yellow-800',
  running:   'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed:    'bg-red-100 text-red-800',
}

const STATUS_LABELS = {
  pending: 'Pendiente', running: 'En ejecución', completed: 'Completado', failed: 'Error'
}

const PROGRESS_MAP = {
  pending: {
    step: 1,
    total: 3,
    percent: 33,
    label: 'Preparando análisis',
    badgeClass: 'bg-yellow-100 text-yellow-800',
    barClass: 'bg-yellow-500',
  },
  running: {
    step: 2,
    total: 3,
    percent: 66,
    label: 'Análisis de superficie',
    badgeClass: 'bg-blue-100 text-blue-800',
    barClass: 'bg-blue-600',
  },
  completed: {
    step: 3,
    total: 3,
    percent: 100,
    label: 'Informe generado',
    badgeClass: 'bg-green-100 text-green-800',
    barClass: 'bg-green-600',
  },
}

export default function Dashboard() {
  const [domain, setDomain]   = useState('')
  const [scans, setScans]     = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [submitting, setSubmitting] = useState(false)

  const activeScan = scans.find(scan => scan.status === 'pending' || scan.status === 'running')
  const activeProgress = activeScan ? PROGRESS_MAP[activeScan.status] : null

  const loadScans = async () => {
    setLoading(true)
    try {
      const res = await API.get('/scans/')
      setScans(res.data)
      setError('')  // 👈 limpia error si ya funciona
    } catch (err) {
      if (err.response?.status === 401) {
        // 👈 ignorar error de autenticación temporal
        return
      }
      setError('Error cargando escaneos')
    } finally {
      setLoading(false)
    }
   }

  useEffect(() => {
    loadScans()
    const interval = setInterval(loadScans, 10000)   // auto-refresh cada 10s
    return () => clearInterval(interval)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await API.post('/scans/', { domain: domain.trim() })
      setDomain('')
      await loadScans()
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al solicitar el escaneo')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex gap-2 mb-2">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">OSINT</span>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">Exposición Externa</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">🔎 Análisis Individual de Superficie de Ataque</h1>
        <p className="text-slate-500 text-sm mt-1">Ingresa un dominio para iniciar el análisis OSINT automatizado.</p>
      </div>

      {/* Formulario de análisis */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Nueva solicitud de análisis</h2>
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="text"
            value={domain}
            onChange={e => setDomain(e.target.value)}
            required
            placeholder="ejemplo.com"
            className="flex-1 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            type="submit"
            disabled={submitting}
            className="bg-brand-600 hover:bg-brand-700 text-white font-semibold px-6 py-2.5 rounded-xl transition disabled:opacity-60"
          >
            {submitting ? 'Enviando...' : 'Ejecutar análisis'}
          </button>
        </form>
        {error && (
          <div className="mt-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}
      </div>

      {activeScan && activeProgress && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">🔄 Escaneo en ejecución</h2>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${activeProgress.badgeClass}`}>
              {activeScan.status === 'pending' ? 'Pendiente' : 'En ejecución'}
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-sm text-slate-500">Dominio</p>
              <p className="text-base font-semibold text-slate-900">{activeScan.domain}</p>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Fase: {activeProgress.label}</span>
              <span className="font-medium text-slate-700">
                Progreso: {activeProgress.step} de {activeProgress.total}
              </span>
            </div>

            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
              <div
                className={`${activeProgress.barClass} h-3 rounded-full transition-all duration-500`}
                style={{ width: `${activeProgress.percent}%` }}
              />
            </div>

            <p className="text-xs text-slate-400">
              Actualización automática cada 10 segundos.
            </p>
          </div>
        </div>
      )}

      {/* Lista de escaneos */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Escaneos recientes</h2>
          <button onClick={loadScans} className="text-sm text-slate-500 hover:text-slate-700">
            ↻ Actualizar
          </button>
        </div>

        {loading && scans.length === 0 ? (
          <div className="p-10 text-center text-slate-400">Cargando...</div>
        ) : scans.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            No hay escaneos aún. Ingresa un dominio arriba para comenzar.
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {scans.map(scan => (
              <div key={scan.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition">
                <div>
                  <p className="font-medium text-slate-900">{scan.domain}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(scan.created_at).toLocaleString('es-CO')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[scan.status] || 'bg-slate-100 text-slate-600'}`}>
                    {STATUS_LABELS[scan.status] || scan.status}
                  </span>
                  {scan.status === 'completed' && (
                    <Link
                      to={`/scans/${scan.id}`}
                      className="text-sm text-brand-600 hover:text-brand-700 font-medium"
                    >
                      Ver informe →
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
