import { statusMaterialCor, statusMaterialLabel } from '../../utils/formatters'

export default function MaterialCard({ material }) {
  const estoqueBaixo = material.estoqueAtual <= material.estoqueMin && material.estoqueMin > 0

  return (
    <div className={`card transition-all hover:shadow-md ${estoqueBaixo ? 'border-red-200' : ''}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-brand-black text-sm leading-tight truncate">{material.nome}</p>
          <p className="text-xs text-brand-red font-mono mt-0.5">{material.codigo}</p>
        </div>
        <span className={`badge flex-shrink-0 ${statusMaterialCor(material.status)}`}>
          {statusMaterialLabel(material.status)}
        </span>
      </div>

      <div className="space-y-0.5 text-xs text-gray-500 mb-3">
        <p>{material.categoria} • {material.tipo}</p>
        {material.bitola && <p>Bitola: <span className="font-medium text-gray-700">{material.bitola}</span></p>}
        {material.metragem && <p>Comprimento: <span className="font-medium text-gray-700">{material.metragem}</span></p>}
        {material.status === 'em_evento' && material.eventoAtual && (
          <p className="text-yellow-600 font-medium truncate">📍 {material.eventoAtual}</p>
        )}
      </div>

      {material.estoqueMin > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-100 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${estoqueBaixo ? 'bg-brand-red' : 'bg-green-500'}`}
              style={{ width: `${Math.min(100, (material.estoqueAtual / material.estoqueMin) * 100)}%` }}
            />
          </div>
          <span className={`text-xs font-medium ${estoqueBaixo ? 'text-brand-red' : 'text-gray-500'}`}>
            {material.estoqueAtual}/{material.estoqueMin}
          </span>
          {estoqueBaixo && (
            <span className="text-brand-red" title="Estoque baixo">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </span>
          )}
        </div>
      )}
    </div>
  )
}
