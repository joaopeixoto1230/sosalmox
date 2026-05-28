export default function ItemCard({ material, selecionado, onAdicionar, onRemover }) {
  const disponivel = material.status === 'disponivel' && material.estoqueAtual > 0

  return (
    <div className={`
      card relative transition-all
      ${selecionado ? 'border-brand-red ring-2 ring-brand-red/20 shadow-md' : ''}
      ${!disponivel ? 'opacity-60' : 'hover:shadow-md hover:border-gray-200'}
    `}>
      {selecionado && (
        <div className="absolute top-2 right-2 w-5 h-5 bg-brand-red rounded-full flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      <div className="mb-3">
        <p className="font-bold text-brand-black text-sm leading-tight pr-6">{material.nome}</p>
        <p className="text-xs text-brand-red font-mono mt-0.5">{material.codigo}</p>
      </div>

      <div className="space-y-0.5 mb-3">
        {material.bitola && (
          <p className="text-xs text-gray-500">Bitola: <span className="font-medium text-gray-700">{material.bitola}</span></p>
        )}
        {material.metragem && (
          <p className="text-xs text-gray-500">Comprimento: <span className="font-medium text-gray-700">{material.metragem}</span></p>
        )}
        <p className="text-xs text-gray-500">Tipo: <span className="font-medium text-gray-700">{material.tipo}</span></p>
      </div>

      <div className="flex items-center justify-between">
        {material.status === 'disponivel' && material.estoqueAtual > 0 ? (
          <span className="badge bg-green-100 text-green-700">Disponível</span>
        ) : material.status === 'em_evento' ? (
          <span className="badge bg-yellow-100 text-yellow-700 truncate max-w-[120px]" title={`Em: ${material.eventoAtual}`}>
            Em evento
          </span>
        ) : (
          <span className="badge bg-red-100 text-red-700">Indisponível</span>
        )}

        {disponivel && (
          selecionado ? (
            <button
              onClick={onRemover}
              className="w-7 h-7 bg-brand-red rounded-lg text-white flex items-center justify-center hover:bg-brand-red-dark transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
              </svg>
            </button>
          ) : (
            <button
              onClick={onAdicionar}
              className="w-7 h-7 bg-gray-100 rounded-lg text-gray-600 flex items-center justify-center hover:bg-brand-red hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )
        )}
      </div>
    </div>
  )
}
