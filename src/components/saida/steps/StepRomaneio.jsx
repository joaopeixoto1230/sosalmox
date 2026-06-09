import { formatarData } from '../../../utils/formatters'

export default function StepRomaneio({ evento, geradores, itens, observacoes, responsavel, onObservacoes, onResponsavel, onRemover, onAvancar, onVoltar }) {
  const codigosGeradores = geradores?.length > 0
    ? geradores.map(g => g.codigo).join(', ')
    : '—'

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-brand-black">Revisar Romaneio</h2>
        <p className="text-sm text-gray-500">Confira todos os itens antes de confirmar a saída.</p>
      </div>

      <div className="card bg-gray-50 border-gray-200">
        <h3 className="font-semibold text-sm text-gray-700 mb-3">Dados da Ordem</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-gray-500 text-xs">Evento</p>
            <p className="font-medium text-brand-black">{evento?.nome || '—'}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Data</p>
            <p className="font-medium text-brand-black">{formatarData(evento?.data)}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Local</p>
            <p className="font-medium text-brand-black">{evento?.local || '—'}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">
              {geradores?.length > 1 ? 'Geradores' : 'Gerador'}
            </p>
            <p className="font-medium text-brand-black">{codigosGeradores}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm text-gray-700">
            Itens ({itens.length})
          </h3>
        </div>
        <div className="space-y-2">
          {itens.map(item => (
            <div key={item.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-brand-black truncate">{item.nome}</p>
                <p className="text-xs text-brand-red font-mono">{item.codigo}</p>
              </div>
              <button
                onClick={() => onRemover(item.id)}
                className="p-1.5 rounded-lg hover:bg-red-50 hover:text-brand-red transition-colors text-gray-300 flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Responsável pela retirada *</label>
        <input
          value={responsavel}
          onChange={e => onResponsavel(e.target.value)}
          placeholder="Nome de quem está retirando o material..."
          className="input"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
        <textarea
          value={observacoes}
          onChange={e => onObservacoes(e.target.value)}
          placeholder="Observações sobre a saída (opcional)..."
          rows={3}
          className="input resize-none"
        />
      </div>

      <div className="flex gap-3">
        <button onClick={onVoltar} className="btn-secondary">
          ← Voltar
        </button>
        <button
          onClick={onAvancar}
          disabled={itens.length === 0 || !responsavel.trim()}
          className="btn-primary flex-1 justify-center disabled:opacity-50"
        >
          Confirmar Saída →
        </button>
      </div>
    </div>
  )
}
