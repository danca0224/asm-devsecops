import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { API } from '../api/auth'

const FLAG_LABELS = {
  flag_subdominios_huerfanos:     'Subdominios huérfanos',
  flag_carencia_spf_dkim_dmarc:   'Sin SPF/DKIM/DMARC',
  flag_software_expuesto:          'Software expuesto',
  flag_exposicion_puertos_admin:   'Puertos admin expuestos',
  flag_headers_esenciales:         'Cabeceras HTTP ausentes',
  flag_cert_ssl_invalido:          'Certificado SSL inválido',
  flag_tls_obsoleto:               'TLS obsoleto',
  flag_cifrados_debiles:           'Cifrados débiles',
}

export default function Consolidated() {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    API.get('/consolidated/')
      .then(r => setData(r.data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-center py-20 text-slate-400">Cargando datos consolidados...</div>

  const entities = data?.entities || []

  // Datos para gráfica de hallazgos globales
  const flagTotals = {}
  entities.forEach(e => {
    Object.entries(e.flags || {}).forEach(([k, v]) => {
      flagTotals[k] = (flagTotals[k] || 0) + v
    })
  })
  const chartData = Object.entries(flagTotals)
    .map(([k, v]) => ({ name: FLAG_LABELS[k] || k, value: v }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value)

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h1 className="text-2xl font-bold text-slate-900">Vista Consolidada</h1>
        <p className="text-slate-500 text-sm mt-1">
          Análisis agregado de {entities.length} entidad(es) escaneada(s).
          {data?.last_updated && (
            <span className="ml-2 text-xs text-slate-400">
              Actualizado: {new Date(data.last_updated).toLocaleString('es-CO')}
            </span>
          )}
        </p>
      </div>

      {/* Métricas globales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Entidades', value: entities.length },
          { label: 'Total activos', value: entities.reduce((s, e) => s + (e.total_assets || 0), 0) },
          { label: 'Activos activos', value: entities.reduce((s, e) => s + (e.active_assets || 0), 0) },
          { label: 'Hallazgos totales', value: Object.values(flagTotals).reduce((s, v) => s + v, 0) },
        ].map(m => (
          <div key={m.label} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <p className="text-xs text-slate-500 uppercase tracking-wide">{m.label}</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Gráfica de hallazgos */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Hallazgos por categoría</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 180, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="name" width={175} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#2563eb" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabla de entidades */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">Detalle por entidad</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600 text-left">
                <th className="px-6 py-3 font-medium">Dominio</th>
                <th className="px-4 py-3 font-medium">Activos</th>
                <th className="px-4 py-3 font-medium">Activos</th>
                <th className="px-4 py-3 font-medium">Hallazgos</th>
                <th className="px-4 py-3 font-medium">Último escaneo</th>
              </tr>
            </thead>
            <tbody>
              {entities.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-400">
                    Sin datos consolidados. Ejecuta al menos un análisis para ver resultados aquí.
                  </td>
                </tr>
              ) : entities.map((e, i) => (
                <tr key={e.domain} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="px-6 py-3 font-medium text-slate-900">{e.domain}</td>
                  <td className="px-4 py-3 text-slate-600">{e.total_assets}</td>
                  <td className="px-4 py-3 text-slate-600">{e.active_assets}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">
                    {Object.values(e.flags || {}).reduce((s, v) => s + v, 0)}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {e.scan_date ? new Date(e.scan_date).toLocaleDateString('es-CO') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
