import { useNavigate } from 'react-router-dom'
import { statusOsLabel, statusOsCor, formatarData } from '../../utils/formatters'

export default function OSCard({ os }) {
  const navigate = useNavigate()
  const atrasada = os.status !== 'concluida' && os.dataAbertura && (() => {
    const abertura = os.dataAbertura?.toDate ? os.dataAbertura.toDate() : new Date(os.dataAbertura)
    return (Date.now() - abertura.getTime()) > 2 * 86400000
  })()

  return (
    <button
      onClick={() => navigate(`/manutencao/${os.id}`)}
      className={`w-full text-left card hover:shadow-md transition-all ${os.prioridade === 'maxima' ? 'border-brand-red border-l-4' : ''}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-mono text-xs text-brand-red font-semibold">{os.numero}</p>
            {os.prioridade === 'maxima' && (
              <span className="text-xs bg-brand-red text-white px-1.5 py-0.5 rounded font-medium">URGENTE</span>
            )}
            {atrasada && (
              <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-medium">ATRASADA</span>
            )}
            {os.localTipo === 'locacao' ? (
              <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">LOCAÇÃO</span>
            ) : (
              <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">PÁTIO</span>
            )}
          </div>
          <p className="font-semibold text-brand-black text-sm mt-0.5">{os.equipamentoLabel}</p>
          {os.localTipo === 'locacao' && os.clienteNome && (
            <p className="text-xs text-amber-700 font-medium">🏢 {os.clienteNome}</p>
          )}
          <p className="text-xs text-gray-500">{os.descricao}</p>
        </div>
        <span className={`badge flex-shrink-0 ${statusOsCor(os.status)}`}>{statusOsLabel(os.status)}</span>
      </div>

      <div className="flex items-center gap-3 text-xs text-gray-500 mt-2">
        <span className={`badge ${os.tipo === 'preventiva' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'}`}>
          {os.tipo === 'preventiva' ? 'Preventiva' : 'Corretiva'}
        </span>
        <span>Abertura: {formatarData(os.dataAbertura)}</span>
        {os.mecanicoNome && <span>• {os.mecanicoNome}</span>}
      </div>
    </button>
  )
}
