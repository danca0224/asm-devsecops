import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'
import { API } from '../api/auth'

// ── Colores de severidad ─────────────────────────────────────
const SEV_COLOR = {
  Crítica:     '#8B0000',
  Alta:        '#D62828',
  Media:       '#F77F00',
  Baja:        '#FCBF49',
  Informativa: '#277DA1',
}

const SEV_BG = {
  Crítica:     'bg-red-950 text-white',
  Alta:        'bg-red-600 text-white',
  Media:       'bg-orange-500 text-white',
  Baja:        'bg-yellow-400 text-slate-900',
  Informativa: 'bg-blue-500 text-white',
}

const STATUS_COLORS = {
  pending:   'bg-yellow-100 text-yellow-800',
  running:   'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed:    'bg-red-100 text-red-800',
}
const STATUS_LABELS = {
  pending: 'Pendiente', running: 'En ejecución', completed: 'Completado', failed: 'Error'
}

const RIESGO_COLOR = {
  Crítico: '#8B0000', Alto: '#D62828', Medio: '#F77F00', Bajo: '#FCBF49'
}

const FLAG_LABELS = {
  flag_subdominios_huerfanos:      'Subdominio huérfano',
  flag_carencia_spf_dkim_dmarc:    'Sin SPF/DKIM/DMARC',
  flag_software_expuesto:           'Software expuesto',
  flag_exposicion_puertos_admin:    'Puerto admin expuesto',
  flag_headers_esenciales:          'Cabeceras HTTP ausentes',
  flag_cert_ssl_invalido:           'Certificado inválido',
  flag_tls_obsoleto:                'TLS obsoleto',
  flag_cifrados_debiles:            'Cifrados débiles',
}

// ── Componente: Badge de criticidad ─────────────────────────
function CriticidadBadge({ nivel, score }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`text-xl font-bold px-5 py-2 rounded-2xl ${SEV_BG[nivel] || 'bg-slate-200 text-slate-800'}`}>
        {nivel}
      </span>
      <span className="text-slate-500 text-sm">Score: <b className="text-slate-800">{score}</b></span>
    </div>
  )
}

// ── Componente: Tarjeta de métrica ───────────────────────────
function MetricCard({ label, value, color = 'text-slate-900' }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

// ── Componente: Tabla de hallazgos ───────────────────────────
function HallazgosTable({ hallazgos }) {
  if (!hallazgos?.length)
    return <p className="text-slate-400 text-sm">No se detectaron vulnerabilidades significativas.</p>

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-900 text-white text-left">
            <th className="px-5 py-3 font-medium">Categoría</th>
            <th className="px-4 py-3 font-medium text-center">Afectados</th>
            <th className="px-4 py-3 font-medium">Severidad</th>
          </tr>
        </thead>
        <tbody>
          {hallazgos.map((h, i) => (
            <tr key={h.categoria} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
              <td className="px-5 py-3 font-medium text-slate-800">{h.categoria}</td>
              <td className="px-4 py-3 text-center font-bold text-slate-900">{h.cantidad}</td>
              <td className="px-4 py-3">
                <span
                  className="px-2.5 py-0.5 rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: SEV_COLOR[h.severidad] || '#64748b' }}
                >
                  {h.severidad}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Componente: Gráfica de hallazgos ────────────────────────
function HallazgosChart({ hallazgos }) {
  if (!hallazgos?.length) return null
  const data = hallazgos.map(h => ({ name: h.categoria.split(' ').slice(0, 3).join(' '), value: h.cantidad, color: h.color }))

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ left: 10, right: 30 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" allowDecimals={false} />
        <YAxis type="category" dataKey="name" width={190} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Componente: Gráfica de puertos ───────────────────────────
function PuertosChart({ puertos }) {
  if (!puertos?.length) return <p className="text-slate-400 text-sm">Sin puertos expuestos detectados.</p>
  const top = puertos.slice(0, 10)
  const data = top.map(p => ({ name: `${p.puerto} (${p.nombre})`, value: p.cantidad }))

  return (
    <div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 30 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" allowDecimals={false} />
          <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((entry, i) => {
              const p = top[i]
              return <Cell key={i} fill={RIESGO_COLOR[p.riesgo] || '#64748b'} />
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {/* Leyenda de riesgo */}
      <div className="flex gap-4 mt-3 flex-wrap">
        {Object.entries(RIESGO_COLOR).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: v }} />
            {k}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Componente: Gráfica de tecnologías ───────────────────────
function TecnologiasChart({ tecnologias }) {
  if (!tecnologias?.length) return <p className="text-slate-400 text-sm">Sin tecnologías identificadas.</p>
  const COLORS = ['#2563eb','#7c3aed','#db2777','#059669','#d97706','#dc2626','#0284c7','#65a30d']
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={tecnologias.slice(0, 8)}
          dataKey="cantidad"
          nameKey="tecnologia"
          cx="50%"
          cy="50%"
          outerRadius={90}
          label={({ tecnologia, percent }) => `${tecnologia} (${(percent * 100).toFixed(0)}%)`}
          labelLine={false}
        >
          {tecnologias.slice(0, 8).map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v, n) => [v, n]} />
      </PieChart>
    </ResponsiveContainer>
  )
}

// ── Componente: Tabla de activos ─────────────────────────────
function ActivosTable({ activos }) {
  const [filtro, setFiltro] = useState('todos')
  const [busqueda, setBusqueda] = useState('')

  const filtrados = (activos || []).filter(a => {
    const matchFiltro = filtro === 'todos' ||
      (filtro === 'hallazgos' && a.tiene_hallazgos) ||
      (filtro === 'activos'   && a.estado?.toLowerCase() === 'activo') ||
      (filtro === 'huerfanos' && a.flags?.flag_subdominios_huerfanos)
    const matchBusqueda = !busqueda || a.subdominio?.toLowerCase().includes(busqueda.toLowerCase())
    return matchFiltro && matchBusqueda
  })

  const flagsActivos = (flags) => Object.entries(flags || {})
    .filter(([, v]) => v)
    .map(([k]) => FLAG_LABELS[k] || k)

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        {['todos','hallazgos','activos','huerfanos'].map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              filtro === f ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {f === 'todos' ? `Todos (${activos?.length || 0})` :
             f === 'hallazgos' ? `Con hallazgos (${(activos || []).filter(a => a.tiene_hallazgos).length})` :
             f === 'activos' ? `Activos (${(activos || []).filter(a => a.estado?.toLowerCase() === 'activo').length})` :
             `Huérfanos (${(activos || []).filter(a => a.flags?.flag_subdominios_huerfanos).length})`}
          </button>
        ))}
        <input
          type="text"
          placeholder="Buscar subdominio..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="ml-auto border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-800 text-white text-left">
              {['Subdominio','IP','Estado','Puertos','Certificado','Correo','TLS','Servidor','Hallazgos'].map(h => (
                <th key={h} className="px-3 py-2.5 font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-400">Sin resultados</td>
              </tr>
            ) : filtrados.map((a, i) => (
              <tr
                key={a.subdominio + i}
                className={`${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'} ${a.tiene_hallazgos ? 'border-l-2 border-red-400' : ''}`}
              >
                <td className="px-3 py-2 font-medium text-slate-800 max-w-[200px] truncate" title={a.subdominio}>
                  {a.subdominio}
                </td>
                <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{a.ip || '—'}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                    a.estado?.toLowerCase() === 'activo' ? 'bg-green-100 text-green-800' :
                    a.estado?.toLowerCase().includes('huér') ? 'bg-slate-200 text-slate-600' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {a.estado || '—'}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-600 max-w-[140px] truncate" title={a.puertos}>
                  {a.puertos || '—'}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {a.cert ? (
                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                      a.cert.toLowerCase().includes('válid') || a.cert.toLowerCase() === 'válido'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {a.cert}
                    </span>
                  ) : '—'}
                </td>
                <td className="px-3 py-2 text-slate-600 max-w-[120px] truncate" title={a.correo}>
                  {a.correo || '—'}
                </td>
                <td className="px-3 py-2 text-slate-600 max-w-[100px] truncate" title={a.tls}>
                  {a.tls || '—'}
                </td>
                <td className="px-3 py-2 text-slate-600 max-w-[120px] truncate" title={a.servidor}>
                  {a.servidor || '—'}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {flagsActivos(a.flags).map(label => (
                      <span key={label} className="px-1 py-0.5 bg-red-100 text-red-700 rounded text-xs whitespace-nowrap">
                        {label}
                      </span>
                    ))}
                    {!a.tiene_hallazgos && (
                      <span className="text-green-600 text-xs">✓ Sin hallazgos</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400 text-right">Mostrando {filtrados.length} de {activos?.length || 0} activos</p>
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────
export default function ScanDetail() {
  const { id } = useParams()
  const [scan,      setScan]      = useState(null)
  const [results,   setResults]   = useState(null)
  const [reports,   setReports]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [resLoading,setResLoading]= useState(false)
  const [activeTab, setActiveTab] = useState('resumen')
  const [error,     setError]     = useState('')

  const handleDownload = async (reportId) => {
    try {
      const response = await API.get(`/reports/${id}/download/${reportId}`, {
        responseType: 'blob',
      })

      const blob = new Blob([response.data], {
        type: response.headers['content-type'] || 'application/octet-stream',
      })

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url

      const disposition = response.headers['content-disposition']
      let filename = `reporte_${reportId}`

      if (disposition) {
        const match = disposition.match(/filename="?([^"]+)"?/)
        if (match && match[1]) {
          filename = match[1]
        }
      }

      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError('No se pudo descargar el informe')
    }
  }

  // Cargar info del escaneo y reportes
  useEffect(() => {
    const load = async () => {
      try {
        const [scanRes, repRes] = await Promise.all([
          API.get(`/scans/${id}`),
          API.get(`/reports/${id}`).catch(() => ({ data: [] })),
        ])
        setScan(scanRes.data)
        setReports(repRes.data)
      } catch {
        setError('Error cargando el escaneo')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  // Cargar resultados cuando el escaneo esté completado
  useEffect(() => {
    if (scan?.status !== 'completed') return
    setResLoading(true)
    API.get(`/scans/${id}/results`)
      .then(r => setResults(r.data))
      .catch(() => setError('No se pudieron cargar los resultados del análisis'))
      .finally(() => setResLoading(false))
  }, [scan?.status, id])

  // Auto-refresh si está en ejecución
  useEffect(() => {
    if (!scan || scan.status === 'completed' || scan.status === 'failed') return
    const t = setInterval(() => {
      API.get(`/scans/${id}`).then(r => setScan(r.data))
    }, 8000)
    return () => clearInterval(t)
  }, [scan?.status, id])

  if (loading) return <div className="text-center py-20 text-slate-400">Cargando...</div>
  if (error && !scan) return <div className="text-center py-20 text-red-500">{error}</div>

  const TABS = [
    { key: 'resumen',     label: '📊 Resumen' },
    { key: 'puertos',     label: '🔌 Puertos' },
    { key: 'tecnologias', label: '⚙️ Tecnologías' },
    { key: 'activos',     label: `🖥️ Activos (${results?.activos?.length || 0})` },
    { key: 'informes',    label: '📄 Informes' },
  ]

  return (
    <div className="space-y-5">
      {/* Back */}
      <Link to="/" className="text-sm text-brand-600 hover:text-brand-700">← Volver al dashboard</Link>

      {/* Header del escaneo */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{scan?.domain}</h1>
            <p className="text-slate-400 text-sm mt-0.5">
              Escaneo #{scan?.id} — {scan?.created_at ? new Date(scan.created_at).toLocaleString('es-CO') : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${STATUS_COLORS[scan?.status] || ''}`}>
              {STATUS_LABELS[scan?.status] || scan?.status}
            </span>
            {results && <CriticidadBadge nivel={results.nivel} score={results.score} />}
          </div>
        </div>

        {scan?.status === 'running' && (
          <div className="mt-4 flex items-center gap-2 text-blue-700 text-sm">
            <span className="animate-spin">⏳</span> Análisis en ejecución — actualizando automáticamente...
          </div>
        )}
        {scan?.status === 'failed' && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm">
            ❌ Error: {scan.error_message}
          </div>
        )}
      </div>

      {/* Métricas rápidas */}
      {results && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard label="Total activos"   value={results.metricas.total_activos} />
          <MetricCard label="Activos expuestos" value={results.metricas.activos_expuestos} color="text-blue-700" />
          <MetricCard label="Huérfanos"       value={results.metricas.huerfanos}         color="text-slate-500" />
          <MetricCard label="Con puertos"     value={results.metricas.con_puertos}        color="text-orange-600" />
          <MetricCard label="Cert. inválidos" value={results.metricas.cert_invalidos}     color="text-red-600" />
          <MetricCard label="Correo inseguro" value={results.metricas.correo_inseguro}    color="text-red-700" />
        </div>
      )}

      {resLoading && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
          ⏳ Cargando resultados del análisis...
        </div>
      )}

      {/* Tabs de contenido */}
      {results && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          {/* Tab bar */}
          <div className="flex border-b border-slate-200 overflow-x-auto">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-5 py-3.5 text-sm font-medium whitespace-nowrap transition border-b-2 ${
                  activeTab === tab.key
                    ? 'border-brand-600 text-brand-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-6">

            {/* ── TAB: Resumen ─────────────────────────────── */}
            {activeTab === 'resumen' && (
              <div className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Tabla de hallazgos */}
                  <div>
                    <h3 className="text-base font-semibold text-slate-800 mb-3">Hallazgos por categoría</h3>
                    <HallazgosTable hallazgos={results.hallazgos} />
                  </div>
                  {/* Gráfica de hallazgos */}
                  <div>
                    <h3 className="text-base font-semibold text-slate-800 mb-3">Distribución visual</h3>
                    {results.hallazgos?.length > 0
                      ? <HallazgosChart hallazgos={results.hallazgos} />
                      : <p className="text-slate-400 text-sm">Sin hallazgos que graficar.</p>
                    }
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB: Puertos ─────────────────────────────── */}
            {activeTab === 'puertos' && (
              <div>
                <h3 className="text-base font-semibold text-slate-800 mb-4">Top puertos expuestos</h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <PuertosChart puertos={results.top_puertos} />
                  {/* Tabla detalle */}
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-800 text-white text-left">
                          <th className="px-4 py-2.5">Puerto</th>
                          <th className="px-4 py-2.5">Servicio</th>
                          <th className="px-4 py-2.5">Riesgo</th>
                          <th className="px-4 py-2.5 text-center">Activos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(results.top_puertos || []).map((p, i) => (
                          <tr key={p.puerto} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            <td className="px-4 py-2.5 font-mono font-bold text-slate-800">{p.puerto}</td>
                            <td className="px-4 py-2.5 text-slate-700">{p.nombre}</td>
                            <td className="px-4 py-2.5">
                              <span
                                className="px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                                style={{ backgroundColor: RIESGO_COLOR[p.riesgo] || '#64748b' }}
                              >
                                {p.riesgo}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-center font-semibold">{p.cantidad}</td>
                          </tr>
                        ))}
                        {!results.top_puertos?.length && (
                          <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Sin puertos expuestos</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB: Tecnologías ─────────────────────────── */}
            {activeTab === 'tecnologias' && (
              <div>
                <h3 className="text-base font-semibold text-slate-800 mb-4">Tecnologías detectadas (Software expuesto)</h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <TecnologiasChart tecnologias={results.top_tecnologias} />
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-800 text-white text-left">
                          <th className="px-4 py-2.5">Tecnología</th>
                          <th className="px-4 py-2.5 text-center">Activos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(results.top_tecnologias || []).map((t, i) => (
                          <tr key={t.tecnologia} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            <td className="px-4 py-2.5 text-slate-800">{t.tecnologia}</td>
                            <td className="px-4 py-2.5 text-center font-semibold">{t.cantidad}</td>
                          </tr>
                        ))}
                        {!results.top_tecnologias?.length && (
                          <tr><td colSpan={2} className="px-4 py-8 text-center text-slate-400">Sin tecnologías identificadas</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB: Activos ─────────────────────────────── */}
            {activeTab === 'activos' && (
              <div>
                <h3 className="text-base font-semibold text-slate-800 mb-4">
                  Detalle completo de activos analizados
                </h3>
                <ActivosTable activos={results.activos} />
              </div>
            )}

            {/* ── TAB: Informes ─────────────────────────────── */}
            {activeTab === 'informes' && (
              <div className="space-y-4">
                <h3 className="text-base font-semibold text-slate-800">Informes generados</h3>

                {reports.length === 0 ? (
                  <p className="text-slate-400 text-sm">No hay informes disponibles.</p>
                ) : (
                  <div className="space-y-3">
                    {reports.map(rep => (
                      <div
                        key={rep.id}
                        className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-4"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-800">
                            Informe #{rep.id}
                          </p>
                          <p className="text-xs text-slate-400">
                            {rep.created_at
                              ? new Date(rep.created_at).toLocaleString('es-CO')
                              : ''}
                          </p>
                        </div>

                        <div className="flex gap-3">
                         <button
                           onClick={() => handleDownload(rep.id)}
                           className="text-red-600 hover:text-red-700 text-sm font-medium"
                         >
                          📄 Descargar
                         </button>
                      </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}

      {/* Estado: sin resultados y no en error */}
      {!results && !resLoading && scan?.status === 'completed' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5 text-yellow-800 text-sm">
          ⚠️ El escaneo está completado pero los resultados no están disponibles todavía.
          Esto puede ocurrir si el CSV no fue generado correctamente por el script de análisis.
        </div>
      )}
    </div>
  )
}
