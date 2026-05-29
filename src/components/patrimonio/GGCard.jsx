import { useNavigate } from 'react-router-dom'
import { statusGeradorLabel, statusGeradorCor, formatarData } from '../../utils/formatters'

export default function GGCard({ gg }) {
  const navigate = useNavigate()

  const diasParado = gg.ultimaAtividade ? (() => {
    const d = gg.ultimaAtividade?.toDate ? gg.ultimaAtividade.toDate() : new Date(gg.ultimaAtividade)
    return Math.floor((Date.now() - d.getTime()) / 86400000)
  })() : null

  const alertaParado = diasParado !== null && diasParado >= 15 && gg.status === 'disponivel'
  const alertaDefeito = gg.temDefeito && gg.status !== 'em_evento'

  return (
    <button
      onClick={() => navigate(`/geradores/${gg.id}`)}
      className={`w-full text-left card hover:shadow-md transition-all ${alertaDefeito ? 'border-red-300' : alertaParado ? 'border-yellow-300' : ''}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="font-bold text-brand-black">{gg.codigo}</p>
          <p className="text-xs text-gray-500">{gg.potencia} {gg.potencia ? '•' : ''} {gg.marca} {gg.modelo}</p>
        </div>
        <span className={`badge flex-shrink-0 ${statusGeradorCor(gg.status)}`}>
          {statusGeradorLabel(gg.status)}
        </span>
      </div>

      <p className="text-xs text-gray-600 truncate">{gg.localizacao || 'Pátio SOS'}</p>

      {gg.horimetroAtual > 0 && (
        <p className="text-xs text-gray-400 mt-1">{gg.horimetroAtual?.toLocaleString('pt-BR')}h</p>
      )}

      {(alertaParado || alertaDefeito) && (
        <div className={`mt-2 text-xs font-medium px-2 py-1 rounded-lg ${alertaDefeito ? 'bg-red-50 text-red-600' : 'bg-yellow-50 text-yellow-700'}`}>
          {alertaDefeito ? `⚠️ ${gg.defeito || 'Com defeito'}` : `⏱️ Parado há ${diasParado} dias`}
        </div>
      )}

      {gg.proximaPreventiva && (
        <p className="text-xs text-gray-400 mt-1.5">Preventiva: {formatarData(gg.proximaPreventiva)}</p>
      )}
    </button>
  )
}
